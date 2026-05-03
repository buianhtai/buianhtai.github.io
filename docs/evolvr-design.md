# evolvr — Design Doc

**Self-evolving agent infrastructure for OpenCode, Claude, Codex, and Pi**

Status: Design / Pre-build  
Date: 2026-05-03

---

## Problem Statement

OpenCode, Codex, Claude CLI, and Pi are execution engines. They run tasks. They do not remember failures, do not learn across sessions, and do not track work in a way that feeds back into future behavior. Every session starts from zero.

The result: agents repeat the same mistakes. Loops hit the same dead ends. Tool sequences that failed yesterday are tried again today. There is no accumulating intelligence — just accumulated cost.

**evolvr** is the persistent layer between runs: task journal, failure classifier, lesson extractor, and skill evolver. It observes all four agents uniformly and improves all four from the same evidence base.

---

## Four Target Agents and Their Integration Points

### 1. OpenCode
- **Hook point:** OpenCode sessions emit events via its event bus. evolvr attaches as a subscriber.
- **AGENTS.md injection:** evolvr writes lessons back as AGENTS.md entries the agent reads at session start.
- **GoClaw connection:** OpenCode already integrates with GoClaw via the gateway layer. evolvr can piggyback on the GoClaw audit event bus (`protocol.EventAuditLog`) rather than instrumenting OpenCode separately.

### 2. Claude CLI (via GoClaw)
- **Hook point:** GoClaw's `claude_cli_hooks.go` generates PreToolUse hook scripts. evolvr registers as a hook consumer — receives every tool call + result without modifying the agent.
- **Lesson injection:** evolvr writes lessons to the session context file that GoClaw loads at run start.
- **Already available:** GoClaw's `PendingMessageStore` can deliver evolvr feedback as injected messages mid-run.

### 3. Codex (via GoClaw)
- **Hook point:** GoClaw's Codex provider uses the `TokenSource` OAuth interface. evolvr wraps the provider client to intercept call/result pairs.
- **Lesson injection:** Same as Claude CLI — context file injection at run start.

### 4. Pi (pi.dev)
- **Hook point:** Pi's **RPC mode** (`--mode json` event stream over stdin/stdout) exposes every tool call, result, and message as structured JSON events. evolvr runs as a Pi **extension** (`TypeScript module`) that hooks into the event lifecycle.
- **Alternatively:** Pi's SDK mode lets evolvr embed Pi and instrument it directly.
- **Lesson injection:** Pi loads `AGENTS.md` from the current directory at startup. evolvr writes learned lessons there.
- **Key advantage:** Pi already integrates with OpenClaw (GoClaw's SDK), so the GoClaw audit bus covers Pi runs too when routed through OpenClaw.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        evolvr                           │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Task Journal │  │  Failure     │  │ Skill Evolver │  │
│  │  (SQLite /  │  │  Classifier  │  │               │  │
│  │  Postgres)  │  │              │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│  ┌──────▼────────────────▼───────────────────▼──────┐   │
│  │              Event Collector                      │   │
│  │   (normalized events from all 4 adapters)        │   │
│  └──────────────────────────────────────────────────┘   │
└────────────┬──────────────────────────────┬─────────────┘
             │                              │
     ┌───────▼──────┐              ┌────────▼────────┐
     │  GoClaw      │              │  Pi Extension   │
     │  Audit Bus   │              │  (RPC events)   │
     │  (covers     │              │                 │
     │  OpenCode,   │              └────────┬────────┘
     │  Claude CLI, │                       │
     │  Codex)      │              Pi runs not via GoClaw
     └──────────────┘
```

---

## System 1: Task Journal

Every agent run produces one `Task` record:

```typescript
interface Task {
  id: string;                    // ulid
  agent: 'opencode' | 'claude' | 'codex' | 'pi';
  intent: string;                // user's original message
  plan_snapshot?: string;        // plan if agent generated one
  tool_calls: ToolCall[];        // ordered sequence
  outcome: 'success' | 'partial' | 'failed' | 'loop_stopped';
  failure_class?: FailureClass;
  reflection: string;            // agent-written or evolvr-generated
  lessons: Lesson[];
  duration_ms: number;
  token_cost: number;
  parent_task_id?: string;       // delegation chain
  session_id: string;
  agent_version: string;
  ts: string;                    // ISO8601
}

interface ToolCall {
  tool: string;
  args_hash: string;             // SHA-256, not raw args (privacy)
  result_hash: string;
  result_summary: string;        // first 200 chars
  latency_ms: number;
  repeated: boolean;
  was_loop_trigger: boolean;
}

type FailureClass =
  | 'exact_repeat_loop'
  | 'read_only_streak'
  | 'same_result_cycling'
  | 'context_overflow'
  | 'tool_permission_denied'
  | 'external_service_error'
  | 'wrong_tool_sequence'
  | 'missing_context'
  | 'ambiguous_intent'
  | 'unknown';

interface Lesson {
  id: string;
  failure_class: FailureClass;
  trigger_pattern: string;       // what situation triggers this lesson
  recommendation: string;        // what to do instead
  confidence: number;            // 0-1, increases with evidence
  evidence_count: number;        // how many failures support this
  agent_scope: string[];         // which agents this applies to
}
```

Storage: SQLite for single-machine, PostgreSQL for multi-agent teams. Schema migrations via a simple versioned migration runner (no ORM).

---

## System 2: Failure Classifier

Runs after each task completes. Input: raw tool call sequence + outcome. Output: `FailureClass` + extracted lessons.

**Classification pipeline:**

1. **Rule-based fast path** — Exact-repeat, read-only streak, same-result cycling are deterministic (same algorithm as GoClaw's `toolloop.go`). Classified immediately without LLM.

2. **Semantic classifier** — For non-deterministic failures (wrong tool sequence, missing context, ambiguous intent), evolvr sends a compact representation to the configured LLM with a structured extraction prompt. Returns `FailureClass` + draft `Lesson`.

3. **Confidence gating** — A lesson is only stored if confidence ≥ 0.6. Below that threshold, it goes into a `pending_lessons` queue for human review.

**Community sync (opt-in):**
- Lessons are anonymized (no file paths, no user content — only tool names, failure class, recommendation text)
- Published to a public index (GitHub-hosted JSON initially, CDN later)
- Pulled at session start: *"12 community lessons match your task type"*

---

## System 3: Skill Evolver

When a lesson reaches `evidence_count ≥ 3` for a given agent+failure_class combination, the Skill Evolver activates.

**Evolver pipeline:**

1. **Draft patch** — Generate a diff to the relevant AGENTS.md, SKILL.md, or playbook file. Uses the accumulated lesson text as the source.

2. **Review gate** — Show the patch to the operator with a diff view. Three options:
   - Auto-apply (if `auto_evolve: true` in config)
   - Apply after review
   - Reject + add to ignore list

3. **A/B shadow test** — New skill version runs alongside old for the next 10 similar tasks. Outcome delta determines promotion or revert.

4. **Promotion** — Patch is committed to the project's AGENTS.md / SKILL.md with a structured commit message:
   ```
   evolvr: apply lesson patch [loop-detection/read_file_cycle]
   
   Evidence: 4 failures over 3 sessions
   Confidence: 0.82
   Failure class: same_result_cycling
   ```

---

## Integration Detail: Pi Extension

Pi's extension system is TypeScript modules. The evolvr Pi extension:

```typescript
// pi-extension: evolvr observer
import type { PiExtension } from '@mariozechner/pi-coding-agent';

export default {
  name: 'evolvr',
  setup(pi) {
    pi.on('tool:before', (call) => {
      evolvr.record({ tool: call.name, args: call.args });
    });
    pi.on('tool:after', (call, result) => {
      evolvr.recordResult({ tool: call.name, result });
    });
    pi.on('session:end', (session) => {
      evolvr.flush(session);  // write Task record, run classifier
    });
    
    // inject lessons into context before first turn
    pi.on('session:start', async (session) => {
      const lessons = await evolvr.queryLessons({
        agent: 'pi',
        context: session.firstMessage
      });
      if (lessons.length > 0) {
        pi.injectContext(formatLessons(lessons));
      }
    });
  }
} satisfies PiExtension;
```

Installed as: `pi install git:github.com/yourusername/evolvr-pi`

---

## Integration Detail: GoClaw Adapter

GoClaw already has:
- `protocol.EventAuditLog` on the event bus — covers all tool calls
- `internal/agent/toolloop.go` — loop detection results
- `PendingMessageStore` — for mid-run lesson injection

evolvr subscribes to the GoClaw event bus as a consumer:

```go
// evolvr GoClaw adapter
bus.Subscribe(protocol.EventAuditLog, func(e bus.Event) {
    evolvr.ingest(AuditToTaskEvent(e))
})
bus.Subscribe(protocol.EventRunCompleted, func(e bus.Event) {
    evolvr.flush(e.SessionID)
})
```

Lessons are injected at run start via `PendingMessageStore.Add()` — the same mechanism GoClaw already uses for mid-run message injection.

---

## Repo Structure (proposed)

```
evolvr/
├── core/
│   ├── journal.ts          # Task record store (SQLite adapter)
│   ├── classifier.ts       # Failure classification pipeline
│   ├── evolver.ts          # Skill patch generation + A/B
│   └── lessons.ts          # Lesson store + community sync
├── adapters/
│   ├── goclaw/             # Go package — GoClaw event bus subscriber
│   ├── pi/                 # Pi extension
│   └── opencode/           # OpenCode event subscriber (future)
├── cli/
│   └── evolvr.ts           # evolvr status, lessons, patches, stats
├── schema/
│   └── migrations/         # SQLite schema versions
└── community/
    └── sync.ts             # Anonymized lesson publish/pull
```

---

## Configuration

`.evolvr/config.json` in project root:

```json
{
  "agents": ["opencode", "claude", "codex", "pi"],
  "storage": "sqlite",           // or "postgres"
  "auto_evolve": false,          // require human review for patches
  "community_sync": false,       // opt-in lesson sharing
  "min_confidence": 0.6,
  "min_evidence": 3,
  "lesson_injection": true,      // inject lessons at session start
  "classifier_model": "claude-3-5-haiku-20241022"  // cheap, fast
}
```

---

## MVP Scope (v0.1)

1. **Task Journal** — SQLite storage, record tool calls + outcome for Pi and GoClaw agents
2. **Rule-based classifier** — Deterministic loop failure classes (no LLM required for v0.1)
3. **Lesson store** — Store + query lessons, inject into AGENTS.md at session start
4. **Pi extension** — Full integration, installable via `pi install`
5. **GoClaw adapter** — Subscribe to audit bus, record tasks
6. **CLI** — `evolvr status`, `evolvr lessons`, `evolvr tasks --failed`

**Deferred to v0.2:**
- Semantic classifier (LLM-based)
- Skill Evolver / patch generation
- Community sync
- OpenCode direct adapter (covered by GoClaw for now)
- Codex direct adapter (covered by GoClaw for now)

---

## Why This Is Different from Existing Projects

| Project | What it does | What evolvr adds |
|---------|-------------|-----------------|
| MemGPT / mem0 | Long-term memory for conversations | Task-level failure classification + lesson extraction |
| LangSmith | Tracing + observability | Not just observe — actively improves agent skills |
| AgentBench | Evaluation benchmarks | Production runtime, not offline eval |
| OpenCode AGENTS.md | Static instructions | Dynamic, evidence-driven updates |
| GoClaw toolloop.go | Detects loops at runtime | Records them, learns from them, prevents recurrence |

The key distinction: evolvr is **not a memory system** and **not a monitoring system**. It is a **learning system** — the output is improved agent behavior, not logs or conversations.

---

## Next Steps

1. Scaffold the repo (`evolvr-core` monorepo with `core/`, `adapters/pi/`, `adapters/goclaw/`)
2. Implement SQLite journal + rule-based classifier (pure TypeScript, no deps beyond better-sqlite3)
3. Build Pi extension — testable immediately without GoClaw
4. Wire GoClaw adapter — leverages existing audit bus
5. Write the blog post series (this design doc becomes post 1)
