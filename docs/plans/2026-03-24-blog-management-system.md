# Blog Management System — Design Document

**Date:** 2026-03-24  
**Project:** `/Users/BuiAnhTai/GitHub/Blogs` (Astro 5.7, Tailwind CSS 4.2)  
**Status:** Design — ready for implementation

---

## Overview

Six features that turn the blog into a self-managing system. All file-based, no CMS, no database. The core principle: `src/content.config.ts` and `src/content/series.json` are the single sources of truth. Everything else reads from them.

**Implementation order matters.** Feature 2 (series.json) must land before Feature 6 (landing page automation). Feature 1 (scaffolding) depends on Feature 2 for the series enum. All others are independent.

**Dependency graph:**
```
Feature 2 (series.json)
  └── Feature 1 (scaffolding CLI)
  └── Feature 6 (landing page)
Feature 3 (update tracking)   — independent
Feature 4 (validation CLI)    — independent
Feature 5 (draft preview)     — independent
```

---

## Feature 1: Blog Scaffolding Script

### What it does

A TypeScript CLI at `scripts/blog.ts` that creates a new MDX post with validated frontmatter. No interactive prompts — all input via flags. Validates against the Zod schema before writing the file.

### Files changed

| File | Change |
|------|--------|
| `scripts/blog.ts` | New file — the CLI |
| `package.json` | Add `"blog:new"` script |

### CLI interface

```bash
npm run blog:new -- \
  --title "Keycloak Architecture Deep Dive" \
  --lang en \
  --category architecture \
  --tags keycloak,auth,java \
  --series keycloak \
  --seriesOrder 1 \
  --draft
```

All flags except `--title` are optional. Defaults:
- `--lang`: `en`
- `--category`: `architecture`
- `--tags`: `[]`
- `--draft`: `false`

### Slug generation

Title to slug: lowercase, replace spaces with hyphens, strip non-alphanumeric characters (except hyphens).

```
"Keycloak Architecture Deep Dive" -> "keycloak-architecture-deep-dive"
```

Output path: `src/content/blog/{lang}/{slug}.mdx`

If the file already exists, the script exits with a non-zero code and prints an error. No overwrite.

### Frontmatter validation

The script imports the Zod schema from `src/content.config.ts` and validates the constructed frontmatter object before writing. If validation fails (e.g., invalid category, unknown series), it prints the Zod error and exits without creating the file.

This requires extracting the schema from `content.config.ts` into a named export so `scripts/blog.ts` can import it without pulling in Astro-specific runtime code.

```typescript
// src/content.config.ts — add named export
export const blogSchema = z.object({ ... });

// scripts/blog.ts — import and validate
import { blogSchema } from '../src/content.config.ts';
const result = blogSchema.safeParse(frontmatter);
if (!result.success) { ... }
```

### Template

Uses `.claude/skills/blog-writer/templates/post-template.mdx` as the base. The script replaces the frontmatter block with the validated values and keeps the body template intact.

### package.json addition

```json
{
  "scripts": {
    "blog:new": "npx tsx scripts/blog.ts"
  }
}
```

### Acceptance criteria

- `npm run blog:new -- --title "Test Post" --lang en --category tutorial` creates `src/content/blog/en/test-post.mdx`
- File contains valid frontmatter matching the Zod schema
- Running the same command twice exits with error (no overwrite)
- Invalid `--category` or `--series` value exits with a clear error message before writing
- `--draft` flag sets `draft: true` in frontmatter

---

## Feature 2: Series Management (Config-Driven)

### What it does

Moves series definitions out of TypeScript code and into a JSON file. Adding a new series requires editing one file, not three.

### Files changed

| File | Change |
|------|--------|
| `src/content/series.json` | New file — series definitions |
| `src/content.config.ts` | Read series IDs from JSON, build enum dynamically |
| `src/lib/posts.ts` | Read `seriesMeta` from JSON instead of hardcoded object |
| `package.json` | Add `"blog:series"` script |
| `scripts/series.ts` | New file — CLI to add series entries |

### series.json schema

```json
[
  {
    "id": "goclaw",
    "title": "GoClaw — Multi-Agent AI Gateway",
    "description": "Deep dives into GoClaw's architecture: agent loops, providers, tools, security, memory, and orchestration.",
    "lang": "Go",
    "link": null
  },
  {
    "id": "ai-agent-tools",
    "title": "AI Agent Tools — Open Source Deep Dives",
    "description": "Architecture studies of open-source tools that make AI coding agents practical.",
    "lang": "TypeScript",
    "link": null
  }
]
```

Fields:
- `id` (required): slug-safe identifier, used as the Zod enum value
- `title` (required): display name
- `description` (required): shown in blog listing and project cards
- `lang` (optional): language badge text (e.g., "Go", "TypeScript", "Java")
- `link` (optional): override URL for the project card; defaults to `/en/blog` filtered by series

### content.config.ts change

The series enum must be built dynamically from `series.json`. Astro's content config runs at build time in Node, so `fs.readFileSync` works here.

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const seriesData = JSON.parse(
  readFileSync(join(process.cwd(), 'src/content/series.json'), 'utf-8')
) as Array<{ id: string; title: string; description: string }>;

const seriesIds = seriesData.map(s => s.id) as [string, ...string[]];

export const blogSchema = z.object({
  // ... other fields ...
  series: z.enum(seriesIds).optional(),
  // ...
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: blogSchema,
});
```

Note: `z.enum` requires a non-empty tuple type `[string, ...string[]]`. If `series.json` is empty, fall back to `z.string().optional()`.

### posts.ts change

Replace the hardcoded `seriesMeta` object with a function that reads from `series.json`:

```typescript
// Before
export const seriesMeta: Record<string, { title: string; description: string }> = {
  goclaw: { title: '...', description: '...' },
  'ai-agent-tools': { title: '...', description: '...' },
};

// After
import seriesData from '../content/series.json';

export const seriesMeta: Record<string, { title: string; description: string; lang?: string; link?: string | null }> =
  Object.fromEntries(seriesData.map(s => [s.id, s]));
```

The `groupPostsBySeries` function also has a hardcoded `seriesOrder` array. Replace it with the order from `series.json` (array index = display order).

```typescript
// Before
const seriesOrder = ['goclaw', 'ai-agent-tools'];

// After
const seriesOrder = seriesData.map(s => s.id);
```

### CLI interface

```bash
npm run blog:series -- \
  --id "keycloak" \
  --title "Keycloak Deep Dives" \
  --description "Architecture and internals of Keycloak's auth flows." \
  --lang "Java"
```

The script appends a new entry to `series.json`. If `--id` already exists, it exits with an error.

### package.json addition

```json
{
  "scripts": {
    "blog:series": "npx tsx scripts/series.ts"
  }
}
```

### Acceptance criteria

- `src/content/series.json` exists with the two existing series migrated
- `npm run blog:series -- --id "keycloak" --title "..." --description "..."` appends to `series.json`
- Astro build succeeds after adding a new series entry (no code changes needed)
- `seriesMeta` in `posts.ts` reflects the JSON data
- `groupPostsBySeries` orders series by their position in `series.json`
- Duplicate `--id` exits with error

---

## Feature 3: Update Tracking

### What it does

The `updatedDate` field already exists in the schema and is already rendered in `BlogPost.astro` (line: `{updatedDate && <span>· Updated {dateFmt(updatedDate)}</span>}`). The UI part is already done.

This feature adds the CLI command to set `updatedDate` to today in a post's frontmatter without manually editing the file.

### Files changed

| File | Change |
|------|--------|
| `scripts/update.ts` | New file — CLI to set updatedDate |
| `package.json` | Add `"blog:update"` script |

### CLI interface

```bash
npm run blog:update -- --slug keycloak-architecture
# or with explicit lang
npm run blog:update -- --slug keycloak-architecture --lang en
```

The script:
1. Resolves the file path: `src/content/blog/{lang}/{slug}.mdx`
2. If `--lang` is omitted, searches both `en/` and `vi/` directories
3. Reads the file, parses the frontmatter block (between `---` delimiters)
4. Sets or replaces `updatedDate: YYYY-MM-DD` with today's date
5. Writes the file back

### Frontmatter parsing approach

Use a simple regex-based approach — no YAML parser dependency needed for this single field:

```typescript
const today = new Date().toISOString().slice(0, 10); // "2026-03-24"

// Replace existing updatedDate or insert after pubDate
if (frontmatter.includes('updatedDate:')) {
  frontmatter = frontmatter.replace(/updatedDate:.*/, `updatedDate: ${today}`);
} else {
  frontmatter = frontmatter.replace(/(pubDate:.*\n)/, `$1updatedDate: ${today}\n`);
}
```

### package.json addition

```json
{
  "scripts": {
    "blog:update": "npx tsx scripts/update.ts"
  }
}
```

### Acceptance criteria

- `npm run blog:update -- --slug keycloak-architecture` sets `updatedDate` to today in the matching file
- Running it again updates the existing `updatedDate` (no duplicate lines)
- If the slug doesn't match any file, exits with a clear error
- The `BlogPost.astro` header shows "· Updated {date}" when `updatedDate` is present (already implemented — verify it works)

---

## Feature 4: Frontmatter Validation

### What it does

A CLI that scans all MDX files and validates their frontmatter against the Zod schema. Reports errors with file paths and field-level details. Integrates into the verify pipeline.

### Files changed

| File | Change |
|------|--------|
| `scripts/validate.ts` | New file — validation CLI |
| `package.json` | Add `"blog:validate"` script |
| `.claude/skills/blog-writer/scripts/verify.sh` | Add `npm run blog:validate` before build |

### CLI interface

```bash
# Validate all posts
npm run blog:validate

# Validate a single file
npm run blog:validate -- --file keycloak-architecture
npm run blog:validate -- --file en/keycloak-architecture
```

### Output format

Success:
```
Validated 12 posts — all valid.
```

Failure:
```
INVALID: src/content/blog/en/keycloak-architecture.mdx
  - series: Invalid enum value. Expected 'goclaw' | 'ai-agent-tools', received 'keycloak'
  - category: Required

INVALID: src/content/blog/vi/some-post.mdx
  - pubDate: Invalid date

2 errors found in 12 posts.
```

Exit code: `0` if all valid, `1` if any errors. This allows `verify.sh` to fail the build on invalid frontmatter.

### Implementation approach

```typescript
import { glob } from 'glob';
import { readFileSync } from 'fs';
import { blogSchema } from '../src/content.config.ts';

// Parse frontmatter from MDX file
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  // Use a minimal YAML parser (js-yaml, already likely in devDeps via Astro)
  return yaml.load(match[1]) as Record<string, unknown>;
}

const files = await glob('src/content/blog/**/*.{md,mdx}');
let errorCount = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const fm = parseFrontmatter(content);
  const result = blogSchema.safeParse(fm);
  if (!result.success) {
    errorCount++;
    console.error(`INVALID: ${file}`);
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
  }
}
```

Note: `js-yaml` is a transitive dependency of Astro — it's available without adding to `package.json`. Confirm with `node -e "require('js-yaml')"` during implementation.

### verify.sh integration

```bash
#!/bin/bash
set -e

echo "Validating frontmatter..."
npm run blog:validate

echo "Building..."
npx astro build
```

### package.json addition

```json
{
  "scripts": {
    "blog:validate": "npx tsx scripts/validate.ts"
  }
}
```

### Acceptance criteria

- `npm run blog:validate` exits `0` when all posts are valid
- `npm run blog:validate` exits `1` and prints field-level errors when any post is invalid
- `npm run blog:validate -- --file keycloak-architecture` validates only that file
- `verify.sh` fails the build if validation fails
- Adding an invalid post and running `npm run blog:validate` shows the exact field that's wrong

---

## Feature 5: Draft Preview System

### What it does

In `astro dev`, draft posts appear in the blog listing with a `[DRAFT]` badge. In production builds, drafts remain excluded. The scaffolding script's `--draft` flag already sets `draft: true` — this feature makes those drafts visible during development.

### Files changed

| File | Change |
|------|--------|
| `src/pages/[lang]/blog/index.astro` | Include drafts when `import.meta.env.DEV` |
| `src/pages/[lang]/blog/[...slug].astro` | Include drafts in `getStaticPaths` when `DEV` |

### index.astro change

```typescript
// Before
const posts = (await getCollection('blog', (p) => p.data.lang === lang && !p.data.draft))

// After
const posts = (await getCollection('blog', (p) => {
  if (p.data.lang !== lang) return false;
  if (p.data.draft && !import.meta.env.DEV) return false;
  return true;
}))
```

In the post list template, add a draft badge next to the title:

```astro
<h3 class="font-semibold group-hover:text-[var(--color-accent)] transition-colors">
  {post.data.title}
  {post.data.draft && (
    <span class="draft-badge">DRAFT</span>
  )}
</h3>
```

Badge styles (scoped, using CSS variables):

```css
.draft-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.65rem;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
  border: 1px solid rgba(217, 119, 6, 0.3);
  border-radius: 3px;
  vertical-align: middle;
}
```

### [...]slug.astro change

The current `getStaticPaths` fetches all posts without a draft filter. This already works for dev (drafts are accessible by URL). The only change needed: in production, exclude drafts from `getStaticPaths` so they don't generate static pages.

```typescript
// Before
export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({ ... }));
}

// After
export async function getStaticPaths() {
  const posts = await getCollection('blog', (p) => {
    if (p.data.draft && !import.meta.env.DEV) return false;
    return true;
  });
  return posts.map(post => ({ ... }));
}
```

### Acceptance criteria

- `npm run dev`: draft posts appear in blog listing with amber `DRAFT` badge
- `npm run dev`: draft post URLs are accessible
- `npm run build`: draft posts do not appear in blog listing
- `npm run build`: draft post URLs return 404 (not generated)
- `npm run blog:new -- --title "Test" --draft` creates a post that appears in dev listing

---

## Feature 6: Landing Page Automation

### What it does

The 5 hardcoded project cards in `src/pages/index.astro` are replaced with dynamic content. Series entries from `series.json` become project cards automatically. Standalone posts with `featured: true` also appear as cards.

### Files changed

| File | Change |
|------|--------|
| `src/content.config.ts` | Add `featured: z.boolean().default(false)` to schema |
| `src/pages/index.astro` | Replace hardcoded cards with dynamic query |

### Schema addition

```typescript
// src/content.config.ts
export const blogSchema = z.object({
  // ... existing fields ...
  featured: z.boolean().default(false),
});
```

### Card data model

Each project card needs: title, description, language badge, and link. Two sources:

**Source 1: Series** (from `series.json`)
- title: `series.title`
- description: `series.description`
- lang badge: `series.lang` (optional)
- link: `series.link ?? /en/blog` (filtered by series — see note below)

**Source 2: Featured standalone posts** (posts where `featured: true` and no `series`)
- title: `post.data.title`
- description: `post.data.description`
- lang badge: `post.data.category` (capitalized)
- link: post URL via `getPostUrl(post)`

### Series link behavior

When `series.link` is null, the card links to `/en/blog`. There's no built-in series filter URL in the current routing. Two options:

**Option A (simpler):** Link to `/en/blog` with a URL hash `#goclaw` — the blog listing already renders series as `<section>` elements. Add `id={group.series}` to each section in `index.astro`.

**Option B (future):** Add a `/en/blog/series/[id]` route. Out of scope for this feature.

**Decision: Use Option A.** Add `id` attributes to series sections in `blog/index.astro` as part of this feature.

### index.astro change

```typescript
// Replace hardcoded cards with:
import seriesData from '../content/series.json';
import { getCollection } from 'astro:content';
import { getPostUrl } from '../lib/posts';

// Build project cards from series
const seriesCards = seriesData.map(s => ({
  title: s.title,
  description: s.description,
  lang: s.lang ?? null,
  link: s.link ?? `/en/blog#${s.id}`,
}));

// Build project cards from featured standalone posts
const allPosts = await getCollection('blog', p => !p.data.draft && p.data.featured && !p.data.series);
const featuredCards = allPosts.map(p => ({
  title: p.data.title,
  description: p.data.description,
  lang: p.data.category.charAt(0).toUpperCase() + p.data.category.slice(1),
  link: getPostUrl(p),
}));

const projectCards = [...seriesCards, ...featuredCards];
```

Then replace the hardcoded card JSX with a map over `projectCards`. The visual design (grid, language badge, description) stays identical to the current implementation.

### Existing card structure to preserve

The current cards use this pattern (from the existing `index.astro`):

```astro
<a href={card.link} class="group block p-5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors bg-[var(--color-surface)]">
  <div class="flex items-start justify-between mb-3">
    <h3 class="font-semibold group-hover:text-[var(--color-accent)] transition-colors">
      {card.title}
    </h3>
    {card.lang && (
      <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-dim)] ml-2 shrink-0">
        {card.lang}
      </span>
    )}
  </div>
  <p class="text-sm text-[var(--color-text-dim)] leading-relaxed">{card.description}</p>
</a>
```

This structure must be preserved exactly — only the data source changes.

### blog/index.astro change (for anchor links)

Add `id` attribute to each series section:

```astro
// Before
<section class="mb-12">

// After
<section id={group.series ?? undefined} class="mb-12">
```

### Acceptance criteria

- `src/pages/index.astro` has no hardcoded project card data
- Adding a new entry to `series.json` causes a new card to appear on the landing page after rebuild
- A post with `featured: true` and no `series` appears as a project card
- A post with `featured: true` and a `series` does NOT appear as a standalone card (series card covers it)
- Visual design of cards is identical to current implementation
- `npm run build` succeeds with the dynamic cards

---

## Implementation Notes

### Shared utilities

All CLI scripts (`scripts/blog.ts`, `scripts/series.ts`, `scripts/update.ts`, `scripts/validate.ts`) share common needs:
- Frontmatter parsing (YAML between `---` delimiters)
- File path resolution (`src/content/blog/{lang}/{slug}.mdx`)
- Schema import from `src/content.config.ts`

Consider a `scripts/lib.ts` with shared helpers to avoid duplication across the four scripts.

### tsx dependency

All scripts use `npx tsx` for TypeScript execution. `tsx` is already a devDependency in Astro projects (used by Astro's own tooling). Confirm with `cat package.json | grep tsx` before adding it explicitly.

### Zod schema export

Feature 1 and Feature 4 both need to import `blogSchema` from `src/content.config.ts`. This requires extracting the schema into a named export. This is a prerequisite for both features — do it as part of Feature 2 (which already modifies `content.config.ts`).

### series.json import in Node scripts

Scripts running in Node (not Astro) can import JSON directly with `import seriesData from '../src/content/series.json' assert { type: 'json' }` or via `JSON.parse(readFileSync(...))`. The `assert` syntax requires Node 18+. Use `readFileSync` for maximum compatibility.

### Build-time vs runtime

`src/content.config.ts` runs at Astro build time. `src/lib/posts.ts` runs at build time (SSG). `src/pages/index.astro` runs at build time. All JSON reads in these files use `fs.readFileSync` or static imports — no async file I/O needed.

---

## File Summary

### New files

```
scripts/blog.ts          — scaffolding CLI
scripts/series.ts        — series management CLI
scripts/update.ts        — updatedDate CLI
scripts/validate.ts      — frontmatter validation CLI
scripts/lib.ts           — shared CLI utilities
src/content/series.json  — series definitions (source of truth)
```

### Modified files

```
src/content.config.ts                              — dynamic series enum, featured field, named export
src/lib/posts.ts                                   — read seriesMeta from series.json
src/pages/[lang]/blog/index.astro                  — draft visibility, series section IDs
src/pages/[lang]/blog/[...slug].astro              — draft exclusion in production
src/pages/index.astro                              — dynamic project cards
package.json                                       — blog:new, blog:series, blog:update, blog:validate scripts
.claude/skills/blog-writer/scripts/verify.sh       — add validation step
```

### Unchanged files

```
src/layouts/BlogPost.astro    — updatedDate already rendered (no change needed)
src/components/               — no new components required
```
