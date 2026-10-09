# Agent Platform Architecture

**Status:** Proposed / design documentation, not a record of implemented services  
**Last updated:** 2026-10-09  
**Scope:** Domain-neutral reference architecture for a configurable agent platform

This documentation lives in \`docs/\` and is **not a blog article or a production implementation**. It explains the missing components between an incoming request and existing MCP/REST tools: triggering, agent selection, run admission, runtime execution, tool invocation, worker coordination, and UI event delivery.

## Read in this order

1. **[01 — Invocation and agent routing](./01-invocation-and-routing.md)**: entry points, \`TriggerBinding\`, eligibility filtering, direct selection vs automatic routing, sessions, router fallbacks, and request/response contract.
2. **[02 — Runtime, workers, tools, and events](./02-runtime-workers-and-events.md)**: how a selected agent runs, where tools are called, run state machine, checkpoint/approval design, worker-to-API-to-UI streaming, and failure recovery.
3. **[03 — Trigger adapters, examples, and MVP plan](./03-triggers-and-mvp.md)**: chat, webhook, scheduled work, email and delegation, plus implementation backlog and executable acceptance scenarios.
4. **[04 — Extensible Tool Registry and external execution](./04-tool-registry-and-external-execution.md)**: connectors, versioned tool definitions/bindings, third-party HTTP actions, approved remote jobs and isolated script runners.
5. **[05 — Agent-to-agent orchestration](./05-agent-to-agent-orchestration.md)**: parent/child runs, delegation policies, budget/permission inheritance, internal collaboration and external A2A protocol.
6. **[06 — Decision layer, Jev and deterministic rules](./06-decision-layer-jev-and-rules.md)**: typed choice/score results, replaceable decision providers, eligibility checks, DMN/FEEL rules and evaluation.
7. **[07 — Complete orchestration scenario](./07-end-to-end-orchestration-scenario.md)**: one fictional SaaS workflow connecting routing, agent tools, child agents, approval-gated remote jobs and SSE.
8. **[08 — Plug-and-play adapters and plugins](./08-plugin-and-adapter-architecture.md)**: stable typed extension interfaces, package/instance/capability/binding separation, manifests, version pinning, installation approval, isolation, upgrades and compatibility.

See also [RFC-001: Configuration-Driven Agent Platform](https://github.com/buianhtai/buianhtai.github.io/pull/6), a separate, **currently proposed** RFC about the control-plane registry, policy model, declarative configuration schema, tool/skill catalog, and framework adapters. These documents intentionally complement that RFC but are reviewable independently.

## Architectural rule: stable core, replaceable integrations

> **Register providers through typed adapters. Configure instances. Publish capabilities. Bind authorized versions to agents.** Core runtime, policy, run state and event contracts do not change when a new provider implements an existing interface.

**[08 — Plug-and-play Adapter Architecture](./08-plugin-and-adapter-architecture.md)** specifies the common extension registry and adapter lifecycle for runtimes, models, MCP/HTTP tools, triggers, decisions, external jobs, internal/external agent delegation, and skill sources. An adapter **package** is installed/approved by the platform operator; an adapter **instance** is tenant/workspace configured; a **capability** is a reviewed catalog entry; an agent **binding** narrows what it may use. These objects are intentionally distinct.

New implementations of known ports should not require changes to agent-runtime source. **Installing executable code** may still require a worker rollout, while an approved remote-RPC adapter can be configured without rebuilding the core. End users never gain arbitrary shell or unrestricted network execution.

## The main distinction

| Concept | Meaning | Executes an LLM? |
| --- | --- | --- |
| Trigger | Event that starts a workflow/run (chat, webhook, schedule, email) | No |
| Agent router | Picks one eligible published agent when none is specified | Not necessarily; start with rules/embeddings |
| Agent registry | Stores versioned definitions, descriptions, tool and skill bindings | No |
| Run service | Creates and owns a run, status, quotas, idempotency, and events | No |
| Worker + runtime | Loads a pinned agent and executes the reasoning/tool loop | Usually, but not for deterministic workflows |
| Tool Gateway | Validates and invokes permitted MCP/REST/KB capabilities and approved async job operations | No |
| Connector / External Job Service | Executes reviewed third-party integrations, fixed workflows and isolated job templates | No |
| Delegation Gateway | Creates scoped child runs or sends approved A2A tasks | Optional model choice upstream, no for permission checks |
| Decision Service | Deterministic rules/DMN and optional Jev-like typed classifiers for routing or workflow branching | Optional dedicated decision inference |
| Skill | Task procedure/instructions and resources attached to an agent | No, not itself |
| Model gateway | Executes approved model requests and meters usage | Yes, when called |
| API/event service | Serves run state and event stream to UI/integrations | No |

**Tool extensions:** a published tool definition points to a reviewed connector (internal, MCP, HTTP, workflow, or remote job). Agents bind only permitted versions. **Shell execution is never a generic built-in tool**; scripts require an approved template and isolated external runner.

**Agent collaboration:** internal agent-to-agent requests create scoped parent/child runs; external interoperable agents can use A2A after connection registration and authorization. The primary router and delegation gateway are different concerns.

**Decisions:** deterministic rules take precedence; optional Jev-style classifiers supply typed decisions, never authorization. See [04](./04-tool-registry-and-external-execution.md), [05](./05-agent-to-agent-orchestration.md), [06](./06-decision-layer-jev-and-rules.md) and the full example [07](./07-end-to-end-orchestration-scenario.md).

**Tools alone are not a platform:** if all we have are tools, we still must add the entry point, registry, admission/run service, routing policy, worker runtime and event response path. Existing tool implementations can be reused. Their presence alone does not imply the other boxes already exist.

## Logical system overview

~~~mermaid
flowchart TB
    CHAT["Chat UI"] --> API["Platform API: auth + runs"]
    HOOK["Webhook / Email / Scheduler"] --> API
    API --> ADMISSION["Admission: tenant + policy + quota"]
    ADMISSION --> DEC["Rules / optional DecisionProvider"]
    DEC --> ROUTER{"Explicit, bound or routed?"}
    ROUTER --> REG["Published Agent Registry"]
    REG --> RUNS["Run Service: version + runId + status"]
    RUNS --> QUEUE["Queue / worker lease"]
    QUEUE --> WORKER["Execution Worker"]
    WORKER --> ENGINE["Runtime Adapter: simple / deep / workflow"]
    ENGINE --> MODEL["Model Gateway"]
    ENGINE --> GW["Tool Gateway (enforced scopes)"]
    ENGINE --> DELEGATE["Delegation Gateway"]
    DELEGATE --> CHILD["Internal child agent / External A2A"]
    GW --> TOOLS["MCP / Reviewed REST / KB"]
    GW --> JOB["External Job Service"]
    JOB --> RUNNER["Approved Kestra flow / Isolated runner"]
    WORKER --> EVENTS["Durable run events + checkpoints"]
    EVENTS --> API
    API --> CHAT
    API --> HOOK
~~~

This diagram is **logical**, not a demand to build eleven microservices. The MVP can begin with a single API process plus a worker and PostgreSQL. Queue, gateway and router may initially be modules; separate them for independent scaling or isolation.

## Design principles

1. **Explicit agent > automatic agent selection.** If an authorized caller specifies an agent version/deployment, do not spend tokens re-routing.
2. **Fixed workflow triggers > open-ended routing.** A scheduled report normally invokes a configured workflow or agent.
3. **Authorization before routing.** The router sees only agents eligible for the caller and workspace. Model routing never grants permission.
4. **Immutable execution manifest.** Start a run with the resolved published agent version, exact tool/skill versions, effective policy, and adapter version.
5. **One run, one primary agent (initially).** The agent can invoke tools; optional subagent delegation is a separate, authorized feature.
6. **Models propose; code enforces.** Business rules, quotas, tool access and approvals do not depend on trusting model instructions.
7. **Worker never owns the client connection.** The API serves durable event streams, allowing retries/reconnections and scheduled invocations.
8. **Use AI selectively.** Deterministic tasks should not invoke an LLM. A router may use embeddings or an optional Jev-style decision provider only when needed.
9. **No proprietary domain- or customer-specific examples.** All names, identifiers, tenants and APIs below are illustrative.
10. **Plugin ports are typed and security-gated.** A new provider implements an approved extension contract; no adapter can bypass the Tool Gateway, policy engine, secret boundary, budget or event service.

## Glossary / contract owners

| Object | Owner | Key fields |
| --- | --- | --- |
| \`AgentDefinition\` / \`AgentVersion\` | Control Plane | description, routing examples, runtime kind, tools, skills, model profile |
| \`AgentDeployment\` | Control Plane | environment, published version pointer, active flag |
| \`TriggerBinding\` | Integration/Control Plane | trigger kind, source, target agent/workflow, principal, policy |
| \`AgentSession\` | Session API | owner, workspace, conversation, selected agent, memory policy |
| \`AgentRun\` | Run Service | runId, trigger, principal, version digest, status, budget, traceId |
| \`AgentRouteDecision\` | Router | candidate set, selected version/deployment, method, routing outcome |
| \`RunEvent\` | Run/Event Service | runId, sequence, type, time, safe payload |
| \`ToolInvocation\` | Tool Gateway | tool/version, input digest, authorization, approval, outcome |
| \`ApprovalRequest\` | Approval API | tool intent hash, approver role, expiration, decision |

## Reference links

- [LangChain agent patterns](https://docs.langchain.com/oss/python/langchain/overview)
- [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview)
- [LangGraph persistence and checkpoints](https://docs.langchain.com/oss/python/langgraph/persistence)
- [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [Agent Skills specification](https://agentskills.io/specification)

Version pinning, adapter compatibility, security and deployment decisions require implementation validation. Examples are proposed contracts, **not** representations of deployed services.
