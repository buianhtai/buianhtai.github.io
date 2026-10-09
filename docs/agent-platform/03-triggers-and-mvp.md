# 03 — Trigger Adapters, Example Flows, and MVP Implementation Plan

**Status:** Proposed  
**Depends on:** [Architecture index](./README.md) · [Agent invocation and routing](./01-invocation-and-routing.md) · [Runtime and event delivery](./02-runtime-workers-and-events.md)

## 1. What starts an agent?

Agents generally do **not** poll queues, read mailboxes or subscribe to arbitrary webhooks on their own. A **trigger adapter** receives an external event, authenticates/verifies its source, maps it to a configured workflow/agent, and submits a run to the Platform API. The exception is direct chat/API invocation, where the caller already initiates the run.

| Source | Initiator | Preferred binding | Does agent routing happen? |
| --- | --- | --- | --- |
| Agent selected in Chat UI | Authenticated human | Explicit deployment/version | **No** |
| General-assistant Chat UI | Authenticated human | \`target:auto\` | **Yes**, once per new session |
| Application API request | Authorized client/service | Explicit deployment preferred | Usually no |
| Webhook | Registered integration | Fixed \`TriggerBinding\` | No unless explicitly designed |
| Email received | Mail connector | Fixed support workflow | Optional intent classifier within workflow |
| Recurring task | Scheduler / Kestra | Fixed workflow or agent | No |
| Another agent invokes a subagent | Authorized parent runtime | Explicit published subagent ref | No general router by default |

**Do not conflate "trigger" and "agent skill."** A \`SKILL.md\` file guides agent behavior once running. It does not subscribe to incoming email or make itself a scheduled job.

## 2. TriggerBinding: the minimal contract

~~~yaml
# Platform proposal; not runnable Kubernetes, Kestra or vendor YAML.
apiVersion: agent-platform/v1alpha1
kind: TriggerBinding
metadata:
  id: public-support-mailbox
  tenantId: example-tenant
  workspaceId: support
spec:
  source:
    kind: email.received
    connectorRef: email-inbox@1
    subscriptionRef: mailbox-support
  target:
    kind: workflow
    deploymentId: support-workflow:prod
  executionPrincipalRef: svc-support-workflow
  enabled: true
  deduplication:
    keyPath: event.messageId
  execution:
    maxConcurrentRuns: 10
    timeoutSeconds: 300
~~~

\`TriggerBinding\` is configuration owned by the platform/integration layer; the incoming event body cannot freely choose the target or elevated credentials. An administrator must explicitly authorize the connector and deployment.

Fields worth adding over time: source-specific signature-verification config reference, event filters, delivery and retry policy, timezone, rate limits, queue priority, deployment environment, and non-secret reference to outbound completion actions.

## 3. Four end-to-end sample flows

All examples use fictional, generic SaaS concepts—no customer identifiers, proprietary domain objects, credentials, internal endpoint hosts or production metrics.

### Flow A — User selects a documentation agent

**Goal:** Demonstrate the full platform with no routing ambiguity and one read-only tool.

~~~mermaid
sequenceDiagram
    participant UI as Chat UI
    participant API as Platform API
    participant REG as Registry
    participant W as Runtime Worker
    participant GW as Tool Gateway
    participant KB as Documentation KB

    UI->>API: Select Documentation Agent, ask question
    API->>REG: Resolve published deployment + verify ACL
    REG-->>API: documentation-agent v1
    API-->>UI: 202, runId + eventsUrl
    API->>W: Schedule run
    W->>GW: knowledge.search(query)
    GW->>KB: Authorized read-only search
    KB-->>GW: Source IDs + excerpts
    GW-->>W: Allowed results
    W-->>UI: run progress and answer via API SSE
~~~

**Implementation requirements:** registry; explicit invocation API; worker adapter with model; existing KB tool; secure Tool Gateway; run event store and SSE. **No router, email connector, scheduler, or Deep Agents required.**

### Flow B — User asks a general assistant; router chooses an agent

**Goal:** Explain how the platform selects among three possible published agents.

~~~text
Registered authorized deployments:
  documentation-agent:prod       => API docs and how-to questions
  troubleshooting-agent:prod     => request errors, logs and traces
  report-agent:prod              => summaries and reports

Input: "Why does my API request return HTTP 500?"
  1. API authenticates user/workspace.
  2. Registry filters only authorized, deployed agents.
  3. Router ranks their public descriptions / example questions.
  4. Router chooses troubleshooting-agent if policy accepts.
     Otherwise return UNROUTABLE and ask user to choose.
  5. Run Service pins the selected published version.
  6. Worker loads approved logs/trace/KB tools, model and skill.
  7. LLM may propose a trace lookup; Tool Gateway checks access.
  8. Worker emits answer and final run status via the API event store.
~~~

**Important:** Step 3 chooses an **agent**. Step 7 chooses a **tool**. They are not interchangeable.

**MVP simplification:** defer auto-routing. The UI can expose an agent dropdown. This proves the full agent/tool/output flow at minimal cost and implementation risk.

### Flow C — Email intake triggers a support workflow

**Goal:** Demonstrate that a triggered workflow does not need to run a general agent for every email.

~~~mermaid
flowchart TD
    EMAIL["Mail connector receives new message"] --> VERIFY["Verify connector + deduplicate messageId"]
    VERIFY --> BIND["Resolve fixed support-workflow binding"]
    BIND --> RULES["Deterministic templates and routing"]
    RULES --> KNOWN{"Known simple request?"}
    KNOWN -->|Yes| DRAFT["Queue approved template draft"]
    KNOWN -->|No| CLASSIFY["Bounded classification step"]
    CLASSIFY --> TYPE{"What kind of request?"}
    TYPE -->|Docs| RETRIEVE["Read-only KB + optional model draft"]
    TYPE -->|Error| AGENT["Invoke bounded troubleshooting agent"]
    TYPE -->|Unclear| HUMAN["Human review"]
    RETRIEVE --> HUMAN
    AGENT --> HUMAN
    DRAFT --> HUMAN
    HUMAN --> SEND{"Authorized to send?"}
    SEND -->|Yes| OUT["Send through reviewed email connector"]
    SEND -->|No| HOLD["Keep as draft / escalate"]
~~~

**Reliability notes:** record the external message ID before accepting processing; workflow retries must not send duplicate mail. Model drafts are evidence-backed, reviewed and never auto-sent in the initial version. A large model is only invoked if the bounded workflow decides it is warranted.

**Integration:** Kestra (or a similar scheduler/orchestrator) can receive/poll messages and invoke \`POST /v1/runs\`; the platform handles agent execution. The agent runtime should not implement a second mailbox polling engine.

### Flow D — Scheduled summary task

**Goal:** Do a predictable job without expensive agent selection.

~~~text
Scheduler triggers every morning
   -> verify configured service principal
   -> lookup schedule TriggerBinding
   -> invoke fixed summary workflow/agent version
   -> fetch allowed data via read-only tool(s)
   -> optionally summarize with one bounded model call
   -> persist artifact and run events
   -> deliver draft or notification using separately approved action
~~~

Scheduled invocations require a managed **service principal** with explicit scopes; do not automatically reuse broad credentials of the human who created the schedule.

## 4. API examples and outcome paths

### Explicit invocation

~~~http
POST /v1/runs
Authorization: Bearer <user-token>
Idempotency-Key: chat-session-1-message-1
Content-Type: application/json

{
  "sessionId": "session-001",
  "target": {
    "type": "deployment",
    "id": "documentation-agent:prod"
  },
  "input": {
    "message": "Where can I find the API authentication guide?"
  }
}
~~~

Response (illustrative):

~~~json
{
  "runId": "run-demo-001",
  "status": "QUEUED",
  "agentId": "documentation-agent",
  "agentVersion": 1,
  "eventsUrl": "/v1/runs/run-demo-001/events"
}
~~~

### Automatic routing

~~~json
{
  "sessionId": "session-002",
  "target": { "type": "auto" },
  "input": {
    "message": "Investigate a failed API request"
  }
}
~~~

When no confident or eligible match is found, return an explicit routing outcome (e.g. \`UNROUTABLE\`) with a safe message asking for agent selection; never send request content to all agents. When resolution is asynchronous, the initial accepted run can have \`status: ROUTING\` and a null selected agent until a \`route.selected\` event occurs.

### Response transport by channel

| Channel | Recommended response |
| --- | --- |
| Chat/browser | HTTP 202 + \`runId\`, then authenticated SSE and REST status |
| API client | HTTP 202 + polling URL; SSE optional |
| Email trigger | Execution finishes, creates review draft; email reply is a separate authorized action |
| Webhook | Immediate 2xx acknowledgement after durable acceptance; caller receives run status by polling or configured signed callback |
| Schedule | Persist run and artifact, optionally issue notification through an approved connector |

An inbound webhook typically requires connector-level \`eventId\` deduplication **and** platform \`Idempotency-Key\` protection. The reply transport is not necessarily the same connection that delivered the original trigger.

## 5. MVP backlog in dependency order

| Order | Work item | Depends on | Definition of done |
| --- | --- | --- | --- |
| M0.1 | \`AgentDefinition\`, immutable \`AgentVersion\`, \`AgentDeployment\` | DB schema, tenant/workspace identity | One published test agent, clear version/digest |
| M0.2 | Scoped \`ToolDefinition\` / \`ToolBinding\` and model profile resolution | Existing tool integrations | Allow/deny before tool execution |
| M0.3 | \`AgentRun\` + idempotent \`POST /runs\` | Registry, policy | Return stable run ID; duplicate submission does not duplicate run |
| M0.4 | Worker and one simple runtime adapter | Run coordinator | Read-only KB tool can be invoked by explicitly selected agent |
| M0.5 | Append-only event store and \`GET /events\` SSE | Run service | UI renders status, tool progress, and final answer; reconnect works |
| M0.6 | Basic chat UI with **explicit agent selection** | APIs and event stream | A user can choose an agent and see results without a router |
| M1.1 | Session affinity and explicit agent switching | Sessions and registry | Follow-ups stay on same authorized agent |
| M1.2 | Eligible-agent discovery + low-cost router | Agent metadata and policy | Unambiguous request selects one; ambiguous request escalates |
| M1.3 | Webhook and schedule \`TriggerBinding\` | Integration auth, service identity | Bound event invokes expected target once |
| M1.4 | Email workflow with human review | Email connector + workflow engine | No model call for template case, no unapproved sends |
| M2.1 | Durable checkpoints, human approval and mutation idempotency | Persisted run state/tool intents | Pause/restart/resume without unauthorized writes |
| M2.2 | Deep Agents and constrained subagents | Adapter contract, runtime limits | Run respects budgets/tool scopes/delegation cap |

### Minimal demonstrable proof

**Chat UI -> explicit Documentation Agent -> Run Service -> Worker -> existing read-only knowledge tool -> Model -> Event Store -> API SSE -> Chat UI.**

Do this before adding router complexity, background triggers, multi-agent orchestration or executable skills.

### Next demonstrable proof

**General Chat UI -> authorized agent discovery -> router -> selected published agent -> same worker/event pipeline**, with an explicit "no safe match" test and zero tool/model access on authorization failure.

## 6. Suggested ownership, even with one deployable

| Boundary | Suggested owner | Why |
| --- | --- | --- |
| Agent Studio | Frontend | Chat, agent selection, run timeline, approval UX |
| Control Plane | Platform API module | Agent versions/deployments, tool/skill catalogs |
| Agent Router | Platform API module | Authorization-filtered target selection |
| Run Coordinator | Platform API module | Idempotency, state, events, delivery |
| Worker Runtime | Python module/process | Framework adapters, model context, tool calls |
| Tool Gateway | Backend security module | MCP/REST authorization, validation, idempotency |
| Trigger connectors | Integration orchestration | Webhook, email, schedule intake and binding |
| Event subscriber/outbound action | Integration orchestration | Human-reviewed reply/callback/scheduled artifacts |

Start modular. Split services only if isolation, different deployments or independent scaling materially improve the system.

## 7. Threat model and test matrix

| Test | Expected behavior |
| --- | --- |
| User requests hidden agent by ID | Denied, no agent leakage or alternate privileged routing |
| Session follows up after agent access revoked | New run denied before execution |
| Router receives prompt injection asking for a privileged agent | Router filters permissions; no privileged selection |
| New user asks question matching two agents | Clarify / require explicit choice |
| Model proposes unavailable tool | Tool Gateway denies; no connector invocation |
| Email provider retries same message | One logical run, no duplicate sends |
| Webhook signature invalid | Reject before trigger binding execution |
| Schedule runs under creator's now-revoked personal account | Use separate explicitly scoped service principal (or deny if unconfigured) |
| Browser disconnects and reconnects | Existing run continues; missing events replayed |
| Worker crashes while waiting for approval | Checkpoint + approval survive; safe resume when supported |
| External write times out after possible success | Reconcile outcome, no blind duplicate write |
| Agent exhausts configured model budget | Stop additional model calls; return bounded status |
| Invalid or missing agent deployment | Fail admission; do not silently choose another |

## 8. Open questions for implementation

1. Is the first integration UI-only, or should webhooks and schedules be in MVP? Recommended: UI first.
2. Does the system already have a persistent run/event store, or must one be introduced? Do not assume tool implementations imply it exists.
3. Do users select an agent explicitly, or enter a general assistant? Recommended: explicit first; auto-routing second.
4. Do we need to support concurrent messages on the same session immediately? Recommended: serialize turns in MVP.
5. Is SSE sufficient for UI transport? Recommended: yes for server -> browser streaming; REST for commands; add WebSocket only if bidirectional real-time needs demand it.
6. Which tools are safe/read-only and ready for a POC? Start with synthetic or non-sensitive documentation lookup.
7. Who owns authorization checks inside legacy MCP/REST tools? A gateway policy is necessary but the downstream service must still enforce resource-level ACL.

## 9. Relationship to the published blog

The [agent-framework comparison article](https://buianhtai.github.io/en/blog/choosing-agent-framework-configurable-platform-2026/) is an editorial overview. These documents are the **technical architecture contract** for implementing invocation, routing, run execution and response streaming. Future articles may summarize the concepts, but should never copy private environment details into public content.

No example in this document represents a specific customer deployment.
