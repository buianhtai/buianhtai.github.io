# MDX Component Library

This reference documents all current MDX visual components in `src/components/mdx/`.

### ArchLayer
**Pattern:** Horizontal architecture lane with a colored badge, layer label, and chip list.
**Props:**
```ts
interface Props {
  badge: string;
  badgeColor?: 'teal' | 'amber' | 'green' | 'rose';
  label: string;
  items: string[];
}
```
**Usage:**
```mdx
<ArchLayer
  badge="GW"
  badgeColor="green"
  label="Gateway"
  items={["TLS", "Policy Engine", "gRPC"]}
/>
```
**When to use:** Layered architecture breakdowns where each row represents one system tier.

### Callout
**Pattern:** Highlight box for key insight or warning with semantic color accent.
**Props:**
```ts
interface Props {
  color?: 'teal' | 'green' | 'amber' | 'rose';
}
```
**Usage:**
```mdx
<Callout color="amber">
  Kernel-level controls cannot be bypassed from userspace.
</Callout>
```
**When to use:** Important context that should stand out from normal paragraphs.

### Card
**Pattern:** Generic bordered container for grouped content, code blocks, or tables.
**Props:**
```ts
interface Props {
  accent?: 'teal' | 'green' | 'amber' | 'rose';
  flush?: boolean;
}
```
**Usage:**
```mdx
<Card accent="teal" flush={true}>
  <p>Grouped explanation content.</p>
</Card>
```
**When to use:** Any section that needs visual grouping without creating a custom component.

### DagGrid
**Pattern:** Wave-based DAG status map with node cards and status legend.
**Props:**
```ts
interface Props {
  nodes: Array<{
    name: string;
    id: string;
    status: 'ready' | 'progress' | 'blocked' | 'closed';
    wave: number;
  }>;
}
```
**Usage:**
```mdx
<DagGrid nodes={[
  { name: "Parser", id: "A1", status: "ready", wave: 1 },
  { name: "Executor", id: "B4", status: "progress", wave: 2 },
]} />
```
**When to use:** Multi-step dependency execution where readiness/blocked states matter.

### DataTable
**Pattern:** Styled data table with optional caption dot and accent color.
**Props:**
```ts
interface Props {
  headers: string[];
  rows: Array<Record<string, string>>;
  caption?: string;
  accent?: string;
}
```
**Usage:**
```mdx
<DataTable
  caption="Workspace Crates"
  accent="teal"
  headers={["Crate", "Purpose"]}
  rows={[
    { Crate: "openshell-core", Purpose: "Shared types" },
    { Crate: "openshell-server", Purpose: "Gateway" },
  ]}
/>
```
**When to use:** 3+ rows of structured comparisons with repeated columns.

### EnforceRule
**Pattern:** Policy enforcement matrix (method/action/allowed-denied).
**Props:**
```ts
interface Rule {
  action: string;
  method: string;
  allowed: boolean;
}

interface Props {
  rules: Rule[];
}
```
**Usage:**
```mdx
<EnforceRule rules={[
  { action: "List repos", method: "GET", allowed: true },
  { action: "Delete repo", method: "DELETE", allowed: false },
]} />
```
**When to use:** API policy narratives where allow/deny clarity is critical.

### FlowStep
**Pattern:** Numbered vertical step item with title and supporting description slot.
**Props:**
```ts
interface Props {
  step: string | number;
  color?: 'teal' | 'green' | 'amber' | 'rose';
  title: string;
}
```
**Usage:**
```mdx
<FlowStep step="1" color="teal" title="Request arrives">
  Gateway validates request and resolves route.
</FlowStep>
```
**When to use:** Linear flows where each step needs brief prose detail.

### HashDemo
**Pattern:** Side-by-side hash transformation comparison with visual verdict.
**Props:**
```ts
interface Props {
  agents: Array<{
    name: string;
    input: string;
    output: string;
    same: boolean;
  }>;
}
```
**Usage:**
```mdx
<HashDemo agents={[
  { name: "Agent A", input: "same content", output: "abc123", same: true },
  { name: "Agent B", input: "same content", output: "abc123", same: true },
]} />
```
**When to use:** Demonstrating deterministic hashing or collision/no-collision behavior.

### HeroGrid
**Pattern:** Top-of-post metric tiles for key stats/signals.
**Props:**
```ts
interface Props {
  items: { label: string; sublabel: string; color: string }[];
}
```
**Usage:**
```mdx
<HeroGrid items={[
  { label: "Sandboxed", sublabel: "Kernel isolation", color: "#0891b2" },
  { label: "Policy", sublabel: "Declarative YAML", color: "#059669" },
  { label: "Router", sublabel: "Credential stripping", color: "#d97706" },
  { label: "Portable", sublabel: "K3s-in-Docker", color: "#e11d48" },
]} />
```
**When to use:** Opening section to frame the post with 3-4 headline facts.

### Label
**Pattern:** Small inline section badge for numbered headings.
**Props:**
```ts
interface Props {
  color?: 'teal' | 'green' | 'amber' | 'rose';
}
```
**Usage:**
```mdx
## <Label color="teal">1</Label> WHY
```
**When to use:** Section headers requiring consistent visual indexing.

### Mermaid
**Pattern:** Interactive Mermaid diagram container with zoom/pan controls and optional caption.
**Props:**
```ts
interface Props {
  chart: string;
  caption?: string;
}
```
**Usage:**
```mdx
<Mermaid
  chart={`flowchart TD\nA-->B\nB-->C`}
  caption="End-to-end flow"
/>
```
**When to use:** Complex graph/sequence/system diagrams that are hard to express with static components.

### Pipeline
**Pattern:** Horizontal/vertical pipeline with nodes, directional arrows, and optional footer note.
**Props:**
```ts
interface Props {
  nodes: Array<{ title: string; subtitle: string }>;
  arrows: Array<{ label: string; direction: 'right' | 'left' }>;
  footer?: string;
}
```
**Usage:**
```mdx
<Pipeline
  nodes={[
    { title: "Agent", subtitle: "Calls API" },
    { title: "Router", subtitle: "Injects creds" },
    { title: "Provider", subtitle: "Returns output" },
  ]}
  arrows={[
    { label: "request", direction: "right" },
    { label: "response", direction: "left" },
  ]}
  footer="Agent never sees upstream keys."
/>
```
**When to use:** End-to-end request/response pipelines and data movement stories.

### PolicyStack
**Pattern:** Ordered policy layer stack showing kernel/userspace scope and controls.
**Props:**
```ts
interface Layer {
  name: string;
  scope: 'kernel' | 'userspace';
  controls: string;
  example: string;
}

interface Props {
  layers: Layer[];
}
```
**Usage:**
```mdx
<PolicyStack layers={[
  { name: "Landlock", scope: "kernel", controls: "Filesystem", example: "/usr ro" },
  { name: "OPA", scope: "userspace", controls: "Network", example: "GET allowed" },
]} />
```
**When to use:** Defense-in-depth or layered enforcement explanations.

### ProviderGrid
**Pattern:** Provider capability cards with env-var and status badge.
**Props:**
```ts
interface Provider {
  name: string;
  envVar: string;
  status: 'base' | 'community' | 'extensible';
}

interface Props {
  providers: Provider[];
}
```
**Usage:**
```mdx
<ProviderGrid providers={[
  { name: "OpenAI", envVar: "OPENAI_API_KEY", status: "base" },
  { name: "Ollama", envVar: "Local", status: "community" },
]} />
```
**When to use:** Capability matrix for provider ecosystems or plugin support.

### ControlLoop
**Pattern:** Sensor → Spec → Actuator cyclic feedback diagram with labeled directional edges. Rendered as an SVG triangle with curved arrows; degrades to a vertical list on mobile.
**Props:**
```ts
interface LoopNode {
  id: string;
  title: string;
  subtitle: string;
  color?: 'teal' | 'green' | 'amber' | 'rose';
}
interface LoopEdge {
  from: string;   // matches a node id
  to: string;
  label: string;
}
interface Props {
  nodes: LoopNode[];   // exactly 3 nodes recommended
  edges?: LoopEdge[];
  caption?: string;
}
```
**Usage:**
```mdx
<ControlLoop
  nodes={[
    { id: "sensor",   title: "Sensor",   subtitle: "sentrux scan", color: "teal"  },
    { id: "spec",     title: "Spec",     subtitle: "rules.toml",   color: "amber" },
    { id: "actuator", title: "Actuator", subtitle: "AI agent",     color: "green" },
  ]}
  edges={[
    { from: "sensor",   to: "actuator", label: "quality signal" },
    { from: "actuator", to: "sensor",   label: "code change → rescan" },
    { from: "spec",     to: "actuator", label: "constraints" },
  ]}
  caption="The architecture feedback loop."
/>
```
**When to use:** Cyclic feedback loops (control systems, observe-decide-act agent cycles, sensor-spec-actuator patterns). Not for linear pipelines — use `Pipeline` for those.

### ScoreGauge
**Pattern:** Multi-metric quality breakdown — each metric rendered as a labeled bar with an optional formula annotation, followed by a combined-score summary row.
**Props:**
```ts
interface Metric {
  label: string;
  formula?: string;      // e.g. "Newman Q (2004)"
  value: number;         // normalised [0, 1]
  color?: 'teal' | 'green' | 'amber' | 'rose';
}
interface Props {
  metrics: Metric[];
  combinedLabel?: string;   // default "Quality signal"
  combinedValue?: number;   // raw combined score (e.g. 7342)
  combinedMax?: number;     // default 10000
  title?: string;
}
```
**Usage:**
```mdx
<ScoreGauge
  title="Quality signal breakdown"
  metrics={[
    { label: "Modularity", formula: "Newman Q (2004)", value: 0.72, color: "teal"  },
    { label: "Acyclicity", formula: "1/(1+cycles)",    value: 1.00, color: "green" },
    { label: "Depth",      formula: "1/(1+d/8)",       value: 0.82, color: "teal"  },
    { label: "Equality",   formula: "1 − Gini",        value: 0.71, color: "amber" },
    { label: "Redundancy", formula: "1 − waste ratio", value: 0.88, color: "green" },
  ]}
  combinedLabel="Quality signal"
  combinedValue={7342}
  combinedMax={10000}
/>
```
**When to use:** Multi-dimensional scoring systems where each dimension has a named formula. Prefer over `MetricBar` when formula attribution matters. Use the combined-score row to show geometric/weighted aggregation.

### SessionGate
**Pattern:** Before/after session quality comparison with a pass/fail badge and delta indicator. Two side-by-side score panels with a bar, connected by an arrow showing the delta.
**Props:**
```ts
interface Panel {
  score: number;
  label: string;
  timestamp?: string;
}
interface Props {
  before: Panel;
  after: Panel;
  pass: boolean;
  bottleneck?: string;    // metric name shown in footer summary
  maxScore?: number;      // default 10000
}
```
**Usage:**
```mdx
<SessionGate
  before={{ score: 7342, label: "session_start()", timestamp: "baseline saved" }}
  after={{  score: 6891, label: "session_end()",   timestamp: "after 500 lines written" }}
  pass={false}
  bottleneck="modularity"
/>
```
**When to use:** Baseline → mutate → compare patterns: MCP session gates, CI quality regressions, before/after refactoring comparisons, A/B scoring. Pass renders green; fail renders red.

### LayerStack
**Pattern:** Vertical architecture layer stack with colored band, tag badge, title, and chip list per layer. Optional connector arrows between layers and a caption footer.
**Props:**
```ts
interface Layer {
  tag: string;          // short badge, e.g. "L3"
  color?: 'teal' | 'green' | 'amber' | 'rose';
  title: string;
  items: string[];
  note?: string;        // right-aligned dim annotation
}
interface Props {
  layers: Layer[];      // rendered top → bottom
  arrows?: string[];    // connector labels between layers (length = layers.length - 1)
  caption?: string;
}
```
**Usage:**
```mdx
<LayerStack
  layers={[
    { tag: "L3", color: "teal",  title: "MCP Tools", items: ["codebase_search", "codebase_impact"], note: "src/tools/" },
    { tag: "L2", color: "amber", title: "Services",  items: ["indexer", "embeddings", "lock"],       note: "src/services/" },
    { tag: "L1", color: "green", title: "Storage",   items: ["Qdrant: dense", "Qdrant: BM25"],       note: "Docker" },
  ]}
  arrows={["tool call → service dispatch", "service → persist / query"]}
  caption="Three-layer architecture. Tools call services; services own storage."
/>
```
**When to use:** Multi-tier architecture diagrams where each layer is visually distinct and stacked vertically. Different from `ArchLayer` (horizontal lanes, no inter-layer arrows). Use `LayerStack` when vertical stacking and flow direction between layers matters.

### CompareTable
**Pattern:** Feature comparison matrix with product columns and ✅ / — / partial cell values. One column can be highlighted as "your product".
**Props:**
```ts
interface Product {
  name: string;
  highlight?: boolean;  // renders with accent background
}
interface Feature {
  label: string;
  values: string[];     // one value per product column; use "yes", "no", or "partial"
}
interface Props {
  products: Product[];
  features: Feature[];
  caption?: string;
}
```
**Usage:**
```mdx
<CompareTable
  products={[
    { name: "Claude Code" },
    { name: "Cursor" },
    { name: "+ SocratiCode", highlight: true },
  ]}
  features={[
    { label: "Semantic search",    values: ["no", "yes", "yes"] },
    { label: "Hybrid search (RRF)", values: ["no", "no",  "yes"] },
    { label: "Call graph",         values: ["no", "no",  "yes"] },
  ]}
  caption="Built-in tools vs SocratiCode."
/>
```
**When to use:** Tool/product comparison matrices where the reader needs to see which features are present/absent at a glance. Use "yes", "no", or "partial" for values — rendered as ✅, —, and ◐ respectively. Prefer over `DataTable` when columns represent competing products.

### BenchmarkBar
**Pattern:** Paired before/after horizontal bars per metric, with reduction percentage badge and optional speedup badge. A totalRow renders with accent styling and heavier badges.
**Props:**
```ts
interface BenchmarkRow {
  label: string;
  baseline: number;
  optimized: number;
  reduction: string;    // display text, e.g. "61.5%"
  speedup?: string;     // optional, e.g. "37×"
}
interface Props {
  baselineLabel?: string;   // default "Before"
  optimizedLabel?: string;  // default "After"
  unit?: string;            // suffix in legend, e.g. "bytes"
  rows: BenchmarkRow[];
  totalRow?: BenchmarkRow;  // rendered below a divider with accent styling
  caption?: string;
}
```
**Usage:**
```mdx
<BenchmarkBar
  baselineLabel="grep"
  optimizedLabel="SocratiCode"
  unit="bytes"
  rows={[
    { label: "Workspace trust", baseline: 56383, optimized: 2068,  reduction: "96.3%", speedup: "37×" },
    { label: "Auth provider",   baseline: 36392, optimized: 16930, reduction: "53.5%", speedup: "31×" },
  ]}
  totalRow={{ label: "Total", baseline: 250510, optimized: 96485, reduction: "61.5%", speedup: "37.2×" }}
  caption="VS Code codebase (2.45M LOC). Claude Opus 4.6."
/>
```
**When to use:** Before/after performance comparisons where you want to show both raw values (as bars) and the improvement delta (as badges). Bar widths are scaled globally across all rows so relative magnitude is visible. Use `totalRow` for aggregate results. Prefer over `DataTable` when visual magnitude matters.

### PatternLifecycle
**Pattern:** Linear state-machine diagram showing ordered lifecycle stages with optional dashed decay/regression arrow back to an earlier state. No client-side JS.
**Props:**
```ts
interface Stage {
  id: string;
  label: string;
  sublabel?: string;
  color?: 'teal' | 'green' | 'amber' | 'rose';
}
interface DecayArrow {
  from: string;
  to: string;
  label?: string;
}
interface Props {
  stages: Stage[];
  decayArrow?: DecayArrow;
  caption?: string;
  label?: string;   // small dim label shown top-left
}
```
**Usage:**
```mdx
<PatternLifecycle
  stages={[
    { id: "candidate",   label: "Candidate",   sublabel: "1-2 successes", color: "amber" },
    { id: "established", label: "Established", sublabel: "3-9 successes", color: "teal"  },
    { id: "proven",      label: "Proven",      sublabel: "10+ successes", color: "green" },
  ]}
  decayArrow={{ from: "proven", to: "candidate", label: "90-day decay" }}
  caption="Pattern maturity states. Proven regresses to Candidate after 90 days without revalidation."
/>
```
**When to use:** Lifecycle progressions where an item moves through ordered states, especially when there is a decay/regression path back to an earlier state (learning systems, certificate expiry, pattern maturity). Works for any finite-state sequence (2–5 stages recommended). For non-sequential flows, use `Pipeline`. For cyclic control loops, use `ControlLoop`.

---

### Flowchart
**Pattern:** Decision-logic diagram with shape semantics: oval=start/end, rect=step, diamond=decision.
**Props:**
```ts
interface FCNode {
  id: string;
  label: string;
  shape?: 'rect' | 'oval' | 'diamond' | 'dot';
  color?: string;   // 'teal' | 'amber' | 'green' | 'rose' | 'violet'
  sub?: string;
  col?: number;     // explicit column (1-based)
  row?: number;     // explicit row (1-based)
}
interface FCEdge {
  from: string;
  to: string;
  label?: string;   // branch label (Yes / No / condition)
  type?: 'solid' | 'dashed';
}
interface Props {
  nodes: FCNode[];
  edges: FCEdge[];
  title?: string;
  caption?: string;
}
```
**Usage:**
```mdx
<Flowchart
  title="Cache lookup decision"
  nodes={[
    { id: "start", label: "Start",             shape: "oval" },
    { id: "hit",   label: "Cache hit?",        shape: "diamond" },
    { id: "serve", label: "Serve from cache",  shape: "rect", color: "teal" },
    { id: "fetch", label: "Fetch from DB",     shape: "rect" },
    { id: "end",   label: "Return response",   shape: "oval" },
  ]}
  edges={[
    { from: "start", to: "hit" },
    { from: "hit",   to: "serve", label: "yes" },
    { from: "hit",   to: "fetch", label: "no" },
    { from: "serve", to: "end" },
    { from: "fetch", to: "end" },
  ]}
  caption="Happy path: cache hit → serve directly."
/>
```
**When to use:** Decision flows, state machines, write/read paths with branch points. Default node is `rect`. Use `color` on the "happy path" or most important branch node. For purely linear steps without decisions, use `FlowStep` or `Pipeline` instead.

---

### Timeline
**Pattern:** Horizontal time axis with events alternating above/below. Major events get accent dots.
**Props:**
```ts
interface TimelineEvent {
  label: string;
  date: string;
  sub?: string;
  major?: boolean;  // true = larger accent dot + bold label
  color?: string;   // 'teal' | 'amber' | 'green' | 'rose' | 'violet'
}
interface Props {
  events: TimelineEvent[];
  title?: string;
  caption?: string;
}
```
**Usage:**
```mdx
<Timeline
  title="LSM-Tree evolution"
  events={[
    { label: "LevelDB",       date: "2011", sub: "Google" },
    { label: "RocksDB",       date: "2012", sub: "Facebook fork", major: true },
    { label: "Cassandra 2.0", date: "2013" },
    { label: "WiscKey",       date: "2016", sub: "key-val separation", color: "teal" },
  ]}
  caption="Key milestones in LSM-tree adoption"
/>
```
**When to use:** Historical progressions, version timelines, algorithm evolution. Events alternate above/below the axis automatically. Use `major: true` for the 1-2 most significant events. Use `color` for notable side events.

---

### Quadrant
**Pattern:** Two-axis scatter chart for positioning items on a 2D trade-off grid.
**Props:**
```ts
interface QItem {
  label: string;
  x: number;     // 0–100 (left → right)
  y: number;     // 0–100 (bottom → top)
  focal?: boolean;
  sub?: string;
}
interface Props {
  items: QItem[];
  xAxis: string;
  yAxis: string;
  title?: string;
  caption?: string;
  quadrantLabels?: [string, string, string, string]; // [TL, TR, BL, BR]
}
```
**Usage:**
```mdx
<Quadrant
  title="Compaction strategy trade-off"
  xAxis="READ AMPLIFICATION"
  yAxis="WRITE AMPLIFICATION"
  quadrantLabels={["High W, Low R", "High W, High R", "Low W, Low R", "Low W, High R"]}
  items={[
    { label: "Leveled",      x: 18, y: 82, focal: true, sub: "1 file/level" },
    { label: "Size-Tiered",  x: 74, y: 22,              sub: "fewer rewrites" },
  ]}
  caption="No strategy occupies the ideal bottom-left corner — that's the RUM Conjecture."
/>
```
**When to use:** Feature prioritization (effort × impact), algorithm trade-offs, design comparison on 2 dimensions. Use `focal: true` on 1-2 "hero" items to highlight in accent color. Use `quadrantLabels` to name the four zones.

---

### Tree
**Pattern:** Parent-child hierarchy with orthogonal (elbow) connectors, auto-layouts by depth.
**Props:**
```ts
interface TreeNode {
  id: string;
  label: string;
  sub?: string;
  parent?: string;  // id of parent node (omit for root)
  color?: string;   // 'teal' | 'amber' | 'green' | 'rose' | 'violet' | 'accent'
}
interface Props {
  nodes: TreeNode[];
  title?: string;
  caption?: string;
}
```
**Usage:**
```mdx
<Tree
  title="B-Tree node hierarchy"
  nodes={[
    { id: "root",  label: "Root",          sub: "separator keys + child ptrs", color: "teal" },
    { id: "int1",  label: "Internal Node", sub: "keys: [15, 30]", parent: "root", color: "amber" },
    { id: "leaf1", label: "Leaf Node",     sub: "records: 5, 10, 12", parent: "int1" },
    { id: "leaf2", label: "Leaf Node",     sub: "records: 17, 22",    parent: "int1" },
  ]}
  caption="2 hops: root → internal → leaf."
/>
```
**When to use:** Class hierarchies, node type taxonomies, inheritance trees, B-Tree node types. Nodes at the same depth are automatically spread horizontally and centered. Use `color` on the root or a critical node (not both).

---

### Pyramid
**Pattern:** Stacked trapezoid layers — pyramid (apex up, rarest/most important at top) or funnel (apex down, narrowest conversion at bottom).
**Props:**
```ts
interface PyramidLayer {
  label: string;
  sub?: string;
  focal?: boolean;   // accent color on this layer (max 1)
  annotation?: string; // right-side note (e.g. drop-off % for funnels)
}
interface Props {
  layers: PyramidLayer[];
  orientation?: 'pyramid' | 'funnel';  // default: 'pyramid'
  title?: string;
  caption?: string;
}
```
**Usage:**
```mdx
<Pyramid
  title="Distributed systems progression"
  orientation="pyramid"
  layers={[
    { label: "Consensus",         sub: "Paxos, Raft", focal: true },
    { label: "Distributed Txns",  sub: "2PC, Spanner" },
    { label: "Consistency Models",sub: "linearizability → eventual" },
    { label: "Fundamentals",      sub: "FLP impossibility, fallacies" },
  ]}
  caption="Apex = most advanced. Each layer depends on the one below it."
/>
```
**When to use:** Knowledge hierarchies (foundational → advanced), Maslow-style priority pyramids, conversion funnels. `layers[0]` is always the apex (top for pyramid, bottom for funnel). Mark the one most important layer with `focal: true`.

---

### ERDiagram
**Pattern:** Entity-relationship diagram with header type tags, field lists, and cardinality relations.
**Props:**
```ts
interface ERField { name: string; note?: string; }
interface EREntity {
  id: string;
  name: string;
  type?: string;       // 'aggregate' | 'entity' | 'value' | 'service' | 'event'
  fields?: ERField[];  // # = PK, → = FK prefix in note
  focal?: boolean;     // accent header (aggregate root)
  col?: number;        // manual column (0-based)
  row?: number;        // manual row (0-based)
}
interface ERRelation {
  from: string;
  to: string;
  fromCard?: string;   // cardinality label near 'from' end
  toCard?: string;     // cardinality label near 'to' end
  label?: string;      // relationship verb
}
interface Props {
  entities: EREntity[];
  relations?: ERRelation[];
  title?: string;
  caption?: string;
}
```
**Usage:**
```mdx
<ERDiagram
  title="Order domain model"
  entities={[
    {
      id: "order", name: "Order", type: "aggregate", focal: true,
      fields: [
        { name: "id",         note: "# PK" },
        { name: "customerId", note: "→ Customer" },
        { name: "status",     note: "enum" },
      ],
    },
    {
      id: "item", name: "OrderItem", type: "entity", col: 1,
      fields: [
        { name: "orderId", note: "→ Order" },
        { name: "sku",     note: "string" },
      ],
    },
  ]}
  relations={[
    { from: "order", to: "item", fromCard: "1", toCard: "N", label: "contains" },
  ]}
  caption="Order aggregate root owns OrderItem collection."
/>
```
**When to use:** Domain models, database schemas, DDD aggregate boundaries. Mark the aggregate root with `focal: true`. Use `type: 'aggregate' | 'entity' | 'value'` for DDD stereotypes. Use `# PK` and `→ FK` prefixes in field notes.

---

### Venn
**Pattern:** 2 or 3 overlapping circles with labeled intersections.
**Props:**
```ts
interface VennCircle { label: string; color?: string; }
interface VennIntersection {
  sets: number[];     // indices into circles[] — [0,1] for overlap between circles 0 and 1
  label: string;
  sub?: string;
  focal?: boolean;    // accent color (max 1–2)
}
interface Props {
  circles: VennCircle[];
  intersections?: VennIntersection[];
  title?: string;
  caption?: string;
}
```
**Usage:**
```mdx
<Venn
  title="RUM Conjecture"
  circles={[
    { label: "Read-optimal",   color: "teal" },
    { label: "Update-optimal", color: "amber" },
    { label: "Memory-optimal", color: "violet" },
  ]}
  intersections={[
    { sets: [0, 2],    label: "B-Trees",      sub: "sorted pages, in-place writes" },
    { sets: [1, 2],    label: "LSM Trees",    sub: "sequential appends, compaction", focal: true },
    { sets: [0, 1],    label: "Hash indexes", sub: "O(1) ops, all keys in memory" },
    { sets: [0, 1, 2], label: "⚠ impossible", sub: "no structure achieves all three" },
  ]}
  caption="Any two can be optimised simultaneously — never all three."
/>
```
**When to use:** Set membership overlaps, shared properties between 2-3 systems, CAP theorem, RUM Conjecture. Use `focal: true` on the most interesting intersection. Circle colors: `'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'teal'`.
