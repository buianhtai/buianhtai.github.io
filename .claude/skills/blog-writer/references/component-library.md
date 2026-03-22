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
