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
