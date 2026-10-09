# 12 — EventCatalog: Architecture Portal, Pricing and Adoption Plan

**Status:** Proposed evaluation, not a production catalog or existing website integration.
**Checked:** 2026-10-09 from [EventCatalog's current pricing page](https://www.eventcatalog.dev/pricing), [visualization documentation](https://www.eventcatalog.dev/features/visualization), and [repository/license](https://github.com/event-catalog/eventcatalog).

## 1. Decision: use EventCatalog for a living architecture map?

**Recommended: YES, evaluate the free Community edition as a *separate architecture documentation portal*, while keeping the existing blog and Markdown RFC files.** EventCatalog is not an agent framework or durable workflow engine; it documents and visualizes the architecture of such a system.

It is most useful when we stop treating every service or event as plain prose and give it a **stable, versioned identity**.

### Licensing and current prices

| Edition | Current price | Relevant capability |
| --- | --- | --- |
| Community | **Free**, self-hosted, no subscription | Architecture docs, services, versioned schemas, architecture visualizations, business workflows, Git documentation |
| Business (Scale) | **$499 monthly** or **$449/month annual billing** ($5,388/year); up to 250 employees | OpenAPI/AsyncAPI automation, official sync integrations, MCP/AI assistant, custom pages, bring your own docs, embedding, CI breaking-change detection |
| Enterprise | Contact sales | Multi-catalog federation/cross-catalog relations and negotiated terms |

Prices were read October 9, 2026 at **https://www.eventcatalog.dev/pricing**. The website previously hosted different v2 pricing (e.g. older Starter/Scale plans); **the current /pricing page is the reference**, not older search result snippets. All plans are advertised as self-hosted; the repository has mixed licensing (core largely MIT, paid feature directories commercial). Official integrations may carry separate license requirements. Review the exact pinned version and conditions before commercial embedding/distribution.

**No paid plan is needed to start with manually curated services, messages and flows.** We can first find out whether the architectural discovery experience improves comprehension before paying for automation.

## 2. Where EventCatalog fits

~~~mermaid
flowchart LR
    REPO["Git: Architecture source"] --> BUILD["EventCatalog Community build"]
    REPO --> BLOG["Existing Astro blog build"]
    BUILD --> CATALOG["Architecture catalog (separate URL)"]
    BLOG --> SITE["Existing blog URL"]
    CATALOG --> SERVICES["Services / Domains"]
    CATALOG --> FLOWS["Flows / Messages"]
    CATALOG --> DOCS["Links to Git Markdown / RFC / ADRs"]
    SITE --> CATALOG
~~~

**Do not replace the existing Astro website or modify its public routing just to evaluate EventCatalog.** A dedicated catalog directory or repo keeps toolchain/dependencies isolated and permits hosting on a different subdomain or GitHub Pages path (after separately validating base paths and static output).

Maintain **one authoritative copy** of each concept:
- Versioned architecture interfaces and decisions remain in Git Markdown/JSON Schema.
- EventCatalog holds *navigable projections* of systems, services, events, commands, flows, ownership, links and specs.
- Avoid duplicating the entire prose of Chapters 01–11 into catalog MDX by hand.
- Later, an approved generator/SDK can derive or sync resources from a structured manifest; automation features may require a commercial license.

## 3. Resource model for our platform

| EventCatalog resource | Our architecture concept | First examples |
| --- | --- | --- |
| System | Agent Platform | Logical overall system |
| Domain | Control, Execution, Integration, Operations | Bounded areas of ownership |
| Service | Logical software component (not necessarily separate deployment) | Platform API, Run Service, Agent Worker, Tool Gateway, Workflow Engine |
| Event | Durable published notification/state | RunAccepted, RunCompleted |
| Command | Request/intention | StartAgentRun, InvokeTool, RequestApproval |
| Query | Read contract | GetRunStatus, ListEligibleAgents |
| Flow | End-to-end story | Explicit Documentation Agent Run; Approval-gated External Job |
| Schema | Contract artifact | JSON Schema, OpenAPI, AsyncAPI |
| ADR | Immutable/dated decision and alternatives | Workflow engine selection, tenant isolation |

**Warning:** Do not assert an event exists in production merely because EventCatalog models it. Mark these as **proposed** until implemented and observed. AgentVersion, ToolDefinition and AdapterPackage may map better to domain entities or schemas than standalone deployable services.

### Event catalog vs actual workflow engine

EventCatalog's **Flow** is a **documentation diagram**, *not* executable BPMN, Kestra YAML, Hatchet task graph, or DBOS workflow source. A diagram tells readers what should happen; the chosen execution engine determines what actually runs.

Likewise, EventCatalog's architecture visualization provides relationships between services/events; **it isn't automatically a swimlane generator for every approval/error path**. Keep precise Mermaid sequences and swimlane views from [Chapter 11](./11-architecture-views-component-flow-swimlanes.md) alongside catalog Flows.

## 4. Minimal source prototype (checked-in, not deployed)

A small, generic **EventCatalog-compatible resource proposal** is in [eventcatalog-poc/](./eventcatalog-poc/README.md). Its layout mirrors EventCatalog's resource directories:

~~~text
eventcatalog-poc/
├── README.md
├── domains/
│   └── AgentPlatform/index.mdx
├── services/
│   ├── PlatformAPI/index.mdx
│   ├── RunService/index.mdx
│   ├── AgentWorker/index.mdx
│   ├── ToolGateway/index.mdx
│   └── EventStreamAPI/index.mdx
├── events/
│   ├── RunAccepted/index.mdx
│   └── RunCompleted/index.mdx
└── flows/
    ├── ExplicitAgentRun/index.mdx
    └── AgentRunRecovery/index.mdx
~~~

This is **sample content for an EventCatalog project**, not a runnable EventCatalog site by itself. The catalog framework, Node runtime and pinned dependencies have **not** been installed/deployed as part of this PR.

### Validation sequence for a real proof of concept

1. Generate a clean, separate project with \`npx @eventcatalog/create-eventcatalog@latest agent-architecture-catalog\` using the official getting-started instructions. **Pin the generated version afterward**, especially because EventCatalog v4 is currently described as beta in migration docs.
2. Copy \`eventcatalog-poc/domains\`, \`services\`, \`events\` and \`flows\` into the generated project root.
3. Run the catalog's documented install/build scripts (typically \`npm install\`, \`npm run dev\`, \`npm run build\`), correct any version-specific MDX/frontmatter differences, and verify the NodeGraph and Flow views in a browser.
4. Confirm service/event relations and both flow graphs navigate correctly, and that no confidential business details appear.
5. Deploy **as a separate architecture URL** only after version and static hosting/base-path checks pass.
6. Compare maintenance effort with plain Mermaid/docs; decide whether commercial sync/MCP functionality justifies its subscription.

**An important limitation:** the sample directory in this PR is not the proof of a successful EventCatalog build. Our existing blog CI validates the *Astro blog*, not a separate EventCatalog installation.

## 5. Diagram strategy

| Diagram | Source / format | Render strategy |
| --- | --- | --- |
| System context / component | Mermaid Markdown, versioned service resources | Chapter 11 in Git; EventCatalog architecture map |
| Detailed execution time order | Mermaid \`sequenceDiagram\` | Git Markdown, and link/embed in catalog docs if supported |
| Swimlane orchestration | Mermaid lane-like subgraphs or BPMN designer | Git Markdown; catalog Flow as navigable high-level counterpart |
| Events and dependencies | EventCatalog events/commands/services | Native visualizer and NodeGraph |
| State machine / retry | Mermaid state diagram | Git alongside API/run contract |
| Reviewable architecture decision | ADR Markdown + version references | Linked resource/ADR in catalog |

EventCatalog supports MDX/diagrams and its own \`<NodeGraph />\` and \`<Flow />\` components. Use the latter **inside an EventCatalog project**, not in the existing blog's MDX renderer unless integrated separately. Commercial "bring your own documentation" and embedding features must be licensed where required.

## 6. Practical adoption path and costs

### Stage A — no license cost

Manually curate 5 logical services, 2 run events, 2 flows and one domain using Community. Validate whether users can navigate the component map and understand who owns agent selection, tool execution, durable state and UI events. Host the catalog separately if the test succeeds.

### Stage B — architecture governance

Version specs, add OpenAPI/AsyncAPI/JSON Schema references, add ADRs and automated **repo-side** validation for references. Verify whether any official sync plugin or embedded feature needs commercial terms; avoid quietly introducing a trial license into builds.

### Stage C — optional paid automation

If schemas and interfaces change frequently, consider Business for automated sync, custom docs, commercial integrations, EventCatalog MCP and AI-powered docs. Separate this subscription from model inference and deployment costs. Never assume a paid product magically discovers custom adapter ownership or every external runner—cataloging still needs careful domain modeling.

## 7. Acceptance criteria

- A reader can start from Agent Platform, find Run Service and understand what it owns.
- A reader can navigate RunAccepted and RunCompleted to relevant services.
- Two sample flows are easy to follow; links resolve to corresponding service/event resource pages.
- Detailed swimlane/error behavior is covered by Chapter 11 and linked from the portal.
- The diagram source is editable in Git, not just screenshots.
- No customer/private product details, credentials or genuine production metrics are published.
- A fresh project builds successfully under one pinned EventCatalog release **before claiming adoption is complete**.

## Sources

- [Current EventCatalog pricing](https://www.eventcatalog.dev/pricing)
- [Architecture visualizations](https://www.eventcatalog.dev/features/visualization)
- [EventCatalog open-source repo / mixed license](https://github.com/event-catalog/eventcatalog)
- [Flow resource authoring](https://v2.eventcatalog.dev/docs/development/guides/flows/adding-flows)
- [Service frontmatter](https://v2.eventcatalog.dev/docs/api/service-api)
- [Flow frontmatter](https://v2.eventcatalog.dev/docs/api/flow-api)
- [v4 upgrade/beta status](https://www.eventcatalog.dev/docs/development/upgrading/v4)
