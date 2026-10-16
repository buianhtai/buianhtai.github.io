# DeepSeek Harness architecture pilot

Route: `/en/labs/deepseek-harness/`.

The shared `ArchitectureExplorer.astro` consumes a JSON model of views, nodes,
relationships, source evidence and an optional guided journey. The pilot maps
DeepSeek Harness at commit `1517a4dbca0a2789ff1d41ba439600f8547d23fa`.

## Reader tasks

- Start with the system map, select Agent runtime, and Explore inside.
- Select agent-loop and Explore inside again to inspect seven implementation files.
- Select a component to highlight direct dependencies and inspect incoming/outgoing evidence.
- Search across levels; Back restores the previous selection, zoom and scroll.
- Follow one agent turn through six curated steps, each linked to source.
- Expand into a modal view or hide side panels with Diagram only. Escape closes the modal.
- Share the current URL to restore its view and selection.

## Diagram-first visual language

The page supplies editorial zones for the system, Agent runtime and agent-loop
views. These bounded panels are **conceptual groupings, not deployment boundaries
or execution sequence**. Evidence stays in the generated JSON graph.

Selecting a component highlights its conceptual zone and distinguishes declared
outgoing dependencies from incoming references (solid versus dashed). Unrelated
relations are faint, reducing the visual noise of mutually dependent packages.
The inspector shows direction counts and commit-pinned source references.

The six-step, source-linked turn walkthrough now appears before the diagram and
provides a directly selectable horizontal stage rail. This is a curated
explanation of the code, not a captured execution trace. On mobile, use native
canvas scrolling to explore the bounded map.

## Evidence and limits

Subsystem boundaries are editorial. Package relationships are extracted from
runtime and peer dependency declarations for 26 selected packages. The seven-file
loop graph extracts relative `from` imports, including type-only imports. Neither
is a runtime call graph. The walkthrough is a curated reading of the driver and
upstream lifecycle documentation, not a recorded execution trace. Omitted packages
and dynamic Cordis event wiring are outside this pilot. Source URLs are pinned;
no model call or upstream code execution occurs while viewing the map.

The MIT-licensed upstream repository supplies package descriptions and evidence.
Regenerate from an inspected local checkout:

```sh
python3 scripts/build-harness-map.py /path/to/deepseek-harness
```

Review changed evidence and walkthrough line anchors on every revision update.
The dedicated Harness architecture explorer CI workflow checks the source model,
reader interactions, light/dark mode, mobile/tablet/desktop, and uploads screenshots.
