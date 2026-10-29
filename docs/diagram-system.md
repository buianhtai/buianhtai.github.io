# Diagram component standard

## Shared reading experience

`src/components/mdx/DiagramFrame.astro` owns the heading, category label, caption,
zoom controls, scrollable viewport and modal diagram-only view. Its colors use
the site's existing theme variables. The eight native renderers retain their
current props and diagram layouts, so existing MDX does not require migration.

Preview all eight at `/en/labs/diagram-system/` (excluded from search indexing via
the page's noindex metadata). Use this page for visual and interaction review.

| Renderer | Use it for |
| --- | --- |
| ArchDiagram | Components and dependencies |
| Flowchart | Decisions and branch conditions |
| SequenceDiagram | Time-ordered messages |
| ERDiagram | Entities and cardinality |
| StateMachine | States and valid transitions |
| Swimlane | Workflow responsibilities |
| MindMap | Concept categories |
| NetworkMap | Positioned network topology |

## Behavior contract

- Render the diagram and caption without JavaScript. Hide inactive controls.
- Keep zoom state independent for every instance; clamp to 50–300%.
- Reset returns to 100% and the top-left scroll position.
- Expand moves the existing diagram into a native modal dialog. It must retain
  its state, trap keyboard focus, close with Escape, and restore the trigger's focus.
- Preserve normal touch scrolling; do not capture page wheel or pinch gestures.
- Controls have at least 44px targets and visible keyboard focus.
- The frame follows theme variables; renderer-specific semantic colors remain
  a separate visual-review concern.
- Print without controls or viewport clipping.

## Review before merge

At 390px, 768px and 1440px, check each gallery instance in light and dark mode.
Verify zoom changes rendered size, neighboring instances remain unchanged,
content can be reached by scrolling, modal close/Escape restore focus, and no
diagram causes horizontal page overflow. Check an existing post with multiple
diagrams as well as the gallery. Run the full build and Lighthouse workflow.

## Remaining migration

Mermaid and DiagramEmbed retain their specialized rendering/loading controls.
The Agno and DeerFlow explorers retain their playback and inspection interfaces.
Migrate these through adapters after the shared native frame passes browser QA;
avoid wrapping an existing toolbar in a second toolbar. Unify semantic colors,
legends and SVG marker isolation separately from renderer replacement.
