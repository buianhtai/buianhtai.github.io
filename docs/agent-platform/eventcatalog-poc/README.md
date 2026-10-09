# EventCatalog sample resources — Agent Platform

**Status:** Concept-only source fixtures. Not a deployed catalog and not verified against a pinned EventCatalog runtime.

This folder intentionally mirrors EventCatalog's `domains/`, `agents/`, `services/`, `events/`, and `flows/` resource layout. The first-class agent sample documents its tool capability rather than executing the agent.

## How to evaluate

1. Create a **separate** EventCatalog Community project from the [official installation instructions](https://www.eventcatalog.dev/docs/development/getting-started/installation).
2. Copy the `domains/`, `services/`, `events/` and `flows/` directories from here into the project root.
3. Install/build and preview the catalog under a pinned, verified EventCatalog release; adjust frontmatter for version changes as needed.
4. Browse `AgentPlatform` domain, `PlatformAPI`/`RunService` resources and the `ExplicitAgentRun`/`AgentRunRecovery` flows.
5. Compare rendered views with [Chapter 11 diagrams](../11-architecture-views-component-flow-swimlanes.md).

The fixtures contain **fictional generic architecture**. Events are **design proposals**, not production message contracts. No secrets or customer-specific data should be placed here.

EventCatalog's `<NodeGraph />` is a native EventCatalog component, **not** a component of the existing Astro blog. Keep the catalog separate until a deliberate integration decision is made.
