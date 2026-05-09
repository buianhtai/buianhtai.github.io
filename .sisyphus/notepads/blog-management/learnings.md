# Learnings

## 2026-03-24 Task: Initial Analysis
- Astro 5.7 blog with MDX, Tailwind CSS 4.2, D2 diagrams
- Content at `src/content/blog/{lang}/*.mdx` (18 posts total)
- Content schema in `src/content.config.ts` uses Astro 5 glob loader
- `updatedDate` already in schema AND rendered in `BlogPost.astro` — no UI change needed for Feature 3
- `draft` field exists in schema, blog listing filters it, but slug page does NOT filter it
- `seriesMeta` hardcoded in `src/lib/posts.ts` with `seriesOrder` array
- `z.enum()` requires `[string, ...string[]]` tuple — need fallback if series.json is empty
- All components use CSS variables, scoped styles, IBM Plex Mono for monospace
- Deploy: GitHub Actions on push to main, uses withastro/action@v3
- blog-writer skill has templates, style-guide, frontmatter-schema, component-library references
- Existing scripts: verify.sh (astro build), research.sh (gh api)
- No `tsx` in devDeps — scripts use `npx tsx` which auto-installs

## 2026-03-24 Task: Feature 2 Implementation
- `src/content/series.json` now drives both schema validation (`content.config.ts`) and runtime grouping metadata (`posts.ts`)
- `blogSchema` is a named export and series validation now handles empty-series fallback (`z.string().optional()`) to avoid tuple errors
- `groupPostsBySeries` ordering is now derived from JSON declaration order, keeping series display deterministic from config
- `npm run build` succeeded after refactor with all current routes rendering

## 2026-03-24 Task: Flywheel Ecosystem Post Expansion
- Expanded `agent-flywheel-ecosystem.mdx` from 6-tool framing to a full 12-tool map aligned to the flywheel stages: Plan, Coordinate, Execute, Verify, Remember.
- For this content style, `DataTable` works best for stage-to-tool mapping and failure-mode framing; `Pipeline` should be reserved for the single end-to-end loop visualization to avoid concept duplication.
- Build verification surfaced an unrelated MDX syntax pitfall: HTML comments (`<!-- ... -->`) break Astro MDX parsing and must be replaced with JSX comments (`{/* ... */}`).

## 2026-03-24 Task: Flywheel Methodology Post
- The methodology-focused angle works best when the post explains boundary discipline (Plan/Coordinate/Execute/Verify/Remember) rather than listing tools.
- For this post shape, combining `Pipeline` (stage chain), `ArchLayer` (per-stage mechanisms), and `FlowStep` (single lifecycle narrative) keeps one-visual-per-concept intact.
- Public repo metadata can be pulled with `gh api repos/{owner}/{repo}` for evidence anchors (stars/forks/open issues) and then included with a date-stamped snapshot.
