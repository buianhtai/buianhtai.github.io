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

## V3.0 — Professional Game Library UI/UX redesign — #109
- Designed the existing 13-game `/mindforge/games/` screen with an editorial layout, light default theme and locally persisted dark-mode switch.
- Rebalanced desktop two-panel hero, illustrated featured Traffic Escape link, professionally styled game cards and a compact touch-first mobile collection. Preserved search, 6 skill chips, collapsed age/difficulty/play time, Show More, EN/VI, surprise link and all 13 direct launch links.
- System-font typography and custom inline SVG art; no new network libraries or tracking. Touch targets approximately 42–51px with keyboard focus visibility and reduced-motion styling.
- Chromium Playwright: 320/390/768/1280px across light/dark and EN/VI; search, filtering, 13 distinct launch routes, Show More, empty state and theme switching all passed; viewport checks also at 280/360/414/600/1024px, no horizontal overflow or JavaScript errors.
- Bumped offline cache version to force the refreshed UI. Screenshots at 320/390/1280 reviewed.
- **Pending** actual hosted GitHub Pages verification, iOS/Android device and assistive-technology audit. Keep [#109](https://github.com/buianhtai/buianhtai.github.io/issues/109) open until those checks are complete.

## V3.1 — Shared professional gameplay UI (#111)
- Reusable zero-dependency `arcade/experience.css` and `experience.js` applied to **Sudoku Garden, Traffic Escape, Three.js Lab (Cube/Tower/Maze), and the original Visual Arcade**.
- Consistent MindForge masthead, shared all-games navigation, theme controls tied to the library's `mf-library-theme`, VI/EN localized labels, and keyboard-visible focus treatment.
- Calm light/dark editorial chrome with intentionally contrasting dark game surfaces: numerical Sudoku board, Traffic vehicles, WebGL viewport, and illustrated Arcade puzzles keep existing high-contrast rendering and state handling. Less hero overhead before starting a game on phones.
- Does not alter puzzle generation, scoring, session history, WebGL loading, opt-in audio or difficulty logic. No extra network libraries or image assets.
- Local Chromium smoke tests with embedded shared assets: 320/390/768/1280px, both themes across Sudoku, Traffic, 3D Lab and Arcade, no detected page errors / horizontal overflow; manual interaction checks (Sudoku number entry, Traffic selection, Arcade play/back and language, 3D Lab language) passed.
- `sw.js` precaches both new shared assets; cache version incremented.
- Still pending: public GitHub Pages route/service-worker tests and physical iOS/Android, WebGL and accessibility audit. [#111](https://github.com/buianhtai/buianhtai.github.io/issues/111) stays open.

## V3.2 — Memory Garden image recall + professional app themes — #113
- Adds `memory-images.js`: 18 original inline-SVG illustration cards with localized labels; memory challenges now include **which objects**, **where**, and **in what order** plus the existing glowing tiles.
- Tiles/Pictures/Mixed selector persists in localStorage. Mixed cycles tiles and illustrated puzzles; age- and level-aware preview times, candidates and puzzle length. Correctness checks operate on IDs, not on visual labels.
- Root dashboard theme aligned to the professional Game Library (clean light surfaces, high-contrast navy/violet gameplay, responsive mobile cards), shared dark/light preference with all game shells via existing `mf-library-theme` key. No account or network assets required.
- Existing shared Arcade/Sudoku/Traffic/3D theme navigation kept intact; fixed repeated DOM updates in theme controls.
- Game Library Memory Garden description updated. PWA version and precache updated for both new assets.
- QA: independently validated 3,000 puzzles across five age groups and six difficulty levels using original design prototype; all three picture challenge styles and original tiles passed Chromium playthroughs at 280/320/390/768/1280px. Professional root appearance smoke tests in light/dark passed at same widths, no overflow or JS exceptions. Deployed code uses a compact SVG implementation and still requires hosted-origin/physical-device QA.
- Pending GitHub Pages and real iOS Safari/Android testing, screen reader interaction, and offline service-worker acceptance. Track [#113](https://github.com/buianhtai/buianhtai.github.io/issues/113).

## V3.3 — Theme visibility + Math Quest (#115)
- Main app and new Math Quest share `mf-library-theme` Light/Dark preference. Existing library and Arcade pages also use this same key; main header and library theme controls now show their current label rather than icon only. Existing profile state and player progress preserved.
- New game `/mindforge/arcade/math/` offers arithmetic, missing number and illustrated mini-market scenarios, with Beginner (5 rounds), Normal (7), and Advanced (9); mixed or dedicated puzzle type, localized VI/EN, keypad/keyboard answer, 2 attempts, strategy hints and progress/best streak saved on device.
- Math Quest is the **14th game** in the main game library and linked on the Visual Arcade landing page. Offline service worker cache updated.
- Chromium Playwright tested at 280,320,390,768,1280px, including 4,500 random arithmetic examples (3 difficulties × 3 modes × 100 × 5 viewports), and user interaction including incorrect then correct, keyboard Enter, language and theme switch; zero browser JS errors and page overflow.
- **Pending:** physical iOS/Android, public Pages deployment confirmation, and real-device cross-route theme consistency. Keep #115 open until these are verified.

## V3.4 — Math Quest presentation-style Auto Next (#117)
- Math Quest adds a 5–9-step question deck indicator and gentle incoming-question transitions.
- After a correct answer, **Auto Next is enabled by default**, displays feedback for 2.2 seconds and then advances. In reduced-motion environments auto-next defaults off; optional toggle (stored as `mf-math-auto-next-v1`) is always available.
- After first wrong answer stay for retry. After second wrong answer, display the explanation/solution and require manual Next. Players can press Next immediately or swipe left after feedback; unanswered questions never auto-advance.
- Cancellation prevents duplicate nexts when manually advancing, restarting or changing modes. Existing scoring, questions and state persistence unchanged; no new runtime assets.
- QA: Chromium 280,320,390,768,1280px validated correct auto, wrong freeze, manual next, preference restoration, swipe-next, reduced-motion default, and no console errors or horizontal overflow.
- [Issue #117](https://github.com/buianhtai/buianhtai.github.io/issues/117) kept open for live Pages and physical-device testing.

## Math Learning V1 — phased Learn / Practice / Review plan (2026-10-20)
- [Implementation plan and dependency graph](MATH_LEARNING_V1_PLAN.md) · [Epic #119](https://github.com/buianhtai/buianhtai.github.io/issues/119).
- **Wave 0:** [#120 workflow/test gates](https://github.com/buianhtai/buianhtai.github.io/issues/120), [#121 curriculum contract](https://github.com/buianhtai/buianhtai.github.io/issues/121), [#122 seeded QA](https://github.com/buianhtai/buianhtai.github.io/issues/122).
- **Wave 1:** [#123 SVG manipulatives](https://github.com/buianhtai/buianhtai.github.io/issues/123), [#124 Learn guided lessons](https://github.com/buianhtai/buianhtai.github.io/issues/124).
- **Wave 2:** [#125 topic practice](https://github.com/buianhtai/buianhtai.github.io/issues/125), [#126 mistakes and descriptive progress](https://github.com/buianhtai/buianhtai.github.io/issues/126).
- **Wave 3:** [#127 integrated mobile E2E release QA](https://github.com/buianhtai/buianhtai.github.io/issues/127).
- **Workflow reference:** [super-board](https://github.com/EricTechPro/super-board) for GitHub Project dependency-aware Build → QA → Review. Currently issues/docs only: super-board not installed, GitHub Project board not yet set up and no unattended merges enabled.
- **Scope:** early counting 1–10, quantity comparison ≤10 and number bonds to 10; leave existing Math Quest generators/scores unchanged. Expand content only after functional pilot.

## Math Learning Wave 1 — Guided visual Learn MVP (#124)
- New [interactive Learn with pictures page](https://buianhtai.github.io/mindforge/arcade/math/learn/) with three original VI/EN topics from the existing content contract: Count to 10, Compare groups, and Make 10.
- Each topic includes three short guided lessons with **Watch → Try → Explain**, interactive ten-frame / paired-object controls, answer checking, strategy hints and explanations.
- Lesson completion and currently selected lesson stored independently under `mf-math-learn-v1`, preserving existing `mf-math-quest-v1` game results and shared `mf-library-theme` preference. No accounts or telemetry.
- Math Quest has a visible direct learning link. The existing game modes remain unchanged; PWA cache includes visual lessons and their static dependencies.
- Node fixtures and math tests added to CI; desktop/mobile and real iOS/Android screen checks remain a post-merge QA requirement.
- Work tracked in [#124](https://github.com/buianhtai/buianhtai.github.io/issues/124); new topic Practice and Review in #125/#126 follow separately.
