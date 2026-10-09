# Agent Platform Architecture Catalog

A **separate EventCatalog Community static site** embedded into the Astro blog's GitHub Pages deployment under `/architecture/`.

- Framework version: `@eventcatalog/core@4.12.3` (pinned).
- Static build: `npm run build`, output `architecture-catalog/dist/`.
- URL after deploy: `https://buianhtai.github.io/architecture/`.
- Content source: `docs/agent-platform/eventcatalog-poc/`, synchronized before build to avoid duplicate edits.
- Blog remains an independent Astro 5 build. Do not import EventCatalog's Astro components into the blog.

## Develop

From repository root:

```sh
node scripts/sync-architecture-catalog.mjs
cd architecture-catalog
npm install
npm run dev
```

The catalog should run on its own local server. Test the published subpath using a static preview of the **merged output** to verify asset links and resources.

## Build

```sh
node scripts/sync-architecture-catalog.mjs
npm --prefix architecture-catalog install
npm --prefix architecture-catalog run build
mkdir -p dist/architecture
cp -R architecture-catalog/dist/. dist/architecture/
```

The normal Astro build generates `dist/` first. GitHub Actions performs both builds and uploads **one** Pages artifact.

The catalog is intentionally **public and generic**: do not add internal URLs, credentials, production metrics, or customer-specific details. All resource examples describe proposed components, not deployed services.

## Limitations

EventCatalog Community static mode is a documentation viewer—not a running AI orchestration platform. Authentication/server-only features and paid integrations are not included. Catalog data is curated in Git; the original Markdown architecture chapters remain authoritative.

The content synchronized into `agents/`, `services/`, `domains/`, `events/`, and `flows/` is generated into the catalog project and is not committed twice.
