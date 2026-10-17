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
