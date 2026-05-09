# Decisions

## 2026-03-24 Task: Design Phase
- CLI scripts are flag-based, not interactive (agent-friendly, CI-friendly)
- Scripts written in TypeScript (can import Zod schema directly)
- Series definitions in `series.json` (config-driven, single source of truth)
- `blogSchema` exported as named export from `content.config.ts` (shared by scripts)
- `readFileSync` over JSON `assert { type: 'json' }` for Node compatibility
- Draft preview: dev-only inline visibility with badge (not separate /drafts route)
- Landing page: series-driven + `featured: true` posts (not separate projects registry)
- Series card links use anchor links (#id) to blog listing sections (not new routes)
- Update tracking: minimal (just show date, no changelog)
- Shared utilities in `scripts/lib.ts` to avoid duplication

## 2026-03-24 Task: Feature 2 Implementation
- Series metadata source of truth is JSON-first (`src/content/series.json`), not hardcoded TS objects
- CLI scripts use shared `scripts/lib.ts` utilities for consistent arg parsing/frontmatter/path helpers
- `blog:series` command uses `npx tsx` to avoid adding dev dependencies while keeping TS scripts executable

## 2026-03-24 Task: Flywheel Ecosystem Post Expansion
- Keep existing six deep-dive sections intact and add the missing six tools as focused sections, instead of rewriting the post from scratch.
- Center the post around the explicit loop `Plan → Coordinate → Execute → Verify → Remember` and map every tool to exactly one stage for conceptual clarity.
- Preserve series metadata (`series`, `seriesOrder`) unchanged while updating title/description/hero snapshot to reflect 12-tool scope.

## 2026-03-24 Task: Flywheel Methodology Post
- Keep frontmatter `title`, `series`, and `seriesOrder` unchanged and write into the scaffolded file path only.
- Emphasize process philosophy (85/15 planning thesis, model-role specialization, self-reinforcing loop) instead of repeating ecosystem catalog content.
- Use only existing MDX components and remove unused imports (e.g., Mermaid/Card) to keep the article structure clean.
