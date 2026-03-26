# LangGraph Hero Infographic Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current LangGraph slide-style hero with a custom retro-industrial infographic that better expresses LangGraph as a stateful runtime.

**Architecture:** Add one dedicated Astro MDX component for the hero poster, then simplify the article to render that component at the top while keeping the supporting sections below. Verify the change through a built-HTML test that checks for the new infographic markers instead of the old slide-deck wrapper.

**Tech Stack:** Astro 5, MDX content, Tailwind utility classes, inline SVG/CSS animation, Node `node:test`.

### Task 1: Lock verification around the new hero

**Files:**
- Modify: `tests/langgraph-slide-mode.test.mjs`

**Step 1: Write the failing test**

Update the existing test to assert the built page contains the new hero wrapper and no longer depends on the slide deck markers.

Expected assertions:
- built HTML contains `langgraph-hero`
- built HTML contains `langgraph-state-capsule`
- built HTML contains `langgraph-callout--durability`
- built HTML does not require `slide-nav`

**Step 2: Run test to verify it fails**

Run: `node --test tests/langgraph-slide-mode.test.mjs`

Expected: FAIL because the current built HTML still reflects the older structure or stale build output.

### Task 2: Build the dedicated infographic component

**Files:**
- Create: `src/components/mdx/LangGraphHeroInfographic.astro`

**Step 1: Write minimal implementation**

Create a self-contained component that renders:
- a poster wrapper with `langgraph-hero`
- layered SVG for rails, stations, state capsule, durability base, and perimeter telemetry
- four oversized callouts for `State`, `Routing`, `Interrupts`, and `Durability`
- custom icon-like industrial glyphs drawn in SVG
- restrained CSS motion for the moving state capsule, route pulse, interrupt blink, and checkpoint glow

**Step 2: Keep the API narrow**

Prefer zero or very few props. This hero is article-specific and should not introduce generic abstraction before it is needed.

### Task 3: Replace the old hero usage in the article

**Files:**
- Modify: `src/content/blog/en/langgraph-architecture-stateful-agent-orchestration-with-graphs.mdx`

**Step 1: Remove the old hero deck entry path**

Replace the top slide-deck-oriented visual section with the new infographic component.

**Step 2: Preserve article substance**

Keep the article’s explanatory sections below the fold, but let them reinforce the four infographic themes:
- state
- routing
- interrupts
- durability

### Task 4: Verify the integrated page

**Files:**
- Verify: `dist/en/blog/langgraph-architecture-stateful-agent-orchestration-with-graphs/index.html`

**Step 1: Build site**

Run: `npm run build`

Expected: Astro build completes successfully.

**Step 2: Run targeted test**

Run: `node --test tests/langgraph-slide-mode.test.mjs`

Expected: PASS with the new infographic markers present in built HTML.

### Task 5: Finish the session cleanly

**Files:**
- Review staged changes only

**Step 1: Check worktree state**

Run: `git status --short`

**Step 2: Sync issue/git state if changes are kept**

Run:
- `bd sync`
- `git pull --rebase`
- `git push`

Expected: branch is up to date with origin and the new hero changes are pushed.
