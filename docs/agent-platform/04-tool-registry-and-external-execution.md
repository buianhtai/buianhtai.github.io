# 04 — Extensible Tool Registry, Connectors, External Jobs, and Script Execution

**Status:** Proposed — architecture contract, not currently deployed.
**Adapter foundation:** [08 — Plug-and-play Adapter Architecture](./08-plugin-and-adapter-architecture.md). Every `executor.kind` below maps to a typed, reviewed adapter package and configured instance; tool definitions and per-agent bindings are separate from adapter implementations.
**Related:** [Overview](./README.md) · [Runtime & events](./02-runtime-workers-and-events.md) · [Triggers](./03-triggers-and-mvp.md)

## Why "we implemented tools" is not enough

A function or MCP tool is an executable capability, but does not by itself support:
- user configuration, versioning, per-agent binding or permissions;
- third-party REST APIs / webhook delivery;
- safe long-running script or remote environment invocation;
- job polling, callbacks, cancellation, result artifacts and recovery;
- connector installation, credentials, tenant isolation, or health checks.

We need **three layers**: catalog definition, scoped agent binding, and secure invocation. Keep **incoming triggers** separate from **outbound tool actions**.

~~~mermaid
flowchart TB
    UI["Agent Studio: select tools"] --> CAT["Tool & Connector Catalog"]
    CAT --> DEF["ToolDefinition + ToolVersion"]
    DEF --> BIND["Agent ToolBinding: narrowed scope"]
    BIND --> AGENT["Published Agent Runtime"]
    AGENT --> GW["Tool Gateway: validate / authz / approval / audit"]
    GW --> ADAPTER{"Invocation Adapter"}
    ADAPTER --> MCP["MCP client/server"]
    ADAPTER --> REST["Approved HTTP / REST action"]
    ADAPTER --> FLOW["Workflow/job adapter: Kestra"]
    ADAPTER --> EXT["Remote job adapter: approved runner"]
    FLOW --> JOB["Isolated container/job"]
    EXT --> JOB
    JOB --> RESULT["Status, logs, artifacts, callback"]
    RESULT --> GW
    GW --> AGENT
~~~

The model only selects among tools already exposed for its execution. The Tool Gateway must independently validate *each* call's principal, tenant, resource scope, schema, execution policy, rate limits, and budget.

## 1. Concepts and ownership

| Entity | Responsibility | Example |
| --- | --- | --- |
| \`ConnectorDefinition\` | An installed and reviewed adapter/provider and connection type | \`generic-http\`, \`mcp\`, \`kestra-job\` |
| \`ConnectorInstance\` | Workspace-scoped endpoint/installation, auth secret reference, health and egress policy | \`sample-issue-tracker-connector\` |
| \`ToolDefinition\` | Stable capability, description, input/output schemas, risk class and owner | \`tickets.create_draft\` |
| \`ToolVersion\` | Immutable adapter configuration and interface contract | \`tickets.create_draft@2\` |
| \`ToolBinding\` | Agent-version-specific reference and strictly narrower resource/argument scopes | \`read-only\`, \`project=demo\` |
| \`ToolInvocation\` | A single attempt to perform an action with run security context | tool call, input hash, audit outcome |
| \`ExternalJob\` | Long-running execution request and remote job correlation | \`job_123\` |
| \`JobArtifact\` | Retained output file or structured result with retention/ACL | \`report.json\` |
| \`TriggerBinding\` | Incoming source event -> fixed agent/workflow target | external webhook starts an agent |

A **connector** transports actions. A **tool** defines the capability a model can ask to perform. A **trigger** receives events. A connector may offer both trigger and action interfaces, but they are separate permissions and lifecycles.

### Supported invocation types

| \`executor.kind\` | Invocation | MVP |
| --- | --- | --- |
| \`internal\` | Reviewed application function; can wrap existing API | Yes |
| \`mcp\` | MCP client invokes a reviewed, discovered tool on registered server | Yes |
| \`http\` | Strongly typed allowlisted HTTP operation (not arbitrary URL/method) | Yes, after security review |
| \`workflow\` | Start a preapproved workflow/task in an orchestrator | Phase 2 |
| \`remote_job\` | Queue a registered job for an isolated remote runner | Phase 2 |
| \`script_template\` | Run signed/versioned script artifact in an isolated environment | Phase 3 only |

Do **not** expose \`curl(url)\`, \`execute_shell(command)\`, or free-form \`POST arbitrary URL\` as general tools in a multi-tenant agent product.

## 2. Declarative tool definition

This is an illustrative **platform contract**, not executable vendor YAML:

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: ToolDefinition
metadata:
  id: reports.generate
  version: 3
  owner: platform-team
spec:
  description: Generate a report from an approved template
  inputSchema:
    type: object
    additionalProperties: false
    required: [reportType, period]
    properties:
      reportType: { type: string, enum: [usage, activity] }
      period: { type: string, enum: [day, week, month] }
  outputSchema:
    type: object
    required: [jobId, status]
    properties:
      jobId: { type: string }
      status: { type: string, enum: [queued, running, completed, failed] }
  classification: write
  approval: required
  executor:
    kind: workflow
    connectorRef: report-runner:prod
    operationRef: generate-report@2
  execution:
    mode: async
    timeoutSeconds: 300
    maxConcurrency: 4
    idempotencyRequired: true
    networkPolicyRef: outbound-reports-only
~~~

**ToolBindings** refer to a \`ToolVersion\` and may *restrict*, never expand, registered behavior:

~~~yaml
# AgentVersion binding fragment
tools:
  - ref: reports.generate@3
    allowedArguments:
      reportType: [usage]
      period: [day, week]
    approval: required
    maxCallsPerRun: 1
~~~

MVP registry API:

- \`POST /v1/connectors\` — register a reviewed connector type/instance (admin).
- \`POST /v1/tools\` — create draft tool definition, schema, executor mapping.
- \`POST /v1/tools/{id}:validate\` — schemas, endpoint allowlist, auth, test invocation.
- \`POST /v1/tools/{id}:publish\` — immutable revision and digest.
- \`GET /v1/tools?eligible=true\` — show caller-eligible tools in Agent Studio.
- \`POST /v1/tools/{id}:test\` — safe sandbox/dry-run with synthetic payload.
- \`GET /v1/tool-invocations/{id}\` — audit and authorized result.

Secrets must be configured by a separate connection/credential flow. Never embed access tokens in tool YAML, agent prompts or browser payloads.

## 3. External HTTP and third-party actions

Example: an agent requests the creation of a **draft ticket** in an external SaaS API.

~~~mermaid
sequenceDiagram
    participant W as Agent Worker
    participant GW as Tool Gateway
    participant AD as Reviewed HTTP Adapter
    participant EXT as Third-party SaaS
    W->>GW: tickets.create_draft(title, summary)
    GW->>GW: Validate schema, caller ACL, quota, approval
    GW->>AD: Execute registered operation, scoped secret ref
    AD->>AD: Resolve allowlisted host, method, path template
    AD->>EXT: POST /tickets/drafts with idempotency key
    EXT-->>AD: ticket ID / outcome
    AD-->>GW: Sanitize result and metering
    GW-->>W: tool.completed + ticket ID
~~~

Never allow the model to supply a raw host/path that bypasses the operation template. Validate DNS resolution against egress policies (SSRF/private IP restrictions), TLS identity, redirect policy, response size, authentication scope and schema. A general integration service may own the actual HTTP connector, with the Tool Gateway mediating authorization.

**Outgoing webhook vs incoming webhook:**

- **Incoming webhook**: verified third-party event -> \`TriggerBinding\` -> enqueue \`AgentRun\`. It does not represent a model tool call.
- **Outgoing webhook**: agent requests an *approved outbound tool* -> Tool Gateway -> fixed endpoint operation. It may be asynchronous; response/callback is correlated to \`ToolInvocation\` or \`ExternalJob\`.

## 4. External environment / script runner

The user may want an agent to start a shell script, scheduled batch, CI job or remote automation. The safe way is to expose a **named operation**, not arbitrary commands.

For example:

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: ToolDefinition
metadata:
  id: reports.run_preview
  version: 1
spec:
  inputSchema:
    type: object
    additionalProperties: false
    required: [period]
    properties:
      period: { type: string, enum: [day, week] }
  classification: write
  approval: required
  executor:
    kind: remote_job
    connectorRef: job-runner:prod
    operationRef: report-preview@1
  execution:
    mode: async
    timeoutSeconds: 240
    cpuLimit: "1"
    memoryLimit: "512Mi"
    networkPolicyRef: deny-by-default
    artifactRetentionDays: 7
~~~

\`report-preview@1\` maps **server-side** to a reviewed, immutable template/image digest or workflow ID. The model cannot modify the script body, image, OS command, executable path, target host or security policies.

~~~mermaid
sequenceDiagram
    participant AG as Agent Runtime
    participant GW as Tool Gateway
    participant JOB as Job Coordinator
    participant RUNNER as Isolated Runner / Kestra
    participant CB as Callback / Poller
    participant STORE as Job/Event Store

    AG->>GW: reports.run_preview({period: week})
    GW->>GW: Validate and authorize exact operation
    GW->>JOB: Create ExternalJob with idempotency key
    JOB->>STORE: Persist QUEUED intent + invocation ID
    JOB->>RUNNER: Start approved workflow/template
    RUNNER-->>JOB: remoteExecutionId
    JOB-->>AG: jobId + status QUEUED
    RUNNER-->>CB: Completion event (or status poll)
    CB->>STORE: Verify signature and job correlation
    STORE-->>AG: Resume / emit tool.job.completed
~~~

**Run lifecycle:** \`QUEUED -> SUBMITTED -> RUNNING -> SUCCEEDED|FAILED|TIMED_OUT|CANCELLED|UNKNOWN_OUTCOME\`. External jobs may outlive the original HTTP request or model loop. Persist remote IDs and use events or polling; do not keep the LLM running merely to wait for a 10-minute script. Cancellation is best-effort; unknown side effects require reconciliation.

### Isolation and security

- Jobs use restricted containers/sandboxes or dedicated remote workers, never the agent-platform host shell.
- Non-root execution, pinned signed image/artifact digest, restricted volume mounts and filesystem, CPU/memory/time quotas, network egress allowlist, ephemeral credentials, no privileged container options.
- Command-line arguments are generated by the trusted template from schema-validated values; no arbitrary shell interpolation of prompt content.
- Separate job service principal and scoped secrets; per-tool, per-tenant resource ACLs.
- Rate-limit and limit concurrent jobs; approval for mutating or costly jobs.
- Signed source callbacks with replay protection; verify remote execution ID, correlation ID and status before updating the run.
- Persist logs/artifacts in scoped storage, sanitize output before returning it to the model. Scripts/results are untrusted text and can carry prompt injection.

### Kestra adapter (proposal)

Use an integration adapter to start a **fixed reviewed Kestra flow** with controlled inputs. Kestra documents script task runners including Docker and remote options; it is a useful external executor, not the source of authorization for the agent platform.

For the public contract, we only need:

~~~python
class JobConnector(Protocol):
    async def submit(self, operation_ref, validated_input, context, idempotency_key): ...
    async def status(self, remote_execution_id, context): ...
    async def cancel(self, remote_execution_id, context): ...
    async def artifacts(self, remote_execution_id, context): ...
~~~

Framework-specific adapter implementations for Kestra, a container job service or CI runner must validate request and response types and handle retries. **Do not claim these functions are native Kestra APIs.**

## 5. Tool discovery, extension, and plugin lifecycle

Proposed authoring flow:

1. Administrator registers and validates a **connector** (MCP server or approved service integration).
2. Platform discovers tool schemas (for MCP) or imports an API description (for HTTP), then offers draft \`ToolDefinition\` entries.
3. A reviewer assigns risk classification, accepted schema, data/egress scope, rate/timeout limits, and grants.
4. Publish immutable \`ToolVersion\`; generate sanitized model-facing description.
5. User opens Agent Studio, sees **only eligible** tools and installs/binds them to an agent draft.
6. Validate agent and publish an immutable \`AgentVersion\`, pinning exact tools/versions.
7. Runtime loads only bound tools through gateway; changing connector/tool definitions cannot silently alter existing published versions.
8. Revoke connector health/grants without rewriting old agent history. In-flight calls recheck effective policy.

MCP tool discovery is an **input to review**, not automatic authorization to run an unknown remote tool. An approved connector can expose multiple tools, some read-only and some mutating, with distinct grants.

## 6. Tool error handling and idempotency

| Error | Action |
| --- | --- |
| Tool/version missing | Reject publish or fail admission |
| Unauthorized target/resource | Deny without invoking connector |
| Bad tool arguments | Return schema validation error, bounded retries |
| Provider rate limit | Backoff with budget and retry limit |
| External write outcome unknown | \`UNKNOWN_OUTCOME\`; reconcile before retry |
| Remote job still running | Persist job ID; pause/wait asynchronously |
| Callback from unknown job | Reject and audit |
| Script execution not enabled | Tool unavailable/denied, never fallback to host shell |
| Connection/secret revoked | Deny future calls and stop queued work as policy requires |

## 7. Implementation sequence

- **MVP:** existing read-only MCP tools, \`ToolDefinition/Version\`, \`ToolBinding\`, gateway, tracing and tests.
- **Next:** reviewed HTTP connector with declarative schemas, authentication and egress restrictions.
- **Then:** asynchronous \`workflow\` / \`remote_job\` adapter and callback/poll handling.
- **Finally:** containerized signed script-template operations after dedicated security review.

## 8. Tests that prove the boundary

- A user cannot register an arbitrary endpoint and give every agent access without review.
- Agent may invoke a bound read tool but cannot invoke an unbound write tool.
- Binding narrows a tool's allowed arguments and resource scope.
- Changing a tool after publishing an agent does not mutate its pinned contract.
- Unknown hostname, redirect to private address, or excessive output is rejected.
- A request cannot turn \`period: week\` into \`rm -rf\` shell content.
- Duplicate remote job submissions return the same logical \`ExternalJob\` or are reconciled.
- A callback cannot complete another tenant's job, even if it guesses the job ID.
- Worker crash and restart recovers remote job status from stored IDs, not a model hallucination.

## References

- [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25)
- [Kestra — shell tasks](https://kestra.io/docs/how-to-guides/shell)
- [Kestra — script task runners](https://kestra.io/docs/scripts/task-runners)
- [Kestra — Docker task runner](https://kestra.io/docs/task-runners/types/docker-task-runner)

These are design recommendations, not evidence that these components have already been implemented.
