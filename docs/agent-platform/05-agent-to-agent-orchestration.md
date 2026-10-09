# 05 — Agent-to-Agent Delegation and Interoperability

**Status:** Proposed (not deployed)
**Related:** [Invocation and routing](./01-invocation-and-routing.md) · [Runtime and events](./02-runtime-workers-and-events.md) · [External tools](./04-tool-registry-and-external-execution.md)

## 1. Three things that look like "agent-to-agent" but are different

1. **Routing** selects a *primary* agent for an incoming request. It does not automatically launch many agents.
2. **Delegation** lets that primary agent assign a bounded subtask to a different registered agent. It starts a **child run** with its own version, budgets and allowed tools.
3. **Workflow orchestration** uses reviewed, deterministic code to run agents in a fixed sequence or parallel fan-out, apply decision gates and join results.

Use a single agent plus tools unless a task genuinely needs separate context, skills, ownership or trust boundaries.

| Mode | Use case | Integration | Recommended phase |
| --- | --- | --- | --- |
| Single agent + tools | Documentation Q&A with KB search | Tool Gateway | MVP |
| Internal delegation | Research agent asks specialist to analyze logs | Platform child-run API | Phase 2 |
| Reviewed workflow | Parallel summaries then one evidence-based synthesis | Workflow coordinator | Phase 2 |
| External independent agent | Partner/team agent exposes independent service | A2A protocol adapter | Phase 3 |
| Long-running external task | Delegate task; result arrives later | A2A task/status/stream + correlation | Phase 3 |

**MCP ≠ A2A.** MCP exposes tools/resources an agent may invoke. A2A exposes an independent agent application capable of handling tasks and returning artifacts. A tool might wrap agent invocation internally, but the platform should preserve agent run/identity semantics, not pretend another autonomous process is a simple function.

## 2. Configuration model

User configures a parent agent with explicit **subagent bindings**, pinned to published versions. A generic illustration:

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: Agent
metadata:
  id: research-coordinator
spec:
  runtime: deep
  modelProfileRef: reasoning-balanced@2
  subagents:
    - ref: documentation-researcher@3
      alias: docs-specialist
      purpose: Gather publicly available reference documents
      mode: internal
      maxDelegationsPerRun: 2
      budgetUsd: 0.10
    - ref: summary-specialist@1
      alias: summary-specialist
      purpose: Summarize verified evidence
      mode: internal
      maxDelegationsPerRun: 1
      budgetUsd: 0.05
  limits:
    maxDepth: 2
    maxTotalChildRuns: 4
    maxCostUsd: 0.40
    maxDurationSeconds: 180
~~~

**Not framework-native YAML**; the platform compiler resolves this into Deep Agents subagents or a dedicated delegation tool. The platform must support *either* framework-native subagent execution with policy interception *or* explicit child \`AgentRun\` records. The MVP recommendation is to use the latter for external/independently managed work and normalize events for both.

### Registry and run edges

~~~mermaid
erDiagram
  AGENT_VERSION ||--o{ SUBAGENT_BINDING : permits
  AGENT_VERSION ||--o{ AGENT_RUN : executes
  AGENT_RUN ||--o{ AGENT_RUN : parent_child
  AGENT_RUN ||--o{ DELEGATION_REQUEST : creates
  DELEGATION_REQUEST ||--|| AGENT_RUN : internal_target
  DELEGATION_REQUEST ||--o| REMOTE_A2A_TASK : remote_target
  AGENT_RUN ||--o{ RUN_EVENT : emits
~~~

For a remote A2A task, no local child \`AgentRun\` may exist; the \`DELEGATION_REQUEST\` then tracks the remote task and its state instead. Treat this ERD as conceptual, not a literal requirement for an exactly-one edge to a local child in all modes.

Stored fields per delegation:
\`delegationId\`, \`parentRunId\`, \`parentAgentVersionDigest\`, \`targetAgentVersionOrExternalRef\`, \`childRunId\` or \`remoteTaskId\`, \`principal\`, \`inputArtifactRefs\`, \`allowedScopes\`, \`remainingBudget\`, \`status\`, \`traceId\`, \`deadline\`, \`idempotencyKey\`.

## 3. Internal agent delegation

~~~mermaid
sequenceDiagram
    participant UI as User UI
    participant CO as Coordinator Worker
    participant DG as Delegation Gateway
    participant RUN as Run Service
    participant SPE as Specialist Worker
    participant GW as Tool Gateway
    participant EV as Event Store

    UI->>RUN: Start research-coordinator
    RUN->>CO: Start parent run
    CO->>DG: Delegate bounded documentation task
    DG->>DG: Validate binding, scope, budget, recursion
    DG->>RUN: Create child run with parentRunId
    RUN->>SPE: Queue pinned specialist version
    SPE->>GW: Execute specialist's permitted read tool
    GW-->>SPE: Filtered results + source IDs
    SPE->>EV: child tool/progress/artifact events
    SPE-->>RUN: Child result and terminal status
    RUN->>CO: Resume parent with scoped child artifact
    CO->>EV: Parent synthesis + run.completed
    EV-->>UI: Parent and safe child progress via SSE
~~~

Critical: the child gets a **scoped task**, not unrestricted parent memory or all parent tools. The child version defines its own tools and skills. Its effective rights are bounded by \`parent's delegated grants ∩ child grants ∩ caller/service principal grants ∩ target ACL\`.

**Budget invariants:**
- Parent budget reserves child spending before delegation; no child may outlive the parent's total hard budget without a separately authorized workflow.
- \`maxDepth\`, fan-out, child count and concurrent child runs are enforced by the Run Service, independent of model instructions.
- Cyclic bindings and self-delegation are rejected during publish; runtime guards prevent recursive dynamic loops.
- Child run failure is a typed result; parent must handle failure/timeout rather than hallucinate successful work.
- Child outcome, sources and tool provenance are retained for audit and evaluation.
- Cancellation of a parent propagates to children and remote tasks best-effort, with terminal reconciliation.

## 4. Who selects the second agent?

The primary **Agent Router** initially selects the first agent. A **Delegation Gateway** controls later subagent selection.

Two safe patterns:

**Explicit binding (MVP for delegation):** parent knows allowed aliases (\`docs-specialist\`, \`summary-specialist\`) and can request one. The platform checks that alias and creates a child run.

**Bounded specialist selector (later):** parent describes a bounded task; delegation router ranks *only* its preapproved subagent bindings. No arbitrary global agent discovery, no automatically granting new capabilities.

Do not allow \`delegate_to_agent(agentId=anything)\` without an approved relationship and a scoped security token.

## 5. External agent-to-agent with A2A

The [Agent2Agent (A2A) protocol](https://a2a-protocol.org/latest/) provides discoverable Agent Cards, authenticated task messages, streaming/status updates and artifacts between independently operated agents. Use it when the target is a *separate agent service* (possibly built in another framework), not just another function in the same process.

### External agent registration

~~~yaml
# Illustrative external agent catalog entry; not native A2A Agent Card.
id: public-data-research-agent
kind: external_a2a
agentCardUrl: https://agent.example.org/.well-known/agent-card.json
approvedOriginRef: external-research-endpoint
credentialRef: svc-research-delegation
allowedSkills: [public-source-research]
maxCostUsdPerTask: 0.08
maxDurationSeconds: 120
dataSharingPolicyRef: public-data-only
approval: required
~~~

Agent Cards are **discoverability metadata, not proof of trust**. The administrator registers and approves the origin, TLS/authentication scheme, remote identity, exposed capabilities, allowed data classes, quotas and costs. Never expose local secrets to the remote agent, and validate any returned artifacts as untrusted.

### Remote task lifecycle

~~~mermaid
sequenceDiagram
    participant P as Parent Agent
    participant DG as Delegation Gateway
    participant A2A as Remote A2A Agent
    participant S as Correlation Store

    P->>DG: Delegate public research task
    DG->>DG: Check origin, data policy, scopes, limits
    DG->>A2A: Authenticated message / send task
    A2A-->>DG: Remote taskId / status
    DG->>S: Map delegationId to remote taskId
    A2A-->>DG: Status / artifact events (or poll)
    DG->>S: Verify, redact, persist output and provenance
    DG-->>P: Normalized child result / failure
~~~

Use the **version-pinned A2A protocol SDK/transport**, since its wire bindings evolve. Map its remote task states and artifact identifiers into platform events, and handle retries using local delegation IDs and verified remote task IDs; do not blindly re-send non-idempotent work on network timeouts. Map A2A authentication to a scoped principal; remote authorization remains the remote owner's responsibility, local data egress remains *ours*.

### API / runtime design

~~~python
class AgentDelegate(Protocol):
    async def submit(self, parent_run, bound_target, scoped_task, context): ...
    async def get_status(self, delegation_id, context): ...
    async def cancel(self, delegation_id, context): ...
    async def artifacts(self, delegation_id, context): ...
~~~

The return is a \`DelegationHandle\` with a durable ID and status. The parent may await or suspend for its result without blocking a worker process indefinitely.

## 6. How the UI shows agent collaboration

The browser connects **only** to the Platform API's run event stream. Event examples:

~~~json
{"type":"delegation.started","runId":"parent-001","payload":{"delegationId":"dlg-001","agentName":"Documentation Researcher"}}
{"type":"delegation.progress","runId":"parent-001","payload":{"delegationId":"dlg-001","state":"RUNNING"}}
{"type":"delegation.completed","runId":"parent-001","payload":{"delegationId":"dlg-001","artifactRefs":["artifact-123"]}}
{"type":"run.completed","runId":"parent-001","payload":{"status":"SUCCEEDED"}}
~~~

This example is abbreviated and omits shared event-envelope fields (\`seq\`, \`id\`, \`traceId\`, \`occurredAt\`). Production event schemas must include those fields as described in [02](./02-runtime-workers-and-events.md).

UI might show parent agent, child tasks, their statuses and citations. Do not expose private child reasoning traces, hidden tool credentials, or raw third-party messages by default.

## 7. Failure and governance checklist

| Failure mode | Required handling |
| --- | --- |
| Subagent not in parent's bindings | Deny before child run |
| Parent asks specialist for restricted record | Enforce delegated principal and resource ACL |
| Child budget exceeds remaining parent budget | Reject or pause for explicit additional approval |
| Recursive delegation/cycle | Depth/cycle guards; fail safely |
| Remote agent unavailable | Return typed failure or safe fallback; never silently grant access to another agent |
| Remote timeout after accepting task | Correlate/poll existing remote task, no uncontrolled duplication |
| Parent cancellation | Request child cancellation, reconcile unknown remote outcomes |
| Remote result contains prompt injection | Treat data as untrusted; provenance + output validation |
| Child emits confidential artifact | Redact/deny unauthorized parent/UI delivery |

## 8. Recommended milestone

1. Explicit primary agent invocation (existing MVP).
2. **Two internal agents** with an authorized parent->child binding, one child run and event propagation.
3. Parent/child budgets, timeout, cancellation, request tracing and failure semantics.
4. Optional parallel child runs and deterministic result aggregation.
5. External A2A adapter only when genuinely integrating with an independent agent service.

## References

- [A2A Protocol — overview](https://a2a-protocol.org/latest/)
- [A2A — key concepts and Agent Cards](https://a2a-protocol.org/latest/topics/key-concepts/)
- [A2A — how it differs from MCP](https://a2a-protocol.org/v1.0.1/topics/a2a-and-mcp/)
- [Deep Agents — subagents](https://docs.langchain.com/oss/python/deepagents/subagents)

A2A is a protocol option, not a requirement for internal child agents and not a security boundary by itself.
