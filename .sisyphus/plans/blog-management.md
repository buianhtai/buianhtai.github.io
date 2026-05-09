# Blog Management System — Implementation Plan

> **Design doc:** `docs/plans/2026-03-24-blog-management-system.md`
> **Goal:** Six features that turn the Astro 5 blog into a self-managing system with CLI tooling, series management, draft preview, and landing page automation.

## Dependency Graph
```
Wave 1: T1 (series.json + content.config.ts refactor) — foundational
Wave 2: T2 (scaffolding), T3 (update tracking), T4 (validation), T5 (draft preview) — parallel
Wave 3: T6 (landing page automation) — depends on T1
Wave 4: T7 (verify.sh integration + final build check)
```

---

## TODOs

- [x] **T1: Series Management — Config-Driven** `[independent]`
  Create `src/content/series.json` as single source of truth. Refactor `src/content.config.ts` to export `blogSchema` and build series enum dynamically from JSON. Refactor `src/lib/posts.ts` to read `seriesMeta` from JSON. Create `scripts/lib.ts` with shared CLI utilities. Create `scripts/series.ts` CLI. Add `blog:series` to `package.json`. Verify: `npm run build` passes with no behavior change.

- [x] **T2: Blog Scaffolding Script** `[depends: T1]`
  Create `scripts/blog.ts` — flag-based CLI (`--title`, `--lang`, `--category`, `--tags`, `--series`, `--seriesOrder`, `--draft`). Import `blogSchema` from `content.config.ts` for validation. Slug generation from title. Uses post-template.mdx as base. Add `blog:new` to `package.json`. Verify: creates valid MDX file, rejects invalid input, no overwrite.

- [x] **T3: Update Tracking CLI** `[depends: T1]`
  Create `scripts/update.ts` — `npm run blog:update -- --slug keycloak-architecture` sets `updatedDate` to today in frontmatter. Add `blog:update` to `package.json`. Verify: sets date correctly, updates existing date without duplication, `BlogPost.astro` already renders it.

- [x] **T4: Frontmatter Validation CLI** `[depends: T1]`
  Create `scripts/validate.ts` — scans all MDX files, validates frontmatter against `blogSchema`. Reports errors with file paths and field details. Supports `--file` for single file. Exit code 0/1. Add `blog:validate` to `package.json`. Verify: catches invalid frontmatter, passes on valid posts.

- [x] **T5: Draft Preview System** `[independent]`
  Modify `src/pages/[lang]/blog/index.astro` — include drafts in dev mode with amber `[DRAFT]` badge. Modify `src/pages/[lang]/blog/[...slug].astro` — exclude drafts from `getStaticPaths` in production only. Verify: drafts visible in `npm run dev`, invisible in `npm run build`.

- [x] **T6: Landing Page Automation** `[depends: T1]`
  Add `featured: z.boolean().default(false)` to `blogSchema`. Replace hardcoded project cards in `src/pages/index.astro` with dynamic query from `series.json` + featured posts. Add `id` attributes to series sections in `blog/index.astro` for anchor links. Preserve existing card visual design. Verify: `npm run build` passes, cards render identically.

- [x] **T7: Verify Pipeline Integration** `[depends: T4]`
  Update `.claude/skills/blog-writer/scripts/verify.sh` to run `npm run blog:validate` before `astro build`. Final full build verification. Verify: `bash verify.sh` runs validation then build.

---

## Final Verification Wave

- [x] **F1: Type Check** — `npx astro check` or `npm run build` exits 0 with zero TypeScript errors
- [x] **F2: Full Build** — `npm run build` succeeds, all 18+ posts render
- [x] **F3: CLI Smoke Test** — Run each `blog:*` command and verify output
- [x] **F4: Code Review** — All changed files follow existing patterns (CSS variables, scoped styles, IBM Plex Mono)
