# Math Learning V1 — interactive SVG toolkit

Implementation: `public/mindforge/arcade/math/learning/manipulatives.mjs`, `manipulatives.css`.  
Component preview: `/mindforge/arcade/math/lab/` (not added to the game library until lesson UI is ready).  
Related work: [#123](https://github.com/buianhtai/buianhtai.github.io/issues/123), [#124](https://github.com/buianhtai/buianhtai.github.io/issues/124).

## Supported educational interactions

- `renderTenFrame(count,opts)`: pure original inline SVG showing a 5×2 ten-frame of 0–10 object counters. Options: `mode: 'count'|'build'`, selection indices, EN/VI, token shape, color palette.
- `mountTenFrame(host,opts)`: interactive object counting or fill missing spaces up to ten; tap/click and Enter/Space supported; emits `{count,total,selected,complete}`. The original counters are locked in build mode.
- `renderCompare(left,right,opts)` and `mountCompare(host,opts)`: paired object comparison for more/fewer/equal, emits pair index list and remaining objects.
- `renderNumberLine(opts)` and `mountNumberLine(host,opts)`: scrollable 0–10 number strip with minimum 50px touch controls and focus state.

Renderers are independent from Math Quest scoring and user history, so they can be imported into Learn and Practice without changing saved session formats. Text labels are fixed localized content and counts validated before rendering. No remote assets, CSS framework or LLM calls.

## Accessibility and geometry

The ten-frame has SVG viewBox `520×220`, five columns of 96-unit touch cells. When displayed at 260px wide (a narrow phone), each hit cell is about 48px; the two comparison frames **stack vertically on small screens** instead of shrinking side-by-side. `tabindex`, button roles, pressed/disabled semantics and focus outlines support keyboard access. Reduced-motion disables transitions.

## Tests

```sh
node --check public/mindforge/arcade/math/learning/manipulatives.mjs
node --test tests/mindforge/math-manipulatives.test.mjs
```

Unit checks cover 0–10 counter geometry, valid focusable targets, selected state, invalid input, number-line buttons and simulated delegated click / keyboard updates. Use the preview for hands-on inspection.

## Follow-ups / limitations

- **Not a finished student Learn screen.** The standalone lab route is an isolated component demonstration; issue #124 integrates lesson steps, explanations and learning progress.
- Does not implement drag and drop yet; tap and keyboard are the supported interactions. Only add drag after mobile testing confirms a measurable usability benefit.
- Live GitHub Pages WebKit/iOS Safari, Android screen readers, actual touch accuracy and dark-mode contrast remain unverified until deploy and physical-device QA.
