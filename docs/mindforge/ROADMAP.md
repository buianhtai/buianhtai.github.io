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

## Spatial 3D Lab MVP — Three.js (#92, #86)
- Three real WebGL mini-games, at `/mindforge/arcade/3d/`: **Cube Orbit** (opposite/right face orientation), **Tower Architect** (blueprint reconstruction), **Maze Rover** (obstacle route + crystal collection).
- Levels: Beginner 4, Normal 6, Advanced 8. Mouse/touch orbit, keyboard D-pad and +/- alternative controls, bilingual, reduced motion, local progress.
- Pinned Three.js ESM `0.186.1` loads lazily from jsDelivr; the lightweight Arcade is separate. Network access is required for the 3D engine (offline fallback link instead of broken canvas).
- Test evidence: 1,500 randomly generated puzzles, geometry orientation and maze connectivity verified; responsive landing UI and fallback checked in Chromium at 320/390/768/1280. Actual WebGL rendering and physical devices must still be validated on the hosted site.
- Follow-up #86: evaluate mid-range mobile FPS/GPU memory, full nonvisual controls and CDN/self-hosting strategy before classing this production ready.
- No claim that these games raise measured IQ.

## Gameplay-first UX refinement (V2.4) — #94
- Policy: 2D is standard for observation/memory/focus and visual logic. Three.js reserved for truly spatial challenges (cube inspection, 3D building); 3D maze is optional alongside default 2D pathfinding.
- Compact the Spatial Lab landing for 320–390px screens with direct game controls and clear micro-instructions.
- Hide home selection while playing; show an accessible objective above the 3D viewport on mobile.
- Offer a prominent 2D Arcade alternative. Three.js loads only when a 3D world is launched; continue graceful no-WebGL fallback.
- Add Undo for Tower and Maze: restores cells / robot position / gems / move count; disable after completion.
- Avoid stale WebGL launch if user exits while a module is loading; preserve bilingual and reduced-motion settings.
- QA: 1,500 randomized puzzle tests, 4 responsive viewports, and Undo state restoration verified in Chromium. Real-WebGL and real-device Safari/Android testing pending.

## V2.5 — Optional sound effects (#96)
- Earshot-inspired named sound roles, original browser Web Audio implementation only (no Earshot Python runtime or recorded samples).
- Audio roles: select, tap, step, move, place, undo, collect, correct, wrong and level complete. Works in Visual Arcade and 3D Lab.
- Sound off by default, opt-in, volume and mute persistent across games, controls in EN/VI; no autoplay, microphone, tracking, or external audio assets.
- Tested mocked-AudioContext sound trigger/UI and no overflow in Chromium at 320, 390, 768 and 1280 px; physical iOS/Android and live Pages deployment QA remain open.

## V2.5 Picture Worlds, Mobile First (#98)
- Six distinct, procedurally selected SVG environments: Mountain Valley, Tropical Coast, Colorful City, Autumn Forest, Snowy Mountains, Desert Canyon.
- Scenery and changed objects vary between consecutive rounds; two images in one round use the same environment for a fair comparison.
- On phones, before/after tabs display one large image. On tablets/desktop, two images remain visible side by side.
- Six labeled touch choices remain accessible under the image, minimum 48px height. Score rules (Beginner/Normal/Advanced), sound toggle, motion toggle, and offline score history remain unchanged.
- QA: Chromium 320/390/768/1280px x 6 rounds; advanced x 8 rounds, no JS exceptions or page overflow; JS syntax check.
- Continue issue #98 for post-deploy real-device iOS/Android/browser QA and future randomized object packs with varied positions.

## V2.6 Phone-first controls and randomized layouts — #100, #101
**Shipped on feature branch:** `feat/mindforge-v26-touch-random-puzzles`

### Touch UX
- 3D Cube: large arrow/orbit controls directly under canvas, reset camera, and keyboard alternatives.
- 3D Tower: tap blueprint cells, or use Previous/Next cell, +/− block, Undo without scrolling to precise 3D meshes.
- 3D Maze: direct movement + Undo bar immediately under canvas; 2D Maze also supports board swipes.
- Larger buttons and no accidental page gesture takeover outside the game interaction area.

### Content variety
- Picture Detective: +Bird and +Flower objects (8 categories total), adjustable per-round object offsets with synchronized hitboxes, six existing background worlds.
- Tower: staircase, pyramid, checker, ridge and skyline blueprints; variants rotate and mirror.
- Maze: one of four opposite-corner start/goal pairs, random obstacles/gems with solvability guarantee.

### Verification
- Chromium UI at 320, 390, 768, 1280px: 24 complete picture rounds, 8 additional Advanced rounds, no JS errors / horizontal overflow.
- 150 generated Towers and Mazes for each of 3 difficulties × 4 viewports: **1,800 each**, all structurally valid and all mazes solvable.
- Mobile control buttons exercised and 2D maze swipe verified in Chromium.
- Actual WebGL rendering, real iOS Safari and Android touch testing **pending after merge**.
- Existing score format / local storage and audio opt-in preserved, no additional runtime assets.

## Sudoku Garden — 2D number puzzle (#103, new Arcade game)
- New standalone route: `/mindforge/arcade/sudoku/`, linked from the Arcade landing page.
- Three difficulties: Beginner 4×4, Normal 6×6, Advanced 9×9; different Sudoku box shapes.
- Randomly generated **single-solution** puzzles validated by bitmask MRV solver during clue removal (100 samples per mode passed uniqueness/row/column/box correctness tests).
- Phone-first touch numpad with 2-row 9-number layout at narrow widths, selectable cells, optional large/scrollable board, keyboard navigation, note pencil, undo, erase, 3 hints, pause.
- EN/VI, local resume and best scores, no time pressure, reused opt-in sound kit; no external puzzle data.
- Chromium responsive/interactions at 320, 390, 768, 1280px; full Beginner solve UI and save/resume tested in sandbox with a storage shim.
- Production GitHub Pages delivery and physical-device iOS Safari/Android QA pending; keep issue #103 open until verified.

## V2.8 — Traffic Escape (sliding-vehicle logic game) — #105
- Adds phone-first 2D `/mindforge/arcade/traffic/` with 45 independently solved puzzles, 14 beginner, 18 normal, 13 advanced.
- Difficulty based on verified minimum number of sliding moves: 2–3 / 4–6 / 7–11.
- Drag or tap a car and use large direction buttons; Undo, Reset, context-sensitive shortest-path Hint, bilingual EN/VI, reduced motion, device-local progress, per-level best moves.
- Existing opt-in MindForge Sound Kit is reused without new dependencies, no Three.js required.
- Linked on Arcade landing page. Service worker precaches Traffic Escape assets.
- QA: independent BFS verification of **all 45 levels**, and full browser drag playthroughs at **320/390/768/1280** px across each difficulty (12 wins), plus hint, undo, and language switching checks. No JS errors or horizontal overflow.
- Acceptance pending: real GitHub Pages build and physical Safari/Android touch validation; hosted persistence reload cannot be simulated by navigation in this testing environment.
- [Track issue #105](https://github.com/buianhtai/buianhtai.github.io/issues/105).

## V2.9 — Unified MindForge Game Library — #107
- New bilingual VI/EN, mobile-first `/mindforge/games/` catalogue covering all 13 existing playable games: 5 classic exercises, 3 Visual Arcade, 3 Spatial Lab, Sudoku, and Traffic Escape.
- Primary discovery controls: search and skill chips; secondary collapsible filters: age guidance (4–6/7–12/13–17/adults/60+), difficulty and approximate session duration; 6-card progressive disclosure on first visit.
- Original vector SVG game illustrations without remote asset dependencies. Each entry launches its specific game directly through safe, allowlisted URL parameters for the classic, Arcade, and 3D worlds; Sudoku and Traffic retain their direct routes.
- Existing MindForge family dashboard and practice remain unchanged except for a library entry; Arcade header links to library. WebGL only loads when a 3D game is opened.
- No account required to browse; existing profiles/scores/settings remain in existing per-game stores. Informal recommended age/time only, **not** official ratings or measured times.
- Chromium Playwright tests at 320/390/768/1280 px: 13 game links, skill/age/difficulty/time filters, bilingual switch, search (empty/results), show more, viewport overflow and no page JS errors.
- QA remaining: public Pages workflow/live URL, physical iOS Safari/Android, real WebGL and cached routes, screen readers and actual navigation to direct links.
- [Issue #107](https://github.com/buianhtai/buianhtai.github.io/issues/107) remains open until post-deploy QA.
