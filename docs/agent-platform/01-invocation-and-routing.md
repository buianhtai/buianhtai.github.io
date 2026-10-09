# 01 — Agent Invocation and Routing Architecture

**Status:** Proposed  
**Depends on:** [Architecture index](./README.md) · [Runtime and event delivery](./02-runtime-workers-and-events.md)

## 1. Purpose: how a message becomes an agent run

A tool registry does not listen for requests or select an agent. The invocation architecture answers six questions:

1. **Who triggers execution?** UI, authenticated API, webhook connector, scheduler, email connector, or another permitted workflow/agent.
2. **Which principal owns the action?** Authenticated user or dedicated service principal, tenant and workspace.
3. **Was a target specified?** An explicit selected agent, a configured trigger binding, or a continuing conversation session may already determine the target.
4. **If not, how is one agent selected?** The router first filters authorized published candidates, then performs a bounded matching step. There is no guarantee that every input maps to an agent.
5. **Which published version runs?** Resolve an active deployment and freeze the version/content digest before starting execution.
6. **How does the caller learn the outcome?** Receive a `runId`; consume run events via SSE or poll state; scheduled/webhook clients may use a callback or outbound integration.

## 2. Ingress and target selection precedence

~~~mermaid
flowchart TD
    INPUT["Request from chat, API, connector"] --> AUTH["Authenticate principal; resolve tenant/workspace"]
    AUTH --> VALIDATE["Validate scope, idempotency, rate limits"]
    VALIDATE --> EXPLICIT{"Explicit agent/deployment?"}
    EXPLICIT -->|Yes| ALLOWED["Verify target is deployed and authorized"]
    EXPLICIT -->|No| BOUND{"Trigger has fixed target?"}
    BOUND -->|Yes| ALLOWED
    BOUND -->|No| SESS{"Session already bound?"}
    SESS -->|Yes| ALLOWED
    SESS -->|No| CANDIDATES["Filter eligible published agents"]
    CANDIDATES --> ROUTE["Cheap router: metadata/rules/embeddings"]
    ROUTE --> DECIDE{"Unambiguous, eligible match?"}
    DECIDE -->|Yes| ALLOWED
    DECIDE -->|No| FALLBACK["UNROUTABLE: clarify / human / fallback"]
    ALLOWED --> PIN["Pin AgentVersion + effective policy"]
    PIN --> RUN["Persist AgentRun / enqueue"]
    RUN --> RESP["202 Accepted: runId + eventsUrl"]
~~~

**Precedence and constraints:**

1. **Explicit selection:** chat/API request includes `agentId` or `deploymentId`; validate access and allowlist. A request may not force an unpublished version.
2. **Trigger binding:** source (for example, a registered webhook) maps to a configured, authorized agent or deterministic workflow.
3. **Session affinity:** follow-up chat messages continue using the session's bound agent, unless the caller explicitly starts a new session or requests an authorized switch. **Do not silently reroute a continuing conversation every turn.**
4. **Automatic routing:** only new, unbound sessions and requests with no target reach the router.

On any unauthorized explicit/bound target, **deny** rather than silently routing to a more privileged agent. No implicit fallback that broadens permissions.

### Example A — explicit target (no routing model)

~~~http
POST /v1/runs
Authorization: Bearer <user-token>
Idempotency-Key: message-001
Content-Type: application/json

{
  "target": { "type": "deployment", "id": "documentation-agent:prod" },
  "sessionId": "session-001",
  "input": {
    "message": "How do I authenticate to the API?"
  }
}
~~~

The server resolves the deployment to a published version, creates a run, and returns a run ID. It skips agent discovery.

### Example B — automatic routing for a new chat

~~~http
POST /v1/runs
Authorization: Bearer <user-token>
Idempotency-Key: message-002
Content-Type: application/json

{
  "target": { "type": "auto" },
  "sessionId": "new-session-002",
  "input": {
    "message": "Why did my API request fail with HTTP 500?"
  }
}
~~~

The router may choose a troubleshooting agent **only if** it is enabled, published, eligible for this principal/workspace, and the match passes the configured acceptance policy.

### Example C — bound trigger (no routing model)

~~~yaml
# Platform configuration proposal, NOT runnable Kestra YAML.
id: daily-report-trigger
source:
  kind: schedule
  cron: "0 9 * * 1-5"
  timezone: "UTC"
target:
  kind: agentDeployment
  id: summary-agent:prod
executionPrincipalRef: svc-report-runner
enabled: true
~~~

This schedule knows its target. The worker may use a model to summarize data, but **routing itself costs zero LLM calls**.

Extension-specific routing and model/decision implementations remain behind the [plug-and-play adapter ports](./08-plugin-and-adapter-architecture.md). Routing must still filter authorized published agents before consulting those adapters.

## 3. Define the agent registry entries the router can understand

At least these fields should be searchable on a **published agent version or approved routing projection**:

~~~yaml
# Illustrative metadata for discoverability, not full AgentDefinition.
agentId: troubleshooting-agent
deploymentId: troubleshooting-agent:prod
name: API Troubleshooting
description: Diagnose generic request errors using approved logs, traces and docs.
routingExamples:
  - "Investigate my failed API request"
  - "What caused HTTP 500?"
supportedIntents: [api-troubleshooting, request-errors]
requiredCapabilities: [logs.search, trace.get, kb.search]
tenantScope: workspace
routingEnabled: true
~~~

`requiredCapabilities` is metadata for **filtering**, not a grant. Policies may exclude a deployed agent at invocation time if the caller cannot access the data/tools it needs.

Agent administrators control descriptions and examples; published versions are immutable. Re-index only after publish/deploy or access-policy change. Do not expose hidden agents or their descriptions to unauthorized principals.

## 4. Router algorithm (MVP)

**Recommendation: avoid a general-purpose "router agent" initially.** A router does not need to plan or call tools; its job is to pick from a finite list.

| Phase | Responsible component | LLM used? |
| --- | --- | --- |
| Candidate discovery | Registry + authorization | No |
| Hard filters | Deployment, tenant/workspace, allowed use, policy | No |
| Exact mappings | Explicit intent / deterministic integration rules | No |
| Similarity ranking | Embedding similarity of user request vs agent descriptions/examples | Optional embedding inference; not a reasoning loop |
| Ambiguity handling | Router policy | No; optional small classifier only after measured need |
| Final authorization | Platform policy check | No |
| Immutable version resolution | Control Plane | No |

Illustrative pseudocode:

~~~python
async def resolve_target(request, context):
    explicit = request.target.id if request.target.type == "deployment" else None
    if explicit:
        return await registry.resolve_authorized(explicit, context)

    bound = await triggers.get_authorized_target(request.trigger_id, context)
    if bound:
        return await registry.resolve_authorized(bound, context)

    session_agent = await sessions.bound_deployment(request.session_id, context)
    if session_agent:
        return await registry.resolve_authorized(session_agent, context)

    candidates = await registry.list_eligible_deployments(context)
    if not candidates:
        return RouteOutcome.unroutable("no_eligible_agents")

    direct = await routing_rules.match(request.input, candidates)
    if direct and direct.is_unambiguous:
        return await registry.resolve_authorized(direct.deployment_id, context)

    ranked = await similarity.rank(request.input, candidates, top_k=3)
    if await routing_policy.accept(ranked, context):
        return await registry.resolve_authorized(ranked[0].deployment_id, context)

    return RouteOutcome.unroutable("ambiguous_or_out_of_scope")
~~~

`routing_policy.accept` must use **evaluated/calibrated thresholds**, not a guessed fixed confidence number. Similarity scores are not probabilities. Its training/test data and per-intent failure rates should be reviewed. An LLM classifier can be added later for genuinely ambiguous cases with a token budget, strict allowed candidates and a verified post-selection check.

**Do not pass raw secret tool configurations or private agent definitions into embeddings or third-party model routing.** Route only on an authorized, minimized projection.

### Unroutable requests are normal

- **Zero eligible agents:** show "No agent available" or ask the user to select a permitted agent.
- **Multiple close matches:** ask a disambiguation question; do not launch all candidates.
- **Unsupported intent:** offer a manual queue, deterministic fallback, or explicit selection.
- **Router unavailable:** explicit and bound invocations still work; auto route returns a retryable routing error or safe fallback.
- **Permission revoked:** stop before execution, regardless of router score.

A `RouteDecision` record should save method, candidate IDs (not secret definitions), selected deployment/version, reason/status, sanitized request fingerprint, and timing.

## 5. Sessions: what happens on the second message?

A user's chat may look like this:

~~~mermaid
sequenceDiagram
    participant UI as Chat UI
    participant API as Platform API
    participant ROUTER as Agent Router
    participant S as Session Store
    participant RUN as Run Service

    UI->>API: First message, target=auto, session=new
    API->>S: Create session with scoped principal
    API->>ROUTER: Select eligible agent
    ROUTER-->>API: documentation-agent:prod
    API->>S: Bind selected deployment to session
    API->>RUN: Create run 1; pin published version
    RUN-->>UI: runId1 + SSE URL
    UI->>API: Follow-up message, same sessionId
    API->>S: Read existing bound agent
    S-->>API: documentation-agent:prod
    API->>RUN: Create run 2, skip router
    RUN-->>UI: runId2 + SSE URL
~~~

**Session-binding policy:**

- First auto-routed message binds the chosen `deploymentId`, if routing succeeds.
- Continuing messages default to that agent. Switching agents should create a new thread or explicitly transfer the session with an audit event.
- **Agent version stickiness is separate from agent identity.** For predictable conversations, pin a version to the session unless a deliberate migration policy says otherwise. Every run always records its exact version.
- The session store identifies a conversation; LangGraph/Deep Agents' internal thread/checkpoint IDs belong to the runtime layer and should not be exposed as public client IDs.
- Concurrent messages in one session require serialization or versioned optimistic concurrency to avoid memory races and out-of-order replies.
- Expired/revoked agent access prevents the next run even when the session remains bound.

## 6. API contract and lifecycle

**MVP API surface:**

| HTTP | Endpoint | Responsibility |
| --- | --- | --- |
| POST | `/v1/runs` | Admit execution of explicit, trigger-bound or auto target |
| GET | `/v1/runs/{runId}` | Return status, resolved agent/version, usage summary |
| GET | `/v1/runs/{runId}/events` | SSE event stream with resume cursor |
| POST | `/v1/runs/{runId}:cancel` | Request cancellation |
| GET | `/v1/agents?eligible=true` | List only caller-eligible agent deployments |
| POST | `/v1/sessions` | Create scoped chat session |
| GET | `/v1/sessions/{sessionId}` | Read current agent/session metadata |

Suggested admission response:

~~~http
HTTP/1.1 202 Accepted
Location: /v1/runs/run-001
Content-Type: application/json

{
  "runId": "run-001",
  "sessionId": "session-001",
  "status": "QUEUED",
  "agentId": "documentation-agent",
  "agentVersion": 3,
  "eventsUrl": "/v1/runs/run-001/events"
}
~~~

**Important:** In the MVP, explicit/bound/deterministically-routed target resolution may happen *before* `202`, so agent ID/version can be returned. If routing is asynchronous, return `status: "ROUTING"` with `agentId: null` until a `route.selected` event appears. Never invent an already-selected agent ID in a queued response.

**Idempotency:** callers send a unique key per logical request. Persist admission responses by `principal + tenant + endpoint + key` and reject key reuse with a different payload. Duplicate retries must not enqueue multiple runs.

## 7. Security and cost guardrails

- **Authorization filters precede similarity ranking.** No cross-tenant candidates may reach the router, not even via summaries.
- **Agent config is immutable for running tasks.** Do not rebuild active runs from mutable drafts.
- **One primary agent per run.** No automatic multi-agent fanout at routing time.
- **Routing is cheap by design.** Fixed-target triggers and selected-agent chat consume zero routing LLM tokens.
- **Routing has a timeout and fallback.** Never route indefinitely or spin up "thinking" loops just to pick an agent.
- **Routing metadata is untrusted author content.** Descriptions cannot override policy, grant capabilities or inject privileged model instructions.
- **Incoming email/webhook payloads are untrusted.** Validate their source before using them for routing; strip secrets and minimize PII.
- **Record the route decision.** Log matching method, sanitized reason, costs and latency for evaluation. Do not expose hidden candidates.

## 8. Open design decisions

1. Which routing modes belong to the initial UI: explicit selection only, or explicit + auto?
2. Should selected deployment persist for all chat follow-ups, or should the UI expose an explicit "switch agent" operation? Recommendation: sticky with explicit switch.
3. Should embedding rankings be scoped to a workspace, an organization or approved shared agents? Recommendation: workspace by default, opt-in shared agents.
4. Which service owns the `TriggerBinding` table: Control Plane or a shared Integration Service? Recommendation: Integration Service, registered through Control Plane.
5. Must the API synchronously resolve auto-routing, or can routing be queued? Recommendation: synchronous cheap routing in MVP, asynchronous when complexity justifies it.
