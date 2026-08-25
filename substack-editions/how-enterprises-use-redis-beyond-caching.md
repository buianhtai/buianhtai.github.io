# How Enterprises Use Redis Beyond Caching

*Cache, ID generator, distributed lock — that's where most teams stop with Redis. The companies running it hardest use it as an in-memory data-structures server: rate limiters, leaderboards, message streams, probabilistic counters. Here are the patterns, when to reach for each, and where they bite.*

---

Ask most teams what Redis does and you'll hear the same trio: **cache**, **ID generator**, **distributed lock**. All true — and all three are just the shallow end.

The companies leaning on Redis hardest — gaming studios running live leaderboards, SaaS platforms metering millions of API calls, marketplaces answering "what's near me" millions of times a minute — treat it as something else entirely: an **in-memory data-structures server**. Each advanced use case is really just *a data structure plus an access pattern*, and once you see it that way, the pattern catalog becomes learnable.

> **KEY INSIGHT:** The mental model shift: stop asking "what can I cache?" and start asking "which of Redis's eight data structures matches my access pattern?" Sorted Set, Stream, HyperLogLog, Bitmap, Hash, List, Pub/Sub, Geospatial — each one is a production use case waiting to be recognized.

## Rate limiting: one shared counter to rule them all

The moment you run more than one app instance, local rate limiting stops meaning anything — each instance has its own counter, so your "100 requests per minute" quietly becomes 100-per-minute-per-pod. Every instance needs to agree on one number, checked on the hot path, in sub-millisecond time. That's exactly Redis's shape: a shared store returning allow/deny decisions behind keys scoped by user, IP, API key, or tenant.

Five algorithms cover essentially every requirement:

| Algorithm | Memory/client | Accuracy | Burst behavior | Best for |
| --- | --- | --- | --- | --- |
| Fixed window | 1 key | Approximate | 2× burst at boundaries | Simple API limits, login throttling |
| Sliding window log | O(n) entries | Exact | None | High-value APIs, audit trails |
| Sliding window counter | 2 keys | Near-exact | Smoothed boundaries | General-purpose APIs |
| Token bucket | 1 hash | Exact | Controlled bursts | Bursty traffic with average-rate caps |
| Leaky bucket | 1 hash | Exact | Strict drain, no bursts | Policing (reject) or shaping (delay) |

The trap that catches everyone: the naive implementation is `INCR` then `EXPIRE` as two separate commands. Between them, a crash leaves a key with no TTL — permanently blocking that client — and concurrent requests can read the same stale count and both pass the check. This is the same TOCTOU race from the idempotency-key world, and the fix is the same idea: **make read-decide-write atomic with a Lua script** (`EVAL`). Redis executes scripts atomically — no other command interleaves — and you get branching logic that `MULTI`/`EXEC` can't express, in a single round trip.

> 📈 **choosing a rate-limiting algorithm** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/how-enterprises-use-redis-beyond-caching/).

Two operational notes from production: in Redis Cluster, multi-key scripts need hash tags (`{user123}:w1`, `{user123}:w2`) so both keys land in the same slot; and use `redis.call('TIME')` inside the script rather than the app server's clock, eliminating drift between instances.

## Leaderboards: the sorted set doing SQL's O(N) job in O(log N)

Ranking is deceptively expensive in a relational database: "what rank is player X?" is an `ORDER BY` over the whole table — seconds at millions of rows — and caching doesn't help because scores change on every user action, so any TTL-based copy is instantly stale.

A Redis Sorted Set keeps itself ranked at all times:

- `ZINCRBY` updates a score atomically in place — no read-modify-write cycle, no cache invalidation.
- `ZREVRANK` returns a member's exact global rank; `ZRANGE ... REV LIMIT` serves top-N pages *and* "rank around me" neighborhoods in one command.
- Daily/weekly/monthly boards are just separate keys with `EXPIRE`; `ZUNIONSTORE` merges windows without application-side sorting.
- Scale reference from Redis's own use-case docs: millions of ranked members in roughly 500MB of RAM, with a companion Hash holding metadata so the set stays light.

This isn't a niche trick — mobile gaming company Scopely runs live game leaderboards on it, and the same structure powers trending-item feeds and priority queues.

## Messaging: Pub/Sub, Lists, and Streams are three different contracts

Redis ships three messaging primitives, and choosing wrong is the most common production mistake:

| Feature | Pub/Sub | Lists | Streams |
| --- | --- | --- | --- |
| Persistence | No — fire-and-forget | Yes | Yes — append-only log |
| Consumer groups | No | No | Yes |
| Replay history | No | No | Yes — read from any point |
| Acknowledgment | No | Manual | Built-in (XACK) |
| Delivery guarantee | At-most-once | At-most-once | At-least-once |
| Read effect | Broadcast | Destructive pop | Cursor moves, data stays |

Pub/Sub is for notifications where losing a message to a disconnected subscriber is fine. Lists are lightweight work queues — but the pop is destructive, so a consumer that crashes mid-job loses the item. **Streams** are the serious option: an append-only log where consumer groups deliver each message to exactly one consumer, track delivery in a Pending Entries List (PEL), and hold messages until explicitly acknowledged.

The lifecycle of a message tells you most of the design:

> 📈 **stream message lifecycle under a consumer group** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/how-enterprises-use-redis-beyond-caching/).

Crash recovery is where Streams earn their keep — orphaned messages get stolen by surviving workers instead of vanishing:

> 📈 **consumer crash and work stealing** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/how-enterprises-use-redis-beyond-caching/).

Four production rules from teams who've been burned:

1. **Start consumers in two phases** — drain your own PEL with ID `0`, then switch to `>` for new messages. Consumers that only ask for `>` leave zombie messages pending forever.
2. **Trim with `XTRIM MAXLEN ~ N`, never `XDEL`-after-ACK.** Streams live in Radix-tree macro-nodes; point deletes fragment memory like Swiss cheese while approximate trims free whole nodes cheaply.
3. **Watch the PEL size as your lag metric.** Growing PEL with healthy throughput means ACK failures or a processing bottleneck — not a delivery problem.
4. **Give blocking reads dedicated connections** with short BLOCK timeouts, or ten blocked consumers will starve every other operation sharing the pool.

Against Kafka: Streams keep data in RAM for hours-to-days versus Kafka's disk-based months, win on latency and operational simplicity (it's already your cache), and lose on native partitioning, automatic rebalancing, and long-retention replay. The working rule: Streams for inter-service events and active job queues when Redis is already in the stack; Kafka for event sourcing with months of retention or millions of events per second.

## Counting things at absurd ratios

Three structures turn analytics workloads that would melt a database into rounding errors:

- **Counters** — `INCR` on minute/hour/day keys with staggered TTLs, pipelined. Freshworks meters every API call into Freshdesk this way.
- **HyperLogLog** — unique visitor counts in ~12KB per set regardless of whether you saw a thousand uniques or a billion, at ~0.81% standard error. `PFADD`, `PFCOUNT`, `PFMERGE`.
- **Bitmaps** — one bit per user per day answers "was user X active?" and `BITCOUNT` gives DAU; AND-ing days produces retention cohorts in milliseconds.

Freshworks combines all three — HyperLogLog, bitmaps, and sets — as the frontend database for user analytics, with MySQL safely behind it.

## Sessions and geospatial: the quiet workhorses

**Session store** is the least glamorous and most widespread pattern: Hash/String plus TTL, billions of field-value pairs at sub-millisecond reads. It's also a proven monolith-extraction wedge — Freshworks' first microservice out of its Rails monolith was authentication, backed by Redis sessions.

**Geospatial** hides inside a Sorted Set: `GEOADD` encodes coordinates as 52-bit geohash integers, and `GEOSEARCH` answers nearest-N and radius queries. Groupon's engineering team published their production numbers: millions of geo queries per minute ("nearest deal", "deals within radius"), scaled by sharding keys across cluster nodes — with the caveat that query cost grows with radius, so keep keys small and partitioned.

## Distributed locks: the part you already do, made honest

You already use Redis locks, so here's the part worth knowing: the famous **Redlock controversy**. Redlock acquires a lock on five independent masters, majority wins — claiming fault-tolerant mutual exclusion. Martin Kleppmann's critique landed hard: the algorithm has no fencing tokens (a client paused past the TTL can still write after another client acquired), and its safety depends on timing assumptions — bounded delays, bounded pauses, sane clocks — that fail exactly when systems misbehave. antirez rebutted the analysis, but both agreed on the practical resolution, which is the part to internalize:

> 📈 **what kind of lock do you actually need?** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/how-enterprises-use-redis-beyond-caching/).

For efficiency locks — deduplicating cron jobs, avoiding double work — the single-instance recipe (`SET key uniqValue NX PX ttl` to acquire, Lua compare-and-delete to release, never a bare `DEL`) is genuinely fine. Just document that it's approximate. For correctness locks, Kleppmann's advice stands: use a consensus system, and have the storage layer enforce **fencing tokens** — a monotonic number that rises with every acquisition, rejecting writes carrying stale tokens. Even the official Redis docs now carry this disclaimer.

## When NOT to reach for Redis

The failure modes are consistent enough to list:

- **As a system of record.** RDB/AOF persistence is best-effort, not a CP guarantee. If losing it hurts more than rebuilding it, it belongs in a durable database.
- **Long-retention event history.** Months of replayable events is Kafka's job.
- **Hot keys and big values.** Redis is effectively single-threaded; one hot key or one multi-megabyte value throttles every other client.
- **Unbounded blocking commands** on shared connection pools — `KEYS`, huge `SMEMBERS`, infinite-BLOCK consumers.
- **Multi-key operations in Cluster mode** without hash tags — your Lua script will fail when keys scatter across slots.

## The pattern catalog

| Problem | Structure | Key commands | Watch out for |
|---|---|---|---|
| Shared rate limiting | String / Sorted Set / Hash + Lua | `INCR`, `EXPIRE`, `ZADD`, `EVAL` | TOCTOU without atomic script |
| Rankings, priorities | Sorted Set | `ZADD`, `ZINCRBY`, `ZRANGE`, `ZREVRANK` | Metadata bloats the set — side-hash it |
| Reliable event processing | Stream | `XADD`, `XREADGROUP`, `XACK`, `XAUTOCLAIM` | Zombie PEL entries; XDEL fragmentation |
| Live broadcast | Pub/Sub | `PUBLISH`, `SUBSCRIBE` | Offline subscribers miss everything |
| Unique counting | HyperLogLog | `PFADD`, `PFCOUNT`, `PFMERGE` | ~0.81% error — fine for analytics, not billing |
| Activity flags, DAU | Bitmap | `SETBIT`, `BITCOUNT` | Sparse user IDs waste space |
| Sessions | String/Hash + TTL | `SET EX`, `HSET` | None — this one's easy |
| Nearby search | Geospatial | `GEOADD`, `GEOSEARCH` | Cost grows with radius |
| Mutual exclusion | String + `SET NX` | `SET NX PX`, Lua release | Know efficiency-vs-correctness first |

> **REALITY CHECK:** The litmus test for every pattern above: Redis earns its place when the workload needs shared, fast, small-lived state — counters that expire, rankings that reorder, messages that acknowledge. The moment state must survive forever or stay perfectly consistent under partition, hand it to a durable database and let Redis do what it's brilliant at.

## Further reading

- [Kleppmann — How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [antirez — Is Redlock safe?](https://antirez.com/news/101)
- [Redis — Distributed locks with Redis](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/)
- [Redis — Build 5 rate limiters](https://redis.io/tutorials/howtos/ratelimiting/)
- [antirez — Streams consumer group patterns](https://redis.antirez.com/fundamental/streams-consumer-patterns.html)
- [Redis — Microservices interservice communication with Streams](https://redis.io/tutorials/howtos/solutions/microservices/interservice-communication/)
- [Redis — Industry use cases (Scopely, Freshworks, Inovonics)](https://redis.io/blog/5-industry-use-cases-for-redis-developers/)
- [Groupon Engineering — Scaling millions of geospatial queries per minute](https://medium.com/groupon-eng/scaling-millions-of-geospatial-queries-per-minute-using-redis-7c05bcf6b4db)
- [Redis — Leaderboard use case](https://redis.io/docs/latest/develop/use-cases/leaderboard/)

---

*Originally published with interactive diagrams at [buianhtai.dev](https://buianhtai.dev/en/blog/how-enterprises-use-redis-beyond-caching/)*
