# 08 — Plug-and-Play Adapter and Plugin Architecture

**Status:** Proposed architecture; no plugin SDK, runtime host, connector or registry in this document is implemented.
**Scope:** Generic extension points for models, runtimes, tools, triggers, remote jobs, decisions and agent collaboration.
**Related:** [Architecture index](./README.md) · [Tool and connector registry](./04-tool-registry-and-external-execution.md) · [Delegation](./05-agent-to-agent-orchestration.md) · [Decision providers](./06-decision-layer-jev-and-rules.md) · [End-to-end scenario](./07-end-to-end-orchestration-scenario.md)

## 1. Design goal

A new provider or tool should require a **new adapter and its reviewed installation**, not a change to the platform's core execution loop, user-facing configuration API, or database schema.

A workspace administrator can install an approved adapter and configure an instance. An agent author can then **bind approved capabilities** from the catalog through Agent Studio. Users do not write backend code merely to use an already-installed capability.

"Plug-and-play" does **not** mean an LLM or untrusted tenant user can upload arbitrary Python, shell commands, network endpoints or credentials into the trusted platform process.

### Four different things

| Concept | What it is | Example |
| --- | --- | --- |
| **Adapter package** | Operator-installed implementation of a typed extension interface | `mcp-connector@1.2`, `kestra-executor@1.0` |
| **Adapter instance** | A configured, scoped instance of that package | `shared-docs-mcp`, `approved-report-runner` |
| **Capability** | A published model/tool/trigger/decision/job/agent service made available by an instance | `docs.search@2`, `reports.preview@1` |
| **Binding** | Immutable agent/deployment/workflow reference to a **permitted** capability and its restrictions | Agent A may call `docs.search@2` with `read` scope |

**Skill is a separate content primitive.** A versioned `SKILL.md` is instructions/resources, not executable adapter code. A skill *source/loader* may have a plugin adapter, but the skill itself cannot install executable capabilities or grant a tool permission.

## 2. Ports and adapters instead of hard-coded dependencies

~~~mermaid
flowchart TB
    UI["Agent Studio / Admin Console"] --> REG["Extension Registry + Policy"]
    REG --> INST["Approved adapter installations"]
    INST --> CAP["Capability catalog + bound versions"]
    CAP --> API["Agent Platform API and Run Service"]
    API --> WORKER["Worker / Runtime Coordinator"]
    WORKER --> PORTS["Typed ports / SPI"]
    PORTS --> R["RuntimeAdapter: LangChain / Deep Agents / others"]
    PORTS --> M["ModelProviderAdapter: LiteLLM gateway / provider"]
    PORTS --> T["ToolConnectorAdapter: MCP / REST / internal"]
    PORTS --> D["DecisionProviderAdapter: rules / classifier / Jev"]
    PORTS --> J["JobExecutorAdapter: Kestra / container job"]
    PORTS --> A["DelegationAdapter: internal runs / A2A"]
    API --> TRIG["TriggerAdapter: webhook / email / schedule"]
    T --> SEC["Tool Gateway / deterministic authorization"]
    J --> SEC
    A --> SEC
    SEC --> OBS["Audit, Events, Tracing, Budgets"]
~~~

The chart is **logical**, not a recommendation for a microservice per interface. Initially, Python package adapters may be built into the worker and configured dynamically through the registry. Later, high-risk or independently operated adapters can use authenticated out-of-process RPC.

The **Platform API, Run Service, authentication, authorization, policy, cost enforcement, audit, event semantics and version resolution are core**. Plugin implementations cannot replace or bypass them.

### Extension points

| Port | Purpose | Examples | Invocation semantics |
| --- | --- | --- | --- |
| `RuntimeAdapter` | Build and execute a published agent definition | LangChain, Deep Agents, Pydantic AI, deterministic graph | Streams normalized agent reasoning events; can pause/resume if supported |
| `WorkflowEngineAdapter` | Durably schedule and coordinate whole runs / multi-step workflows | Hatchet, DBOS, Kestra, Temporal (optional) | Submit, signals, status, cancel, durable wait/recovery; see [10](./10-open-source-durable-worker-engines.md) |
| `ModelProviderAdapter` | Make an approved model available behind a common gateway | LiteLLM, approved hosted/local inference | Token stream / response + usage + capability metadata |
| `ToolConnectorAdapter` | Discover and invoke registered tool operations | MCP, schema-bound REST, application functions | Sync result or async operation handle |
| `TriggerAdapter` | Verify and normalize external events into a run request | Webhook, inbox poller, scheduler | At-least-once events; source deduplication |
| `JobExecutorAdapter` | Start and observe approved external tasks | Kestra, container task service, remote runner | Submit -> durable job ID -> status/callback/poll |
| `DecisionProviderAdapter` | Return typed choices, scores or rule outcomes | Code/DMN, Jev-like model, structured small LLM | Bounded decision result, not agent execution |
| `DelegationAdapter` | Dispatch a subtask to another approved agent | Internal child run, external A2A task | Durable delegation/task handle + artifacts |
| `SkillSourceAdapter` (later) | Import validated versioned skill bundles | Git repository, object storage | Fetch/import metadata and content, no code execution |

**Do not invent one generic `execute(any_payload)` contract for all ports.** Reuse common registration, security context, validation and telemetry, but give each extension type a **typed protocol** and explicitly defined lifecycle. That avoids hiding long-running jobs or agent delegation behind synchronous function calls.

## 3. Adapter package manifest (declarative discovery)

This **proposed** JSON/YAML contract is not a native Kestra, MCP, A2A or Python packaging format:

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: AdapterPackage
metadata:
  id: kestra-job-executor
  version: 1.0.0
spec:
  port: job-executor
  adapterApiVersion: v1
  distribution:
    type: remote-rpc    # builtin | trusted-python-package | remote-rpc
    endpointRef: approved-job-adapter-service
  capabilities:
    - submit
    - get-status
    - cancel
    - artifacts
    - async-result
  configurationSchema:
    type: object
    additionalProperties: false
    required: [connectionRef]
    properties:
      connectionRef: { type: string }
      namespaceRef: { type: string }
  permissionsRequested:
    - external-job-submit
    - external-job-read
  health:
    mode: active-check
    timeoutSeconds: 5
~~~

**Package** is a registered implementation identity. **Instance** stores configured settings, secret references and workspace availability. **Capability** is exposed from that instance. **Binding** is what an authorized agent may actually use.

A provider's arbitrary marketing capability labels are not enough for security: the platform owns a constrained set of known port types, declared operations and policy classifications.

### Example configured installation

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: AdapterInstance
metadata:
  id: approved-report-runner
  tenantId: demo-tenant
  workspaceId: reports
spec:
  packageRef: kestra-job-executor@1.0.0
  settings:
    connectionRef: integration-kestra-demo
    namespaceRef: sample-report-workflows
  secretRefs:
    credentialRef: reports-runner-secret
  enabledCapabilities:
    - reports.preview@1
  enabled: true
~~~

Secret values must live outside these manifests. The control plane authorizes the installation and **only exposes safe capability metadata** to a tenant's Agent Studio.

## 4. Extensibility without changing the agent runtime

Assume operators already installed:
- an MCP tool connector for `docs.search@2`;
- a reviewed HTTP connector for `tickets.draft@1`;
- a job executor for `reports.preview@1`.

Users can publish:

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: Agent
metadata:
  id: generic-support-assistant
spec:
  runtimeRef: simple-langchain@1
  modelProfileRef: economical-model@3
  instructions: Answer common SaaS support requests using evidence.
  tools:
    - ref: docs.search@2
      connectorInstanceRef: shared-docs-mcp
      access: read
    - ref: tickets.draft@1
      connectorInstanceRef: approved-ticket-api
      access: write
      approval: always
    - ref: reports.preview@1
      connectorInstanceRef: approved-report-runner
      access: write
      approval: always
  skills:
    - ref: evidence-based-answering@1.0.0
  limits:
    maxModelCalls: 6
    maxCostUsd: 0.15
~~~

This agent fragment demonstrates *bindings*, not a runnable final agent schema. Published versions pin adapter package/version, connector instance reference, capability/version, configuration digest and authorization policy revision. The exact effective access may be **narrower** at run time if a grant is revoked.

When a new connector is installed, the **Catalog service** discovers its reviewed capabilities, and a permitted user can select them in Agent Studio. **No modifications to the runtime's model/tool loop should be needed**, assuming the adapter implements an already-supported port type.

Adding a **new port type** is different: it **does** require a core platform contract, policy and event model change. Plug-and-play is extensibility *within established interfaces*, not a claim that unknown execution semantics need zero engineering.

## 5. Plugin/adapter lifecycle

~~~mermaid
flowchart TD
    PACKAGE["Operator submits adapter package/descriptor"] --> VERIFY["Verify signature, provenance, license, API version"]
    VERIFY --> TEST["Validate schema, requested permissions, compatibility"]
    TEST --> APPROVE{"Security/admin approval?"}
    APPROVE -->|Denied| REJECT["Reject / quarantine"]
    APPROVE -->|Approved| INSTALL["Install version + create instance"]
    INSTALL --> CONFIG["Configure secret refs, scopes, egress, quotas"]
    CONFIG --> HEALTH["Health / capability negotiation"]
    HEALTH --> PUBLISH["Publish reviewed capabilities to catalog"]
    PUBLISH --> BIND["Agent author chooses eligible bindings"]
    BIND --> FREEZE["Publish immutable AgentVersion and lockfile"]
    FREEZE --> EXEC["Resolve pinned adapters at run time"]
    EXEC --> OPERATE["Monitor, disable, upgrade or drain"]
    OPERATE --> INSTALL
~~~

Lifecycle details:

1. **Package approval:** operators verify source/artifact digest, license, security and requested permissions. Public registries or auto-discovered MCP tools are **not automatically trusted**.
2. **Compatibility:** every package declares `adapterApiVersion`, supported runtime protocol and capabilities. Unsupported versions fail installation.
3. **Instance configuration:** schema validated, scoped to installation/workspace, with secret references and connection tests. No raw provider keys in published agent definitions.
4. **Capability review:** discovered tools still need operation-level risk labels, schemas and authorization before publishing.
5. **Binding:** users can configure only catalog entries visible to them; bindings can narrow arguments, resources, rate limits and approval, never widen platform grants.
6. **Resolution:** every accepted run snapshots immutable refs/digests. In-flight runs cannot silently switch adapter implementation because someone installed a newer version.
7. **Upgrade/rollback:** stage new version, run contract/security tests, canary, switch deployment pointers, drain old sessions/jobs, and rollback if needed.
8. **Disable/revoke:** immediate policy revocation must stop new tool invocations even from old published versions; registry historical metadata is preserved for audit.
9. **Removal:** block package deletion while pinned by active runs/deployments or supply an explicit reviewed migration/retention plan.

**Cold/hot loading:** a *remote-rpc* adapter instance can be installed/configured without redeploying the core service if its port protocol is already supported. A new *trusted Python package* may still require a worker image build/restart. Both are legitimate extensions; distinguish them in the product UI instead of implying arbitrary live code loading is safe.

## 6. Typed SPI contracts (illustrative, not implementation)

~~~python
from typing import Protocol, AsyncIterator

class AdapterContext(Protocol):
    tenant_id: str
    workspace_id: str
    run_id: str
    principal_id: str
    trace_id: str

class AdapterPackage(Protocol):
    def descriptor(self) -> "AdapterDescriptor": ...
    async def validate_config(self, settings: dict) -> "ValidationResult": ...
    async def health(self) -> "HealthResult": ...

class RuntimeAdapter(Protocol):
    async def compile(self, published_manifest, resolved_capabilities): ...
    async def stream(self, compiled_agent, request, context: AdapterContext) -> AsyncIterator["RunEvent"]: ...

class ToolConnectorAdapter(Protocol):
    async def discover(self, instance, context: AdapterContext) -> list["ToolDescriptor"]: ...
    async def invoke(self, operation, validated_args, context: AdapterContext) -> "ToolOutcome": ...

class JobExecutorAdapter(Protocol):
    async def submit(self, operation_ref, validated_input, idempotency_key, context: AdapterContext) -> "JobHandle": ...
    async def get_status(self, job_handle, context: AdapterContext) -> "JobStatus": ...
    async def cancel(self, job_handle, context: AdapterContext) -> "JobStatus": ...

class DecisionProviderAdapter(Protocol):
    async def evaluate(self, published_decision, eligible_options, input, context: AdapterContext) -> "TypedDecision": ...

class DelegationAdapter(Protocol):
    async def submit(self, bound_target, scoped_task, context: AdapterContext) -> "DelegationHandle": ...
    async def status(self, handle, context: AdapterContext) -> "DelegationStatus": ...
~~~

The platform's **Tool Gateway** wraps `ToolConnectorAdapter.invoke` and external job submission with policy checks before touching a third party. The adapter is *not* a policy decision point. For remote-rpc adapters, the host authenticates and authorizes RPC calls and avoids sending unrestricted credentials or user data.

A `TriggerAdapter` exposes an authenticated/verified event stream to the ingestion layer, not an `invoke` method to the LLM. A `ModelProviderAdapter` is invoked by the model gateway with metering/capability checks. A `SkillSourceAdapter` fetches verified content, and never executes bundled shell files.

## 7. How execution works with plugins

~~~mermaid
sequenceDiagram
    participant U as Agent Studio
    participant C as Extension/Capability Registry
    participant API as Platform API
    participant W as Runtime Worker
    participant G as Tool Gateway
    participant A as Installed Adapter
    participant X as Remote Service

    U->>C: Select eligible published tool + model
    C-->>U: Validated schema / configuration choices
    U->>API: Publish AgentVersion with pinned bindings
    API->>C: Resolve approved versions and config digests
    API-->>U: Published immutable version
    U->>API: Start agent run
    API->>W: Queue resolved run manifest
    W->>G: Model-proposed tool invocation
    G->>G: Validate ACL, scopes, payload, quotas, approvals
    G->>C: Resolve pinned adapter instance/operation
    C-->>G: Verified descriptor and connection reference
    G->>A: Invoke typed operation with scoped context
    A->>X: Perform approved REST/MCP/job operation
    X-->>A: Result or async job handle
    A-->>G: Typed outcome
    G->>API: Persist audited event / outcome
    API-->>U: Progress and result via SSE
~~~

New adapter packages can provide **different implementations** behind the same typed interface. The worker does not need a `switch(tool.provider)` statement for every new connector. The catalog selects/loads the approved adapter via its declared port and package version.

## 8. Remote code, scripts, third parties: explicit trust levels

| Adapter distribution | Allowed purpose | Isolation requirement |
| --- | --- | --- |
| `builtin` | Audited internal adapters with trusted dependencies | Platform runtime |
| `trusted-python-package` | Reviewed, signed, pinned adapter artifact | Operator-controlled worker image; no tenant upload |
| `remote-rpc` | Independent provider, tool bridge, or job adapter | Authenticated service endpoint, constrained credentials and egress |
| `script-template` operation | Approved and pinned task executed by a JobExecutor | Separate isolated runner/container, never host shell |

**Arbitrary `execute_shell(command)` or `http_request(url)` is not an acceptable default plugin capability.** For custom scripts, users bind to a **reviewed versioned operation** that accepts schema-validated arguments. The job service runs it in an isolated environment with CPU/memory/time/network constraints. A completion callback is verified and correlated to its job ID; remote outputs are untrusted text.

The same rules apply to external agent services: an A2A `DelegationAdapter` can submit tasks only to an explicitly registered/approved endpoint, with bounded payloads, secrets and delegation permissions.

**Platform-wide reliability:** adapters must declare timeouts, idempotency classification, cancellation support, concurrency and failure modes. The host enforces limits and owns retries, circuit-breaking decisions and durable state according to [09 — Scalability and Reliability](./09-scalability-reliability-and-operations.md). Plugin authors cannot promise exactly-once external side effects merely by returning a successful result.

## 9. Schema, capability negotiation and error handling

- **Common descriptor fields:** `id`, `version`, `port`, `adapterApiVersion`, `capabilities`, `configurationSchema`, `permissionRequests`, `distribution`, `digest`, `license`, `health`.
- **Tool schema:** JSON Schema input/output; strict validation; explicit read/write/destructive classification; human approval policy for mutating operations.
- **Capability negotiation:** check `supports_streaming`, `supports_checkpointing`, `supports_cancel`, `supports_async_job` and model/tool capabilities before publishing incompatible configurations.
- **Fail closed:** unavailable/disabled/incompatible adapter, revoked credential, missing operation, wrong version, or failed health check cannot silently fall back to an unapproved provider.
- **Provider fallback:** only an *explicit configured fallback* whose permissions, model features and residency obligations match; log all changes.
- **Events:** typed `adapter.invocation.started/completed/failed`, `job.*`, `delegation.*`; include adapter package/version and trace ID. Do not expose credentials or arbitrary raw third-party payloads.
- **Costs:** plugin-owned provider prices are input to centralized usage and budget accounting; the plugin never overrides run budget hard stops.

## 10. Suggested plugin admin/user experience

The **administrator** sees: Adapter Marketplace/Registry (operator-curated), Install/Upgrade/Disable, Instance setup and credential references, Capability Review, Health, Permissions, Audit and Version Usage.

The **agent author** sees: Models, Tools, Skills, Triggers, Subagents and Decisions as *eligible catalog pickers*. Choosing `reports.preview` configures a binding; they never see arbitrary shell-command fields or third-party secrets.

A **developer** supplies a new adapter by implementing one port interface + descriptor, adding validation and connector tests, and installing it through the operator approval flow. Framework integration stays behind the adapter interface.

### Implementation slice

1. Implement **Registry + ToolConnectorAdapter** interface for existing read-only MCP tools; store `ToolVersion` and `ToolBinding`.
2. Support one additional registered **HTTP adapter** with a fixed endpoint, typed schema and scope restrictions, without editing agent runtime code.
3. Add **JobExecutorAdapter** for one approved asynchronous workflow, with submission, status, callback verification, idempotency and stored artifacts.
4. Add `DecisionProviderAdapter` for deterministic rules, then optional Jev-like structured decisions.
5. Add internal `DelegationAdapter` for one allowed child agent; external A2A after governance and task correlation are tested.
6. Implement optional second `RuntimeAdapter` only when a real use case benefits.

### Acceptance tests

- Register a new **approved HTTP tool instance**; it appears in the eligible catalog, and an agent can bind/invoke it **without changing runtime source**.
- An unapproved tool or connector cannot be bound, even if its adapter is installed.
- Tool V2 cannot silently change an agent version pinned to tool V1.
- Adapter V2 rollout leaves already-running V1 invocations on V1, or defers to a reviewed migration/compatibility strategy.
- A disabled/revoked credential stops new calls from all versions.
- An arbitrary user-submitted URL/command/script is rejected, not treated as an automatically installable plugin.
- An external job returns a durable handle; client disconnect and worker restart do not lose it.
- A decision adapter cannot grant access to a hidden agent or waive an approval.
- A delegation adapter cannot launch an unbound, cross-tenant or over-budget child agent.
- A plugin crash returns a typed error and is observable; it does not take down all agent runs where isolation is configured.

## 11. Open choices

1. Should the very first adapter SDK support **Python-only in-process**, or start with an **HTTP/gRPC out-of-process contract** for multi-language plugins? Recommendation: built-in Python interfaces first plus an explicit RPC boundary for external jobs/tool connectors.
2. Is adapter installation **operator-managed** or can tenant admins install packages? Recommendation: operator-managed packages, tenant-admin-managed instances subject to approval.
3. Should connectors declare tools through MCP discovery or an OpenAPI import? Recommendation: support both through distinct adapters; each discovered operation still undergoes review.
4. Where should capability version/digest locks live? Recommendation: published `AgentVersion` resolved manifest and run snapshot, not mutable connector metadata.
5. Which adapter capabilities must the UI expose? Recommendation: only verified, currently eligible ones, with clear support for streaming, async, cancellation and approvals.

## References

- [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [A2A protocol](https://a2a-protocol.org/latest/)
- [Agent Skills specification](https://agentskills.io/specification)
- [Kestra task runners](https://kestra.io/docs/task-runners)
- [JSON Schema](https://json-schema.org/specification)

These links describe integration standards and runner options; the adapter SPI, manifests, registry and UI discussed here are **proposed platform designs**.
