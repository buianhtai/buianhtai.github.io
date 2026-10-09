# 07 — Complete Worked Example: Route -> Delegate -> External Job -> Respond

**Status:** Design walkthrough (fictional SaaS example; no real integration or service has been implemented)

This walkthrough joins [routing](./01-invocation-and-routing.md), [worker execution](./02-runtime-workers-and-events.md), [external tools](./04-tool-registry-and-external-execution.md), [agent-to-agent delegation](./05-agent-to-agent-orchestration.md) and [decision providers](./06-decision-layer-jev-and-rules.md).

## Scenario

User: "**Can you investigate why last night's scheduled usage report failed and prepare a summary?**"

A generic SaaS platform has three user-configured agents:
- `Documentation Agent`: read-only KB/documentation tools.
- `Troubleshooting Agent`: read-only log, trace and workflow-status tools. May delegate to the Documentation Agent.
- `Report Agent`: drafts reports from approved data; can start a **reviewed report-preview job** that runs in an isolated external environment, with approval.

This is intentionally a complex illustrative example. A simpler workflow might solve a particular reporting issue more cheaply; do not assume agent orchestration is necessary for every incident.

This scenario assumes each provider is installed as an approved [adapter package](./08-plugin-and-adapter-architecture.md), configured as a scoped instance, and exposed as published capabilities that agent authors can bind. No runtime source edit is needed when a new provider implements an existing adapter port.

## 1. What administrators preconfigure

Before this works, **developers and administrators** must supply these building blocks:

| Capability | Implemented/installed by developer/admin | Selected by user in Agent Studio |
| --- | --- | --- |
| AuthN/RBAC/tenant | Real identity and scoped execution grants | Select approved workspace and resources |
| Agent registry | Draft/publish/version/deploy APIs | Publish agent instructions and routing examples |
| Decision adapter | Code rules and optionally Jev-compatible client | Bind appropriate routing policy/profile |
| MCP tools | Implement/install `jobs.status`, `logs.search`, `kb.search` with ACLs | Enable those read tools |
| External job adapter | Register fixed report-preview workflow and isolated runner | Enable `reports.run_preview@1` within grants |
| Delegation gateway | Child-run creation, budget and access checks | Bind Documentation Agent as allowed subagent |
| Run worker/API | Event store, model interface, Tool Gateway, streaming | Choose model/profile and run limits |

**No arbitrary tool name is an implementation:** a tool is runnable only if its connector/operation is installed and validated. Likewise, a shell script can run only when a signed or reviewed template is deployed in an isolated execution environment.

### Example published config fragments

~~~yaml
# NOT native Deep Agents/Kestra YAML; illustrative registry projection.
agentId: troubleshooting-agent
version: 3
modelProfile: small-tool-calling@2
routing:
  description: Diagnose scheduled job and API failures
tools:
  - jobs.status@1
  - logs.search@2
  - kb.search@3
delegation:
  - target: documentation-agent@2
    maxChildRuns: 1
    budgetUsd: 0.05
execution:
  maxModelCalls: 5
  maxCostUsd: 0.20
~~~

The optional external-job tool remains bound to the **Report Agent**, not automatically available to Troubleshooting Agent or the delegated Documentation Agent.

## 2. Execution sequence

~~~mermaid
sequenceDiagram
    autonumber
    participant USER as Chat UI
    participant API as Platform API
    participant DEC as Decision/Router
    participant RUN as Run/Event Service
    participant TRO as Troubleshooting Worker
    participant DG as Delegation Gateway
    participant DOC as Documentation Agent
    participant TG as Tool Gateway
    participant JOB as External Job Service
    participant EXT as Isolated Runner

    USER->>API: "Why did last night's report fail?"
    API->>API: Authenticate, resolve tenant/workspace
    API->>DEC: Route only among eligible agents
    DEC-->>API: Troubleshooting Agent v3 / or clarify
    API->>RUN: Persist run and pinned manifest
    API-->>USER: 202 {runId, eventsUrl}
    RUN->>TRO: Queue executable run
    TRO->>TG: jobs.status(jobRef)
    TG-->>TRO: Approved status + error summary
    TRO->>DG: Delegate "find matching docs"
    DG->>RUN: Validate binding; create child run
    RUN->>DOC: Execute Documentation Agent v2
    DOC->>TG: kb.search(error code)
    TG-->>DOC: Source IDs and excerpts
    DOC-->>TRO: Scoped evidence artifact
    TRO->>RUN: Save diagnosis and final explanation
    RUN-->>USER: SSE completed + findings

    Note over USER,EXT: Optional SECOND action: user requests report preview
    USER->>API: Invoke Report Agent / preview request
    API->>RUN: New authorized run (separate runId)
    RUN->>TG: reports.run_preview(period=day)
    TG->>TG: Require approval + validate exact operation
    TG-->>USER: approval.required via run events
    USER->>API: Approve exact reviewed request
    API->>TG: Verify approval and resume
    TG->>JOB: Submit immutable approved template
    JOB->>EXT: Execute sandboxed report preview
    EXT-->>JOB: remoteJobId / status / artifact
    JOB->>RUN: Correlated completion + artifact reference
    RUN-->>USER: SSE tool.job.completed / run.completed
~~~

Notice **two distinct runs**: diagnosis (read-only) and report generation (write-capable, approval required). This prevents the first agent from acquiring a report-execution permission just because the user asked a related question.

## 3. Who chose what?

| Decision point | Component | Mechanism | LLM necessary? |
| --- | --- | --- | --- |
| Should the input start processing? | API/auth/trigger | Verified request, quota and scope | No |
| Which agent owns the investigation? | Router | Explicit selection, rule, then optional decision model | Maybe one bounded choice |
| Should logs or job status be queried? | Troubleshooting Agent | Tool-using model with approved schemas | Usually |
| May the agent query those logs? | Tool Gateway | Deterministic ACL and resource check | **No model authority** |
| May a Documentation Agent assist? | Delegation Gateway | Published binding + principal/budget/depth checks | No policy LLM |
| Which specialist to delegate to? | Parent agent within preapproved bindings | Explicit alias or bounded selector | Optional |
| Can the report-preview script start? | Tool Gateway/approval service | Exact approved operation + human decision | **Not decided by LLM** |
| Where does the script execute? | External Job Service | Approved connector to Kestra/container/remote runner | No |
| How do results reach the UI? | Event Store + Platform API | Authenticated SSE with runId | No |

## 4. Async external jobs: don't keep an LLM waiting

A long script may take minutes. It should produce a durable `ExternalJob` and allow the agent/workflow to **suspend** while waiting for a verified completion event or polling result.

~~~mermaid
stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> WAITING_APPROVAL
    WAITING_APPROVAL --> QUEUED: approved
    WAITING_APPROVAL --> REJECTED: denied
    QUEUED --> SUBMITTED: accepted by remote runner
    SUBMITTED --> RUNNING
    RUNNING --> COMPLETED
    RUNNING --> FAILED
    RUNNING --> UNKNOWN_OUTCOME: network uncertainty
    QUEUED --> CANCELLED
    RUNNING --> CANCELLED: best effort
    COMPLETED --> [*]
    FAILED --> [*]
    REJECTED --> [*]
    UNKNOWN_OUTCOME --> [*]
    CANCELLED --> [*]
~~~

Remote job status belongs to **External Job Service**, and the parent agent/workflow maintains a correlated waiting state/checkpoint. Merely returning `jobId` is not final success.

## 5. A2A instead of an internal child agent

If the Documentation Agent belongs to another company or independent team and exposes A2A, replace the internal child run with:
1. An approved `ExternalAgentConnection` (agent card, endpoint, identity and scopes).
2. A `DelegationRequest` with sanitized task input and no secret parent memory.
3. A remote A2A `Task` / `taskId` correlated to the local `delegationId`.
4. Status and artifact polling/streaming mapped into parent `RunEvents`.
5. Validated returned evidence treated as untrusted, with provenance and tenant ACL.

A2A transport does not override local or remote access policies; it is not required for two agents running under the same internal Run Service.

## 6. When to use Jev-like decision models

The only likely Jev-style step in this scenario is the **routing/classification** step if the UI doesn't explicitly select an agent. For example, decide among `documentation`, `troubleshooting`, and `report` using a bounded typed-choice contract. Another optional step is to decide whether a technical report has enough evidence to request human review.

Do not use the decision model to approve the external write, assert that the job completed, or bypass errors. Existing logic, status records, resource ACLs, and human approval are authoritative.

### Example decision adapter output (illustrative)

~~~json
{
  "choice": "troubleshooting",
  "probabilities": {
    "documentation": 0.08,
    "troubleshooting": 0.90,
    "report": 0.02
  },
  "accepted": true,
  "policyVersion": "routing@1"
}
~~~

**Those numbers are placeholders** and may not be sufficiently reliable for production without calibration.

## 7. What the frontend must show

The Platform API (not workers) exposes run status and SSE. A UI timeline for this fictional run:

~~~text
Run: run-001
- Agent selected: Troubleshooting v3
- job.status: completed, found failure reason
- Child agent started: Documentation v2
- Child agent completed: found 2 references
- Response ready: diagnosis + suggested actions
- Run completed: tokens, cost, elapsed time

Separate run: run-002 (Report Agent)
- reports.run_preview requested
- Waiting for approval
- Approved -> external job queued
- External job completed -> artifact ready
- Run completed
~~~

If the user closes the browser, the runs continue according to policy. Reopening the UI retrieves current status and replays stored events; it does **not** launch new runs.

## 8. Implementation order: avoid building all of this at once

| Milestone | Demonstrable result |
| --- | --- |
| 1. Registry + ToolBinding + simple worker | A selected read-only agent invokes an authorized KB tool and responds over SSE |
| 2. Tool connector registry | Add a second MCP tool and one fixed approved HTTP action without editing agent runtime source |
| 3. Decision service | Automatic routing among two published agents with fallback and zero unauthorized candidates |
| 4. Internal delegation | One parent requests one child run; both appear in run timeline; budgets and permissions enforce |
| 5. External job adapter | Agent requests a fixed approved script template; human approves; results arrive async |
| 6. External A2A | Delegate to a separately operated agent service, with scoped data and task correlation |

**Architecture rule:** do not launch arbitrary shell commands or general HTTP requests from model-supplied strings. Integrations and script operations must be reviewed and registered in the platform before users can bind them to agents.

## 9. Acceptance tests

- An explicit selected agent skips paid auto-router calls.
- An unapproved connector cannot be bound to an agent.
- An agent's tool catalog can grow without modifying the runtime loop.
- The router never returns an agent outside the caller's eligible set.
- A child run cannot use more rights than parent delegation or caller grants permit.
- The UI displays child progress and returns a parent result after the child completes/fails.
- An external job uses a fixed signed template; a malicious prompt cannot change its shell command.
- A canceled or timed-out job is not reported as success just because the model says it ran.
- Completion callbacks are authenticated and correlated to a known job.
- Decision-model output can route/score but cannot grant permissions or execute a write.
