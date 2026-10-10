# 13 — Plug-and-play agent platform: product blueprint and illustration guide

**Status: proposed design, not implemented.** Domain-neutral architecture reference. No client branding, vendor-dependent runtime claim, fabricated performance metrics, or production topology belongs in the public infographics.

## Product promise

**Create an agent by configuration; extend the platform by implementing a reviewed adapter; execute through shared, governed runtime services.** These are three different user journeys. The platform does not guarantee arbitrary code or unreviewed external endpoints can be installed without engineering or authorization.

The existing [adapter architecture](./08-plugin-and-adapter-architecture.md) is authoritative for package/instance/capability/binding semantics. The [run lifecycle](./02-runtime-workers-and-events.md) remains authoritative for durable admission and event delivery. This chapter makes their end-user experience and implementation responsibilities explicit.

## One-screen product model

| Experience | What the user can do | What the platform must enforce |
| --- | --- | --- |
| **Agent Studio** (agent author) | Write purpose/instructions; select an approved runtime/model profile, versioned skills, scoped knowledge, eligible tools, triggers and collaborators; set hard limits | Only eligible capabilities visible, tenant/workspace scope, schema validation, compatibility checks |
| **Extension Catalog** (workspace admin/operator) | Request/install reviewed adapter package, configure an instance, test credentials/health and publish the allowed capability catalog | Provenance, signed/pinned adapter, requested privileges, operation schemas, credentials by reference, egress/health |
| **Version / Deploy** (publisher) | Validate draft, run tests, publish immutable agent manifest, configure deployment alias and roll back | Compiler resolves all pinned refs and digests; policy and model compatibility; explicit authorized publication |
| **Run** (end user/verified trigger) | Choose an agent or allow constrained routing; ask a question; watch progress and results | Authn/authz, pinned revision, idempotent durable admission, worker leases, budgets, tool gateway authorization |
| **Operate** (operator/reviewer) | View usage and trace evidence; approve exact risky actions; disable instance or roll back | Revalidation before effects, revocation at invocation, per-run event/audit stream, ambiguous-effect reconciliation |

### What is actually plug-and-play?

- **Agent configuration** is no-code/low-code **only if** the desired model, tool, skill, knowledge source, trigger or subagent is already approved and exposed.
- **New capability, known port:** a developer implements an existing typed adapter SPI; an operator reviews and installs it. A remote-RPC adapter can be installed without changing the agent loop when the port/protocol is already supported. A trusted in-process package may need a worker image/redeploy.
- **New port semantics:** modifying a core contract, security model, event schema and UI is deliberate engineering, **not** zero code.
- **No arbitrary shell/URL capability:** named reviewed jobs and typed allowlisted HTTP operations run in constrained environments, never the trusted core process with user-supplied commands.

## Three independent lifecycles

### A — Assemble, test and publish an agent

~~~mermaid
flowchart LR
    AUTHOR["Agent author"] --> DRAFT["Draft: purpose, model, skills, knowledge, tools, triggers, subagents"]
    DRAFT --> RESOLVE["Validate grants and compatibility"]
    RESOLVE --> TEST["Evaluate sample tasks, budget and denied paths"]
    TEST --> PUBLISH["Publish immutable manifest digest"]
    PUBLISH --> ALIAS["Authorized deployment alias"]
    ALIAS --> INVOKE["Run pins revision at admission"]
    RESOLVE -->|Invalid| DRAFT
    TEST -->|Failed tests| DRAFT
~~~

A mutable draft cannot run as a production deployment. An **Agent Compiler** is the proposed logical responsibility that resolves the effective model profile, skill content digest, KB scope, tool/connector instance and version, permitted subagent bindings, policy revision, limits and runtime interface into an immutable manifest. In the MVP, **Agent Registry may host this responsibility**; a new compiler microservice is not required. The compiler produces data, **not executable arbitrary code**, and never grants access beyond the caller's permissions.

### B — Extend an installed connector safely

~~~mermaid
flowchart LR
    DEV["Adapter developer"] --> PACKAGE["Implement typed port + descriptor"]
    PACKAGE --> REVIEW["Operator: provenance, scopes, schema and isolation review"]
    REVIEW -->|Approved| INSTANCE["Admin: configure instance + secret refs"]
    REVIEW -->|Denied| QUARANTINE["Reject / quarantine"]
    INSTANCE --> HEALTH["Connection test + capability negotiation"]
    HEALTH --> CATALOG["Publish reviewed capability version"]
    CATALOG --> BIND["Author binds narrower scope"]
    BIND --> CALL["Gateway-authorized invocation"]
    CALL --> AUDIT["Typed outcome + audit + telemetry"]
~~~

**AdapterPackage != AdapterInstance != Capability != AgentBinding.** Do not collapse these into one UI entity or database record. Model routing and external tool execution are separate decisions; a skill describes how to perform a task, but does not authorize executable tools.

### C — Execute, stream and recover

~~~mermaid
sequenceDiagram
  actor User
  participant UI as Frontend / Chat
  participant API as Platform API
  participant REG as Registry + Compiler
  participant RUN as Run Service
  participant W as Isolated Worker
  participant G as Model / Tool / Delegation Gateways
  participant E as Run & Event Store
  User->>UI: Ask question / choose deployment
  UI->>API: Start run with idempotency key
  API->>REG: Resolve eligible pinned version
  API->>RUN: Commit run + outbox before 202
  RUN->>E: Persist accepted state and event
  RUN-->>UI: runId + status endpoint
  RUN->>W: Dispatch fenced attempt
  W->>G: Invoke configured, authorized capability
  G-->>W: Typed result / denial / unknown effect
  W->>E: Commit progress, results, terminal status
  E-->>API: Authorized projection / replay cursor
  API-->>UI: SSE or REST status and artifacts
~~~

The worker does not stream directly to browser clients. A provider timeout after a side effect may mean **OUTCOME_UNKNOWN**, requiring reconciliation rather than an unsafe retry. Tool permissions are rechecked at invocation even for a pinned agent version.

## Examples — deliberately domain-neutral

| Agent role | Model profile | Knowledge & skills | Bound tools | Invocation |
| --- | --- | --- | --- | --- |
| Documentation assistant | Low-cost approved chat profile | Published writing skill; scoped docs collection | Read-only search | Explicit chat or selected KB route |
| Support triage assistant | Approved classifier + optional stronger fallback | Response rubric; approved support KB | Read ticket; create-draft action gated by approval | Verified mailbox trigger |
| Research coordinator | Reviewed reasoning profile | Evidence/summary skills | Scoped search; allowed specialist child agent | Explicit chat with bounded delegation |

Illustrative names are roles, **not preinstalled production agents**. Pricing, providers, latency, automation percentage and availability have no measured values in this reference.

## MVP versus target product proof

| Proof | MVP | Later extension |
| --- | --- | --- |
| Agent Studio | Draft, validate and publish agent with one read-only tool, model profile and KB | Full model/skill/tool/KB/trigger/subagent pickers and draft previews |
| Adapter catalog | Existing read-only MCP + second reviewed typed HTTP adapter; no agent-loop code change | Remote jobs, workflow jobs, A2A, decision providers |
| Runtime | One worker pool, pinned manifest, durable run and SSE | Fleet isolation, multi-agent pools, human approvals and comprehensive resumption |
| Security | Tenant/workspace authorization, secrets by ref, tool ACL, quota, audit | Formal adapter certification, residency policies and enterprise tenant QoS |
| Evidence | Source-linked run trace, denied-path test, rollback test | Versioned compatibility matrix, contract conformance suites, chaos and performance results |

**Acceptance demonstration:** Install a reviewed HTTP adapter instance, publish a read capability, bind it to an agent, publish version 2, run without editing the runtime loop, disable the connector, and prove the next invocation is denied; a preexisting version 1 run retains its pinned manifest but cannot bypass current revocation.

## Visual design contract for public infographics

Create **three separate illustrations**, not a wall of tiny unreadable service boxes:

1. **L0 product story** — agent-builder slots feeding a published version and a governed execution system. Keep vendor logos and customer industry examples out.
2. **Plug-in lifecycle** — four distinct records (package, instance, capability, binding) plus review and health gates. The end-user "add tool" journey must not look like installing arbitrary code.
3. **Execution responsibility** — frontend vs backend/control vs isolated workers vs model/tool/agent gateways vs durable state; show SSE return via API, and external providers outside the trust boundary.

Use enough large illustration and whitespace that labels are readable at **actual mobile size**. Decorative robots are not architectural entities. Include alt text and links to native diagrams; do not copy brand assets or add fictional benefit metrics.

## Detailed references

- [01: invocation/routing](./01-invocation-and-routing.md)
- [02: worker coordination, events, and state](./02-runtime-workers-and-events.md)
- [04: Tool Registry and external jobs](./04-tool-registry-and-external-execution.md)
- [05: delegation, internal child runs, external A2A](./05-agent-to-agent-orchestration.md)
- [08: typed port/adapter protocol and approvals](./08-plugin-and-adapter-architecture.md)
- [09: scalability and operations](./09-scalability-reliability-and-operations.md)
- [Native EventCatalog Agent Configuration Lifecycle](./eventcatalog-poc/flows/AgentConfigurationLifecycle/index.mdx)
- [Native Execution Sequence](./eventcatalog-poc/diagrams/RunLifecycleSequence/index.mdx)
