# 02 — Agent Runtime, Worker, Tool Execution, and Result Delivery

**Status:** Proposed  
**Depends on:** [Architecture index](./README.md) · [Invocation and routing](./01-invocation-and-routing.md) · [Triggers and MVP](./03-triggers-and-mvp.md)

## 1. What exactly does the runtime do?

**Agent selection ends before the worker begins.** The platform determines which authorized published agent version will run. The worker then:

1. Leases a queued `runId`.
2. Loads the **pinned published manifest**: instructions, model profile, approved tool/skill versions, limits, and optional subagent references.
3. Revalidates runtime policy and resolves **scoped tool handles**; model credentials stay server-side.
4. Chooses a runtime adapter (`simple`, `deep` or reviewed `workflow`) from the manifest.
5. Builds an executable agent, invokes the approved model through the model gateway, and handles proposed tool calls through a secure Tool Gateway.
6. Appends normalized, ordered events; persists checkpoints and tool intents as needed.
7. Marks the run completed/failed/cancelled and records trace and token/cost usage.

The worker executes **one primary agent** per run. Multi-agent delegation is an optional capability of that agent, not a requirement of the outer Agent Router.

## 2. Responsibility boundaries

| Component | Owns | Explicitly does **not** own |
| --- | --- | --- |
| Platform API | Authorization, incoming requests, run/session reads, SSE subscriptions | Executing agent loops |
| Run Service | Run IDs, quotas, status transitions, event log, cancellation intent, idempotency | Deciding tool semantics |
| Queue/Lease Coordinator | Delivery, claiming runs, lease expiry, backpressure | Guarantees of exactly-once external writes |
| Runtime Worker | Run execution, adapter setup, heartbeat, checkpoints, normalized events | Client HTTP connection or identity policy source |
| Runtime Adapter | Framework-specific call conventions, messages, interruptions, resume/cancel hooks | Bypassing Tool Gateway, policy or cost limits |
| Model Gateway | Provider auth, approved profiles, usage, limits, retries | Tool authorization or business approvals |
| Tool Gateway | Tool schema validation, per-call authorization, read/write policies, approvals, idempotency | Trusting the LLM's explanation of authorization |
| Registry | Immutable published definition versions, deployment pointer, skill/tool versions | Run status/history |
| Event Store | Append-only run event sequence with retention and redaction | Long-term raw model contents by default |

A single deployment may contain multiple logical components; preserve the interfaces even before separating processes.

## 3. End-to-end execution: UI to model to tools to UI

~~~mermaid
sequenceDiagram
    autonumber
    participant U as Chat UI
    participant API as Platform API
    participant A as Admission / Router
    participant R as Run Service / DB
    participant Q as Queue
    participant W as Runtime Worker
    participant M as Model Gateway
    participant T as Tool Gateway
    participant EXT as Tool Connector

    U->>API: POST /v1/runs {sessionId, target, input}
    API->>A: AuthN/AuthZ, target selection
    A-->>API: Authorized deployment + pinned version
    API->>R: Create run and append run.accepted
    R->>Q: Transactional enqueue / outbox
    API-->>U: HTTP 202 {runId, eventsUrl}
    U->>API: GET /v1/runs/{id}/events (SSE)
    Q->>W: Claim run lease
    W->>R: RUNNING + adapter/model/tool version resolution
    W->>M: Prompt + allowed tool schemas
    M-->>W: Proposed tool call knowledge.search
    W->>T: Execute knowledge.search with run security context
    T->>T: Validate args, target ACL, grant, budget
    T->>EXT: Authorized query only
    EXT-->>T: Source IDs / allowed results
    T-->>W: Redacted tool response
    W->>R: Append tool.completed
    R-->>U: SSE tool.completed via API
    W->>M: Summarize retrieved evidence
    M-->>W: Answer
    W->>R: Append message.delta, run.completed + usage
    R-->>U: SSE final answer and completion
~~~

The UI sees run events **through the API**, not through a direct connection to the worker. The sequence intentionally depicts a read-only KB query; approvals are described separately.

**Version consistency:** resolve the actual deployment version and content digest at admission and persist them. The worker must load that exact version, not whichever version is currently deployed when the queue finally drains.

**Transactional admission:** the run record and its enqueue intent must be atomic (database-backed queue or transactional outbox). Otherwise a crash can produce a run that never starts or a worker message with no run.

## 4. Why use a worker instead of having the API call the model?

A synchronous direct call seems easy for a demo, but it ties long execution to the browser request. A worker helps with:

- Queues and global concurrency limits;
- Model timeouts / provider retries;
- Browser disconnect and reconnect;
- Scheduled runs without any browser;
- Approval pauses that last minutes or hours;
- Crash recovery and load shedding.

A **simple MVP** can run a worker loop in the API process during local development, but should still persist run state and events. Avoid creating a production dependency on open browser connections.

### Worker lease and recovery model

1. Worker claims a queued run under an exclusive **lease with fencing token**.
2. It heartbeats while running; a newer valid lease fences out a stale worker.
3. On crash or lease expiry, scheduler determines whether a checkpoint permits safe recovery.
4. Tool invocation outcomes are checked against stored invocation IDs before replay. If outcome is unknown and side effects may have occurred, mark `RECONCILIATION_REQUIRED` and stop automatic retry.
5. Cancellation is cooperative: set cancellation intent, propagate it through model/tool loops, and record a terminal status only after execution stops or a timeout policy intervenes.
6. The event stream remains available while runs change workers.

**Do not promise exactly-once execution across external APIs.** Idempotency keys and outcome reconciliation are required for mutating tools. For read-only calls, bounded retries may be appropriate.

## 5. Runtime adapter contract

For pluggable adapter registration, version negotiation, operator-installed packages and scoped instances (rather than hard-coded framework switch statements), see [08 — Plug-and-play Adapter Architecture](./08-plugin-and-adapter-architecture.md).

The public product uses a **normalized runtime interface**. Illustrative shape:

~~~python
class RuntimeAdapter(Protocol):
    async def build(self, manifest, resolved_tools, execution_context):
        """Return an executable tied to one published version."""

    async def stream(self, executable, input, execution_context):
        """Yield normalized RunEvent objects."""

    async def resume(self, checkpoint_ref, approval_result, execution_context):
        """Resume a paused run (if supported)."""

    async def request_cancel(self, run_id, execution_context):
        """Ask the active execution to stop."""
~~~

Implement this with one adapter initially:

- `simple`: a basic LangChain (or equivalent) agent with a bounded model/tool loop.
- `deep`: Deep Agents harness for planning, task decomposition and controlled delegation; later milestone.
- `workflow`: reviewed LangGraph workflow or deterministic task orchestration; distinct from unconstrained agent reasoning.

Some frameworks do not supply equivalent pause/resume/cancel semantics. The **Run Service** owns public status and guarantees, while adapters provide whatever safe execution primitive is available. Adapter compatibility and restart behavior must be proven against pinned package versions.

### Internal agent model/tool loop

~~~mermaid
flowchart TD
    START["Worker: build selected agent"] --> MODEL["Call approved LLM"]
    MODEL --> DECIDE{"Final response or tool proposal?"}
    DECIDE -->|Final| FINAL["Normalize response + finish"]
    DECIDE -->|Tool proposal| POLICY["Tool Gateway: scope, schema, budgets"]
    POLICY --> AUTH{"Authorized?"}
    AUTH -->|No| DENY["Tool denied + event"]
    AUTH -->|Approval needed| PAUSE["Persist intent and checkpoint"]
    AUTH -->|Yes| CALL["Execute reviewed MCP / REST / KB tool"]
    CALL --> RESULT["Truncate/redact result"]
    RESULT --> LIMIT{"Limits still available?"}
    DENY --> LIMIT
    LIMIT -->|Yes| MODEL
    LIMIT -->|No| STOP["End bounded run / escalate"]
~~~

The agent can only call tools exposed for its current run. Even exposed tools are independently reauthorized at the Tool Gateway on each call.

## 6. A concrete tool call is not the same as agent selection

**Agent Router**: chooses `troubleshooting-agent` among authorized agent deployments. It does not decide to execute `logs.search` directly.

**Selected runtime**: sends the user's request and approved tool descriptions to a model. The model may propose `logs.search` if that call helps accomplish the task.

**Tool Gateway**: validates and performs `logs.search` only after checking actual data scope and principal permissions, and emits a traceable `tool.completed` or `tool.denied`.

**Tool implementation**: existing MCP server or REST integration performs the API query. A tool is not an autonomous process that knows when to run unless some invocation/orchestration calls it.

## 7. Run lifecycle and status model

~~~mermaid
stateDiagram-v2
    [*] --> ROUTING: auto target / async selection
    [*] --> QUEUED: resolved target
    ROUTING --> QUEUED: agent selected
    ROUTING --> UNROUTABLE: no safe match
    QUEUED --> RUNNING: worker lease
    RUNNING --> WAITING_APPROVAL: write requires approval
    WAITING_APPROVAL --> QUEUED: approved / resume
    WAITING_APPROVAL --> REJECTED: denied or expired
    RUNNING --> SUCCEEDED: valid result
    RUNNING --> FAILED: unrecoverable error
    RUNNING --> RECONCILIATION_REQUIRED: uncertain external side effect
    RUNNING --> QUEUED: safe checkpoint retry
    QUEUED --> CANCELLED: cancel
    RUNNING --> CANCELLED: cancellation acknowledged
    WAITING_APPROVAL --> CANCELLED: cancel
    UNROUTABLE --> [*]
    SUCCEEDED --> [*]
    FAILED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
    RECONCILIATION_REQUIRED --> [*]
~~~

`ROUTING` is used only when target selection is asynchronous. For synchronous resolution the initial run starts `QUEUED`.

Run status is transactional application state; framework-native status/checkpoint IDs are implementation details.

### Approvals

~~~mermaid
sequenceDiagram
    participant W as Worker
    participant G as Tool Gateway
    participant P as Policy/Approval API
    participant DB as Checkpoint/Event Store
    participant UI as User UI
    participant EXT as External API

    W->>G: Request write tool with exact arguments
    G->>P: Evaluate approval policy + actor scope
    P-->>G: Approval required
    G->>DB: Persist immutable tool intent hash
    W->>DB: Persist checkpoint; WAITING_APPROVAL
    DB-->>UI: approval.required event
    UI->>P: Approve exact intent / authorized actor
    P->>P: Check intent hash, ACL, expiry, revision
    P->>DB: Record decision + enqueue resume
    DB->>W: Restore pinned checkpoint
    W->>G: Execute approved intent
    G->>EXT: Write with idempotency key
    EXT-->>G: Status / external ID
    G->>DB: Record tool outcome
    W->>DB: Resume reasoning + final response
~~~

The agent **never decides whether its own approval is sufficient**. The approval request is bound to a particular payload and tool invocation; changing any write argument after approval requires a new approval.

## 8. Durable event protocol and UI response

### Event envelope

~~~json
{
  "id": "run-001:000003",
  "runId": "run-001",
  "seq": 3,
  "type": "tool.completed",
  "occurredAt": "2026-10-09T00:00:00Z",
  "traceId": "trace-example",
  "payload": {
    "tool": "knowledge.search",
    "summary": "Retrieved 4 authorized references",
    "durationMs": 38
  }
}
~~~

Identifiers, counts and timestamps above are fictitious illustrations.

Suggested event types:

| Type | UI meaning |
| --- | --- |
| `run.accepted` / `route.selected` | Accepted / which agent will run |
| `run.started` | Runtime begins |
| `message.delta` | Partial answer text |
| `tool.requested` | Display safe label, not secrets or raw arguments |
| `tool.completed` / `tool.denied` | Progress / policy rejection |
| `approval.required` / `approval.resolved` | Show review UI and decision |
| `usage.updated` | Token/spend estimate |
| `run.completed` / `run.failed` / `run.cancelled` | Terminal outcome |
| `run.unroutable` | Ask for manual agent selection |

Do not send raw provider prompts, full tool credentials, unredacted request payloads or cross-tenant data in generic SSE events.

### Browser API

~~~http
POST /v1/runs
→ 202 Accepted
{
  "runId": "run-001",
  "status": "QUEUED",
  "eventsUrl": "/v1/runs/run-001/events"
}

GET /v1/runs/run-001/events
Accept: text/event-stream

id: run-001:000001
event: run.started
data: {"runId":"run-001","seq":1,"type":"run.started","payload":{"agentName":"Documentation Agent"}}

id: run-001:000002
event: message.delta
data: {"runId":"run-001","seq":2,"type":"message.delta","payload":{"text":"Here is the documented approach..."}}

id: run-001:000003
event: run.completed
data: {"runId":"run-001","seq":3,"type":"run.completed","payload":{"status":"SUCCEEDED"}}
~~~

This is **illustrative wire formatting**. Production events must also conform to the full event envelope or to a documented minimized SSE payload variant, with consistent IDs/types.

**SSE resume requirements:**

- Store ordered events before broadcasting them; event sequences unique per `runId`.
- Authenticate each `GET /events`, not just run creation; enforce tenant/workspace and session ownership.
- Support `Last-Event-ID` (or an explicit cursor) to replay events after a dropped connection, within retention.
- Reconnection must not start a second run.
- Client should render `message.delta` incrementally, update status on `run.*` events and reconcile with `GET /runs/{id}` after terminal status.
- Slow consumers must not block the worker; fanout is decoupled from computation through durable storage.
- Persist final answer separately from deltas if event retention and message-history retention differ.

### Why not let the worker respond to the browser directly?

The worker may be restarted, moved, suspended for approval, or invoked by a scheduler when no browser exists. The API remains the stable read interface; the worker merely produces ordered run events and persists final state.

For email/webhooks, the outbound integration may listen for `run.completed` and choose a configured action (e.g. prepare a human-review draft). **Do not assume `run.completed` automatically sends email or calls a webhook.** That requires a separately authorized post-run action.

## 9. Conversation and checkpoint state

Store at least:

- `AgentSession`: user/workspace, bound deployment, selected version and revision, chat conversation references.
- `AgentRun`: triggering actor, pinned version/adapter, budget, trace ID, status.
- `RunEvent`: append-only event log with seq/cursor.
- `RuntimeCheckpointRef`: framework thread ID + checkpoint version (private to worker), storage namespace and retention policy.
- `ToolInvocation`: idempotency key, tool ID/version, input hash, authorization/approval decision and result.
- `ApprovalRequest`: intent hash, reviewer, expiry, revision and decision.

**Separate long-term memory from execution checkpoints.** A checkpoint enables crash recovery; it does not imply permission to remember sensitive user data indefinitely. Tenant-scoped memory must be explicitly configured, governed and erasable.

## 10. Error handling, security and cost

1. Authorization is enforced before routing, at run start **and** before every tool invocation.
2. Enforce max model calls, steps, wall time, tool calls, input/output tokens, and spend **outside** the model prompt.
3. On budget exhaustion, finish safely and return a bounded partial result or escalation path. Never ask the model to promise to stop itself.
4. Protect tools against arbitrary egress/SSRF, oversized outputs, unreviewed file execution, replay, and malformed arguments.
5. Support trace propagation across API -> queue -> worker -> model/tool; redact secrets and sensitive tool output.
6. If a write's outcome is unknown, do not blindly re-issue it. Mark a reconciliation-required state.
7. The runtime must not leak hidden agent definitions, cross-tenant sessions, or previous run contents.
8. Error messages distinguish `UNROUTABLE`, unauthorized, invalid deployment, tool denied, quota exceeded, model failure, tool timeout, and external-write uncertainty.

## 11. Implementation contracts to test

- An explicit selected agent executes without invoking a routing model.
- Auto-routing sees only authorized published candidates.
- A second message with the same session stays with the same agent unless explicitly switched.
- UI receives status + deltas even if the worker and API run in different processes.
- UI disconnect/reconnect replays missing events without restarting execution.
- Tool call is denied when user or target ACL disallows it, even if the LLM proposes it.
- Rate limit and budget limits interrupt further model/tool calls.
- Paused approval survives a worker restart (once checkpoint support is implemented).
- A duplicate mutating tool call is idempotent or enters reconciliation rather than repeating unsafe writes.
