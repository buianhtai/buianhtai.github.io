# Neo4j Deep-Dive: Storage, Indexes, and Query Optimization

*Most teams use Neo4j as a black box and tune by vibes. Underneath: fixed-size record stores, pointer-chasing adjacency, six index types with sharp edges, an execution planner with real traps, and a memory model that will OOM a 12GB machine you configured for 10GB. A field guide to all of it.*

---

If your platform stores entities and their relationships in Neo4j, you've probably felt the pattern: reads are blazing fast until suddenly they aren't; a query that ran in milliseconds starts timing out; the process OOMs even though you set heap and page cache correctly; or connections pile up and you're not sure whether to tune the server or the driver.

All four have precise explanations buried in Neo4j's internals. This deep-dive walks through them: how data physically lands on disk, why traversals are fundamentally different from joins, what each index type actually solves, how to read an execution plan like a pro, where the memory really goes, and the connection-pooling misconception that bites almost every team once.

## Storage: fixed-size records and pointer chains

Neo4j is a **native graph database**: both storage and processing are built for graphs end-to-end. On disk, everything lives in fixed-size record files accessed by offset arithmetic — node ID × record size:

| Store file | Record size | Contents |
| --- | --- | --- |
| nodestore | 15 B | Nodes — pointers to first property, first relationship, labels |
| relationshipstore | 34 B | Relationships — start/end nodes, type, prev/next pointers per endpoint |
| propertystore | 41 B | Key-value properties as linked lists per entity |
| strings / arrays | 128 B | Overflow for large string and array values |

A node record is deliberately lightweight: its job is to *point* — to its property chain and to the first relationship in its chain. Each relationship record references both endpoints plus its previous/next relationship at each endpoint. That doubly-linked per-node structure **is** the implementation of graph traversal.

Enterprise deployments default to the newer **block format**, which co-locates a node's data into 128-byte blocks (`blockId × 128`): typically ~10 labels, 6–7 properties, and ~5 relationships inline. Overflow spills to dynamic records, and high-degree nodes ("dense nodes") get a dedicated multi-root B+tree sorted by relationship type and direction. The win is locality: one block read serves most of a node's data instead of chasing linked lists across the file.

## Index-free adjacency: the reason graph queries stay fast

This is the concept the entire database is built around, so it deserves its own name:

> **KEY INSIGHT:** Index-free adjacency: every node directly references its adjacent nodes through relationship records. Traversing one hop is a pointer dereference — O(1), regardless of total graph size. Non-native stores pay an index lookup (O(log n)) per hop, which collapses at depth. Reverse-direction traversals are free too, because relationships store both endpoints.

The corollary surprises people: in a healthy graph database, **scanning all nodes is the anomaly**. Normal queries start from an indexed entry point and traverse. If your PROFILE plan shows `AllNodesScan`, that's not business-as-usual — it's a missing starting point.

## Indexing: six types, each with sharp edges

Two token lookup indexes exist by default (one mapping labels → nodes, one mapping relationship types → relationships). They're what makes `MATCH (p:Person)` fast at all — deleting them degrades every query in the database.

Everything else you create yourself:

| Type | Solves | Sharp edges |
| --- | --- | --- |
| Range | Equality, ranges, STARTS WITH, existence; ORDER BY can skip Sort (pre-sorted); composite (multi-property) supported | ~8KB key size limit; strings stored alphabetically so CONTAINS/ENDS WITH still scan |
| Text | CONTAINS and ENDS WITH via trigram indexing; up to ~32KB keys | Strings only, single property; planner needs type certainty — add IS :: STRING NOT NULL or a property type constraint or it won't be used |
| Point | distance() and bounding-box spatial predicates | POINT values only, single property; same type-certainty requirement as text |
| Full-text | Relevance-ranked search with language analyzers (stop words, word forms, phrase queries, autocomplete) | Queried via procedures, not MATCH; requires understanding analyzers |
| Vector | Embedding kNN similarity — semantic search, GraphRAG retrieval | Vectors must share embedding space for cross-index comparison |
| Token lookup | Label and relationship-type predicates | Default indexes — never drop them |

Three rules worth internalizing: **at most one index is chosen per planning decision**, so create composite range indexes when properties are always filtered together; **every index slows writes** (maintained on each write), so don't index everything; and **ORDER BY can become free** when the planner exploits a range index's pre-sorted order.

## Reading execution plans like a pro

`EXPLAIN` shows the plan without executing (estimated rows only). `PROFILE` executes and reports truth: actual rows, **DB hits** (low-level storage operations — the real work meter), per-operator peak memory, and time. Plans read bottom-up: leaf operators (seeks, scans) feed upward to the root `ProduceResults`.

The metrics that matter:

- **EstimatedRows vs Rows**: estimates come from statistics without runtime feedback — treat mismatches as hints about stale statistics or skewed data.
- **DB hits ≫ rows**: one matched row costing hundreds of hits means property-chain chasing or index scanning — often fixable with a better starting point.
- **Eager operators**: aggregation and sorting operators must buffer their entire input before emitting anything. An Eager sitting under a large expand is a memory bomb waiting for scale.

When a query is slow, walk this tree:

> 📈 **slow Cypher query — diagnosis path** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/neo4j-deep-dive-storage-indexes-query-optimization/).

Four classic traps the plans expose:

1. **LIMIT after writes is lazy.** LIMIT stops upstream processing once satisfied — writes before it may execute for fewer rows than you assumed. Insert an aggregation between write and LIMIT if all-row execution matters.
2. **Variable-length paths enumerate every path**, even pruned ones. Always set upper bounds and follow with DISTINCT; on dense graphs, reach for APOC path expanders.
3. **Literals defeat plan caching.** Parameters let Cypher reuse execution plans instead of reparsing.
4. **Schema changes invalidate plans** — dropping an index forces replanning of in-flight queries. Schedule disruptive schema work deliberately (`CYPHER replan=force EXPLAIN ...` pre-warms plans at low-traffic times).

## The memory model: where the bytes actually go

Here's the trap: set 4GB heap + 6GB page cache on a 12GB machine, and Neo4j can still crash with OOM. Heap and page cache are *limits on two components*, not a cap on the process:

| Region | What lives there | Control |
| --- | --- | --- |
| Heap |  | heap.initial_size = heap.max_size (identical values avoid resize full-GCs). Keep ≤16GB even on huge machines — GC pauses grow with heap. |
| Page cache |  | pagecache.size ≥ store size + expected growth + 10% |
| Transaction state |  | dbms.memory.transaction.total.max caps globally; per-db and per-tx limits terminate runaway queries safely |
| Direct buffers |  | -XX:MaxDirectMemorySize + -Dio.netty.maxDirectMemory=0 |
| JVM native |  | Reserve 1–2GB for OS + headroom; NativeMemoryTracking=detail + jcmd to audit |

Sizing sequence: pick heap first (workload-dependent, ≤16GB rule), then page cache (store + growth + 10%), then verify total fits physical RAM with headroom. `neo4j-admin server memory-recommendation` gives the starting split.

## Connections: the server-thread vs driver-pool misconception

This one bites almost every team exactly once. The error says *"Unable to schedule bolt session … no available threads"* and the instinct is "too many connections — raise the pool!" Wrong direction:

- **Server side**: the Bolt connector's thread pool (default max 400) limits how many transactions execute *concurrently*. Idle connections hold **zero threads** — a thread is assigned only while processing a message. Pool exhaustion means too many concurrent active transactions, period.
- **Client side**: connection pooling belongs entirely to the driver. The server has no connection cap; idle connections close only when the driver decides.

```java
Config config = Config.builder()
    .withMaxConnectionLifetime(30, TimeUnit.MINUTES)
    .withMaxConnectionPoolSize(50)          // client-side pool cap
    .withConnectionAcquisitionTimeout(2, TimeUnit.MINUTES)
    .build();
```

Sizing rule: bolt thread pool max ≈ maximum expected concurrent active transactions, plus small headroom for connect/disconnect bookkeeping. If you see thread-pool rejection errors, either reduce concurrent transaction load or raise `server.bolt.thread_pool_max_size` — adjusting driver pool sizes won't help.

## Where graphs shine — and the GraphRAG tie-in

The canonical wins: fraud detection (relationship-pattern matching), recommendations (collaborative signals through connections), knowledge graphs, identity/access graphs, supply chains. The 2026 frontier adds retrieval: hybrid search inside Neo4j fuses **full-text** (exact terms, error codes), **vector** (semantic similarity), and **structural** embeddings (FastRP — nodes with similar neighborhoods) via Weighted Reciprocal Rank Fusion, then expands results through the graph for context. That's the GraphRAG pipeline: retrieve by words, meaning, and structure — then return connected context that explains *why* a result matters.

> **REALITY CHECK:** The anti-pattern list, earned the hard way: unbounded variable-length paths on dense graphs; CartesianProducts from disconnected MATCH parts; Eager operators under large expands; literals instead of parameters; LIMIT trusting writes above it completed; dropping token lookup indexes; assuming heap+pagecache caps process memory; tuning server thread pools to fix client-side pool problems.

## Further reading

- [Understanding data on disk — Neo4j KB](https://neo4j.com/developer/kb/understanding-data-on-disk/)
- [Store formats — Operations Manual](https://neo4j.com/docs/operations-manual/current/database-internals/store-formats/)
- [Native vs non-native graph technology](https://neo4j.com/blog/cypher-and-gql/native-vs-non-native-graph-technology/)
- [Execution plans — Cypher Manual](https://neo4j.com/docs/cypher-manual/current/planning-and-tuning/execution-plans/)
- [Tuning Cypher queries by cardinality — KB](https://neo4j.com/developer/kb/understanding-cypher-cardinality/)
- [Using indexes — Cypher Manual](https://neo4j.com/docs/cypher-manual/current/indexes/search-performance-indexes/using-indexes/)
- [Hybrid search: full-text, vectors, and graph topology](https://neo4j.com/blog/developer/hybrid-search-in-neo4j-full-text-vectors-and-graph-topology-with-cypher/)
- [Memory configuration — Operations Manual](https://neo4j.com/docs/operations-manual/current/performance/memory-configuration/)
- [Understanding memory consumption — KB](https://neo4j.com/developer/kb/understanding-memory-consumption/)
- [Limiting Bolt threads vs connections — KB](https://neo4j.com/developer/kb/limiting-bolt-threads-vs-connections/)

---

*Originally published with interactive diagrams at [buianhtai.dev](https://buianhtai.dev/en/blog/neo4j-deep-dive-storage-indexes-query-optimization/)*
