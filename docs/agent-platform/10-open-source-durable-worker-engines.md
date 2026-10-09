# 10 — Open-Source Durable Worker and Workflow Engines: Alternatives to Temporal

**Status:** Proposed architecture evaluation; no engine selected or integrated.
**Checked:** 2026-10-09 (official project docs and GitHub licenses)
**Scope:** Generic agent-platform **durable run orchestration and worker execution**; not a replacement for an LLM or agent runtime.
**Related:** [Reliability and operations](./09-scalability-reliability-and-operations.md) · [Runtime/worker/events](./02-runtime-workers-and-events.md) · [Adapter architecture](./08-plugin-and-adapter-architecture.md) · [External jobs](./04-tool-registry-and-external-execution.md)

## 1. Correct the abstraction: workflow engine vs worker vs agent runtime

- **Agent runtime (LangChain, Deep Agents, Pydantic AI):** performs model calls and tool-use reasoning.
- **Durable workflow/worker engine (Temporal, Hatchet, DBOS, Restate, Kestra, etc.):** schedules work, retains progress, retries/recoveries, waits for events, manages concurrency, and tracks long-running tasks.
- **External job executor (Kestra task runner, isolated containers):** performs reviewed scripts/operations in another execution environment.
- **Control plane / Run Service (our platform):** authenticates caller, chooses published agent/version, enforces tenant budget/policy, exposes the stable run API and audited SSE events.

These are **different responsibilities**. A product may use Deep Agents with DBOS/Hatchet/Temporal underneath; it need not choose between Deep Agents *and* a durable engine.

A bare Celery, BullMQ or Redis queue can dispatch background jobs. However, an ordinary queue **does not automatically supply** full workflow history, crash-safe checkpoint/replay semantics, external signal waits, child-workflow lineage, or safe side-effect reconciliation. It may be sufficient for short, idempotent jobs but requires additional platform code for these features.

## 2. Candidates and license reality

| Engine | Primary model | Most compelling fit | License / important caution |
| --- | --- | --- | --- |
| **Temporal** | Dedicated durable orchestration server + language workers | Long-lived, multi-step, cross-service workflows; mature reference | MIT; OSS/self-hostable. Baseline rather than a required dependency. |
| **Hatchet** | Dedicated worker/orchestration platform with queues, durable tasks and workflows | Multi-tenant worker pools, background AI tasks, throttling/fair scheduling and operations UI | MIT, genuine open source. |
| **DBOS** | **Embedded** durable workflow library backed by PostgreSQL | Python-first agent workers, minimal infrastructure, durable queues, steps and signals | Python SDK MIT; OSS. No dedicated orchestration server required for the basic use case. |
| **Kestra** | Workflow orchestrator with stateless coordinator and remote task workers | Schedule/webhook/email ingestion, approved REST/HTTP/scripts, hybrid external execution | Apache 2.0 OSS core. Some advanced remote worker auth/pool controls are enterprise features. |
| **Trigger.dev** | Task orchestration/deployment platform, strongest in TypeScript | TypeScript-first durable background agents and long-running jobs | Apache 2.0 GitHub repo, but verify exact distribution/hosted features and pinned v4 compatibility. |
| **Restate** | Durable RPC, workflows, virtual objects, async tasks in one runtime | Actor/session-centric agents and resilient cross-service calls | **BSL 1.1 (source-available, not OSI open source)** for the server; additional use grant has platform-specific restrictions. SDKs MIT. |
| **Inngest** | Event-driven step functions and orchestration | Webhook/event-centric workflows and background functions | Server SSPL with delayed Apache release; SDKs Apache 2.0. License review required. |
| **Windmill** | Multi-language script/workflow execution platform | User-configurable scripts, operator tooling and interactive workflows | Open-source source code AGPLv3; distributed community binaries may have extra terms. Review commercial embedding/managed-service restrictions. |

**Important:** "Can self-host" is not the same as "OSI open source". For a user-configurable commercial platform, the distribution and service-access license matters, especially if tenants can configure adapters/agents. Review the exact version/license and permitted interface exposure with counsel before embedding or exposing any engine.

### What the primary sources actually establish

- [Hatchet GitHub](https://github.com/hatchet-dev/hatchet): Python/TypeScript/Go/Ruby support, durable tasks, background queues, worker-level controls, retries and monitoring; [MIT LICENSE](https://github.com/hatchet-dev/hatchet/blob/main/LICENSE).
- [DBOS Python SDK](https://github.com/dbos-inc/dbos-transact-py), [durable queue](https://docs.dbos.dev/python/reference/queues), [workflow and step recovery](https://docs.dbos.dev/python/tutorials/workflow-tutorial), [separate queue-worker example](https://docs.dbos.dev/python/examples/queue-worker): embedded DB-backed workflows with independently deployable workers; MIT SDK LICENSE.
- [Kestra architecture](https://kestra.io/docs/architecture), [task runners](https://kestra.io/docs/scripts/task-runners), [retries](https://kestra.io/docs/workflow-components/retries): control-plane vs worker, queue/state backend, retries, isolated script runners and integration triggers. Its documentation distinguishes OSS and enterprise worker/security capabilities.
- [Restate GitHub LICENSE](https://github.com/restatedev/restate/blob/main/LICENSE), [durable runtime](https://restate.dev/): BSL 1.1 server has an additional grant and an exclusion for a "Public Restate Platform Service." A GUI/DSL abstraction is specifically described as permitted under conditions; this requires actual license review, not a blanket "commercial SaaS forbidden" assumption.
- [Inngest GitHub](https://github.com/inngest/inngest): self-hosting with server SSPL and SDK Apache 2.0.
- [Windmill GitHub](https://github.com/windmill-labs/windmill): source AGPLv3, community binary and commercial embedding conditions.
- [Trigger.dev GitHub](https://github.com/triggerdotdev/trigger.dev), [self-hosting guide](https://github.com/triggerdotdev/trigger.dev/blob/main/docs/self-hosting/overview.mdx): pinned releases and self-hosted platform operations.

**Do not base a licensing decision on third-party comparison marketing pages** or project-wide claims such as "open source" that obscure components with different licenses.

## 3. Which engine for which platform requirement?

| Requirement | Hatchet | DBOS | Kestra | Restate | Temporal |
| --- | --- | --- | --- | --- | --- |
| Dedicated orchestration server | Yes | No, embedded library | Yes | Yes | Yes |
| Self-hosted distributed execution | Yes | Yes, with workers sharing DB | Yes | Yes | Yes |
| Python agent-worker integration | Native SDK | Native Python library | Task/HTTP/container integration | Native SDK | Native SDK |
| Durable per-step state / replay | Durable tasks/workflows | DB checkpointed steps | Task/execution state, retries | Journaled durable steps | Workflow history/replay |
| Long waits / callbacks / approvals | Verify semantics in POC | Durable messaging/events/sleep | Triggers, tasks and pause/wait patterns | Durable signals/timers | Signals/timers |
| Worker concurrency and rate controls | Strong built-in focus | Queue concurrency/rate limits | Per-flow/task limits; worker capabilities vary by edition | Flow control/queues | Task queues and worker configuration |
| Remote shell/container jobs | Via dedicated external executor | Via dedicated external executor | **Directly strong** via task runners | Via dedicated external executor | Activities with separately managed runner |
| Agent sessions / A2A API | Application responsibility | Application responsibility | Application responsibility | Virtual objects can help, still app responsibility | Application responsibility |
| Product-facing tenant RBAC / costs | **Always platform-owned** | **Always platform-owned** | **Always platform-owned** | **Always platform-owned** | **Always platform-owned** |

Cells describe advertised architectural capabilities, **not benchmarked feature parity**. The POC must validate public APIs, checkpoint/approval semantics, tenant isolation, retries, license and infrastructure complexity against pinned versions.

## 4. Architecture: pluggable durable WorkflowEngineAdapter

Do **not** bind the public AgentRun API directly to a particular engine's workflow ID, task queue naming, checkpoint format or state machine.

~~~mermaid
flowchart TD
    INPUT["Chat / Webhook / Schedule"] --> API["Platform API + Auth"]
    API --> REG["Pinned AgentVersion + tenant policy"]
    REG --> RUN[("AgentRun record + outbox")]
    RUN --> ENG["WorkflowEngineAdapter (typed port)"]
    ENG --> HAT["Hatchet adapter"]
    ENG --> DBOS["DBOS adapter"]
    ENG --> KES["Kestra workflow adapter"]
    ENG --> TEMP["Temporal adapter (optional)"]
    ENG --> REST["Restate adapter (optional, license review)"]
    HAT --> WORKER["Agent Workers / Runtime Adapters"]
    DBOS --> WORKER
    KES --> WORKER
    TEMP --> WORKER
    REST --> WORKER
    WORKER --> MODEL["Agent Runtime / LLM Gateway"]
    WORKER --> TOOL["Tool Gateway / approved connectors"]
    WORKER --> EVENT["Normalized events / state projection"]
    EVENT --> API
~~~

This diagram shows **alternatives**, not five workflow engines simultaneously in production.

### Proposed interface (not vendor SDK code)

~~~python
from typing import Protocol

class WorkflowEngineAdapter(Protocol):
    async def submit(self, run_id: str, manifest_ref: str,
                     input_ref: str, idempotency_key: str) -> "WorkflowHandle": ...
    async def get_status(self, handle: "WorkflowHandle") -> "WorkflowStatus": ...
    async def signal(self, handle: "WorkflowHandle", event: "WorkflowSignal") -> None: ...
    async def request_cancel(self, handle: "WorkflowHandle") -> None: ...
    async def recover(self, handle: "WorkflowHandle") -> "RecoveryOutcome": ...

class WorkflowHandle:
    # Engine-specific IDs are stored internally, never in the public API.
    workflow_engine_id: str
    engine_version: str
    backend_run_id: str
~~~

Actual SDK contracts and runtime-specific features differ. In particular, \`recover\` may mean inspect/resume/reconcile rather than an imperative RPC. The adapter describes **capabilities** (\`supports_signals\`, \`supports_durable_sleep\`, \`supports_child_workflows\`, \`supports_cancel\`, \`supports_search\`) so publishing an incompatible agent/workflow fails validation.

### Important ownership choice: avoid two competing coordinators

**When using DBOS/Hatchet/Temporal as the durable source for step execution, do not implement a second independently advancing step-state machine in PostgreSQL.** Keep:

1. **Agent Platform DB** as source of truth for tenant permissions, immutable agent config, audit and user-facing \`AgentRun\` admission/ownership/status *projection*.
2. **Chosen workflow engine** as source of truth for step ordering, durable step outcome, resume/signal/retry, and engine workflow execution state.
3. **Run Event API** as normalized read/output interface. Append the engine's observed transitions using idempotent event mapping, with reconciliation after crashes; events can lag engine state.
4. **Tool Gateway and external-job service** as authorization/side-effect boundary, with independent idempotency/outcome tracking.

If **not** adopting an engine, the original [Postgres outbox/worker-lease design](./09-scalability-reliability-and-operations.md) is a valid **alternative**. **Do not stack** an elaborate custom leased step scheduler on top of a durable engine merely because both are mentioned in these docs.

## 5. End-to-end agent workflow with Hatchet/DBOS/Kestra

~~~mermaid
sequenceDiagram
    participant UI as Chat UI
    participant API as Platform API
    participant DB as AgentRun DB
    participant W as Workflow Engine
    participant A as Agent Worker
    participant G as Tool Gateway
    participant JOB as Approved External Runner
    participant EV as Event API

    UI->>API: POST /runs (agent/version/input)
    API->>DB: Durable run + idempotent dispatch intent
    API-->>UI: 202 runId/eventsUrl
    DB->>W: Submit workflow with stable runId
    W->>A: Start agent activity/step
    A->>G: Authorized MCP/REST read tool
    G-->>A: Allowed data/source references
    A-->>W: Persist typed agent step result
    opt Approved external job requested
      W->>JOB: Start fixed operation, idempotency key
      JOB-->>W: Durable external jobId
      W->>W: Suspend / await verified callback or polling
      JOB-->>W: Completion signal/artifact
    end
    W->>A: Resume/synthesize with pinned agent version
    A-->>W: Final answer + model usage
    W->>EV: Normalize run/child/job events
    EV-->>UI: Authenticated SSE replay and final answer
~~~

**Workflow run is not the same as agent reasoning turn.** A single engine workflow can orchestrate one or multiple agent steps, tool invokes, child workflows and external jobs. For an agent with many model/tool iterations, define step boundaries deliberately—checkpointing every token or every tiny model delta may make durability overhead and storage excessive. Conversely, checkpointing only at the very end loses all meaningful restart progress.

### Safe activity boundaries

- A model call is nondeterministic and costs money. Wrap it in an engine step/activity whose completed output is recorded, and avoid unbounded retry on timeouts.
- Pure state transitions and decisions remain deterministic code.
- Tool calls go through Tool Gateway even when the engine supports native activities.
- Before a mutation, persist stable operationId and use downstream idempotency; on ambiguous outcome, reconcile instead of blindly resubmitting.
- Human approval and remote job completion are signals/events to a **durably waiting** workflow, not busy loops consuming a worker slot.
- On model/tool exceptions, return typed failure statuses to the platform; the UI can reconnect without restarting execution.

## 6. Criteria for selecting the first engine

**Use one identical workload across all candidates** (no claimed performance results yet):

1. API starts agent run -> model calls read-only tool -> store answer/usage -> SSE.
2. Kill Python worker after successful model step, restart and verify completed step is not unnecessarily repeated.
3. Inject 429/5xx provider errors; verify retry budget, backoff, circuit behavior and tenant fairness.
4. Wait for human approval across worker shutdown and deployment upgrade.
5. Start external fixed script job; disconnect engine -> restore job correlation without duplicate submission.
6. Parent run delegates one bounded child workflow; verify cancellation, budget reservation and trace lineage.
7. Compare max sustained throughput and p95 queue-to-start under 10 / 100 / 1,000 representative concurrent queued runs using identical hardware.
8. Verify multi-tenant authorization stays in the Platform API/Tool Gateway even when orchestration engine offers its own RBAC.
9. Compare **total ops cost**: engine DB/broker/storage, CPU/memory, patching, backup/HA, dashboards and on-call effort. Model tokens/provider billing are separate.
10. Validate license fit for multi-tenant, publicly configurable SaaS before any implementation commitment.

These are **proposed POC workloads**, not evidence they have been successfully run.

## 7. My recommendation for this project

### Option A: DBOS — leanest Python-first starting point

Choose when you want a small, modular Python execution backend, already expect PostgreSQL, and want durable steps, queues, signals and restarts without operating a separate Temporal-style server. DBOS supports an independent worker service architecture. Its Python SDK is MIT licensed.

**Trade-off:** a relatively embedded programming model and DB ownership. Validate provider/tenant fairness, horizontal execution semantics, in-flight version upgrades, and operational visibility at your target volumes. Don't assume a queue library automatically solves application tenant authorization.

### Option B: Hatchet — strongest dedicated worker-platform candidate

Choose when you want an off-the-shelf, self-hosted orchestration layer with **workers scaling independently**, durable tasks, retries, concurrency/rate control and operational UI. Its MIT license is attractive for building a separate product on top.

**Trade-off:** another stateful platform to deploy, backup, upgrade, and secure. Validate exactly what a durable task means for interrupted LLM/tool calls, signal/approval support and versioned worker deployment compatibility.

### Option C: Kestra — most natural for installed integration/external runner workflows

Choose when schedules, inbound webhooks, batch jobs, shell/container scripts, and remote environments dominate. Kestra has a clear worker-controller architecture, plugin ecosystem, retries and execution UI.

**Trade-off:** a separate external workflow/job orchestrator may complement rather than replace Python agent-loop durability. Kestra is less obviously the smallest primitive for checkpointing every agent reasoning step. Review edition boundaries for worker-group features and authenticated remote worker channels.

### Restate — technically promising, but review license first

Restate offers durable RPC, workflow waits and virtual objects for persistent agent sessions. However, its server is **Business Source License 1.1** with a prohibition on a defined "Public Restate Platform Service." There is a conditional allowance for higher-level GUI/DSL abstractions; this is not blanket permission or prohibition for every SaaS. Evaluate the specific planned API exposure and licensing terms before shortlist promotion.

### Do not pick a winner yet

For this platform's stated priorities—generic, pluggable, multi-tenant, Python-first agents with optional external script execution—**start a two-way POC with DBOS and Hatchet**. Retain **Kestra as an external job/trigger adapter** while deciding whether it should orchestrate agent steps too. This avoids forcing the entire control plane onto a workflow implementation before real failure/cost/load measurements.

## 8. Architectural follow-through

- Add **WorkflowEngineAdapter** as a distinct typed port to [08 — Adapters](./08-plugin-and-adapter-architecture.md). Do not overload \`RuntimeAdapter\` (LLM reasoning) or \`JobExecutorAdapter\` (external script).
- Keep \`AgentRun\`, \`AgentVersion\`, \`ToolBinding\`, \`RunEvent\` and \`ApprovalRequest\` as stable product contracts regardless of engine.
- Persist \`WorkflowHandle\` and mapping \`runId -> engine workflow ID\` with idempotent submission and event projection.
- Pin engine/adapter version per run; do not hot-swap in-flight workflows across engines without an explicit migration plan.
- Enforce external tool permissions in Tool Gateway and provider budgets outside model prompts.
- Treat workflow-engine HA and DB failover as a separate operational design (the engine adds stateful infrastructure even if your API/workers are stateless).

## References

- [Hatchet](https://github.com/hatchet-dev/hatchet), [MIT license](https://github.com/hatchet-dev/hatchet/blob/main/LICENSE)
- [DBOS Python](https://github.com/dbos-inc/dbos-transact-py), [queues](https://docs.dbos.dev/python/reference/queues), [separate queue worker](https://docs.dbos.dev/python/examples/queue-worker), [workflow messaging](https://docs.dbos.dev/python/tutorials/workflow-communication)
- [Kestra architecture](https://kestra.io/docs/architecture), [retry behavior](https://kestra.io/docs/workflow-components/retries), [script task runners](https://kestra.io/docs/scripts/task-runners)
- [Restate LICENSE](https://github.com/restatedev/restate/blob/main/LICENSE)
- [Temporal MIT LICENSE](https://github.com/temporalio/temporal/blob/main/LICENSE)
- [Inngest GitHub license](https://github.com/inngest/inngest), [Windmill distribution/license](https://github.com/windmill-labs/windmill)
- [Trigger.dev repository](https://github.com/triggerdotdev/trigger.dev), [self-hosting guide](https://github.com/triggerdotdev/trigger.dev/blob/main/docs/self-hosting/overview.mdx)
