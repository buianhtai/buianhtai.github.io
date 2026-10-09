# Architecture Governance and Contract Authoring Guide

**Scope:** EventCatalog Community architecture proposals in this repository. These resources are **not a statement of deployed production features, confirmed staffing, or ratified decisions**.

## Publication lifecycle

| Architecture review state | Definition | Who changes it |
| --- | --- | --- |
| Proposed | Design hypothesis or illustrative contract being evaluated | Authors may open PRs |
| Accepted | Decision reviewed, alternatives and consequences documented | Confirmed decision makers, not placeholder teams |
| Rejected / Superseded | An alternative chosen or new ADR replaces the old | Architecture reviewers |
| Implemented | Linked source, build, observable behavior and test evidence exist | Verified delivery/engineering owner |
| Deprecated | Implementation and consumers have a published migration path | Verified owner |

Do **not** infer `Implemented` from a passing EventCatalog static build. The `x-implementation-status: proposed` metadata is independent from an ADR's `status: proposed`. ADR status records decision approval; implementation status records evidence that the code exists and behaves as documented.

## Ownership

The native team resource `architecture-stewards` is an intentionally **provisional role** only. It exists to make architectural responsibility visible without fabricating a real person's identity, mailbox, or department. Before accepting an ADR or claiming implementation, confirm the actual engineering team and record:

- A named accountable team or approved on-call group, with a verified contact route
- Real source repository and version or commit reference
- Tracking issues/PRs and deployment/service status where applicable
- Review date and review evidence

Changes to production-facing API or external-effect contracts should request review from the actual API/security/service owners.

## Architecture decision process

1. Create `adrs/<stable-id>/index.mdx` with `status: proposed`, date, owners and `appliesTo`.
2. Document why a decision is needed and compare realistic alternatives (cost, reliability, portability, threat boundaries).
3. Record a proposed direction *without claiming acceptance*.
4. Prototype with synthetic, non-sensitive fixtures; gather latency, cost, compatibility and failure-test evidence.
5. Obtain a human review and only then change status and implementation metadata.
6. Never rewrite a published decision into the opposite decision. Supersede it with a new ADR and links.

Current proposals: ADR-001 Durable Engine, ADR-002 Runtime Adapter, ADR-003 Tool Security, ADR-004 Agent Routing.

## Contract authority and compatibility

- **External REST** is represented by `services/PlatformAPI/openapi.json` (OpenAPI 3.1). No real endpoint exists at the placeholder `example.invalid` URL.
- **Run lifecycle notifications** are represented by `services/RunService/asyncapi.json` (AsyncAPI 3) and each event's colocated JSON Schema.
- **Internal commands** are independently versioned catalog messages (`commands/*/schema.json`), not automatic aliases for HTTP request bodies.
- **Run public status**, tool outcome and operation IDs must align with actual implementation and tests *before* asserting deployed status.
- **Provider-specific credentials and customer data** never go into the catalog or its examples.

Nonbreaking evolution can usually add optional fields or compatible enum handling. Breaking changes (remove/rename a required field, change field type, narrow an accepted value set, change an event's meaning, change security semantics) require explicit versioning and a consumer migration plan. An API change may be breaking even when JSON Schema remains structurally valid.

## Automated gates

The offline validator `scripts/validate-architecture-catalog.mjs` rejects unknown native IDs, unresolved owner references, invalid flow next-step edges, schema files with missing required property declarations, ADR `appliesTo` references to non-existent resources, and broken internal specification `$ref` paths. It also checks that sources are explicitly marked Proposed and that the illustrative specification versions are recognizable.

Run from repository root after installing the catalog dependencies:

~~~bash
npm ci
node scripts/sync-architecture-catalog.mjs
npm install --prefix architecture-catalog --no-audit --no-fund
node scripts/validate-architecture-catalog.mjs
npm run build --prefix architecture-catalog
~~~

CI then checks native ADR, flow, entity and spec routes plus the custom homepage and visual checks. A green CI run validates **documentation integrity** only, not runtime behavior.

## Tracked future work

- Replace provisional owners with verified teams and source-specific issue links
- Generate/sync schemas from the real OpenAPI/AsyncAPI producers, once available
- Add backward-compatibility fixtures, consumer-driven contract tests and negative authorization cases
- Link production telemetry, SLOs, threat review and operational runbooks only after they are available

Use a pull request to review these changes; GitHub Pages deploys from `main` after the merge workflow.
