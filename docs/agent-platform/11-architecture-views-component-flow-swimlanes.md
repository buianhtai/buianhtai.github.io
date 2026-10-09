# 11 — Architecture Views: Components, Sequence, Swimlanes, and Failure Paths

**Status:** Proposed logical architecture, not implemented services.  
**Audience:** Developers, architects, platform operators and integrators.  
**Scope:** Fictional, domain-neutral user-configurable agent platform.

This document deliberately uses **multiple diagram types**. A single giant flowchart cannot clearly describe boundaries, temporal behavior, exception handling and ownership at the same time.

| View | Answers | Use when |
| --- | --- | --- |
| **C4-style system context** | What is outside our platform? | Aligning scope and integrations |
| **C4-style container/component view** | Which logical service owns what? | Defining contracts and deployment responsibilities |
| **Sequence diagram** | What happens in time after a request? | API/runtime/worker design |
| **Swimlane workflow** | Who performs each step and decision? | Explaining routing, tool execution, approvals |
| **Failure/recovery swimlane** | What happens when a worker or provider dies? | Reliability and operations |
| **Event/state transition** | What durable messages/states exist? | EventCatalog resources, idempotency and UI |

The diagrams below are editable Mermaid source in Git. Subgraphs in a flowchart are used as **logical swimlanes**; they are not BPMN 2.0 execution files. If executable BPMN or strict role-based swimlanes become a product requirement, model them separately in a BPMN designer with semantic validation.

## A. System context — actors and boundaries

~~~mermaid
flowchart LR
    USER["End User / Developer"] --> UI["Agent Studio / Chat UI"]
    ADMIN["Workspace Administrator"] --> UI
    UI --> PLATFORM["Agent Platform"]
    EXT["Webhook / Email / Scheduler"] --> PLATFORM

    PLATFORM --> MODEL["Approved LLM/Decision Provider"]
    PLATFORM --> TOOL["Reviewed MCP / SaaS Tool"]
    PLATFORM --> REMOTE["Isolated Job Runner / External Agent"]
    PLATFORM --> DATA[("PostgreSQL / Artifact Storage")]

    classDef trust fill:#e6f4f1,stroke:#117a65,color:#17332c
    class PLATFORM,UI trust
~~~

**Boundary:** externally triggered calls enter through the API/trigger adapter; they must not directly invoke workers or bypass policy. The external runner and model providers are dependencies, not components we promise to own.

## B. Container/component view — control, execution, integration and state

~~~mermaid
flowchart TB
    subgraph EXPERIENCE["Experience Layer"]
      UI["Chat / Agent Studio UI"]
      ADMIN["Admin & Catalog UI"]
    end

    subgraph CONTROL["Control Plane"]
      API["API Gateway + Identity"]
      REG["Agent/Adapter/Tool Registry"]
      ROUTER["Eligibility + Routing / Decision"]
      RUN["Run Service + Version Pinning"]
      POLICY["Policy + Budget + Approvals"]
    end

    subgraph EXEC["Execution Plane"]
      WF["WorkflowEngineAdapter: Hatchet / DBOS"]
      Q["Durable Queue / Dispatch"]
      WORKER["Agent Worker Pool"]
      RUNTIME["RuntimeAdapter: Simple / Deep"]
    end

    subgraph INTEG["Integration Plane"]
      TOOLGW["Tool Gateway"]
      CONN["ToolConnectorAdapter: MCP / HTTP"]
      DELEGATE["DelegationAdapter: Internal / A2A"]
      JOB["JobExecutorAdapter: External Jobs"]
      MODEL["ModelProviderAdapter / Gateway"]
    end

    subgraph PERSIST["Durable State"]
      DB[("Run, Registry and Approval DB")]
      EVENTS[("Run Event Store + Checkpoints")]
      BLOB[("Scoped Artifacts")]
    end

    UI --> API
    ADMIN --> API
    API --> REG
    API --> ROUTER
    API --> RUN
    ROUTER --> REG
    RUN --> POLICY
    RUN --> DB
    RUN --> WF
    WF --> Q
    Q --> WORKER
    WORKER --> RUNTIME
    RUNTIME --> MODEL
    RUNTIME --> TOOLGW
    RUNTIME --> DELEGATE
    TOOLGW --> CONN
    TOOLGW --> JOB
    DELEGATE --> RUN
    WORKER --> EVENTS
    JOB --> BLOB
    EVENTS --> API
    API --> UI
~~~

**Ownership decisions:** the Run Service owns the platform \`runId\`, budget, approval and user-facing status projection. The selected workflow engine owns its internal step execution/recovery. The worker owns the model/tool loop. The Tool Gateway owns **every per-tool authorization check**. The API alone exposes SSE to the browser. These are logical components, not necessarily separate deployments.

## C. Sequence — user input -> agent selection -> tools -> response

~~~mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Chat UI
    participant API as Platform API
    participant REG as Registry + Router
    participant RUN as Run Service
    participant ENG as Workflow Engine
    participant W as Agent Worker
    participant MODEL as Model Gateway
    participant GW as Tool Gateway
    participant EV as Run Events

    User->>UI: "How do I use this API?"
    UI->>API: POST /runs {target:auto, sessionId, message}
    API->>REG: List eligible deployed agents; choose target
    alt No eligible or unambiguous match
      REG-->>API: UNROUTABLE
      API-->>UI: Clarify or explicit agent choice
    else Authorized deployment selected
      REG-->>API: Documentation Agent v2
      API->>RUN: Atomic admission + pinned config + outbox
      RUN-->>API: runId
      API-->>UI: 202 {runId, eventsUrl}
      UI->>API: GET /runs/{id}/events (SSE)
      RUN->>ENG: Idempotent workflow submission
      ENG->>W: Execute pinned agent version
      W->>MODEL: Input + permitted tool schemas
      MODEL-->>W: Request knowledge.search
      W->>GW: Validate request, principal and resource ACL
      GW-->>W: Approved search results with source IDs
      W->>MODEL: Source evidence; synthesize answer
      MODEL-->>W: Final answer
      W->>EV: Persist normalized events + usage
      EV-->>API: Durable read / notification
      API-->>UI: SSE deltas + run.completed
    end
~~~

The router picks an **agent**; once running, the model may *propose* a tool. The gateway decides whether that tool call is executable. For an explicit agent selection or bound trigger, routing model inference is skipped.

## D. Swimlane — ownership of a normal run

~~~mermaid
flowchart TB
    subgraph L1["LANE 1 · Client and API"]
      direction LR
      I1["Receive user request"] --> I2["Authenticate and create runId"]
      I3["Respond 202 + SSE URL"] --> I4["Render progress / final result"]
    end

    subgraph L2["LANE 2 · Routing and Policy"]
      direction LR
      P1["Resolve explicit/trigger/session binding"] --> P2{"Need auto-route?"}
      P3["Select only eligible agent"] --> P4["Pin version + budget"]
    end

    subgraph L3["LANE 3 · Workflow Engine"]
      direction LR
      Q1["Idempotent submit"] --> Q2["Queue + lease execution"]
      Q3["Commit terminal status"]
    end

    subgraph L4["LANE 4 · Agent Worker"]
      direction LR
      W1["Load pinned agent"] --> W2["Model chooses approved tool"]
      W3["Compose answer from evidence"] --> W4["Publish events + result"]
    end

    subgraph L5["LANE 5 · Integration / Tool Gateway"]
      direction LR
      T1["Validate tool, actor, tenant, ACL"] --> T2{"Allowed?"}
      T3["Run reviewed MCP/HTTP tool"] --> T4["Return sanitized evidence"]
      T5["Deny + audit"]
    end

    I2 --> P1
    P2 -->|No| P4
    P2 -->|Yes| P3
    P3 --> P4
    P4 --> Q1
    Q1 --> I3
    Q2 --> W1
    W2 --> T1
    T2 -->|Yes| T3
    T2 -->|No| T5
    T4 --> W3
    T5 --> W3
    W4 --> Q3
    Q3 --> I4
~~~

**Swimlane invariant:** the model **never** directly invokes an external command or approves its own write. Every transition crossing from the agent worker to an integration crosses the Tool Gateway.

## E. Swimlane — approval-gated external script/job

~~~mermaid
flowchart TB
    subgraph USERLANE["LANE 1 · Authorized Reviewer"]
      U1["Inspect exact requested operation"] --> U2{"Approve?"}
    end

    subgraph RUNLANE["LANE 2 · Platform Run and Approval Service"]
      P1["Persist immutable intent hash"] --> P2["WAITING_APPROVAL / release worker slot"]
      P3["Verify decision + current ACL + budget"]
      P4["Requeue safe continuation"]
      P5["Mark rejected or expired"]
    end

    subgraph TOOLLANE["LANE 3 · Tool Gateway and Job Coordinator"]
      G1["Validate fixed registered job template"] --> G2["Reserve idempotency key + ExternalJob"]
      G3["Submit approved operation"]
      G4["Correlate callback / poll results"]
    end

    subgraph REMOTELANE["LANE 4 · Isolated External Runner"]
      R1["Execute reviewed, pinned job image"] --> R2["Return job ID, status, artifact"]
    end

    subgraph UOUT["LANE 5 · API / SSE"]
      E1["approval.required event"]
      E2["job.completed or reconciliation.required"]
    end

    G1 --> P1
    P2 --> E1
    E1 --> U1
    U2 -->|Yes| P3
    U2 -->|No| P5
    P3 --> G2
    G2 --> P4
    P4 --> G3
    G3 --> R1
    R2 --> G4
    G4 --> E2
~~~

The model supplies **validated arguments**, not a shell command. The registered operation maps to an isolated runner. Unknown remote write outcomes require reconciliation. Human approval is bound to the exact payload and is rechecked before execution.

## F. Failure/recovery — worker crashes mid-execution

~~~mermaid
sequenceDiagram
    autonumber
    participant E as Workflow Engine
    participant W1 as Worker A
    participant STORE as Durable Run / Checkpoints
    participant GW as Tool Gateway
    participant W2 as Worker B
    participant UI as API / UI

    E->>W1: Lease run 123, fencing=7
    W1->>STORE: Persist completed safe step
    W1->>GW: Execute approved tool with invocation ID
    GW-->>W1: Remote effect accepted (outcome may persist separately)
    Note over W1: Worker crashes before acknowledging step result
    E->>E: Detect failed heartbeat / lease expiration
    E->>W2: Lease run 123, fencing=8
    W2->>STORE: Read pinned version + checkpoint + invocation ID
    alt Tool is read-only or outcome safely known
      W2->>GW: Resume / fetch prior outcome
      GW-->>W2: Recorded result
      W2->>STORE: Append resumed status and final result
      STORE-->>UI: SSE replay + terminal status
    else External write outcome uncertain
      W2->>STORE: Mark RECONCILIATION_REQUIRED
      STORE-->>UI: Safe status + manual/integration reconciliation
    end
    Note over E,W2: Stale worker A cannot commit using fencing=7
~~~

This failure path requires engine-specific verification. A durable workflow engine does **not** promise exactly-once external writes by itself.

## G. Event choreography and run state

~~~mermaid
stateDiagram-v2
    [*] --> ROUTING: automatic selection
    [*] --> QUEUED: explicit/bound target
    ROUTING --> QUEUED: route.selected
    ROUTING --> UNROUTABLE: no safe match
    QUEUED --> RUNNING: run.started
    RUNNING --> WAITING_APPROVAL: approval.required
    WAITING_APPROVAL --> QUEUED: approval.granted
    WAITING_APPROVAL --> REJECTED: approval.denied/expired
    RUNNING --> WAITING_EXTERNAL_JOB: job.accepted
    WAITING_EXTERNAL_JOB --> QUEUED: job.completed/resume
    WAITING_EXTERNAL_JOB --> RECONCILIATION_REQUIRED: ambiguous external outcome
    RUNNING --> SUCCEEDED: run.completed
    RUNNING --> FAILED: run.failed
    RUNNING --> QUEUED: safe recovery
    QUEUED --> CANCELLED: cancel
    RUNNING --> CANCELLED: acknowledged cancel
    WAITING_EXTERNAL_JOB --> CANCELLED: confirmed cancel
    SUCCEEDED --> [*]
    FAILED --> [*]
    UNROUTABLE --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
    RECONCILIATION_REQUIRED --> [*]
~~~

**Contract note:** \`WAITING_EXTERNAL_JOB\` is a **proposed addition** to the public run-state vocabulary. If the platform chooses to represent it as \`WAITING\` plus \`waitReason: "EXTERNAL_JOB"\`, all API schemas and related state diagrams must be reconciled before implementation. Don't make this solely a diagram-level change.

## 2. Suggested diagram ownership and documentation mapping

| Diagram | Source of truth | EventCatalog mapping |
| --- | --- | --- |
| System context / component | Versioned Markdown + service descriptors | Domains, Systems, Services, context map |
| Request/route/run sequence | Mermaid source alongside API docs | Flow linked to services + optional embedded sequence |
| Tool/approval swimlane | Swimlane source + policy contract | Flow with actor/service/custom decision nodes |
| External job/runner | JobExecutor docs + workflow contract | Flows and external system nodes |
| Worker crash / recovery | Reliability chapter + chaos test specification | Flow + ADR and runbook links |
| State/events | API contract, OpenAPI/AsyncAPI/JSON Schema | Commands, events, services and schemas |

## 3. Diagram review checklist

- **Naming:** each participant must map to an owned logical component; a diagram must not suggest tools trigger themselves.
- **Authority:** all external operations pass through Tool Gateway; never show an LLM directly approving writes.
- **Durability:** persistent accept precedes HTTP 202; worker failures never erase accepted runs.
- **Ownership:** workflow engine's internal step states do not compete with platform's user-facing run projection.
- **Cost:** expensive model calls and subagent fanout remain bounded by policy.
- **Privacy:** only fictional actors, endpoints, run IDs and data are shown.
- **Versioning:** document what was proposed and what was tested; update diagrams with the actual implementation and API contracts.
- **Reproducibility:** keep editable Mermaid diagrams in Git; don't use only screenshots.

**See also:** [12 — EventCatalog adoption and sample](./12-eventcatalog-architecture-catalog.md).
