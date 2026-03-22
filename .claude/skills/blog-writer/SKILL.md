# Blog Writer — Full Pipeline Skill

## Overview
Given a GitHub URL, produce a complete blog post: research -> visual diagram -> MDX with custom components -> build verify -> push.

## When to Use
- "Write a blog post about <url>"
- "Create a post about <project>"
- "Blog about this repo"

## Pipeline (6 Phases)

### Phase 1A: Surface Research
Use context-mode to fetch and index without flooding context:

```txt
ctx_batch_execute(
  commands: [
    { label: "README", command: "gh api repos/{owner}/{repo}/readme -q .content | base64 -d" },
    { label: "Structure", command: "gh api repos/{owner}/{repo}/git/trees/HEAD?recursive=1 -q '.tree[].path'" },
    { label: "Deps", command: "gh api repos/{owner}/{repo}/contents/package.json -q .content | base64 -d" }
  ],
  queries: ["architecture", "tech stack", "key features", "main entry point"]
)
```

### Phase 1B: Source Deep Dive
Clone via repo-autopsy, then read key files through ctx_execute_file:

```txt
repo-autopsy clone(repo: "{owner}/{repo}")

ctx_batch_execute(
  commands: [
    { label: "Core", command: "cat {clone_path}/src/core.*" },
    { label: "Config", command: "cat {clone_path}/src/config.*" },
    { label: "Entry", command: "cat {clone_path}/src/index.*" }
  ],
  queries: ["architecture pattern", "data structures", "interesting algorithms", "code snippets for blog"]
)

repo-autopsy cleanup(repo: "{owner}/{repo}")
```

### Phase 2: Visual Diagram
Delegate to visual-explainer skill:
- Use `task(category="visual-engineering", load_skills=["visual-explainer"], ...)`
- Generate HTML at `~/.agent/diagrams/{project-name}.html`
- Open in browser for review

### Phase 3: Component Audit
Scan the generated HTML for visual patterns. Compare against the component library in `references/component-library.md`.

For each visual section in the HTML:
1. Match to existing component -> use it
2. No match -> create new `.astro` component in `src/components/mdx/`
3. Update `references/component-library.md` with the new component

### Phase 4: Create Components (if needed)
New components MUST:
- Use CSS variables (`--color-accent`, `--color-border`, `--color-surface`, `--color-text`, `--color-text-dim`, `--color-bg`)
- Use scoped `<style>` tags
- Be responsive (1-col mobile, multi-col desktop)
- Accept typed `Props`
- Use IBM Plex Mono for code/monospace text
- Have zero client-side JavaScript (except Mermaid)

### Phase 5: Write MDX Post
Follow the structure in `references/style-guide.md`:

1. Frontmatter (see `references/frontmatter-schema.md`)
2. Imports (only components actually used)
3. Opening paragraph (2-3 sentences, state the problem)
4. HeroGrid (4 key stats)
5. ## WHY section
6. ## HOW sections (1-3, architecture + core mechanism)
7. ## FLOW section (end-to-end workflow)
8. "What Makes It Different" closing
9. Repo link + stats

**Anti-duplication rule:** One visualization per concept.
- Do NOT add Mermaid if FlowStep/Pipeline already shows the same flow
- Do NOT add DataTable if markdown table has only 2 rows
- Priority: Custom component > Mermaid > Markdown table

### Phase 6: Verify + Push
Run: `bash {skill_dir}/scripts/verify.sh`
Then: `git add`, `git commit`, `git push`

## Context-Mode Routing Rules

| Operation | Tool | Why |
|-----------|------|-----|
| Fetch README/source | `ctx_batch_execute` | Raw content indexed, only queries enter context |
| Read source files | `ctx_execute_file` | Print summary only |
| Scan components | `ctx_execute_file` | Extract Props interface |
| Build verification | `ctx_execute` | Only exit code + errors enter context |
| Web documentation | `ctx_fetch_and_index` | HTML->MD, chunked, searchable |

**NEVER read raw source files with Read tool during research. Always use ctx tools.**
Exception: Reading files you intend to EDIT (component creation, post writing).

## References
- Component library: `/Users/BuiAnhTai/GitHub/Blogs/.claude/skills/blog-writer/references/component-library.md`
- Style guide: `/Users/BuiAnhTai/GitHub/Blogs/.claude/skills/blog-writer/references/style-guide.md`
- Frontmatter schema: `/Users/BuiAnhTai/GitHub/Blogs/.claude/skills/blog-writer/references/frontmatter-schema.md`
