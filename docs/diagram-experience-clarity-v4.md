# Clarity-first architecture visualization (review proposal)

## Problem found in the merged DeepSeek Harness explorer

Passing interaction tests is not evidence that a technical diagram is understandable.

The source explorer in #66 places a code preview, selected-component inspector,
editorial zones, dependency lines, minimap, and navigation sidebars in the same
viewport. Its four modes mostly reuse the same graph. At small widths, Fit can
reduce labels until they are unreadable; on desktop, details are hidden by panels.
The execution mode is particularly misleading because lexical imports are not
runtime messages.

## Four modes answer four different questions

| Reader question | Diagram | Explicit non-claim |
| --- | --- | --- |
| What is in the system? | Editorial area map, with six recognizable subsystems and concise roles | Not deployment topology |
| What depends on this? | One-hop centered dependency explorer, incoming/outgoing separate, clickable source evidence | Not a runtime call graph |
| What happens in an agent turn? | Six numbered, directionally connected editorial stages, one large explanation/evidence panel at a time | Not a measured trace or network sequence |
| Where is it implemented? | Seven-file navigator with wide, line-numbered pinned source excerpt | A snippet, not full source or inferred call chain |

The four modes intentionally **do not** share a spiderweb diagram.

## Visual design acceptance checklist

1. At 1440px, the System page must communicate all three areas and six subsystems
   without needing to pan, zoom, or open the inspector.
2. Every visible arrow has exactly one unambiguous semantic. Dependencies come
   from manifest imports; numbered execution stages are editorial.
3. A new reader can distinguish inbound ("used by") from outbound ("uses")
   without relying on color alone.
4. Request journey has visible direction on desktop and mobile, with readable
   stage labels and meaningful source anchors.
5. Source snippets use no horizontal **page** scrolling and no tiny auto-fit text;
   the code pane itself may scroll horizontally.
6. At 390px, navigation moves in a single reading direction and there is
   no graph clipping or inspector overlay hiding primary content.
7. No assumption of concrete HTTP/SSE protocol hops, persistence writes,
   class-level calls, or live timings without verified code or execution evidence.
8. The prototype is reviewed visually in light/dark at 390/768/1440 before any
   decision to replace the current explorer.

## Architecture and source integrity

The prototype consumes the same pinned DeepSeek Harness JSON model from #64,
and the same seven pinned source excerpts from #66. Model-derived edges remain
untouched. The editorial zones and six-stage walkthrough are independently
labeled so that no diagram falsely presents them as observed runtime topology.

## After design acceptance

Replace /en/labs/deepseek-harness/ with the agreed clarity-first interface,
preserve deep links and the existing evidence model, then adapt reusable view
contracts for Agno and DeerFlow. Symbol-level call graphs, syntax highlighting,
semantically routed protocol flows, production traces, and automated model
regeneration are later research/implementation tasks, not accomplished here.


## V5 review: React Flow-style canvas (Astro-native implementation)

The review route at \`/en/labs/deepseek-harness-clarity/\` now uses
\`DiagramOnlyExplorer.astro\`, a lightweight DOM/SVG flow canvas. It borrows
the important **interaction patterns** from React Flow without introducing
React or \`@xyflow/react\` into this Astro-only site. It is **not** a React
Flow dependency and should not be described as one.

- Source-backed **nested boundaries**: system areas, runtime contract/tool/state
  areas, and agent-loop source-file areas. Zones are conceptual groupings, not
  processes, container deployments, or source-derived import edges.
- **Select a node** for role, related components, evidence and pinned code excerpts.
  **Expand** renders a one-hop USED BY → FOCUS → USES graph. **Explore inside**
  dives into packages and source files, with history/back.
- Optional **Dependency overlay** adds directional source-derived edges.
  Edge click reveals provenance and both endpoints; hover emphasizes the edge.
  Edge routing chooses left, right, up or down based on geometry.
- **Agent turn flow** has six source-linked nodes inside three conceptual
  phase boundaries (Input & Admission; Model & Stream; Tools & Continuation).
  Desktop shows a full connected six-node story; tablet uses two columns;
  phones use a single vertical progression. **Previous/Next** stages and
  node-click provide contextual narrative and source evidence.
- A clickable **minimap**, pan, zoom/fit/focus, fullscreen, mobile bottom
  detail sheet and dark/light surfaces support exploration.
- **Edge semantics are separated**: dashed strokes = pinned package/source
  dependency; solid arrows = *editorially curated* reading order. Neither is
  evidence of a distributed HTTP/SSE request or a measured trace.

For a production-grade graph canvas, later investigate adopting an actual
graph library with automatic nested layout, edge avoidance and drag/keyboard
interaction. Do not imply that React Flow, runtime tracing or code-symbol
call graph extraction is implemented here.

### Required user acceptance

Readers should (1) name the major subsystem boundaries at first glance,
(2) inspect a component without leaving the drawing, (3) expand exactly its
source-supported direct relationships, (4) follow six stages as one **visible
directed flow**, and (5) drill from runtime to source excerpt without switching
to a separate code-heavy layout. Mobile must preserve legibility, never fit
the full model by reducing all text to an unreadable scale.
