# 09 — Scalability, Reliability, Recovery, and Operations

**Status:** Proposed design, not a record of implemented infrastructure.
**Scope:** Generic multi-tenant agent platform with interchangeable models, runtimes, tool connectors, trigger adapters, decision providers, internal subagents, and external jobs.
**Related:** [Overview](./README.md) · [Runtime/worker/events](./02-runtime-workers-and-events.md) · [External tools and jobs](./04-tool-registry-and-external-execution.md) · [Agent delegation](./05-agent-to-agent-orchestration.md) · [Plug-and-play adapters](./08-plugin-and-adapter-architecture.md)

## 1. Core reliability decision

> The **platform owns durability, scheduling, quotas, security, event delivery, and error semantics**. Adapters own provider-specific execution protocols. No single adapter is allowed to define the reliability guarantee of the public `AgentRun` API.

A plug-and-play adapter can fail, time out, rate-limit requests, restart, or be upgraded without invalidating the durable run record. **A failed provider is not automatically a failed platform**, provided the platform can report a typed failure or use an explicitly approved fallback. **A retry is not proof that the external effect happened only once.**

Scalability means:
- Admission and routing don't require a long-lived connection to a worker.
- Different workload types scale independently.
- A noisy agent, tenant, connector, or external provider cannot consume everyone else's execution capacity.
- The system degrades in controlled ways rather than building an unbounded queue or LLM bill.

Reliability means:
- Every accepted run has a durable identity and terminal or recoverable state.
- Model/tool/provider errors have bounded behavior.
- A worker restart does not silently erase run state, approvals or external job IDs.
- Client reconnect does not re-execute a run.
- Mutating external actions are idempotent when supported, otherwise reconciled.

## 2. Logical deployment architecture

~~~mermaid
flowchart TB
    CLIENT["Chat / API / Webhook"] --> EDGE["Load balancer + Auth + Rate limits"]
    EDGE --> API1["API replica A"]
    EDGE --> API2["API replica B"]
    API1 --> DB[("HA PostgreSQL / durable run state")]
    API2 --> DB
    API1 --> OUTBOX["Transactional outbox / durable queue"]
    API2 --> OUTBOX
    OUTBOX --> DISPATCH["Dispatcher / queue consumers"]
    DISPATCH --> Q1["Simple agent queue"]
    DISPATCH --> Q2["Deep agent queue"]
    DISPATCH --> Q3["External job queue"]
    Q1 --> W1["Stateless worker pool: simple"]
    Q2 --> W2["Stateless worker pool: deep"]
    Q3 --> W3["Job coordinator / runner adapters"]
    W1 --> GATE["Model & Tool Gateways: budgets, quotas, policy"]
    W2 --> GATE
    W3 --> JOBS["Isolated external runner pool"]
    W1 --> EV[("Durable run events + checkpoints")]
    W2 --> EV
    W3 --> EV
    EV --> LIVE["Pub/sub notifier (optional live fanout)"]
    LIVE --> API1
    LIVE --> API2
    EV --> API1
    EV --> API2
    API1 --> CLIENT
    API2 --> CLIENT
~~~

**The diagram is logical, not a service-count mandate.** For an MVP, API + worker + PostgreSQL with an outbox or DB-backed queue is a valid starting point. Introduce independent queue brokers, object storage, pub/sub and dedicated worker deployments only when workload measurements justify them.

### Component scaling and state

| Component | Stateless / stateful | Scale-out approach | Correctness dependency |
| --- | --- | --- | --- |
| API / ingress | Stateless | Replica count from RPS, CPU and open SSE connections | Auth, idempotency, DB admission |
| Router / decision | Usually stateless | Batch embeddings, cache eligible metadata, rate-limit inference | Always policy-filter candidate set |
| Agent registry | State in DB | Read replica/caches only for read-heavy paths | Writes and run admission read authoritative published version |
| Run admission | Transactional | Multiple API replicas, compare-and-swap run states | Atomic run + enqueue intent |
| Work queue | Durable state | Partition/scale consumers, monitor lag | At-least-once delivery, visibility timeout or leases |
| Simple worker | Mostly stateless | Horizontally replicated, capped concurrency | Pinned config, lease/fencing and durable checkpoints |
| Deep worker | Mostly stateless, larger runtime footprint | Separate pool, smaller per-worker concurrency | Fanout/depth and resource budget |
| Model gateway | Stateless front, quota state shared | Replicas + provider-aware limits | Avoid oversubscribing provider TPM/RPM |
| Tool/connector adapter | Varies | Pool per connector/tenant or remote RPC | Auth, retries, idempotent side effects |
| Job runner | Isolated long-running | Separate job pool, per-operation quotas | Remote job IDs, status reconciliation |
| SSE/event service | API replicas + event DB | Durable replay + optional pub/sub for notifications | Sequence ordering and scoped subscription |
| PostgreSQL | Stateful | HA/failover, replicas for safe read paths, partition old events | Source of truth for runs, approvals, policy references |

**Never keep authoritative run/session state only in worker RAM or an SSE connection.**

## 3. Run admission and queue delivery

### Durable accept/dispatch protocol

~~~mermaid
sequenceDiagram
    participant C as Client
    participant API as API Replica
    participant DB as Run DB
    participant O as Outbox / Queue
    participant W as Worker
    participant E as Event Store

    C->>API: POST /runs (Idempotency-Key)
    API->>DB: Transaction: authenticate + create AgentRun
    API->>DB: Pin manifest digest, quotas, input ref
    API->>DB: Insert outbox dispatch record
    DB-->>API: COMMIT
    API-->>C: 202 Accepted {runId, eventsUrl}
    DB->>O: Dispatcher publishes at least once
    O->>W: Deliver runId
    W->>DB: Claim run lease with fencing token
    W->>DB: Verify pin + policy, mark RUNNING
    W->>E: Append run.started
    W->>DB: Heartbeat and persist checkpoint refs
    W->>E: Append normalized progress events
    W->>DB: Commit terminal status + result reference
    W->>E: Append run.completed / run.failed
    O->>O: Ack after durable state transition
~~~

**Guarantees to build and test:**

1. Use a DB transaction for `AgentRun`, immutable manifest/version reference, idempotency claim and outbox record. This prevents acknowledging a run without a dispatch intent.
2. Dispatch is **at least once**. Duplicate deliveries are normal and must not create multiple *logical* runs.
3. Worker claims the run using an atomic state transition, lease and **fencing token**. A stale worker must not be allowed to commit state after a new lease holder takes over.
4. A crashed worker can be requeued after lease expiry **only** with a safe checkpoint/outcome policy. It must not blindly reissue an external write.
5. Use a separate **retry scheduler** with attempt counters, exponential backoff plus jitter, error classification, and a dead-letter/reconciliation queue.
6. Queue and DB outages must fail admission clearly. Never return 202 before durable acceptance.
7. A completed or cancelled run's terminal state is immutable except for an explicit audited reconciliation state transition.

### Queue selection

**Alternative to a custom queue/lease orchestrator:** adopt a dedicated open-source durable execution engine such as **Hatchet** or an embedded engine such as **DBOS**. They should be integrated through a typed [WorkflowEngineAdapter](./10-open-source-durable-worker-engines.md), not conflated with a model RuntimeAdapter or external script JobExecutorAdapter. If such an engine owns step state and recovery, do **not** also build a competing internal step scheduler. Keep Platform AgentRun as the tenant-owned user-facing projection, audit and authorization boundary.

- **Small deployment:** PostgreSQL queue-like table plus transactional outbox. PostgreSQL `FOR UPDATE SKIP LOCKED` can reduce row-lock contention for queue consumers, but its inconsistent-view semantics make it unsuitable for general read queries.
- **Growing deployment:** move dispatch onto an established queue system appropriate to throughput and operational skills. Do not change public `AgentRun` contracts.
- **High durability requirement:** evaluate a dedicated durable workflow engine such as Temporal **rather than** building a sophisticated distributed scheduler/retry/approval engine from scratch. This is a separate platform decision; Temporal activities may still execute more than once, so external effects remain idempotency-sensitive.

**No hard dependency on Kafka, Redis, Kestra, Temporal, or Kubernetes should be embedded in the domain model.** Queue/WorkflowEngine adapters supply the relevant infrastructure contract. Kestra remains a useful orchestrator for external workflows/scripts, not an automatic replacement for agent session and run coordination.

## 4. Capacity planning and horizontal autoscaling

### Workload dimensions

Track separately:
- `arrival_rate` (requests/s) by tenant, agent, trigger and priority.
- `queue_wait`, `queue_depth`, oldest queued age, and processing duration.
- `model_calls_per_run`, tokens in/out, tool calls, checkpoint frequency and fanout.
- `worker_cpu`, memory per active run, open streams, external job concurrency.
- Provider-side requests-per-minute, tokens-per-minute and maximum simultaneous requests.
- Connector-specific rate limits, error rate, p95/p99 latency, and remote job quotas.

Approximate concurrency needed under steady conditions:

~~~text
in_flight_runs ≈ arrival_rate_runs_per_second × mean_active_run_seconds

worker_capacity ≈ replica_count × safe_parallel_runs_per_replica

provider_token_demand_per_minute ≈
  admitted_runs_per_minute × mean_tokens_per_run
~~~

These formulas are **starting estimates**, not a load-test result. Use measured service times and p95/p99 tails, especially when long agent loops or queue waiting make averages misleading. A provider token limit or remote tool rate limit may dominate worker CPU.

### Autoscaling strategy

| Pool | Primary scaling signal | Safety cap |
| --- | --- | --- |
| API replicas | RPS, open SSE sockets, event-loop lag, CPU | DB connection budget and max SSE subscribers |
| Simple workers | Queue age + active runs / worker + completion throughput | Model/provider quotas and per-tenant limits |
| Deep workers | Queue age, token throughput, memory pressure | Lower parallelism, budget, child-run fanout |
| External runner | Queued jobs, expected resource weight, available remote slots | CPU/memory quota, target system concurrency |
| Decision adapter | Request rate, p95 decision latency | Bounded inference quota; rules-first fallback |

Use **queue age (oldest item waiting)** alongside queue length: length alone can look fine while a costly tail request starves. Scale-out is only useful up to downstream limits; extra workers should not hammer a provider returning 429s.

For Kubernetes-based deployments, [KEDA ScaledObject](https://keda.sh/docs/2.20/reference/scaledobject-spec/) and [ScaledJob](https://keda.sh/docs/2.21/reference/scaledjob-spec/) illustrate event/queue-driven autoscaling. They're optional platform choices, not prerequisites.

**Admission/backpressure:**
- Implement bounded queues by workload and tenant.
- Apply tenant/agent quotas and provider-aware token-bucket limits **before** expensive execution; reserve approximate budgets, reconcile actual token use.
- Return explicit `429` for caller quota exhaustion and `503` (with retry guidance) for capacity unavailable; existing accepted runs stay trackable.
- Separate interactive vs scheduled/batch queues or priority bands; avoid indefinite starvation with aging and fair-share scheduling.
- Protect cheap read-only work from high-memory deep-agent workloads using distinct pools/bulkheads.

## 5. Multi-tenant isolation, quotas and noisy-neighbor defense

A configurable adapter platform has multiple failure domains: an individual agent, a tenant, a provider, a tool instance, and a remote runner.

**Partitioning model:**

~~~text
global capacity limit
  -> tenant/workspace allocation
      -> agent deployment concurrency
          -> per-run step/cost/fanout limit
      -> connector-instance rate and concurrency
      -> model-provider RPM/TPM quotas
      -> external-job operation pool quota
~~~

The effective limits are the **intersection** of inherited quotas and per-resource configuration. Child runs reserve budget from parents, never create unbounded extra capacity.

Reliability controls:

- **Bulkhead:** separate concurrency pools or semaphores per provider/connector/tenant so one hung adapter doesn't monopolize all workers.
- **Circuit breaker:** when provider errors/timeouts cross a reviewed threshold, reject or queue new calls temporarily; add half-open recovery probes. Never loop endless fallback attempts.
- **Timeout budget propagation:** a child or tool timeout must not exceed the parent run's remaining deadline.
- **Cost limit propagation:** every tool, model call, child agent and remote job counts toward parent + tenant budgets; record estimated vs final spend.
- **Version pinning:** published AgentVersion + ToolVersion + AdapterPackage/instance configuration digest locked for each run; connection revocation can **narrow** active permissions immediately.
- **Fair scheduling:** prioritize interactive requests without permanently starving background workloads; avoid a single FIFO queue for all job classes.
- **Provider failover:** only a compatible, authorized model/tool endpoint with equivalent residency and capability constraints can be a fallback. For external writes, automatic fallback requires proving no side effect was already performed.

## 6. Reliability boundaries and retry matrix

| Failure | Retry? | Required behavior |
| --- | --- | --- |
| Model 429 / transient 5xx | Maybe, bounded | Honor Retry-After/backoff/jitter and budgets; approved compatible model fallback |
| Model timeout after generating partial output | Usually stop or resume from known checkpoint | Do not duplicate already-committed tool effects; partial UI output marked incomplete |
| KB/doc read timeout | Yes if idempotent | Retry briefly; surface incomplete evidence if unavailable |
| MCP connection failure | Yes for proven read-only operations | Health/circuit state; do not assume tool effect absent for writes |
| External HTTP mutation timeout | **Not blindly** | Idempotency key or downstream outcome lookup; otherwise `RECONCILIATION_REQUIRED` |
| Remote script/job submission timed out | **Not blindly** | Query job by idempotency/correlation key and reconcile remote ID |
| Adapter crash or incompatible upgrade | On compatible healthy instance only | Pinned implementation; fail typed status, isolate process if possible |
| Worker crash | Recover from durable run/checkpoint | Lease expiry + fencing + safe replay; child budget preserved |
| API instance crash | No execution restart | Another API replica reads durable run/events; client SSE reconnect |
| Database unavailable | Reject new admission; preserve in-flight outcomes safely | Retry DB connections, pause commit-dependent actions; don't claim success without persistence |
| Approval wait expires | No execution until new authorization | Persist expiration/rejection and release reserved capacity |
| External A2A agent unavailable | Only if policy allows | Correlate existing remote task; don't duplicate without idempotency |

**At-least-once scheduling is a delivery guarantee, not exactly-once side effects.** Temporal and LangGraph explicitly document replay/idempotency considerations. Document each tool as `read`, `idempotent_write`, `non_idempotent_write`, or `external_job` and enforce a retry strategy appropriate to its class.

## 7. Durable checkpoints, resumable approvals and child agents

A checkpoint should capture enough to resume **logical execution**, without putting raw credentials in the state store:

~~~text
Run identity / tenant / execution principal reference
Pinned agent/adapter/tool version digests
Framework checkpoint reference + state revision
Tool invocation intent + idempotency key + remote request IDs
Pending approval ID + exact payload hash + expiry
Parent-child run IDs + delegated scopes/budgets + child status
External job ID + remote correlation + last known state
Last event sequence + trace ID + cancellation intent
~~~

Use a **run coordinator** to transition states; runtime adapters store framework-native checkpoint data in a scoped backend. Persist before suspending for approval or external long-running work.

- Waiting for human approval or remote job completion should release worker compute and active concurrency slots.
- Resuming requires a compare-and-swap state transition; don't wake two workers for the same child/parent.
- Child-run fanout and nesting depth are strictly bounded. A parent cancel propagates cancellation requests to children, with reconciliation for independent A2A tasks.
- Event order is per run; parent/child global event order is not implied. Preserve causal links (`parentRunId`, `delegationId`, `traceId`).
- Framework checkpoints and **conversation memory** are separate retention/authorization concerns.

## 8. Reliable event streaming without coupling UI and worker

Client SSE connections terminate on stateless API replicas. **Do not depend on ephemeral Redis pub/sub for delivery correctness.** A pub/sub notification can wake an API replica, but durable event storage is the replay source.

Recommended design:
1. Worker writes `RunEvent` with a monotonically increasing **per-run** sequence (enforce unique `runId + seq` with row-level serialization or another safe allocator).
2. Event notifier informs subscribed API replicas; if notifier fails, API polls/rechecks durable events using a cursor.
3. API authenticates every SSE subscription and fetches `seq > cursor`.
4. Client reconnects with `Last-Event-ID`, receives missing events up to configured retention; out-of-retention cursors get an explicit resync response and REST status/history endpoint.
5. `message.delta` is optional transient detail; **final response and authoritative run status are stored independently**.
6. Apply connection limits, heartbeat and slow-client backpressure; streaming to the UI must not stall model execution.

At larger event volume, consider partitioning event tables by time/tenant/run hash, compacting deltas to message snapshots, moving large artifacts to object storage and using dedicated fanout infrastructure. Keep the same SSE API.

## 9. Data durability and disaster recovery

### Source of truth and recovery priorities

| Data | System of record | Recovery expectation |
| --- | --- | --- |
| Agent and adapter catalog | PostgreSQL | HA backups/PITR; versioned migration/rollback |
| AgentRun and approvals | PostgreSQL | Transactional consistency, standby/failover |
| Dispatch intent | Transactional outbox / durable queue | Re-publish unacknowledged intents safely |
| Checkpoints | Durable DB/blob store | Recover exact pinned adapter/schema version |
| Run events and final answers | Durable event/result store | Replay and restore user-visible status |
| Job artifacts | Scoped object storage | Backups/retention aligned to tenant policy |
| Model provider | External dependency | Circuit breaker, compatible fallback, accepted run state intact |
| External tool/job | External dependency | Correlated operation IDs, reconciliation procedure |

A single PostgreSQL instance is acceptable for development but is a **single point of failure** in production. HA PostgreSQL, backup verification, point-in-time recovery tests, connection pooling and storage sizing are operational requirements before making uptime promises.

**Disaster recovery objectives are business choices**, not architectural facts. Set RPO (acceptable lost data) and RTO (restore time) after assessing business criticality, deployment region, storage, backup frequency and operational staffing. Checkpointing alone does not equal database disaster recovery.

Multi-region active/active should **not** be an MVP default. It introduces ambiguous leadership, duplicate dispatch and cross-region data/privacy concerns. Prefer one authoritative region with documented recovery strategy until measured requirements justify further complexity.

## 10. SLOs, observability and operating dashboards

**Proposed SLO categories, not measured guarantees:**

| User-facing objective | Suggested measurement |
| --- | --- |
| API availability | Fraction of authorized, valid non-provider requests served successfully |
| Durable admission | Accepted `202` requests with persisted run + dispatch intent |
| Queue wait | p50/p95/p99 queued-to-start latency by workload/tenant |
| Event delivery | Time from committed event to visible SSE update; replay success rate |
| Run terminal integrity | Runs not stuck in nonterminal states beyond policy threshold |
| Tool authorization | Rate of policy escapes (target **zero** in security tests); denied-call audit coverage |
| Approval recovery | Restored pending approvals and exact intent integrity after restart |
| External job reconciliation | Unknown outcomes and time to resolution |
| User-task quality | Evidence-backed answer correctness and escalation rate from evaluated dataset |
| Cost control | Provider token spend per run and hard-budget enforcement |

Start dashboards with:
- **Golden signals:** throughput, errors, latency, saturation for API/worker/adapter/model gateway.
- **Queue health:** queued age, depth, retry count, dead-letter count, leases expired, stuck runs.
- **Provider/tool health:** 429/5xx, timeouts, circuit state, concurrency and retry exhaustion.
- **Cost:** input/output tokens, model/provider profile, cost per task, tenant-level budget consumption.
- **Delegation:** child-run count, fanout, max depth, parent wait, child failures.
- **Approval and job:** pending age, retries, orphan job handles, ambiguous write outcomes.
- **Data plane:** DB pool usage, slow queries, table size, checkpoint/event write failures, backup/restore checks.

Use OpenTelemetry trace propagation across `API -> queue -> worker -> decision -> model -> tool/remote job -> SSE`. Adopt stable conventional attributes where available, plus platform-specific `runId`, `agentVersionDigest`, `toolVersion`, `adapterVersion`, `delegationId`. Avoid high-cardinality tenant IDs as metrics labels unless carefully bounded; use trace attributes with strict privacy and tenant access controls.

**Alert on user impact**, not only exceptions: growing oldest queued age, sustained 429, repeated adapter circuit opens, stalled accepted runs, checkpoint failures, orphan approvals, exhausted spend, or event-replay failures.

## 11. Failure injection / chaos testing

A release is **not** reliable simply because a workflow demo completes. At minimum test:

1. Kill an API replica after `202`; client reconnects to another and finds the same run.
2. Kill worker during a model call; lease expires, safe recovery happens, no second logical run.
3. Kill worker immediately after a **remote write succeeded** but before local success commit; no blind duplicate write; reconcile by operation ID.
4. Disconnect the browser mid-SSE; reconnect with event cursor; no restarted agent.
5. Disable a tool connector during a run; subsequent invocation fails closed, and pending external jobs retain correlation state.
6. Provider returns 429 or partial output; bounded retry, circuit breaker, budget and error behavior are visible.
7. Spawn maximum permitted child agents and request one extra; extra delegation is denied, parent budget preserved.
8. Hold approval through a worker restart and deployment rollout; no approved payload tampering or duplicate submission.
9. Inject false/duplicate/missing external job callbacks; valid status only for the correlated job, otherwise reject/audit.
10. Introduce tenant-specific traffic burst; unrelated tenants continue within their reserved capacity.
11. Fail the message broker between DB commit and publish; outbox dispatcher safely re-publishes.
12. Exercise DB failover/restore in staging; event/run/checkpoint integrity and recovery targets measured.

Perform **load tests** with a mix of cheap rules, simple agents, long deep-agent runs, external jobs, paused approvals and child delegation. Measure performance and cost under several realistic traffic shapes; never report guessed throughput or p95 values as achieved benchmarks.

## 12. Pragmatic roadmap

| Stage | What to build | Reliability milestone |
| --- | --- | --- |
| **MVP** | Modular API, registry, Postgres run/event/outbox, one simple worker, read-only tool gateway, SSE | Duplicate admission and restart/reconnect tests pass |
| **Scale 1** | Multiple API and worker replicas, shared leases, queue-age backpressure, quotas, tracing | Kill one replica/worker with no lost accepted run |
| **Scale 2** | Separate simple/deep/external job pools, adapter bulkheads, provider circuits, rate-limit accounting | Failing provider or tenant cannot exhaust all capacity |
| **Scale 3** | Durable approvals, child-run orchestration, async remote jobs and reconciliation | Parent/child restart and external write fault-injection pass |
| **Scale 4 (if needed)** | Dedicated workflow engine, HA/PITR drills, object/event partitioning, region-level recovery | Measured business RTO/RPO/SLO targets satisfied |

**Recommended default:** don't adopt a distributed workflow engine and a complex broker on day one if PostgreSQL plus an outbox meets measured volume. Conversely, don't reinvent durable execution indefinitely once long-running approvals/jobs and exactly-at-least-once recovery become central product requirements.

## 13. Architecture decisions to confirm

1. **Queue:** PostgreSQL outbox/claiming first, with swappable queue adapter; when should a broker or workflow engine replace it?
2. **Workers:** worker process separate from API in production; one shared pool at first or distinct simple/deep pools?
3. **Tenant QoS:** per-tenant concurrency/spend/queue priority defaults and reserved capacity?
4. **External effects:** require idempotency support for write tools, or allow explicit manual reconciliation for non-idempotent APIs?
5. **Streaming:** durable event log with SSE replay retention and snapshot policy?
6. **Deployments:** single-region HA now, or eventual multi-region disaster recovery?
7. **Targets:** business-defined availability/latency/RTO/RPO/cost SLOs based on actual load data.
8. **Operations:** who owns provider circuit breakers, on-call runbooks, failure reconciliation, security incident response, and adapter vetting?

## Sources and technical references

- [PostgreSQL — SELECT and SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html)
- [LangGraph — Functional API, idempotency and side effects](https://docs.langchain.com/oss/python/langgraph/functional-api)
- [Temporal — Activity retries and idempotency](https://docs.temporal.io/activity-definition)
- [KEDA — ScaledObject](https://keda.sh/docs/2.20/reference/scaledobject-spec/)
- [KEDA — ScaledJob](https://keda.sh/docs/2.21/reference/scaledjob-spec/)
- [OpenTelemetry — semantic conventions](https://opentelemetry.io/docs/specs/semconv/)
- [OpenTelemetry — GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)

The sources support implementation considerations; queue adapters, HA topology, failure handling and SLO targets above are **platform design proposals**, not vendor-guaranteed behavior.
