# Blog Post Style Guide (WHAT / WHY / HOW / FLOW)

Use this guide for architecture posts in `src/content/blog/en/`.

## Target Shape
- Length target: 1,600-2,600 words.
- Audience: senior engineers who want implementation detail, not marketing copy.
- Voice: direct, technical, evidence-first, no hype.
- Section rhythm: short paragraph -> visual -> interpretation.

## Required Structure

### 0) Frontmatter + Imports
- Include all required frontmatter fields from `frontmatter-schema.md`.
- Import only components actually used.
- Keep imports grouped and sorted by usage order in the post.

### 1) Opening (Problem Statement)
- 2-3 sentences.
- State the concrete risk or engineering pain first.
- Name the project and one-line value proposition second.
- Include quick credibility anchors (license, stars, language) when available.

### 2) Hero Snapshot
- Use `HeroGrid` with exactly 4 items.
- Each item must represent a distinct axis: security, architecture, operations, extensibility.
- Labels are short (1-2 words); sublabels explain the mechanism.

### 3) WHY
- Explain why this problem matters in production.
- Include failure modes, blast radius, or operational cost.
- Prefer one table or one compact visual for risk framing.

### 4) HOW (1-3 sections)
- Split by mechanism, not by files.
- Typical sequence:
  1. System architecture
  2. Policy/enforcement or core algorithm
  3. Extensibility/runtime model
- For each HOW section: describe mechanism, then show concrete artifact (code, config, component).

### 5) FLOW
- Show end-to-end lifecycle from input to output.
- Use `FlowStep` for narrative flows or `Pipeline` for request pipelines.
- Include one concise explanation of where control boundaries are enforced.

### 6) What Makes It Different
- 5-8 bullets, each starting with a differentiator.
- Compare architectural choices, not brand claims.
- End with repo link and current project stats.

## Tone and Writing Principles
- Prefer concrete nouns and active verbs.
- Use exact technology names (`Landlock`, `seccomp`, `OPA`) instead of vague phrases.
- Every claim should be backed by source code, config, docs, or measurable metadata.
- Keep paragraphs tight (2-5 lines in markdown source).
- Explain trade-offs, not only benefits.

## Visual Composition Rules
- One visual = one concept.
- Pick the minimal component that fully explains the idea.
- Use markdown tables only for tiny comparisons (2 rows max).
- Use `DataTable` for larger structured comparisons.
- Use `Mermaid` only when a static component cannot express graph relationships clearly.

## Anti-Duplication Rules
- Do not explain the same flow in both `Mermaid` and `Pipeline`/`FlowStep`.
- Do not repeat identical metrics in HeroGrid and closing bullets.
- Do not restate code blocks line-by-line after showing them.
- If two sections overlap, merge them and keep one stronger visualization.

## Component Selection Heuristics
- Architecture layers -> `ArchLayer`
- Sequential process -> `FlowStep` or `Pipeline`
- Policy allow/deny matrix -> `EnforceRule`
- Capability/provider matrix -> `ProviderGrid`
- Dense comparison tables -> `DataTable`
- High-impact side note -> `Callout`
- Multi-layer defense model -> `PolicyStack`

## Quality Checklist Before Verify
- Problem is explicit in opening.
- Every major section has at most one primary visual.
- No redundant visualizations for the same concept.
- Technical claims are specific and source-backed.
- Closing explains differentiation, not summary repetition.
