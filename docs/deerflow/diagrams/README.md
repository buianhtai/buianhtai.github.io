# DeerFlow architecture drawings

This folder stores the **single semantic scene definition** for three DeerFlow diagrams:

- deerflow-containers.json — system/application/harness/execution boundaries
- deerflow-tool-boundary.json — tool schema discovery vs execution authorization
- deerflow-platform.json — proposed configurable agent platform, not a DeerFlow deployment claim

The shared build step runs:

    npm run diagrams:deerflow

It generates three outputs per scene under public/diagrams/deerflow/:

- .d2 — human-readable D2 diagram definition (generated)
- .svg — high-quality static asset rendered by the pinned D2 CLI
- .drawio — native diagrams.net XML with selectable, editable shapes and connectors

**Edit the JSON scene and rerun the generator.** Changes made in diagrams.net are useful for exploration and hand-off, but are not automatically synced back into JSON. Similarly, do not edit the generated .d2 file and expect it to survive the next build.

Presentation uses the existing Astro src/components/mdx/DiagramEmbed.astro component in its opt-in svg mode. Existing interactive iframe/Archify diagrams still use the legacy src mode without changes.

Why keep Mermaid for five diagrams? Sequence diagrams and bounded model/tool loops are more naturally represented as executable-looking flows; D2 is used where container boundaries, systems and adapters need a visual hierarchy. All eight diagrams live inside the same article and share Astro-based framing.

Review checkpoints: desktop and 390px mobile, dark/light themes, no page overflow, D2 SVG loading, source/diagram downloads and diagrams.net import. `npm run build` validates the conversion on CI because the deployment already pins D2 v0.9.0.
