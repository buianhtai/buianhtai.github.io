# Agent Platform — EventCatalog source

**Status:** versioned, public **architecture proposal**; not a claim of deployed agent services or runtime behavior.

This directory is the source of truth for native EventCatalog resources that are synchronized into the separate `architecture-catalog/` Community application and published under `/architecture/` together with the existing Astro blog. The deployment is handled by the repository's GitHub Pages workflow on `main`.

## What's here

| Type | Number | Why it matters |
| --- | ---: | --- |
| Domain | 1 | Start-here hub, scope, contracts and design invariants |
| System | 1 | Agent Execution Platform across control, runtime and integrations |
| Services | 12 | Explicit ownership boundaries, contracts, failures, metrics |
| Agents | 3 | Documentation, support triage and research coordinator examples |
| Flows | 8 | Invocation, routing, tools, recovery, publication, support, approval and delegation |
| Entities | 7 | Native conceptual models with versioned properties and invariants |
| Events | 10 | Durable lifecycle and approval/tool/delegation message contracts |
| Commands | 6 | Execution and control intents with JSON Schemas |
| Queries | 1 | Read-side run-status contract |

Events, commands and queries have colocated illustrative JSON Schemas. New workflow diagrams are native EventCatalog Flow resources, not executable code. Service references build navigable producer/consumer graphs.

## Recommended learning path

1. [Agent Platform domain](./domains/AgentPlatform/index.mdx): architecture overview, system context, navigation and domain model.
2. [Agent Configuration Lifecycle](./flows/AgentConfigurationLifecycle/index.mdx): how models, skills, tools and limits are published safely.
3. [Explicit Agent Run](./flows/ExplicitAgentRun/index.mdx): user request, durable admission, tools and SSE.
4. [Tool Execution](./flows/ToolExecution/index.mdx): per-invocation authorization and reviewed adapters.
5. [Support Email Intake](./flows/SupportEmailIntake/index.mdx): rules-first orchestration and reviewed drafts.
6. [Approval-Gated External Job](./flows/ApprovalGatedExternalJob/index.mdx): approved writes and outcome reconciliation.
7. [Delegated Agent Run](./flows/DelegatedAgentRun/index.mdx): parent-child lineage, least privilege and bounded budgets.
8. [Agent Run Recovery](./flows/AgentRunRecovery/index.mdx): safe lease recovery after crashes.

## Local build and validation

From repository root, using **Node 22**:

~~~bash
npm ci
node scripts/sync-architecture-catalog.mjs
npm install --prefix architecture-catalog --no-audit --no-fund
npm run build --prefix architecture-catalog
test -s architecture-catalog/dist/index.html
~~~

CI additionally checks critical generated routes. The architecture portal is built into `dist/architecture/` for GitHub Pages. Custom homepage is in `architecture-catalog/pages/homepage.astro` and uses native EventCatalog Flow and NodeGraph components.

## Authoring rules

- Keep all examples **fictional and domain-neutral**; never publish proprietary customer data or credentials.
- Mark proposed behavior clearly. Do not imply an EventCatalog node deploys executable code.
- Use **stable IDs and versions** to keep interactive links navigable across changes.
- Distinguish a ToolDefinition, connection instance, ToolBinding and ToolInvocation; distinguish trigger, routing, tool choice and child-agent delegation.
- Include a meaningful `summary`, owning service, failure behavior, policy, schema and at least one worked example.
- Keep versioned JSON Schema compatible with the message semantics; change major versions for breaking contracts.
- Check that Flow nodes reference existing service/message IDs, and that all catalog pages build before merging.

For rationale beyond individual resources see [agent-platform chapters](../README.md), especially chapters 04 (Tool Registry), 05 (Delegation), 08 (Adapters), 09 (Reliability) and 11 (Architecture Diagrams).
