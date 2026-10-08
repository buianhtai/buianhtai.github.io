# Modern Engineering Editorial

## Scope

An Astro-native visual overhaul of the personal engineering blog, preserving every Markdown/MDX article, slug, diagram, series and public route.

### Page architecture

- `/`, `/en/`, `/vi/`: editorial hero, featured writing, curated reading series, latest writing and short author introduction. Shared `HomePage.astro`.
- `/[lang]/blog`: searchable article archive with topic filters, reading series filters and URL-backed `?series=` deep-links.
- `/[lang]/blog/[...slug]`: accessible long-form reading layout with editorial hero, sticky table of contents, reading progress, chapter navigation, related articles, metadata and comments.
- `/[lang]/foundations` and Foundations post layouts remain feature-complete; their specialized chapter navigation, progress and advanced diagrams are retained.

### Design tokens

Implementation: `src/styles/editorial.css`. Theme switching: `src/components/ThemeToggle.astro`.

| Token | Dark | Light |
| --- | --- | --- |
| Background | `#0b111b` | `#f7f9fc` |
| Surface | `#121c2a` | `#ffffff` |
| Text | `#edf3f8` | `#152538` |
| Muted text | `#a5b5c7` | `#52667e` |
| Accent | `#71e0d0` | `#087e79` |
| Border | `#263548` | `#dfe6ef` |

Typography: Inter for UI/editorial reading, JetBrains Mono for metadata, existing IBM Plex fonts for specialized Foundations. Spacing uses generous section rhythm, max-width 1180px for pages and 750px for readable article text. Layout adapts below 1024px / 760px / 520px. Motion honours `prefers-reduced-motion`.

### Existing content & functionality

- No content migration: `src/content/blog/**` remains untouched.
- Do not rename post slugs; links remain stable.
- Series and chapter order remain sourced from `src/content/series.json` and Astro Content Collections.
- RSS, sitemap, existing MDX components, D2 renderer and Giscus remain.
- Localized switch always falls back to the corresponding language's archive instead of guessing whether an individual translated article exists.
- Archive search is local metadata search (title, description, tags), **not full-text**. Pagefind may be added in a separate enhancement.

### Quality gates

1. `npm ci && npm run build` (with D2 available on PATH).
2. Check desktop and phone widths: 1440px, 1024px, 768px, 390px, 320px.
3. Test homepage / archive / regular MDX post / Foundations post in dark and light modes.
4. Search terms, category filters, series filter URL and empty result handling.
5. Test all links, keyboard focus, article TOC, comments and theme persistence.
6. Run Lighthouse/Core Web Vitals and a content image audit as a follow-up.

### Implementation notes

- Visual design is implemented with Astro + Tailwind and a dedicated plain CSS token layer; no SPA conversion or new runtime framework.
- Metadata preserves canonical and Open Graph information, and regular blog posts emit `BlogPosting` JSON-LD.
- The redesign branch is intended for review/QA before merging into `main`.
