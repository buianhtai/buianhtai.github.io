# Enterprise architecture diagram pilot — Archify + EventCatalog

**Status: exploratory, proposed, synthetic.** This is an optional visual presentation experiment, not a new architecture source of truth or evidence of a deployed runtime.

EventCatalog owns the resource IDs, services, systems, diagrams, versions, decisions and contracts. The files in this directory are **curated Archify presentation candidates** of three selected views. They reuse the same viewer pattern as the Astro blog, which already publishes `public/diagrams/*.json` + standalone interactive `.html`.

| Enterprise view | Archify source | Published view | Scope caveat |
| --- | --- | --- | --- |
| Container architecture | `agent-platform-container-map.architecture.json` | `/architecture/showcase/agent-platform-container-map.html` | C4-*inspired* with explicit frontend, backend control plane, isolated execution, integration, persistence and external provider boundaries; not a normative C4 model |
| Request-to-result | `agent-run-sequence.sequence.json` | `/architecture/showcase/agent-run-sequence.html` | UML-sequence-*inspired* illustration |
| Human approval | `approval-swimlane.workflow.json` | `/architecture/showcase/approval-swimlane.html` | BPMN-*inspired* swimlanes, not BPMN XML/executable BPMN |

## Build

On GitHub Actions, the build checks out the upstream MIT-licensed Archify **v3.0.1** renderer pinned to commit
`2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c`, into an ephemeral `.vendor/archify/` working directory. It uses `npm ci` inside that checkout and generates self-contained HTML in `dist/architecture/showcase/`. No global installation is requested and nothing is deployed to an agent's skill directory.

~~~bash
npm ci
# Checkout https://github.com/tt-a1i/archify at the pinned commit into .vendor/archify
npm ci --prefix .vendor/archify/archify --no-audit --no-fund
node scripts/build-archify-pilot.mjs
~~~

The build validates each source against Archify's runtime constraints and checks the generated HTML. Each view lists the EventCatalog service IDs that must exist. The accompanying EventCatalog native graphs remain the **canonical navigation and ownership model**.

## Explicit container and trust boundaries

The revised overview is no longer a flat service graph. It wraps the **Chat UI / Agent Studio** inside a Frontend boundary, the **Platform API and control services** inside Backend, the **Dispatcher and Agent Worker** inside Execution, the **Model and Tool Gateway** inside Integration, and configuration/event/artifact storage inside Data. Third-party model and tool providers are outside the application boundary. The browser is never the Platform API and model calls must go through policy-controlled gateways.

The native [C4 Level 2 view](/architecture/diagrams/C4Containers/0.1.0/) mirrors those logical boundaries using `Container_Boundary` elements, so an architect can compare the descriptive C4 view with Archify’s interactive presentation.

## Review criteria

- Clearer at a glance than the equivalent native EventCatalog page?
- Interactions (focus, trace/route, inspection, export) work on desktop and narrow screens?
- Are every depicted relationship and trust boundary supported by the documented **proposed** design?
- Do diagram authors avoid inventing runtime behavior or production facts?
- Can content maintainers keep views consistent as EventCatalog IDs change?

**Do not use Archify diagrams as a substitute for formal BPMN 2.0 XML, UML interchange, ArchiMate metamodels or executable code.** If a workflow will execute in a BPMN engine, its BPMN model and deployment are a separate verified artifact. Keep C4/sequence/ERD/data-flow and trust-boundary explanations relevant to their audiences.

## Next if successful

A generator could read canonical EventCatalog resource frontmatter and flow edges and produce the Archify intermediate JSON for selected views. This pilot deliberately does not claim that automatic export already exists.
