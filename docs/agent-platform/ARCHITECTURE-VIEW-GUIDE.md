# Architecture View Guide — one overview, detailed drill-downs

**Status:** proposed reference architecture; no technology or deployment decisions are asserted to be implemented. This material is generic and uses no customer-specific details.

## How to use these views

Don't put every agent, API, connector, queue and metric in the same drawing. Architecture review works better when each view answers **one question** and keeps its abstraction level consistent:

| View | Primary question | Draw | Avoid |
| --- | --- | --- | --- |
| L0 Executive | What does the platform do and why is it trustworthy? | Five logical capabilities, entry and result paths | API endpoints, classes, retry state details |
| L1 C4 Context | Who uses it and which outside systems does it rely on? | People, system boundaries, external IdP/providers | Database tables and individual services |
| L2 C4 Containers | Which logical deployable/isolated units exist? | FE, API, control plane, isolated workers, gateways, stores | Claiming every logical component is its own pod |
| L3 C4 Components | Who owns the implementation contract? | Modules, typed ports, grants, data ownership | Duplicating all APIs in every view |
| L4 Dynamic | What happens for one request and on failure? | Ordered calls, run state, approvals, retries, events | Hidden side effects or assumed exactly-once writes |
| Cross-cutting | How is the platform operated safely? | Trust boundary, data classification, resilience, deployment | Unconfirmed production topology and metrics |

## Reading paths

**Non-technical stakeholder:** [Executive Overview](./eventcatalog-poc/diagrams/ExecutiveOverview/index.mdx) → [System Context](./eventcatalog-poc/diagrams/C4SystemContext/index.mdx) → [Container Boundaries](./eventcatalog-poc/diagrams/C4Containers/index.mdx).

**Frontend developer:** [Frontend Components](./eventcatalog-poc/diagrams/C4FrontendComponents/index.mdx) → [Backend API Components](./eventcatalog-poc/diagrams/C4APIComponents/index.mdx) → [Run State Machine](./eventcatalog-poc/diagrams/AgentRunStateMachine/index.mdx) → [Run OpenAPI proposal](./eventcatalog-poc/services/PlatformAPI/openapi.json).

**Backend/agent developer:** [Backend API](./eventcatalog-poc/diagrams/C4APIComponents/index.mdx) → [Control Plane](./eventcatalog-poc/diagrams/C4ControlPlane/index.mdx) → [Execution Plane](./eventcatalog-poc/diagrams/C4ExecutionPlane/index.mdx) → [Invocation Sequence](./eventcatalog-poc/diagrams/ToolInvocationSequence/index.mdx).

**Security reviewer:** [Trust Boundaries](./eventcatalog-poc/diagrams/TrustBoundaries/index.mdx) → [Integration Components](./eventcatalog-poc/diagrams/C4IntegrationComponents/index.mdx) → [Approval Flow](./eventcatalog-poc/flows/ApprovalGatedExternalJob/index.mdx) → [Tool Security ADR](./eventcatalog-poc/adrs/adr-003-tool-security/index.mdx).

**SRE:** [Deployment View](./eventcatalog-poc/diagrams/C4Deployment/index.mdx) → [Event and Data Flow](./eventcatalog-poc/diagrams/EventDataFlow/index.mdx) → [Run State Machine](./eventcatalog-poc/diagrams/AgentRunStateMachine/index.mdx) → [Reliability and Scaling](./eventcatalog-poc/diagrams/ResilienceOverview/index.mdx).

## Relationship to Archify

EventCatalog is the canonical source for systems, services, message contracts, logical resources and native navigation. Purpose-built C4/sequence diagrams add explanatory design views. Archify publishes curated interactive presentations of selected structural and workflow scenarios, with source JSON, validation and stable links. Do **not** silently overwrite EventCatalog ownership or imply an Archify diagram is a standards-conformant BPMN/UML interchange file.

## Review checklist for every new view

- State audience, scope, status, assumptions and one primary question.
- Make **frontend versus backend** and **internal versus external** trust boundaries explicit where applicable.
- Link every named service/module to its authoritative catalog resource and approved contract, or mark it provisional.
- Explain the happy path **and** denial, timeout, cancellation and ambiguous-effect handling when relevant.
- Keep generic client data and example identifiers; never embed real secrets, credentials or customer details.
- Use native EventCatalog diagram pages with editable Mermaid source and a CI/browser render assertion.
- Verify cross-view consistency for public statuses, event schema versions and tool names.
- Prefer text/tables outside a diagram to adding labels that obscure lines and interactions.

## Criteria to mark architecture as implemented

An architecture diagram is not implementation evidence. Change status only after verified code/source links, assigned owners, conformance tests, observed behavior in an authorized environment, and human review. Production HA, tenancy/residency, budgets and SLAs must not be inferred from diagrams.
