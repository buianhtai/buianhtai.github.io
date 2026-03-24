# Session Handoff — 2026-03-24 (Session 3)

## Completed This Session

### 1. Blog Management System (6 features, 16 files, 1,399 lines)
- **Commit**: `27bac9e`
- **Design doc**: `docs/plans/2026-03-24-blog-management-system.md`
- **New CLI commands**:
  - `npm run blog:new -- --title "..." --lang en --category ai` — scaffold MDX posts with Zod-validated frontmatter
  - `npm run blog:series -- --id "keycloak" --title "..." --description "..."` — add series to `series.json`
  - `npm run blog:update -- --slug keycloak-architecture` — auto-set `updatedDate` to today
  - `npm run blog:validate` — validate all frontmatter against schema
- **Infrastructure changes**:
  - `src/content/series.json` — single source of truth for series definitions
  - `src/content.config.ts` — dynamic series enum, `blogSchema` export, `featured` field
  - `src/lib/posts.ts` — reads seriesMeta from JSON
  - Draft preview: dev-mode visibility with amber DRAFT badge
  - Landing page: auto-generated project cards from series + featured posts
  - Verify pipeline: `npm run blog:validate` runs before `astro build`

### 2. Flywheel Blog Posts (2 posts)
- **Commit**: `308e1ef`
- **Updated**: `agent-flywheel-ecosystem.mdx` — expanded from 6 to 12 tools, added flywheel loop model
- **New**: `the-agentic-coding-flywheel-why-85-planning-beats-100-coding.mdx` — methodology deep-dive (85/15 thesis, multi-model blending, compounding memory)
- Both in `ai-agent-tools` series (seriesOrder 4 and 6)
- No Glide/GlideYoke references — user explicitly requested this

### 3. Deploy Fix
- **Commit**: `cee2ae1`
- Fixed GitHub Actions deploy failure: added D2 CLI install step to `.github/workflows/deploy.yml`
- All deploys since Mar 23 (D2 integration) had been failing
- Deploy now succeeds ✅

## In Progress
- None — all work committed and pushed

## Next Up

### Blog Backlog
1. Vietnamese translations for new posts (flywheel ecosystem, flywheel methodology, keycloak)
2. Fill `seriesOrder: 5` gap in ai-agent-tools series (nvidia-openshell is at 5, flywheel methodology is at 6 — verify ordering)
3. Replace remaining Mermaid usages in older posts with D2 or custom components
4. Consider new blog series (e.g., Keycloak deep dives — `npm run blog:series`)

### Blog Management Enhancements
1. Add `--help` flag to all CLI scripts
2. Consider interactive mode wrapper for `blog:new`
3. Update `blog-writer` skill references to mention the new CLI commands
4. Add `blog:validate` to CI/CD pipeline (currently only in verify.sh)

### Flywheel → Real Codebase Mapping
- The `.sisyphus/plans/flywheel-mapping-glide-agents.md` (636 lines) has a complete analysis mapping flywheel tools onto a real codebase
- User wanted to explore this but it involves sensitive repo — avoid mentioning Glide

## Key Decisions Made
- CLI scripts are flag-based (not interactive) — agent-friendly, CI-friendly
- Scripts written in TypeScript (import Zod schema directly from content.config.ts)
- `series.json` is the single source of truth — no code changes needed to add series
- `blogSchema` exported as named export for shared use by CLI scripts
- `node:module` register() used to shim Astro virtual imports in CLI scripts
- Draft preview: dev-only inline visibility (not separate /drafts route)
- Landing page: series-driven + `featured: true` posts (not separate projects registry)
- No Glide/GlideYoke references in any public blog content

## Git State
- **Branch**: main
- **Last commit**: `cee2ae1` (deploy fix)
- **Status**: Clean (untracked: .sisyphus/, docs/keycloak-research.md, keycloak/, public/d2/, tsx-501/)
- **Remote**: Up to date with origin/main
- **Deploy**: ✅ Passing (GitHub Pages)

## Key File Locations
- Blog posts: `src/content/blog/en/`
- Series config: `src/content/series.json`
- Content schema: `src/content.config.ts` (exports `blogSchema`)
- CLI scripts: `scripts/blog.ts`, `scripts/series.ts`, `scripts/update.ts`, `scripts/validate.ts`
- Shared CLI utils: `scripts/lib.ts`
- MDX components: `src/components/mdx/` (19 files)
- Design doc: `docs/plans/2026-03-24-blog-management-system.md`
- Flywheel mapping: `.sisyphus/plans/flywheel-mapping-glide-agents.md`

## Continuation Prompt
```
I've built a blog management system with 4 CLI commands (blog:new, blog:series, blog:update, blog:validate), config-driven series via series.json, draft preview in dev mode, and auto-generated landing page cards.

I also updated the flywheel ecosystem post (6→12 tools) and wrote a new methodology post. No Glide references in any public content.

Deploy is fixed and passing. Site is live at https://buianhtai.github.io.

Key files: scripts/*.ts (CLI), src/content/series.json (series), src/content.config.ts (schema with blogSchema export).
```
