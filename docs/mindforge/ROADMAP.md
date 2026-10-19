# MindForge — delivery roadmap

> Source of truth: [MindForge V2 tracker #82](https://github.com/buianhtai/buianhtai.github.io/issues/82).  
> This file documents scope and acceptance gates. Issue state + linked PRs are authoritative for status.

## Product intent
Train habits of attention, memory, reasoning, and evidence-based decisions through playful, age-appropriate practice. **Do not claim IQ gains**: game accuracy is not a validated IQ measure.

## Milestone plan

| Release | Task | Issue | Status |
|---|---|---|---|
| V2.1 | Motion system / feedback | [#73](https://github.com/buianhtai/buianhtai.github.io/issues/73) | In review — [PR #83](https://github.com/buianhtai/buianhtai.github.io/pull/83) |
| V2.1 | Animated Memory Matrix | [#74](https://github.com/buianhtai/buianhtai.github.io/issues/74) | In review — [PR #83](https://github.com/buianhtai/buianhtai.github.io/pull/83) |
| V2.1 | Progress trend visuals | [#77](https://github.com/buianhtai/buianhtai.github.io/issues/77) | In review (first chart) — [PR #83](https://github.com/buianhtai/buianhtai.github.io/pull/83) |
| V2.1 | Mobile QA + accessibility | [#78](https://github.com/buianhtai/buianhtai.github.io/issues/78) | Backlog |
| V2.2 | Pattern Builder | [#75](https://github.com/buianhtai/buianhtai.github.io/issues/75) | Backlog |
| V2.2 | Focus Challenge | [#76](https://github.com/buianhtai/buianhtai.github.io/issues/76) | Backlog |
| V2.2 | Release regression suite | [#81](https://github.com/buianhtai/buianhtai.github.io/issues/81) | Backlog |
| V2.3 | Avatar and reward journey | [#79](https://github.com/buianhtai/buianhtai.github.io/issues/79) | Backlog |
| V2.3 | Decision scenario visualizations | [#80](https://github.com/buianhtai/buianhtai.github.io/issues/80) | Backlog |

## Execution workflow

1. Move next highest-impact issue from **Backlog** to **In progress** by commenting or updating [#82](https://github.com/buianhtai/buianhtai.github.io/issues/82).
2. Work on a focused branch in `public/mindforge/` and reference issue numbers in PR.
3. Update issue checkboxes only after verifiable behavior is implemented.
4. Run syntax checks, game-level smoke tests, 320px/mobile review, keyboard and reduced-motion checks; document unverified checks.
5. Merge reviewed PR; confirm GitHub Pages deployment and game path.
6. Close completed issues, post outcome / known gaps, update this roadmap.

### Release gates
- Correctness: playing every game still records results and advances rounds; no unintended pattern answer leakage.
- Accessibility: working focus order, keyboard and touch, reduced-motion, no rapid flashing.
- Privacy: local-only game state, no telemetry, no external analytics.
- Offline: cache bumps with each static asset change; service-worker update tested.
- Observability: build/release status is recorded in PR. Browser tests should be run before production.
- Scientific honesty: charts report *practice performance*, not general intelligence changes.

## V2.1 implementation notes

Increment 1:
- `public/mindforge/visuals.css`: animated card entrances, feedback, celebratory results and matrix tiles.
- `public/mindforge/visuals.js`: memory countdown overlay, keyboard focus restoration, SVG accuracy trend from saved records.
- `public/mindforge/sw.js`: offline cache revision to include visual assets.
- `public/mindforge/index.html`: source references to optional visual assets.

Increment 1 does **not** complete all of #73, #74 or #77: in-browser mobile/e2e testing and a deeper trend comparison remain necessary.

## Visual Arcade pilot (new game genres)
- **#84:** Playable cube rotation (CSS 3D), image detective (SVG hotspots), and isometric pathfinding: implemented on `feat/mindforge-visual-arcade-pilot` for review.
- **#85:** Visual asset library, illustration polishing, full accessibility and age-specific tuning: backlog.
- **#86:** Explore performance-tested WebGL/Three.js scenes with accessible 2D fallback: research backlog.
- **Pilot testing:** desktop Chromium 1280px and mobile emulation 390px via in-memory HTML, plus all three game flows; production deployment and Safari/Android still pending.
- **Navigation:** the Visual Arcade sits under `/mindforge/arcade/`, linked from MindForge Dashboard and Practice, with independent local high scores.

## Visual Arcade V2.2 — difficulty and interaction (#88)
- **Beginner** (4 rounds): three-choice cube, one scene change, solvable 3×3 maze.
- **Normal** (6 rounds): four-choice cube, one scene change, solvable 4×4 maze.
- **Advanced** (8 rounds): cube spatial orientation determined by a front/top pair, two image differences, solvable 5×5 maze with two crystals and route-efficiency evaluation.
- **UX:** visible mode selector; clearer game cards, progress and results; corrected overlapping illustration targets and added explicit keyboard/touch object choices.
- **Data:** locally stored scores keyed by profile + difficulty + game. Existing `mindforge-arcade-scores-v1` data remains readable for normal mode.
- **Verification:** Chromium 320px, 390px, 1280px: 54 playable rounds per viewport, 900 randomized advanced spatial-orientation samples overall; no JS errors or horizontal overflow. Live Pages, iOS Safari, Android physical-device validation remain open.
- **Release gate:** #88 stays open until live Pages verification and UX feedback are collected.

## Visual Arcade V2.3 — Graphic overhaul (#90)
- Original vector cover illustrations and more legible 3D cube/maze game pieces replace emoji-heavy artwork.
- Picture Detective scenes are repainted using layered SVG while preserving 6 changeable object categories and hotspot positions.
- Responsive design tested at 320 / 390 / 768 / 1280; Advanced maze is no longer clipped.
- Accessibility: reduced-motion styles, focus states, text labels retained; on-device Safari/Android still require release QA.
- No remote assets, font downloads, analytics or added runtime dependency.
- [PR](https://github.com/buianhtai/buianhtai.github.io/pulls?q=is%3Apr+mindforge+graphics) to review; issue #90 remains open until post-deploy QA.
