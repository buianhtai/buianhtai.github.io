# RFC-001: Configuration-Driven Agent Platform

**Status:** Proposed (architecture draft, not an implementation)
**Date:** 2026-10-09
**Owners:** Platform engineering
**Decision scope:** MVP control plane, execution plane, policy model, configuration contract, integration boundaries
**Related research:** [AI agent documentation research](../ai-agent-documentation-research.md), [LangChain alternatives](../langchain-alternatives-documentation-ai.md)
**Repository note:** This document is a public, domain-neutral architecture proposal. It includes no private infrastructure or credentials.

## 1. Executive summary

Build a developer-friendly, user-configurable platform for creating, testing, publishing, and running agents. Users select a model profile, write instructions, bind approved tools, attach versioned Agent Skills, and choose an execution mode. Every run resolves a published immutable specification under explicit tenant/workspace permissions. The platform owns identity, policies, secrets, budgets, observability, versioning, and lifecycle; frameworks own the model/agent execution mechanics.

**Proposed MVP architecture:** React Agent Studio + Python FastAPI modular backend + Python runtime adapters (LangChain simple, Deep Agents deep, LangGraph workflow) + PostgreSQL + pluggable skill/artifact storage + LiteLLM model gateway + MCP/REST tools. Include server-side policy enforcement from day one. Do not create independent microservices, a graph-based editor, or uncontrolled shell execution in the first milestone.

This is a design contract for review. Framework calls, provider features, and version compatibility must be smoke-tested and pinned before code implementation.

**Companion artifacts:** [JSON Schema (v1alpha1)](./contracts/agent-platform-v1alpha1.schema.json) · [example agent manifest](./examples/agent-platform-incident-triage.json). These are proposed contracts and should be versioned and automatically validated when implementation starts.

## 2. Motivation and scope

Existing agent frameworks supply execution loops but do not automatically give product users safe, auditable, multi-tenant configuration. We need a clear boundary between an agent definition (desired behavior), an installed deployment (approved effective behavior), and a run (what actually happened).

### Goals

1. Users can create, validate, test, publish, and deploy an agent without modifying server source code.
2. Users configure model, instructions, tools, Agent Skills, optional subagents, memory mode, and execution limits.
3. All runnable dependencies are referenced by immutable versions/digests; historical runs remain reproducible at the configuration level.
4. Tools execute only via enforced capabilities, scoped identity, and approvals; the LLM never grants itself permission.
5. Simple, deep, and graph-driven execution share one lifecycle, event protocol, audit trail, and cost accounting.
6. Long-running runs support cancellation, persisted checkpoints, approval, restart-safe recovery, and deterministic tracking of side effects.
7. All API and stored objects are tenant/workspace scoped, with ownership and role-based access rules.

### Non-goals in MVP

- A drag-and-drop workflow designer; define workflow graphs through reviewed templates/code initially.
- Model training, fine-tuning, or self-hosted LLM scheduling.
- Executing arbitrary uploaded code or untrusted shell commands.
- Full A2A interoperability, marketplace billing, or federated agent discovery.
- Exactly-once external side effects across arbitrary APIs.
- Replacing specialist data/knowledge services with the agent runtime.

## 3. Proposed decisions (ADRs)

| ID | Decision | Rationale | Revisit when |
| --- | --- | --- | --- |
| D-01 | Separate logical control and execution planes; same deployable initially | Simple operations now, safe scaling path later | Significant independent workload growth |
| D-02 | PostgreSQL authoritative registry for versioned definitions and runs | Transactions, relational constraints, audit and queryability | Capability graph needs complex traversals |
| D-03 | Runtime adapters: simple (LangChain), deep (Deep Agents), workflow (LangGraph) | Fit complexity to task; limit framework coupling | New runtime has proven differentiated value |
| D-04 | Agent versions immutable; deployment pointers mutable | Safe rollback, traceable execution and reproducibility | Never for published versions |
| D-05 | Skill bundles follow Agent Skills specification; immutable stored artifacts | Interoperability and portable authoring | Standard evolves |
| D-06 | Tool Gateway mediates MCP and REST invocation; deny by default | Central authentication, authorization, audit and limits | Never bypass for platform tools |
| D-07 | Explicit approval checkpoint before mutating high-impact operations | Human control and auditable resume | After policy/UX validation |
| D-08 | LiteLLM (or replaceable compatible gateway) for model routing | Key isolation, metering, consistent provider access | Cost/capability benchmarks |
| D-09 | No model, prompt, or skill is a trust boundary | Resist tool misuse/prompt injection | Never |
| D-10 | Event-driven streaming and polling API over runs; not framework-native public graph objects | Stable product API while adapters evolve | Client compatibility requirements |

### Options considered

- **Build on Dify/Flowise:** excellent UI/plugin references but coupling to their internal abstractions and licensing deserves review. Not proposed as runtime foundation.
- **Use LangChain alone for everything:** low complexity for simple agents, but explicit durable workflows and planning benefit from LangGraph/Deep Agents.
- **Use Deep Agents for every agent:** adds unnecessary capabilities/cost to trivial retrieval agents.
- **Use Neo4j for configuration registry:** useful eventually for recursive capability and dependency queries, but PostgreSQL is simpler for transactional versioning; avoid dual-write in MVP.
- **Merge control plane and business application domain:** would constrain reuse. Keep the platform domain-neutral with optional industry adapters.

## 4. Architecture boundaries

~~~mermaid
flowchart TB
    STUDIO["Agent Studio / Playground"] --> API["API: auth, RBAC, versioning"]
    API --> REG["Control plane: agent/config registry"]
    API --> PUB["Publish and deployment workflow"]
    API --> RUN["Execution service / scheduler"]
    REG --> PG[("PostgreSQL")]
    PUB --> PG
    REG --> OBJ[("Versioned skill/artifact store")]
    RUN --> RES["Resolve immutable deployment + effective policy"]
    RES --> ADAPTER{"Runtime adapter"}
    ADAPTER --> SIMPLE["LangChain simple"]
    ADAPTER --> DEEP["Deep Agents deep"]
    ADAPTER --> GRAPH["LangGraph workflow"]
    SIMPLE --> TG["Tool Gateway: authz, validation, approval, audit"]
    DEEP --> TG
    GRAPH --> TG
    TG --> MCP["MCP connectors"]
    TG --> REST["Reviewed REST connectors"]
    TG --> KB["KB / retrieval adapters"]
    SIMPLE --> MG["Model Gateway"]
    DEEP --> MG
    GRAPH --> MG
    MG --> PROVIDERS["Approved model providers"]
    RUN --> CHECK[("Checkpoints and run events")]
    RUN --> OBS["Traces, metrics, evaluation"]
~~~

**Boundary rule:** A runtime adapter is a library integration, not an authorization server. It may propose tool calls. The Tool Gateway must recheck permissions at execution time against a trustworthy scoped context. Long-running and scheduled runs use the same deployment policy resolution.

**Initial deployables:** (a) Agent Studio web app, (b) agent-platform API/worker Python service, (c) PostgreSQL, (d) optional model gateway and telemetry backend. Extract workers or tool gateway into separate processes only when justified by isolation/scaling.

## 5. Configuration contract (agent-platform/v1alpha1)

This is **our own schema**, not a native Deep Agents configuration. Control-plane validation rejects unknown fields and unresolvable or unauthorized references. Agent IDs are stable; version numbers and asset digests are immutable when published.

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: Agent
metadata:
  id: incident-triage
  tenantId: tenant-demo
  workspaceId: ops
  displayName: Incident Triage
spec:
  runtime:
    kind: deep            # simple | deep | workflow
    templateRef: null     # required only for workflow mode
  instructions: |
    Investigate failures and cite supporting evidence.
    Never mutate external systems without approval.
  model:
    profileRef: model-balanced@2
    parameters:
      temperature: 0.1
  tools:
    - ref: knowledge.search@3
      mode: read
    - ref: logs.query@2
      mode: read
    - ref: incidents.create@1
      mode: write
      approval: always
  skills:
    - ref: root-cause-analysis@1.0.0
    - ref: technical-report@1.2.0
  subagents:
    - agentVersionRef: log-investigator@4
      purpose: Investigate correlated logs and traces
  memory:
    threadPersistence: true
    crossSession: false
  limits:
    maxSteps: 20
    maxDurationSeconds: 180
    maxInputTokens: 200000
    maxOutputTokens: 20000
    maxCostUsd: 0.50
  output:
    format: text
~~~

### Semantics and validation

- **metadata**: tenant/workspace identity is assigned/verified by server authorization, never trusted from client-supplied body. Existing agent ID cannot change.
- **runtime.kind**: simple = LangChain create_agent; deep = Deep Agents create_deep_agent; workflow = registered, reviewed LangGraph workflow template. Exact library adapter calls are implementation details.
- **model.profileRef**: resolves to a pinned model profile/revision; not arbitrary provider keys. Validate structured-output/tool-calling abilities and organization allowlists.
- **tools**: versions reference catalog definitions; a binding may only reduce allowed operations/scopes, never expand them. Approval mode is policy-constrained, never downgraded by author.
- **skills**: versions reference validated bundles; importing skill instructions does not automatically permit listed tools. Script execution disabled for MVP.
- **subagents**: version refs must resolve, graph must be acyclic, delegation depth capped. Each subagent resolves its own effective permissions; no implicit tool/skill inheritance.
- **memory**: thread checkpoint state is operational persistence; cross-session user memory is a separate opt-in scoped capability.
- **limits**: enforce both pre-invocation and at runtime (model usage, tool calls, elapsed wall time, delegation count). If billing/usage data is delayed, stop conservatively.
- **output.format**: start with text and JSON schema output; validate output against declared schema if enabled.
- Only server-issued deployment ID + agent version content hash drive production execution. Mutable draft content is playground-only.

### Version lifecycle

DRAFT -> VALIDATED -> PUBLISHED (immutable) -> DEPLOYED (environment pointer) -> DEPRECATED / ARCHIVED.

Editing PUBLISHED creates a new draft; publishing computes configuration digest and content-addressed skill digests. Deployment switches are atomic; older versions remain accessible for audit/rollback. Running executions pin the version and digest at start.

## 6. Domain model (conceptual ERD)

~~~mermaid
erDiagram
    TENANT ||--o{ WORKSPACE : contains
    WORKSPACE ||--o{ AGENT_DEFINITION : owns
    AGENT_DEFINITION ||--o{ AGENT_VERSION : versions
    AGENT_VERSION ||--o{ TOOL_BINDING : permits
    TOOL_DEFINITION ||--o{ TOOL_VERSION : versions
    TOOL_VERSION ||--o{ TOOL_BINDING : referenced
    AGENT_VERSION ||--o{ SKILL_BINDING : installs
    SKILL_DEFINITION ||--o{ SKILL_VERSION : versions
    SKILL_VERSION ||--o{ SKILL_BINDING : referenced
    MODEL_PROFILE ||--o{ MODEL_PROFILE_VERSION : revisions
    MODEL_PROFILE_VERSION ||--o{ AGENT_VERSION : used_by
    AGENT_DEFINITION ||--o{ AGENT_DEPLOYMENT : deployed
    AGENT_VERSION ||--o{ AGENT_DEPLOYMENT : active_version
    AGENT_DEPLOYMENT ||--o{ AGENT_RUN : executes
    AGENT_SESSION ||--o{ AGENT_RUN : groups
    AGENT_RUN ||--o{ RUN_EVENT : emits
    AGENT_RUN ||--o{ APPROVAL_REQUEST : requests
    AGENT_RUN ||--o{ TOOL_INVOCATION : invokes
    AGENT_RUN ||--o{ RUN_CHECKPOINT : snapshots
~~~

Additional entities: principal/role grants, connector credential references, subagent binding edges, evaluation runs, artifact digests, environment and deployment history.

#### Storage invariants

- Every workspace-owned row includes tenant ID and workspace ID. Index on (tenant_id, workspace_id, id); enforce cross-tenant references in application and database constraints.
- agent_versions unique (agent_id, version), digest immutable, content payload JSONB with schemaVersion; published payload cannot be modified.
- agent_deployments unique (agent_id, environment), points to exactly one published version, has compare-and-swap revision number and deployment audit history.
- run_events unique (run_id, event_seq); append-only event stream with monotonic sequence.
- tool_invocations have stable idempotency keys unique per effective target/action/run operation. Store invocation intent, approval, outcome, provider request ID and audit principal.
- run_checkpoints map run_id + execution thread_id to the framework-native checkpoint references; framework checkpoint payloads are isolated from public APIs.
- credentials contain **references**, never raw secrets. Secret values live in an appropriate secret manager or encrypted per-tenant service; never serialized into snapshots, logs or tool output.
- Put large traces, files and checkpoint blobs in separate storage as needed. PostgreSQL remains source of run status and audit indexing.

## 7. Control-plane API v1 (proposal)

All paths shown are scoped by server-verified tenant/workspace context (identity token or route scope). JSON payloads validated and unknown fields rejected.

| HTTP | Endpoint | Semantics |
| --- | --- | --- |
| POST | /v1/agents | Create draft agent definition |
| GET | /v1/agents | Paginated list, authorized workspace only |
| GET | /v1/agents/{id} | Read metadata and current version refs |
| PUT | /v1/agents/{id}/draft | Update draft; requires If-Match optimistic revision |
| POST | /v1/agents/{id}/validate | Validate refs, schema, capability, policy, subagent DAG |
| POST | /v1/agents/{id}/publish | Publish immutable version; returns version + content digest |
| GET | /v1/agents/{id}/versions/{version} | Read immutable configuration with secrets redacted |
| PUT | /v1/agents/{id}/deployments/{env} | Atomically update active version; requires deployment revision |
| GET | /v1/tools | Authorized tool/version catalog, schemas and risk labels |
| POST | /v1/tools:register | Register reviewed connector/tool; admin or publisher role |
| GET | /v1/skills | Skill catalog, versions, digests and compatibility |
| POST | /v1/skills:import | Upload source bundle for validation/quarantine/review |
| GET | /v1/model-profiles | Authorized model profiles, capability flags, budgets |
| POST | /v1/runs | Start a run of an active deployment; idempotency-key header |
| GET | /v1/runs/{runId} | Status, resolved version/digest, trace/usage summary |
| GET | /v1/runs/{runId}/events | Ordered SSE; Last-Event-ID replay/cursor support |
| POST | /v1/runs/{runId}:cancel | Cooperative cancel with bounded shutdown |
| GET | /v1/approvals | Pending authorizable approval requests |
| POST | /v1/approvals/{id}:resolve | Approve/reject with actor, reason, revision and expiry |

Proposed start-run request:

~~~json
{
  "deploymentId": "incident-triage:stage",
  "sessionId": "session-123",
  "input": {"messages": [{"role": "user", "content": "Why is our API returning 502?"}]},
  "clientRequestId": "request-uniquely-generated"
}
~~~

Proposed start-run response:

~~~json
{
  "runId": "run-123",
  "status": "QUEUED",
  "deploymentId": "incident-triage:stage",
  "agentVersion": 7,
  "eventsUrl": "/v1/runs/run-123/events",
  "traceId": "trace-123"
}
~~~

- POST /runs returns 202 Accepted, with a Location header to run status. It does not claim synchronous completion.
- Return 400 for malformed contract, 401/403 for denied access, 404 without leaking cross-tenant resource existence, 409 for lifecycle conflicts, 422 for valid syntax but incompatible runtime dependencies, 429 for quota/budget policy, and 503 for unavailable execution capacity.
- Idempotency-Key required on mutating API operations and run submission where retries could duplicate work. Scope keys to tenant + principal + endpoint and persist their results with expiration.
- SSE sample event envelope: {id, runId, seq, type, occurredAt, traceId, payload}; event types run.started, message.delta, tool.requested, approval.required, tool.completed, run.paused, run.resumed, usage.updated, run.completed, run.failed, run.cancelled.
- SSE replay must not stream another tenant's runs. Retention and truncation of large tool payloads are explicit policy settings.

## 8. Runtime compiler interface

The runtime compiler resolves **only** verified immutable inputs:

~~~python
class ExecutionContext(Protocol):
    tenant_id: str
    workspace_id: str
    principal_id: str
    run_id: str
    trace_id: str

class RuntimeAdapter(Protocol):
    async def compile(self, version: "PublishedAgentVersion",
                      capabilities: "ResolvedCapabilities") -> "ExecutableAgent": ...
    async def stream(self, agent: "ExecutableAgent", request: "RunInput",
                     context: ExecutionContext) -> AsyncIterator["RunEvent"]: ...
    async def resume(self, run_id: str, decision: "ApprovalDecision",
                     context: ExecutionContext) -> None: ...
    async def cancel(self, run_id: str, context: ExecutionContext) -> None: ...
~~~

Pseudo-flow (normative enforcement belongs to the platform, not prompts):

1. Authenticate caller, resolve tenant/workspace and effective principal.
2. Resolve deployment -> published version -> manifest digest, provider/model profile, skill digests and tool versions.
3. Verify deployment allowed in environment, principal grants, object-level ACL, quotas, model capabilities and connector availability.
4. **Compute effective capabilities as an intersection**: caller grants ∩ agent grants ∩ tool binding scopes ∩ environment policy ∩ target-resource ACL. For scheduled runs, use an explicitly granted service principal in place of caller grants; never silently widen authority.
5. Initialize model client through gateway; attach budget/cost accounting, tracing, timeouts and cancellation token.
6. Materialize read-only skill bundles and isolated checkpoint/runtime working storage. Code-execution tools remain absent in MVP.
7. Compile one of the adapters and start streaming normalized run events.
8. Before each tool call, Tool Gateway repeats authz on resolved target IDs, validates input schema, egress destination, rate limits, approval policy and idempotency.
9. Persist tool intent before external mutation. Human approval, if needed, suspends execution at a durable checkpoint.
10. Commit run terminal state + usage reconciliation. Emit auditable event with secrets/PII redacted.

**Model compatibility:** The profile registry records at least model ID, provider, tool-calling support, structured-output support, context limit, pricing source, residency restrictions and fallback set. Prevent unsupported configurations at publish time. A fallback model must satisfy capability/security/residency constraints too.

**Dependency isolation:** Runtime adapters are versioned packages. Record runtime kind, adapter version and framework package lock fingerprint with each execution; adapter upgrades are tested against saved fixtures before deployment.

## 9. Tools and skills as separate products

### ToolDefinition / ToolVersion

- Identity and purpose, connector type (MCP/REST/internal), JSON input/output schema, auth scheme, allowlisted endpoint/host, version/digest, operation classification (read/write/destructive), tenant availability, rate limit and timeout.
- ToolBinding narrows permitted operations, resource filters, arguments and human approval; must **not** contain arbitrary URL supplied by the LLM.
- Raw HTTP tool is excluded from MVP. Reviewed HTTP integrations use an allowlisted destination, method, payload shape, token scope and egress policy.
- A tool is never authorized because a skill requested it or the prompt says it is safe.

### SkillDefinition / SkillVersion

- Follow https://agentskills.io/specification: required SKILL.md with valid name/description YAML frontmatter; optionally references/ and assets/. Script files are importable but not runnable in MVP.
- Import workflow: upload -> size/extension checks -> parse/validate -> antivirus/content/security checks -> quarantine -> reviewer approval -> digest + immutable version -> publish.
- Provide progressive disclosure: discover skill metadata first, then fetch SKILL.md/reference content only when activated. Require explicit scope to read artifacts across tenants.
- Skill bundle is instructions and artifacts, not permission. Any allowed-tools hints are advisory and cannot extend the effective Tool Gateway allowlist.
- Cross-agent or cross-tenant skill sharing requires explicit grants and licenses. Pin exact version/digest in published agent version.

### Subagents

- Bind to published agentVersionRefs with explicit purpose; validate no cycles, maximum depth and fanout.
- Subagent has independent runtime/model/tool/skill policy, budgets and traces. Parent budget is a hard upper bound, and delegation cannot widen the parent's effective grants.
- Pass only a scoped task and necessary data; do not automatically share full session history, secrets, workspace filesystem, or skill set.

## 10. Principal, policy, and audit model

Three identities matter:
1. **Human caller**: whose request initiated the work.
2. **Agent definition identity**: versioned application object describing capability, not necessarily a privileged service account.
3. **Execution principal**: human-delegated authority for interactive runs or explicitly provisioned service identity for schedules/integrations.

Example policy decisions:
- An agent can read a KB document only if tenant/workspace visibility, document ACL, caller/service principal, and binding scopes all allow it.
- A tool that creates an incident requires human approval on its proposed target/payload; approving an intent never authorizes a different payload.
- Credentials are scoped to the connector and principal; an LLM cannot ask for the raw secret, and tool outputs are redacted.
- A rejected or expired approval cannot be replayed. A decision has immutable request hash, version, actor, timestamp and reason.
- Untrusted retrieved content, tool results and skills cannot override platform policy or change the agent's selected authority.

Store audit events for agent version publish/deploy, permission change, tool registration/credential change, run start/stop, approval, tool intent/commit and model spend. Link all events with run ID, trace ID, tenant/workspace, actor and exact manifest digest.

## 11. Run lifecycle and recovery

~~~mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> RUNNING
    RUNNING --> WAITING_APPROVAL
    WAITING_APPROVAL --> RUNNING: approved + resume
    WAITING_APPROVAL --> REJECTED: denied / expired
    RUNNING --> SUCCEEDED
    RUNNING --> FAILED
    QUEUED --> CANCELLED
    RUNNING --> CANCELLED
    WAITING_APPROVAL --> CANCELLED
    FAILED --> RETRY_QUEUED: safe retry
    RETRY_QUEUED --> RUNNING
    SUCCEEDED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
    REJECTED --> [*]
~~~

**Recovery semantics:** Checkpoints help restore agent computation but do **not** make an external API mutation exactly-once. For a mutating tool, persist an operation ID, target and request hash before invocation; use downstream idempotency key or query previous outcome before retry. If external outcome is ambiguous, mark RECONCILIATION_REQUIRED and stop automatic retries until verified. Approvals suspend at a checkpoint and resume with the same thread/run identifiers.

**Failure taxonomy:** invalid configuration, model unavailable, tool denied, approval rejected/expired, quota exceeded, provider rate limit, timeout, cancellation, ambiguous side effect, runtime bug, transient infrastructure. Only retry classes proven safe, with bounded exponential backoff.

## 12. End-to-end sequence: incident triage

~~~mermaid
sequenceDiagram
    participant U as User / Studio
    participant API as Platform API
    participant CP as Registry / Policy
    participant R as Runtime Worker
    participant L as Model Gateway
    participant TG as Tool Gateway
    participant H as Approver
    participant X as Incident API
    U->>API: POST /runs (deployment, input, idempotency key)
    API->>CP: Resolve version + principal + policy
    CP-->>API: Pinned manifest and grants
    API-->>U: 202 + runId + eventsUrl
    API->>R: Enqueue run with resolved identifiers
    R->>L: Model messages + allowed tool schemas
    L-->>R: Tool call: logs.query
    R->>TG: logs.query with scoped auth context
    TG-->>R: Audited/filtered results
    R->>L: Analysis + evidence
    L-->>R: Proposed incidents.create
    R->>TG: Validate request, persist intent
    TG-->>R: Approval required
    R->>CP: Durable checkpoint + approval request
    CP-->>U: approval.required via SSE
    H->>API: Approve exact intent hash
    API->>CP: Verify approver, policy, expiry and hash
    API->>R: Resume checkpoint
    R->>TG: Execute approved operation, idempotency key
    TG->>X: POST incident
    X-->>TG: Incident identifier
    TG-->>R: Audited tool result
    R-->>U: run.completed via SSE
~~~

## 13. Security, privacy and operations

- **Tenant isolation:** every lookup and indexed query has tenant/workspace filters plus object ACL enforcement; use separate encrypted object-storage namespaces and logs. Consider PostgreSQL RLS as defense in depth, not the only policy engine.
- **Credentials:** reference-based, rotated, secret manager backed; never embedded in YAML, traces, SSE, checkpoint snapshots or prompts.
- **Input and output:** schema validation at API and tool boundary, allowlisted egress for connectors, SSRF-resistant URL resolution, response truncation/redaction, token-limit enforcement.
- **Prompt injection:** treat external documents and tool outputs as untrusted instructions. Tool gateway prevents elevated action independent of model behavior.
- **Skill artifacts:** sandbox scripts only in a future milestone with per-run isolated filesystem, CPU/memory/network policies, signed/approved artifacts and time limits.
- **Observability:** OpenTelemetry trace propagation for run/model/tool/subagent; usage events with input/output tokens, estimated/provider-billed cost, budget evaluation and latency. Track cost with model ID and pricing revision.
- **SLOs (proposal, to benchmark):** control API p95 < 300ms without provider calls; accepted run visible within 2s at nominal load; tool policy decision p95 < 50ms; 99% of run state transitions persisted. These are targets, not measured results.
- **Retention:** configuration versions durable; checkpoints, files, raw model text and traces are separately configurable and deletable according to tenant policy. Define GDPR/privacy needs before production.
- **Testing:** tenant-crossing denial, tool-level ACL, approval tamper/replay/timeout, invalid model capability, tool schema mismatch, malicious skill, duplicate run submission, ambiguous API response, worker crash/restart and budget exhaustion.
- **Threat review:** complete before enabling any write-capable tool or uploading executable skill scripts.

## 14. MVP milestones and exit criteria

| Phase | Deliverable | Exit criteria |
| --- | --- | --- |
| M0 / contracts | RFC, schema validation, policy matrix, runnable test fixtures | 10 valid + 15 invalid configs classified correctly |
| M1 / agent registry | CRUD drafts, validate, publish, deploy/rollback, model profiles | Version pinning and optimistic concurrency proven |
| M2 / simple runtime | Run API, SSE, LiteLLM, one read-only KB tool, basic tracing | Reproducible run with cost and tool audit |
| M3 / skills + MCP | Skill import/version/digest, MCP tool catalog, deny-by-default gateway | Unapproved tool is impossible to call |
| M4 / deep runtime | Deep Agents adapter, subagent DAG, checkpointing, approval/resume | Worker kill/restart and approval tests pass |
| M5 / Agent Studio | Configuration wizard, playground, run timeline, approval UI | Non-developer can publish/test without code edits |
| M6 / hardening | Evaluation fixtures, budgets, load tests, migration/rollback | Quality and ops thresholds established from data |

**Suggested initial pilot:** read-only technical support agent searches curated documentation through one KB tool, summarizes findings and cites source IDs. Then enable a separately approved incident.create tool with true human-in-the-loop and idempotency. Avoid shell/script/batch execution and broad HTTP invocation until connectors are explicitly sandboxed and scoped.

## 15. Repository/module layout (proposed, future implementation)

~~~text
agent-platform/
  apps/
    studio/                   # UI, no provider credentials
    api/                      # FastAPI control-plane + run API
    worker/                   # scheduled and queued execution
  packages/
    contracts/                # Pydantic/JSON Schema, event schemas
    registry/                 # agents, profiles, skills, tools, versions
    policies/                 # principal/scopes/object-ACL intersection
    runtimes/
      base.py                 # RuntimeAdapter protocol
      simple.py               # LangChain
      deep.py                 # Deep Agents
      workflow.py             # LangGraph templates
    tool_gateway/             # MCP/REST adapters, approval, idempotency
    observability/            # OTel, cost accounting, eval
  migrations/
  tests/
    fixtures/
    contract/
    integration/
    security/
    crash_recovery/
  examples/
    incident-triage.yaml
~~~

The future platform should live in its own repository. This RFC is placed in the blog repo only to keep the public design review and future architecture posts close to existing documentation.

## 16. Blog publication plan

Do not copy this RFC verbatim into the blog. Publish a readable, evidence-backed series with diagrams and code after the corresponding module exists:

1. Why another agent platform? A comparison of Dify, Flowise, Agno, Letta and Deep Agents.
2. Designing an agent Control Plane: model/tool/skill configurations and immutable versions.
3. Building safe MCP Tool Gateways with per-run delegated identity.
4. Agent Skills registry: validation, versioning, progressive loading and supply-chain security.
5. LangChain vs Deep Agents vs LangGraph: choosing an execution mode.
6. Durable tool execution, approvals, idempotency and crash recovery.
7. Evaluation, model routing, latency and cost benchmarking.

Every post SHOULD include: objective, alternatives, contract/diagram, minimal executable code, failure tests, benchmark methodology, observed results (not invented numbers), and what changed from the initial design.

## 17. Open questions requiring product decisions

1. **Scope:** Is the MVP single-user/local-first, organization/team-oriented, or multi-tenant SaaS from launch? Design assumes eventual multi-tenancy, but rollout can start with one tenant.
2. **Actor:** Can an agent have an independent service identity, or should every run remain explicitly delegated from a human? Proposal supports both with distinct policy.
3. **Tenancy:** Are tools, skills, models and memory shared across workspaces by default? Proposal: no; sharing is opt-in and auditable.
4. **Workflow mode:** Reviewed Python LangGraph templates initially, or a DSL? Proposal: templates first.
5. **Execution:** Should long-running tools be asynchronous? Proposal: treat HTTP and MCP calls as bounded units; add scheduler/worker integration for external long-running jobs once lifecycle is proven.
6. **Model policy:** Which model providers and geographic data residency rules are allowed? Treat as deployment-specific configuration.
7. **UI:** Wizard, YAML editor, or both? Proposal: guided wizard plus read-only resolved manifest and an advanced editor with validation.
8. **Deployment:** Single service process for a developer demo or isolated worker processes for multi-user workloads? Proposal: separate logical worker with optional same container locally.
9. **Agent output:** Which artifacts need durable storage versus ephemeral SSE delivery? Proposal: text/JSON first, files later.
10. **Observability:** Which evaluation and usage data is visible to tenant users vs platform operators?

## References checked (2026-10-09)

- [Deep Agents overview and execution capabilities](https://docs.langchain.com/oss/python/deepagents/overview)
- [Deep Agents customization](https://docs.langchain.com/oss/python/deepagents/customization)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Agent Skills specification](https://agentskills.io/specification)

This RFC expresses proposed platform policy and interfaces, not guarantees made by these open-source libraries. Review framework API compatibility against pinned versions in M0.
