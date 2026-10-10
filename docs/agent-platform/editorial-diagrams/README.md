# Editorial enterprise architecture diagrams

These two views are **designed for readability first**. They supplement the native EventCatalog resource graph and the technical C4/Mermaid diagrams rather than replacing them.

- **L0 Executive:** five concepts only — input, frontend experience, backend control, durable execution, approved integrations. It intentionally omits deployment vendors and per-service detail.
- **L2 Containers:** visually distinct frontend, backend control-plane, worker execution, integration policy, protected data and external-system boundaries. Individual named services are placed in their logical region.

Both use consistent vector typography, generous spacing, a restrained palette, orthogonal connectors, clear trust-boundary rectangles and explanatory notes. The diagram's **single layout source is JSON** in this directory. The versioned script `scripts/build-editorial-diagrams.mjs` deterministically exports both scalable SVG and editable diagrams.net `.drawio` files.

### Locally regenerate

```bash
node scripts/build-editorial-diagrams.mjs
```

Outputs (after the normal site build creates `dist/`):

| Diagram | Vector preview | Editable diagrams.net source |
| --- | --- | --- |
| L0 | `dist/architecture/showcase/editorial-executive.svg` | `dist/architecture/showcase/editorial-executive.drawio` |
| L2 | `dist/architecture/showcase/editorial-containers.svg` | `dist/architecture/showcase/editorial-containers.drawio` |

You can open the `.drawio` export with <https://app.diagrams.net/> for freeform editing, but **save intentional structural edits back in the versioned JSON design source** to avoid generated exports being overwritten during the next deployment. The draw.io file is editable as an export, not automatically bidirectionally synchronized. A diagrams.net edit can be retained as a standalone .drawio artifact when further pixel-perfect hand-tuning is necessary.

### Validation

PR and deploy CI check that both SVG and diagrams.net exports are parseable XML, enforce the key L2 regions, and verify static routes and real browser image loading. Existing native EventCatalog and Archify views continue to have independent validation.

### Design rules

1. One diagram should answer one question; avoid placing a full service graph on the L0 page.
2. Use consistent colors for the same zones across levels (blue FE, violet control, teal worker, amber policy integration, slate external/persistence).
3. Distinguish the application trust boundary from external providers and workers from backend HTTP handling.
4. Indicate that all services and deployment arrangements are **proposed logical design**, never documented as implemented without code/test evidence.
5. Maintain links to native EventCatalog services, flow contracts and ADRs, which remain the **source of truth**.
