# Neo4j Architecture & Optimization — Research Notes

> Goal: understand Neo4j's internals (storage, indexing, query execution), production pain points (memory, connection pooling), and where it shines — to inform how we run and optimize our graph workloads.
> Compiled Aug 2026. Sources at bottom.

---

## TL;DR

- **Native graph storage + index-free adjacency**: every node physically points to its relationships; traversal is pointer-chasing at O(1) per hop instead of O(log n) index lookups per join. This is THE architectural reason graph queries stay fast as data grows.
- **Storage**: fixed-size records in append-friendly store files (`nodestore` 15B/node, `relationshipstore` 34B, `propertystore` 41B). Enterprise `block` format co-locates a node's data in 128B blocks with dynamic/dense overflow stores backed by per-node B+trees.
- **Indexes**: two token lookup indexes exist by default (labels, relationship types — never delete them). Property indexes: range (general-purpose B-tree), text (CONTAINS/ENDS WITH, trigram), point (spatial), full-text (analyzers, relevance), vector (embeddings). Composite range indexes for multi-property predicates. Key size limits: ~8KB range / ~32KB text.
- **Query tuning**: read PROFILE plans bottom-up; watch DB hits (storage work) vs rows; hunt Eager operators (they buffer entire streams — memory bombs); manage cardinality early; bound variable-length paths + WITH DISTINCT for VarLengthExpand(Pruning); beware LIMIT after writes; use parameters so plans get cached.
- **Memory**: process footprint = heap + page cache + transaction state + Netty direct buffers + JVM overhead — heap+pagecache settings do NOT cap total usage. Rules: heap ≤16GB (GC pauses grow), page cache ≥ store size + growth + 10%, set initial=max heap.
- **Connections**: server-side Bolt thread pool (default max 400) limits concurrent *executing* transactions, NOT connections. Idle connections consume no server thread. Connection pooling is entirely client-side driver config (`MaxConnectionPoolSize`, `ConnectionAcquisitionTimeout`, `MaxConnectionLifetime`). "Unable to schedule bolt session" = thread pool exhaustion = too many concurrent transactions, not too many connections.

---

## 1. Storage architecture

### Record stores (classic format)

| Store file | Record size | Contents |
|---|---|---|
| neostore.nodestore.db | 15 B | Nodes |
| neostore.relationshipstore.db | 34 B | Relationships |
| neostore.propertystore.db | 41 B | Properties |
| .strings / .arrays | 128 B | Large string/array values |

Fixed-size records accessed by offset: `nodeId × recordSize`. Node records point to first property record, first relationship in its relationship chain, and label store. Relationships doubly-link prev/next per endpoint node — this IS the adjacency implementation.

### Block format (Enterprise default)

- `_block.x1.db`: 128B block per node (= nodeId × 128) containing two 64B records (node-data: labels+properties; relationship-data). Typically fits ~10 labels, 6–7 props, ~5 relationships inline.
- `_block.node.xd.db`: dynamic records (×128B, max 8KB) when x1 overflows.
- `_block.relationship.xd.db`: dynamic relationship records (max 2047B).
- Dense store: multi-root generational B+tree per node, sorted by type+direction, for high-degree nodes ("dense nodes"). No upper limit.
- `_block.huge.db`: thousands-of-properties entities.
- Properties <~31B inline; larger spill to dynamic records (×64B, max 8KB, linked for bigger).

Why it matters: **data locality** — one 128B block read serves most of a node's data; fewer page faults than linked-list chasing.

### Transactions

- Full ACID; write-ahead log; checkpointing + log pruning.
- Default isolation: **read-committed**. Write locks auto-acquired at node/relationship level; manual locks escalate toward serializable. Deadlock detection built-in.
- Traversal results not protected from concurrent modification (non-repeatable reads possible).

## 2. Index-free adjacency

Each node directly references adjacent nodes via relationship records. Traversal = pointer dereference, O(1) per hop, regardless of total graph size. Non-native graph stores (relational joins, document lookups) pay O(log n) per hop via index lookups — which collapses at depth. Reverse-direction traversals are free (relationships store both endpoints); non-native systems need reverse-lookup indexes or brute force.

Corollary: **unindexed scans are the exception you should investigate**, since normal traversals never scan.

## 3. Indexing

Two token lookup indexes exist by default (node labels; relationship types). Deleting them → severe degradation (label predicates fall back to AllNodesScan).

| Index type | Solves | Notes |
|---|---|---|
| Range | equality, ranges, STARTS WITH, existence, ORDER BY (pre-sorted) | General-purpose B-tree; composite (multi-property) supported; ~8KB key limit |
| Text | CONTAINS, ENDS WITH (trigram-based) | Strings only, single property, ~32KB keys; needs type certainty (`IS :: STRING NOT NULL`) or property type constraint to be planner-eligible |
| Point | distance, bounding box | Spatial POINT values, single property |
| Full-text | relevance search w/ analyzers (language-aware, stop words, phrase queries, autocomplete) | Queried via procedures, not Cypher MATCH; results relevance-ordered |
| Vector | embedding similarity (kNN) | For semantic search / GraphRAG |
| Token lookup | label / relationship-type predicates | Default, do not drop |

Heuristics:
- Index properties used in complex multi-hop queries' starting points.
- At most ONE index used per query planner decision by default → composite index when properties always filtered together.
- ORDER BY can skip Sort by exploiting range-index order.
- Over-indexing slows writes (every index maintained on write).
- Property type constraints unlock text/point indexes when values may be null/mixed-type.

## 4. Query optimization

### Reading plans

- `EXPLAIN` = plan only (estimated rows); `PROFILE` = execute + actual rows, DB hits, memory, time. Read bottom-up; root is ProduceResults.
- **DB hits** = low-level storage operations (entity/property/index-entry reads). One row can cost many hits.
- EstimatedRows come from statistics without runtime feedback — treat as hints; compare against actual Rows.

### The big levers

1. **Filter early, return less** — select only needed properties/data.
2. **Cardinality management** — aggregate/reduce rows before expensive expands; COLLECT after OPTIONAL MATCH; pattern comprehensions.
3. **Variable-length paths** — always set upper bounds; `WITH DISTINCT` triggers VarLengthExpand(Pruning); even pruned expands enumerate all paths — on dense graphs use APOC path expanders.
4. **Eager operators** (aggregation, sorting, and writes touching read data) buffer entire upstream streams — memory spikes live here. Spot them in PROFILE.
5. **LIMIT after writes pitfall** — LIMIT is lazy; writes before an unreached LIMIT may not execute for all rows. Insert aggregation/Eager between write and LIMIT if all-row execution matters.
6. **Parameters > literals** — enables plan cache reuse; avoids replanning storms.
7. **CYPHER replan=force EXPLAIN ...** to schedule replanning of expensive-to-plan queries at low-load times.
8. Watch for **CartesianProduct** operator — usually a missing relationship pattern between two disconnected MATCH parts.

## 5. Memory configuration (the part that bites)

Process footprint = **heap + page cache + transaction state + direct buffers (Netty!) + JVM native** — setting heap and page cache does NOT cap total usage. The classic surprise: 4GB heap + 6GB page cache on a 12GB machine still OOM-crashes.

Regions:
- **Heap**: instantiated objects, query execution state. Set initial = max (avoids resize-triggered full GCs). Rule: ≤16GB even on huge machines (GC pause growth).
- **Page cache** (off-heap): caches store files + native indexes. Rule of thumb: store size + expected growth + 10%. More = fewer disk reads.
- **Transaction state**: on-heap by default; `dbms.memory.transaction.total.max` caps globally; per-db and per-transaction limits terminate runaway queries without killing the DBMS.
- **Direct memory**: Netty's byte buffers for network IO — grows under high concurrency; cap via `-XX:MaxDirectMemorySize` + `-Dio.netty.maxDirectMemory=0`.
- Lucene (full-text) indexes live off-heap unmanaged; native indexes live inside page cache (account for them).

Tools: `neo4j-admin server memory-recommendation`; NativeMemoryTracking=detail + `jcmd VM.native_memory summary.diff`.

## 6. Connections: server threads ≠ client connections

The most common production misconception:

- **Server side**: Bolt connector has a thread pool (`server.bolt.thread_pool_max_size`, default 400). A thread is assigned only while processing a message; idle connections hold NO thread. Pool exhaustion → "Unable to schedule bolt session … no available threads" = too many *concurrent executing transactions*.
- **Client side**: the driver's connection pool is what limits connections — `MaxConnectionPoolSize`, `MaxConnectionAcquisitionTimeout`, `MaxConnectionLifetime`. Server has no connection cap; idle connections are closed only by the driver.

Java driver example:
```java
Config.builder()
  .withMaxConnectionLifetime(30, TimeUnit.MINUTES)
  .withMaxConnectionPoolSize(50)
  .withConnectionAcquisitionTimeout(2, TimeUnit.MINUTES)
  .build();
```

Sizing: bolt thread pool ≈ max expected concurrent active transactions (+ headroom for connect/disconnect ops).

## 7. Use cases & the GraphRAG angle

Classic fits: fraud detection (pattern matching across relationships), recommendations (collaborative filtering via graph), knowledge graphs, identity/access graphs, supply chain, master data. 

2026 frontier: **hybrid retrieval inside Neo4j** — full-text (lexical) + vector (semantic) + structural (FastRP node embeddings) fused via Weighted Reciprocal Rank Fusion, then graph expansion for context → GraphRAG pipelines where the graph both finds and explains results. Directly relevant to LLM support agents grounded in knowledge graphs.

---

## Sources

- [Understanding data on disk (KB)](https://neo4j.com/developer/kb/understanding-data-on-disk/)
- [Store formats (Operations Manual)](https://neo4j.com/docs/operations-manual/current/database-internals/store-formats/)
- [Database internals — transactions](https://neo4j.com/docs/operations-manual/current/database-internals/)
- [Property Graph Behind the Scenes](https://support.neo4j.com/s/article/360059560813-Neo4j-Property-Graph-Behind-the-Scenes)
- [Native vs non-native graph technology](https://neo4j.com/blog/cypher-and-gql/native-vs-non-native-graph-technology/)
- [Query tuning (Cypher Manual)](https://neo4j.com/docs/cypher-manual/current/planning-and-tuning/query-tuning/)
- [Execution plans](https://neo4j.com/docs/cypher-manual/current/planning-and-tuning/execution-plans/) · [Operators in detail](https://neo4j.com/docs/cypher-manual/current/planning-and-tuning/operators/operators-detail/)
- [Cardinality KB](https://neo4j.com/developer/kb/understanding-cypher-cardinality/) · [GraphAcademy optimization workshop](https://graphacademy.neo4j.com/courses/workshop-optimization/3-query-optimization/2-profile-explain/)
- [Using indexes](https://neo4j.com/docs/cypher-manual/current/indexes/search-performance-indexes/using-indexes/) · [Index configuration](https://neo4j.com/docs/operations-manual/current/performance/index-configuration/) · [GraphAcademy indexes course](https://graphacademy.neo4j.com/courses/cypher-indexes-constraints/3-indexes/01-index-overview/)
- [Hybrid search with WRRF](https://neo4j.com/blog/developer/hybrid-search-in-neo4j-full-text-vectors-and-graph-topology-with-cypher/)
- [Memory configuration](https://neo4j.com/docs/operations-manual/current/performance/memory-configuration/) · [Understanding memory consumption (KB)](https://neo4j.com/developer/kb/understanding-memory-consumption/) · [Initial memory estimation (KB)](https://neo4j.com/developer/kb/how-to-estimate-initial-memory-configuration/)
- [Limiting Bolt threads vs connections (KB)](https://neo4j.com/developer/kb/limiting-bolt-threads-vs-connections/) · [Bolt thread pool config](https://neo4j.com/docs/operations-manual/current/performance/bolt-thread-pool-configuration/)
