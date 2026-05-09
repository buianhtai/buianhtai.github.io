# Flywheel → glide-agents Mapping & Implementation Plan

**Date:** 2026-03-24
**Author:** Sisyphus analysis session
**Scope:** Map Dicklesworthstone Agentic Coding Flywheel patterns onto `gitlab.com/tripudiotech/others/glide-ai-tool`

---

## Part 1: glide-agents Current Architecture

### What It Is
TypeScript monorepo of 5 composable AI agents for GlideYoke (Java microservices platform). Each agent = **MCP server (deterministic tools) + Skill (markdown orchestration recipe)**.

### Agents

| Agent | MCP Tools | Purpose |
|-------|-----------|---------|
| **GlideKnowledge (KGraph)** | 7 tools (impact_analysis, trace_flow, service_map, etc.) | Neo4j code knowledge graph — 7,113 nodes, 9,008 relationships, 9 parsers |
| **GlideDebugger** | 5 tools (parse_stack_trace, find_error_source, correlate_logs, analyze_patterns, persist_rca) | 6-step RCA workflow |
| **GlideJira** | 5 tools (triage_ticket, find_similar_bugs, auto_create_ticket, resolution_lookup, sprint_health) | Ticket triage + pattern-based routing |
| **GlideVisual** | 4 tools (fishbone_diagram, impact_diagram, flow_diagram, rca_timeline) | SVG/Mermaid diagram generation |
| **GlideDevOps** | 5 tools (env_diff, deployment_status, config_audit, rollback_check, health_dashboard) | Environment health + config verification |
| **GlideInvestigate** | meta-skill (chains all agents) | End-to-end investigation pipeline |
| **GlidePlanner** ❌ MISSING | — | Ticket → Analyze → Technical Design → Task Decomposition → Implementation Guide |

**Critical gap**: All existing agents are REACTIVE (respond to bugs/errors). No agent handles the PROACTIVE side: receiving a Jira feature/task ticket and producing an implementation plan. This is the flywheel's "85% planning / 15% coding" thesis — and it's entirely absent.

### Architecture Strengths (Already Flywheel-Adjacent)

| Aspect | Status | Detail |
|--------|--------|--------|
| **Semantic Memory** | ✅ Strong | Hivemind with 9,490 memories, integrated into debugger + jira tools |
| **Pattern Analysis** | ✅ Implemented | analyze_patterns aggregates RCAs into recurring themes (ADR-010) |
| **Three-Layer Learning** | ✅ Designed | Instance → Pattern → Skill Evolution loop (ADR-009) |
| **Knowledge Graph** | ✅ Strong | Neo4j with 9 parsers covering Java, Maven, Kafka, BPMN, Avro, DTOs |
| **Task Tracking** | ✅ Active | Beads/Hive integration, 57 issues across 3 projects |
| **Structured Output** | ✅ Implemented | Standardized RCA template (ADR-006) |
| **Step Transparency** | ✅ Implemented | Show-your-work pattern (ADR-004) |
| **Agent Chaining** | ✅ Implemented | GlideInvestigate chains all agents sequentially |
| **ADR Documentation** | ✅ 10 ADRs | Well-structured architectural decisions |

### Architecture Gaps

| Gap | Impact | Detail |
|-----|--------|--------|
| **No CI/CD** | HIGH | No `.gitlab-ci.yml` at repo root. Only glide-knowledge-graph has CI. |
| **No Linting/Formatting** | MEDIUM | No ESLint, Prettier, or Biome. Type checking only via `tsc --noEmit`. |
| **Minimal Test Coverage** | HIGH | Only parse-stack-trace + hivemind-retag tests for debugger. Other agents have basic tool tests. No integration tests. |
| **No Code Scanning** | HIGH | No automated bug detection, no pre-commit quality gate. |
| **No Dead Code Detection** | MEDIUM | KGraph knows all references but doesn't flag unreachable code. |
| **No Multi-Agent Parallelism** | MEDIUM | GlideInvestigate chains sequentially. No parallel investigation. |
| **No Inter-Agent Messaging** | LOW (current scale) | Single contributor, single-agent execution. Coordination not yet needed. |
| **No Cross-Session Search** | MEDIUM | Hivemind stores memories but doesn't index full coding sessions. |
| **Shell-based Hivemind Client** | MEDIUM | `shared/src/hivemind-client.ts` shells out to CLI via `execSync`. Fragile. |
| **No Pre-commit Hooks** | MEDIUM | Changes can be committed without type checking or tests. |

---

## Part 2: Flywheel Tool Mapping

### The Flywheel Loop
```
Plan → Coordinate (Agent Mail) → Execute (NTM + Agent Farm) → Verify (UBS + DCG) → Remember (CASS + CM) → repeat
```

### Complete Tool Inventory (12 tools)

| # | Tool | Full Name | Language | Stars | Purpose |
|---|------|-----------|----------|-------|---------|
| 1 | **ACFS** | Agentic Coding Flywheel Setup | Bash | 1,279 | VPS bootstrapping — installs all tools |
| 2 | **NTM** | Named Tmux Manager | Go | 133 | Tmux session management for parallel agents |
| 3 | **Agent Mail** | MCP Agent Mail | Python/FastMCP | 1,400+ | Inter-agent messaging + file reservations |
| 4 | **BV** | Beads Viewer | Rust | 1,389 | PageRank task prioritization on dependency DAG |
| 5 | **beads_rust** | Beads (Rust) | Rust | 739 | SQLite-based task management |
| 6 | **Agent Farm** | Claude Code Agent Farm | Python | 699 | Lock-based parallel agent orchestration |
| 7 | **CASS** | Coding Agent Session Search | Rust/Tantivy | 446 | Cross-session full-text search |
| 8 | **CM** | CASS Memory | TypeScript | 212 | Three-layer memory (Episodic → Working → Procedural) |
| 9 | **UBS** | Universal Bug Scanner | Bash | 294 | 1000+ bug patterns across 9 languages |
| 10 | **DCG** | Destructive Command Guard | Rust | 694 | Blocks dangerous shell commands (rm -rf, DROP TABLE) |
| 11 | **SLB** | Simultaneous Launch Button | Go | 56 | Parallel process launcher |
| 12 | **CAAM** | Coding Agent Account Manager | — | — | OAuth token management |

### Tool-by-Tool Analysis

#### 1. UBS (Universal Bug Scanner) — **ADOPT**
- **What it does**: Scans code for bugs — null safety, XSS, async/await issues, memory leaks, type coercion. Supports JS/TS, Python, C++, Rust, Go, Java, Ruby.
- **glide-agents equivalent**: None. Zero automated quality scanning.
- **Recommendation**: **ADOPT directly.** UBS is already available as an MCP tool (`ubs_scan`). Wire it into CI and pre-commit.
- **Implementation**: Add `ubs_scan` to CI pipeline, create pre-commit hook, add `verify_code` step to GlideDebugger workflow.
- **Impact**: HIGH — catches bugs before they reach Jira.

#### 2. DCG (Destructive Command Guard) — **ADOPT**
- **What it does**: Rust-based safety layer that intercepts and blocks destructive shell commands — `rm -rf`, `git push --force`, `DROP TABLE`, etc. Pre-commit hook integration. Essential defense-in-depth for agentic coding where LLMs issue shell commands.
- **glide-agents equivalent**: None. No safety guard against destructive commands.
- **Recommendation**: **ADOPT directly.** Install as a pre-commit hook and shell wrapper. Critical when AI agents (GlideDebugger, GlideDevOps) issue kubectl/git commands.
- **Implementation**: Install `dcg` binary, add to `.lefthook.yml` pre-commit, wrap shell execution in shared kubectl-client.ts.
- **Impact**: HIGH — prevents catastrophic mistakes from AI-generated commands.

#### 2b. KGraph Dead Code Detector — **BUILD CUSTOM** (Not a flywheel tool)
- **What it does**: Custom tool leveraging KGraph's existing call graph to find unreachable code.
- **Why custom**: KGraph already has 7,113 nodes + 9,008 relationships. It knows Java annotations, BPMN handlers, Camunda tasks, REST endpoints, and Kafka consumers — "hidden callers" that generic tools miss.
- **Implementation**: New MCP tool `dead_code_analysis` — query for methods/classes with zero incoming relationships AND not annotated as entry points (@Path, @ExternalTaskSubscription, @FeignClient, @KafkaListener).
- **Impact**: MEDIUM — reduces codebase noise. Phase 2 stretch goal.

#### 3. CASS (Coding Agent Session Search) — **ADOPT**
- **What it does**: Indexes all AI coding sessions (Claude, Codex, Cursor, etc.) for cross-session search.
- **glide-agents equivalent**: Hivemind stores RCA memories but doesn't index full coding sessions.
- **Recommendation**: **ADOPT directly.** CASS is already available as MCP tools (`cass_search`, `cass_index`). Index glide-agents sessions for cross-session recall.
- **Implementation**: Add CASS indexing to session end hook. Wire `cass_search` into GlideDebugger Step 5 (Check History) alongside Hivemind.
- **Impact**: MEDIUM — prevents re-solving solved problems across sessions.

#### 4. Agent Mail / MCP Agent Mail — **DEFER**
- **What it does**: Inter-agent messaging protocol with file reservations.
- **glide-agents equivalent**: None, but current scale (1 contributor) doesn't need it.
- **Recommendation**: **Defer until multi-developer.** Agent Mail solves coordination between parallel agents. glide-agents runs sequentially by design (GlideInvestigate chains steps). Adopt when team grows or parallel investigation is needed.
- **Pre-work**: Already have `swarmmail` MCP tools available. The plumbing exists.
- **Impact**: LOW at current scale, HIGH when team scales.

#### 5. Agent Farm (claude_code_agent_farm) — **ADOPT PATTERNS, NOT TOOL**
- **What it does**: Python-based parallel agent orchestration with **lock-based coordination** — spawns multiple Claude Code instances on isolated tasks. Uses file locks for conflict prevention, not tmux.
- **glide-agents equivalent**: GlideInvestigate runs agents sequentially.
- **Recommendation**: **Adopt the lock-based coordination pattern** into GlideInvestigate. The Agent Farm's Python lock patterns translate directly to TypeScript. Use `task()` delegation with `run_in_background=true` for parallel steps.
- **Implementation**: Redesign GlideInvestigate workflow — Steps 1-3 (Debug → Triage → Visualize) can partially parallelize. Steps 2a (find_similar_bugs) and 2b (triage_ticket) are independent. Steps 3a-3d (all diagrams) are independent. Add file-lock pattern from Agent Farm for shared resource access.
- **Impact**: MEDIUM — faster investigation, same quality.

#### 6. Beads / beads_viewer — **ENHANCE EXISTING**
- **What it does**: PageRank-based task prioritization, visual task graph.
- **glide-agents equivalent**: Already using beads for task tracking (57 issues, 3 projects).
- **Recommendation**: **Enhance, don't replace.** Add PageRank prioritization to sprint_health tool. Auto-create beads from GlideJira triage output.
- **Implementation**: Add `create_issue_from_rca` to persist_rca workflow. Wire sprint_health to use beads dependency graph for priority scoring.
- **Impact**: LOW-MEDIUM — better prioritization.

#### 7. NTM (Named Tmux Manager) — **SKIP**
- **What it does**: Go-based tmux session manager — creates, names, and manages tmux sessions for running parallel agents in isolated terminals. Part of the Agent Farm infrastructure.
- **glide-agents equivalent**: Not applicable — glide-agents uses MCP stdio transport, not tmux sessions.
- **Recommendation**: **Skip.** Tmux orchestration is for VPS-based agent farms. glide-agents runs as MCP servers in the developer's local environment. The `task()` delegation pattern serves the same parallelism purpose without tmux.
- **Impact**: N/A

#### 7b. CASS Memory / CM (Three-Layer Memory) — **EVALUATE**
- **What it does**: Separate from CASS (session search). Three-layer memory architecture: **Episodic** (raw session logs) → **Working** (summarized learnings) → **Procedural** (extracted rules/patterns). Knowledge compounds across layers.
- **glide-agents equivalent**: Hivemind (partial) + analyze_patterns (partial). Hivemind = flat memory store. analyze_patterns = periodic aggregation. Missing: the explicit layer promotion and procedural rule extraction.
- **Recommendation**: **Evaluate for Phase 3+.** The three-layer model maps well to the existing Three-Layer Learning Loop (ADR-009): Instance Memory ≈ Episodic, Pattern Memory ≈ Working, Skill Evolution ≈ Procedural. The gap is that promotions between layers are manual today. CM could automate this.
- **Impact**: MEDIUM-HIGH long term — makes the learning loop self-reinforcing.

#### 7c. SLB (Simultaneous Launch Button) — **SKIP**
- **What it does**: Go-based parallel task launcher — starts multiple processes simultaneously with coordinated output.
- **glide-agents equivalent**: pnpm scripts + task() delegation already handle parallel execution.
- **Recommendation**: **Skip.** Not needed for MCP server architecture.
- **Impact**: N/A

#### 8. GlidePlanner — **BUILD NEW AGENT** (Flywheel's "Plan" Stage)

The flywheel's core thesis is 85% planning / 15% coding. The current agents are ALL reactive (debug after bugs). The **Plan** stage is entirely missing — no agent handles:

```
Jira ticket → Analyze requirements → Technical design → Impact analysis → Task decomposition → Implementation guide
```

**New Agent: GlidePlanner** — Receives any Jira ticket (feature, task, OR bug) and produces an implementation-ready plan.

**MCP Tools (6 new tools):**

| Tool | Purpose | Data Sources |
|------|---------|-------------|
| `analyze_ticket` | Parse Jira ticket: extract requirements, acceptance criteria, affected area, ticket type. Read comments, attachments, linked issues. | Jira REST API |
| `technical_design` | Generate a technical spec: which modules change, API additions/changes, data model impact, configuration changes. | KGraph (impact_analysis, dependency_graph, service_map) |
| `impact_preview` | Show blast radius: upstream/downstream services, Kafka topics, BPMN processes, REST endpoints affected. Visual diff of "before vs after". | KGraph + GlideVisual (flow_diagram) |
| `decompose_work` | Break technical design into implementation subtasks (beads) with dependency ordering. Each subtask has: file targets, acceptance criteria, estimated complexity. | KGraph + Beads |
| `implementation_guide` | Generate per-subtask notes: existing patterns to follow, code locations from KGraph, similar past implementations from Hivemind/CASS, test strategy. | KGraph + Hivemind + CASS |
| `persist_plan` | Store the plan: post to Jira as structured comment, create beads for each subtask, store plan in Hivemind for future reference. | Jira + Beads + Hivemind |

**Skill Workflow (7 steps):**

```
Step 1: Read Ticket    → analyze_ticket (Jira context, acceptance criteria)
Step 2: Locate Code    → find_error_source / KGraph queries (affected files, modules)
Step 3: Assess Impact  → impact_preview (blast radius, dependencies)
Step 4: Check History  → find_similar_bugs + CASS + Hivemind (past approaches)
Step 5: Design         → technical_design (spec with approach, alternatives, risks)
Step 6: Decompose      → decompose_work (beads with dependencies)
Step 7: Persist        → persist_plan (Jira comment + beads + Hivemind)
```

**Trigger phrases:** "plan GY-*", "analyze ticket", "create technical design for", "break down GY-*", "implement GY-*"

**Why this is the HIGHEST IMPACT addition:**
- Completes the flywheel loop (Plan → Execute → Verify → Remember)
- Reuses existing infrastructure: KGraph, Hivemind, Beads, GlideJira, CASS
- Every other phase (verify, remember) is MORE valuable when the plan stage exists
- Directly embodies the 85/15 ratio

#### 9. agentic_coding_flywheel_setup — **BUILD CUSTOM**
- **What it does**: VPS bootstrapping with Docker, tmux, monitoring.
- **glide-agents equivalent**: Manual `pnpm install` + Docker Compose for Neo4j.
- **Recommendation**: **Build custom setup script.** Not VPS-oriented but a project-specific `setup.sh` that bootstraps: Neo4j, pnpm install, KGraph scan, MCP registration, skill symlinking.
- **Implementation**: Single `glide-agents-setup.sh` script in repo root.
- **Impact**: LOW — onboarding convenience.

---

## Part 3: Implementation Plan

### Phase 1: Quality Foundation (Week 1-2)
**Goal**: Establish the Verify stage of the flywheel.

| # | Task | Detail | Files |
|---|------|--------|-------|
| 1.1 | Add Biome config | Zero-config TS linter/formatter. Replace implicit `tsc --noEmit` with Biome + tsc. | `biome.json`, `package.json` |
| 1.2 | Add `.gitlab-ci.yml` | CI pipeline: install → lint → typecheck → test → scan (UBS). | `.gitlab-ci.yml` |
| 1.3 | Add pre-commit hooks | Biome lint + tsc + vitest on staged files. Use `lefthook` (fast, Go-based). | `.lefthook.yml`, `package.json` |
| 1.4 | Expand test coverage | Test all tool functions in glide-jira, glide-visual, glide-devops. Target: every exported function with **happy path + edge cases + error cases**. | `*/test/*.test.ts` |
| 1.5 | Add coverage thresholds | Configure `vitest --coverage` with c8/istanbul. Set thresholds: **80% line, 70% branch**. Fail CI if below. | `vitest.config.ts`, `.gitlab-ci.yml` |
| 1.6 | Wire UBS scan into CI | Add `ubs_scan` step after tests pass. Fail on errors, warn on warnings. | `.gitlab-ci.yml` |
| 1.7 | Add duplication detection | Add `jscpd` (JS Copy-Paste Detector) to CI. Threshold: max 3% duplication. Detects copy-pasted blocks across TS files. | `package.json`, `.jscpd.json`, `.gitlab-ci.yml` |
| 1.8 | Add complexity limits | Configure Biome complexity rules: max cyclomatic complexity per function = 15, max cognitive complexity = 20, max function length = 50 lines. | `biome.json` |
| 1.9 | Create setup script | `setup.sh`: checks prereqs, installs deps, starts Neo4j, scans KGraph, registers MCPs. | `setup.sh` |

**Exit criteria**: Every commit goes through lint → complexity → typecheck → test (with coverage) → duplication → scan. CI catches regressions.

### Phase 2: Safety & Verification Loop — DCG + UBS Expansion (Week 3-4)
**Goal**: Establish defense-in-depth for AI-generated commands and code changes.

| # | Task | Detail | Files |
|---|------|--------|-------|
| 2.1 | Install DCG (Destructive Command Guard) | Install Rust binary, add as pre-commit hook. Blocks `rm -rf`, `git push --force`, `DROP TABLE`, destructive kubectl commands. | `.lefthook.yml`, `package.json` |
| 2.2 | Wrap shell execution with DCG | Add DCG validation layer to `shared/src/kubectl-client.ts` before executing kubectl commands. Agents cannot accidentally delete pods/namespaces. | `shared/src/kubectl-client.ts`, `shared/src/command-guard.ts` |
| 2.3 | Expand UBS scanning | Add UBS scan for Java files in BE repo (via CI). Run `ubs_scan` on both TS agents AND Java BE. | `.gitlab-ci.yml` |
| 2.4 | ADR for safety layers | Document the DCG + UBS defense-in-depth approach. | `docs/decisions/011-safety-layers.md` |

**Stretch goal**: Build KGraph Dead Code Detector (custom `dead_code_analysis` MCP tool using Neo4j graph to find methods/classes with zero callers that aren't framework entry points).

**Exit criteria**: No destructive command can execute without DCG approval. UBS scans both TS and Java.

### Phase 2b: Code Quality & GlideReviewer (Week 4-5) ⭐ YOUR ASK
**Goal**: Enforce clean code, well-structured code, TDD discipline, no duplication, and comprehensive test coverage — across BOTH TypeScript agents AND Java BE.

#### New Agent: GlideReviewer — Automated Code Review

A new MCP server (or extension to GlideDebugger) that reviews code changes against quality standards BEFORE merge.

| Tool | Purpose | What It Checks |
|------|---------|---------------|
| `review_clean_code` | Verify code follows clean code principles | Naming conventions (camelCase TS, PascalCase Java classes), single responsibility (function length ≤ 50 lines, class ≤ 300 lines), no magic numbers, no deep nesting (max 3 levels), no commented-out code |
| `review_structure` | Verify well-structured code | No circular dependencies (madge for TS, JDepend for Java), proper layering (controller → service → repository), module boundaries respected (KGraph dependency_graph), imports follow project conventions |
| `review_duplication` | Detect copy-paste code | Cross-file duplication detection (jscpd for TS, PMD CPD for Java), threshold: max 3% duplication per module, suggest extract-to-shared when pattern repeats 3+ times |
| `review_tdd` | Enforce test-driven development | Every changed `.ts` file must have a corresponding `.test.ts` file. New functions must have tests. Test file must contain: at least 1 happy path test, at least 1 edge case test (null/empty/boundary), at least 1 error case test. Coverage delta: changed files must have ≥ 80% coverage |
| `review_test_quality` | Verify test quality (not just quantity) | Tests must have descriptive names (`should X when Y`), no skipped tests (.skip/.only), no hardcoded timeouts > 5s, assertions must be specific (not just `.toBeTruthy()`), edge cases: null inputs, empty arrays, boundary values, concurrent access |
| `review_summary` | Produce a structured review report | Aggregate all checks into a single report: PASS/WARN/FAIL per category, specific file:line references, suggested fixes, overall verdict |

**Skill Workflow (GlideReviewer):**

```
Step 1: Diff Analysis   → Get changed files from git diff (MR branch vs main)
Step 2: Clean Code       → review_clean_code on each changed file
Step 3: Structure        → review_structure on affected modules
Step 4: Duplication      → review_duplication on changed + neighboring files
Step 5: TDD Compliance   → review_tdd (test exists? coverage adequate?)
Step 6: Test Quality     → review_test_quality (happy + edge + error cases?)
Step 7: Report           → review_summary (post to MR as comment OR Jira)
```

**Trigger phrases:** "review MR", "check code quality", "verify before merge", "review GY-*"

#### Implementation Tasks

| # | Task | Detail | Files |
|---|------|--------|-------|
| 2b.1 | ADR for GlideReviewer | Document the 6-tool review agent, quality standards, thresholds. | `docs/decisions/012-glide-reviewer.md` |
| 2b.2 | Create glide-reviewer package | New MCP server with 6 review tools. | `glide-reviewer/src/index.ts`, `glide-reviewer/src/tools/*.ts` |
| 2b.3 | Build review_clean_code | AST-based checks: function length, nesting depth, naming conventions, magic numbers. For TS use ts-morph, for Java use KGraph method/class size data. | `glide-reviewer/src/tools/review-clean-code.ts` |
| 2b.4 | Build review_structure | Circular dependency detection (madge for TS). Layer violation check via KGraph (controller calls repository directly = violation). Import convention check. | `glide-reviewer/src/tools/review-structure.ts` |
| 2b.5 | Build review_duplication | Wrap jscpd for TS, PMD CPD for Java. Report duplicate blocks with file:line references and "extract to shared" suggestions. | `glide-reviewer/src/tools/review-duplication.ts` |
| 2b.6 | Build review_tdd | Check changed files have test files. Parse test files for: describe blocks (happy/edge/error), assertion count, coverage of changed functions. | `glide-reviewer/src/tools/review-tdd.ts` |
| 2b.7 | Build review_test_quality | Verify test naming patterns, no .skip/.only, specific assertions, edge case coverage (null/empty/boundary inputs). | `glide-reviewer/src/tools/review-test-quality.ts` |
| 2b.8 | Build review_summary | Aggregate all checks into structured report. Post to GitLab MR as comment OR Jira. | `glide-reviewer/src/tools/review-summary.ts` |
| 2b.9 | Create GlideReviewer skill | 7-step review workflow with trigger phrases. | `glide-skills/glide-reviewer/SKILL.md` |
| 2b.10 | Wire into CI | Add review step to `.gitlab-ci.yml` — runs on MR pipelines. FAIL on critical issues, WARN on style issues. | `.gitlab-ci.yml` |
| 2b.11 | Java BE quality gates | Add Checkstyle (style), SpotBugs (bugs), PMD (complexity + duplication), JaCoCo (coverage ≥ 80% line, 70% branch) to Java BE CI. Wire results into review_summary. | Java BE `.gitlab-ci.yml` |
| 2b.12 | ArchUnit tests for Java | Architecture tests: verify layering (controller → service → repository), no circular deps between modules, DTOs don't leak into service layer. | Java BE `src/test/java/.../ArchitectureTest.java` |

#### Quality Standards (Enforced by GlideReviewer)

**Clean Code Rules:**
- Function length: ≤ 50 lines (WARN at 40, FAIL at 50)
- Class length: ≤ 300 lines (WARN at 250, FAIL at 300)
- Cyclomatic complexity: ≤ 15 per function
- Cognitive complexity: ≤ 20 per function
- Nesting depth: ≤ 3 levels
- No magic numbers (extract to named constants)
- No commented-out code blocks
- Descriptive naming (no single-letter variables except loop counters)

**Structure Rules:**
- Zero circular dependencies (FAIL)
- Proper layering: controller → service → repository (FAIL on violation)
- Module boundaries: no cross-module direct imports (use shared package)
- Import ordering: external → internal → relative

**TDD Rules:**
- Every changed source file MUST have a corresponding test file (FAIL)
- Every new exported function MUST have at least 1 test (FAIL)
- Test file naming: `<source>.test.ts` (TS) or `<Source>Test.java` (Java)

**Test Coverage Requirements:**
- Per test file, MUST contain:
  - ≥ 1 happy path test (normal input → expected output)
  - ≥ 1 edge case test (null, empty, boundary, max/min values)
  - ≥ 1 error case test (invalid input → proper error handling)
- Coverage thresholds:
  - Changed files: ≥ 80% line coverage, ≥ 70% branch coverage
  - Overall project: ≥ 75% line coverage (WARN), ≥ 80% (target)
- Test naming: `should <expected> when <condition>` pattern
- No `.skip()` or `.only()` in committed code (FAIL)
- Assertions must be specific: no bare `.toBeTruthy()` — use `.toBe()`, `.toEqual()`, `.toThrow()`

**Duplication Rules:**
- Max 3% duplication per module (WARN at 2%, FAIL at 3%)
- Blocks ≥ 10 lines duplicated → suggest extract to shared utility
- Cross-module duplication → suggest adding to `shared/` package

**Exit criteria**: Every MR gets an automated review with PASS/WARN/FAIL per category. No MR merges with FAIL status.

### Phase 3: GlidePlanner Agent — The "Plan" Stage (Week 6-8) ⭐ HIGHEST IMPACT
**Goal**: Build the missing Plan stage of the flywheel. Complete the loop: Jira ticket → plan → implement → verify → remember.

| # | Task | Detail | Files |
|---|------|--------|-------|
| 3.1 | ADR for GlidePlanner | Document the agent design: 6 tools, 7-step workflow, integration points with KGraph/Hivemind/CASS/Beads. | `docs/decisions/012-glide-planner.md` |
| 3.2 | Create glide-planner package | New MCP server with 6 tools: analyze_ticket, technical_design, impact_preview, decompose_work, implementation_guide, persist_plan. | `glide-planner/src/index.ts`, `glide-planner/src/tools/*.ts` |
| 3.3 | Build analyze_ticket tool | Read Jira ticket via Atlassian MCP. Parse requirements, acceptance criteria, classify ticket type (feature/bug/task). Extract module hints. | `glide-planner/src/tools/analyze-ticket.ts` |
| 3.4 | Build technical_design tool | Use KGraph to identify affected modules, dependencies, APIs. Generate structured spec with approach, alternatives, risks. | `glide-planner/src/tools/technical-design.ts` |
| 3.5 | Build decompose_work tool | Break design into ordered subtasks. Create beads with dependencies. Each subtask gets: target files, acceptance criteria, complexity estimate. | `glide-planner/src/tools/decompose-work.ts` |
| 3.6 | Build implementation_guide tool | Per-subtask notes: code patterns from KGraph, past approaches from Hivemind/CASS, test strategy. | `glide-planner/src/tools/implementation-guide.ts` |
| 3.7 | Build persist_plan tool | Post plan to Jira comment, create beads, store in Hivemind. | `glide-planner/src/tools/persist-plan.ts` |
| 3.8 | Create GlidePlanner skill | 7-step workflow: Read Ticket → Locate Code → Assess Impact → Check History → Design → Decompose → Persist. | `glide-skills/glide-planner/SKILL.md` |
| 3.9 | Unit tests | Test each tool function with fixtures. | `glide-planner/test/*.test.ts` |
| 3.10 | Wire into GlideInvestigate | Add optional "plan" path to GlideInvestigate — when ticket is feature/task (not bug), route to GlidePlanner instead of GlideDebugger. | `glide-skills/glide-investigate/SKILL.md` |

**Exit criteria**: `plan GY-1234` produces a structured plan with subtask beads and Jira comment.

### Phase 4: Session Memory — CASS Integration (Week 8)
**Goal**: Prevent re-solving solved problems across sessions.

| # | Task | Detail | Files |
|---|------|--------|-------|
| 4.1 | Add CASS to GlideDebugger + GlidePlanner | Wire `cass_search` alongside Hivemind in both agents' history-check steps. | Skills |
| 4.2 | Auto-index sessions | Add CASS session indexing to workspace end-of-session hook. | `shared/src/cass-integration.ts` |

**Exit criteria**: Both debug and planning workflows search past coding sessions.

### Phase 5: Parallel Investigation (Week 9)
**Goal**: Speed up GlideInvestigate by parallelizing independent steps.

| # | Task | Detail | Files |
|---|------|--------|-------|
| 5.1 | Refactor GlideInvestigate skill | Split into parallel groups where data dependencies allow. | `glide-skills/glide-investigate/SKILL.md` |
| 5.2 | ADR for parallel investigation | Document the execution model. | `docs/decisions/013-parallel-investigation.md` |

**Exit criteria**: Full investigation completes in < 60% of sequential time.

### Phase 6: Enhanced Task Flow (Week 10)
**Goal**: Close the loop from investigation/planning → task creation → prioritization.

| # | Task | Detail | Files |
|---|------|--------|-------|
| 6.1 | Auto-create beads from RCA | After persist_rca, auto-create a beads issue. | `glide-debugger/src/tools/persist-rca.ts` |
| 6.2 | Priority scoring with KGraph | Coupling score boosts priority for highly-connected modules. | `glide-jira/src/tools.ts` |
| 6.3 | Hive→Jira sync | Closed bead → resolved Jira ticket. | `shared/src/hive-jira-sync.ts` |

**Exit criteria**: The full flywheel loop is automated: Ticket → Plan → Implement → Verify → Remember → next ticket.

---

## Part 3b: Flywheel Workflow Commands — "Stream Deck" Skills

The flywheel defines 8 workflow commands — single-button actions that chain multiple tools. These map to **Skills** in glide-agents. Each skill is a SKILL.md that orchestrates MCP tools into a complete workflow.

### Mapping: Flywheel Commands → glide-agents Skills

| # | Command | Flywheel Tools | glide-agents Implementation | Status |
|---|---------|---------------|---------------------------|--------|
| 1 | **Deep Code Exploration** | CASS, UBS, BV | New skill: `glide-explore` — KGraph random-walk → trace flows → UBS scan → report bugs | 🆕 BUILD |
| 2 | **Agent Peer Review** | Mail, CASS, UBS | `glide-reviewer` (Phase 2b) — review changed code for bugs/security/reliability | ✅ COVERED (Phase 2b) |
| 3 | **UX/UI Deep Scrutiny** | BV, CM | Skip — backend Java microservices, no frontend | ⏭️ SKIP |
| 4 | **Beads Planning** | BV, Mail | `glide-planner` `decompose_work` (Phase 3) — create beads with deps from analysis | ✅ COVERED (Phase 3) |
| 5 | **Plan Validation** | BV | New skill: `glide-validate-plan` — review beads for optimality before execution | 🆕 BUILD |
| 6 | **Systematic Execution** | BV, Mail, SLB, RU | New skill: `glide-execute` — execute beads in dependency order, mark progress | 🆕 BUILD |
| 7 | **Post-Implementation Review** | UBS, CASS | `glide-reviewer` (Phase 2b) + UBS — review all new code with fresh eyes | ✅ COVERED (Phase 2b) |
| 8 | **Intelligent Commit Grouping** | SLB, RU | New skill: `glide-ship` — group changes into logical commits, detailed messages, push | 🆕 BUILD |

### 4 New Skills to Build

#### Skill 1: `glide-explore` — Proactive Code Exploration
**Trigger:** "explore codebase", "find hidden bugs", "deep scan"

```
Step 1: Random Walk     → KGraph: pick 3-5 high-coupling modules (coupling_score query)
Step 2: Trace Flows     → KGraph: trace_flow for each module's key endpoints
Step 3: Check History   → Hivemind + CASS: have these modules had recent bugs?
Step 4: Fresh-Eyes Scan → UBS: scan the module source files for bug patterns
Step 5: Cross-Reference → KGraph: check if any traced flows have uncovered gaps
                           (e.g., missing error handling on a REST endpoint that traces
                           through 3 services and 2 Kafka topics)
Step 6: Report          → Structured findings: module, flow, issue, severity, suggested fix
Step 7: Persist         → Store findings in Hivemind, optionally create beads for fixes
```

**Key insight**: This is the only PROACTIVE workflow — it finds problems WITHOUT a Jira ticket. Every other workflow is reactive (triggered by a ticket or error). This is the "fresh eyes" the flywheel emphasizes.

#### Skill 2: `glide-validate-plan` — Plan Space Validation
**Trigger:** "validate plan", "check beads", "review plan before execution"

```
Step 1: Load Plan       → Read beads created by GlidePlanner (dependency graph)
Step 2: Dependency Check → Verify dependency ordering is correct (no circular deps)
Step 3: Scope Check     → For each bead: is the scope reasonable? (1-3 files per bead,
                           not 10+). Split oversized beads.
Step 4: Impact Check    → KGraph: verify blast radius matches plan assumptions
Step 5: History Check   → Hivemind + CASS: have similar plans succeeded or failed before?
Step 6: Risk Assessment → Flag high-risk beads (touching highly-coupled modules,
                           crossing service boundaries, modifying shared libs)
Step 7: Optimize        → Suggest reordering for better parallelism or reduced risk
Step 8: Report          → Validated plan with risk scores per bead, suggested changes
```

**Key insight**: "It's a lot easier and faster to operate in plan space." Catch mistakes BEFORE implementation.

#### Skill 3: `glide-execute` — Systematic Bead Execution
**Trigger:** "execute beads", "start implementation", "work through tasks"

```
Step 1: Load Ready      → Get unblocked beads sorted by dependency order + priority
Step 2: Claim           → Mark current bead as in_progress
Step 3: Context         → Load implementation_guide for this bead (from GlidePlanner)
Step 4: Implement       → Write code following the guide, patterns from KGraph
Step 5: Test            → Write tests (happy path + edge cases + error cases per TDD rules)
Step 6: Verify          → Run GlideReviewer on changed files (clean code + structure + TDD)
Step 7: Mark Done       → Close bead, move to next unblocked bead
Step 8: Repeat          → Loop Steps 1-7 until all beads complete or blocked
```

**Key insight**: This automates the "execute in optimal order" workflow. Each bead gets: context → implement → test → verify → close.

#### Skill 4: `glide-ship` — Intelligent Commit Grouping
**Trigger:** "commit and push", "ship it", "group commits"

```
Step 1: Diff Analysis   → git diff --stat: list all changed files
Step 2: Group by Module → KGraph: map files to modules, group changes by module boundary
Step 3: Group by Bead   → Match changed files to closed beads (bead metadata has file targets)
Step 4: Order Groups    → Dependency order: shared/ first, then modules, then skills/configs
Step 5: Commit Each     → For each group: git add <files> && git commit with detailed message
                           Message format: "feat(module): <bead title>\n\n<what changed and why>"
Step 6: Verify          → Run lint + typecheck + test on final state
Step 7: Push            → git push (or create MR via glab)
```

**Key insight**: Logical commits make git history useful for future debugging. "What changed for GY-1234?" → one commit group, not a 50-file dump.

### Integration: The Complete Development Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT LIFECYCLE                          │
│                                                                    │
│  ┌────────────┐   ┌─────────────┐   ┌──────────────┐            │
│  │  EXPLORE   │   │    PLAN     │   │   VALIDATE   │            │
│  │ glide-     │──▶│ glide-      │──▶│ glide-       │            │
│  │ explore    │   │ planner     │   │ validate-plan│            │
│  │ (proactive)│   │ (from Jira) │   │ (check beads)│            │
│  └────────────┘   └─────────────┘   └──────┬───────┘            │
│                                             │                     │
│  ┌────────────┐   ┌─────────────┐   ┌──────▼───────┐            │
│  │   SHIP     │   │   REVIEW    │   │   EXECUTE    │            │
│  │ glide-     │◀──│ glide-      │◀──│ glide-       │            │
│  │ ship       │   │ reviewer    │   │ execute      │            │
│  │ (commits)  │   │ (quality)   │   │ (bead loop)  │            │
│  └────────────┘   └─────────────┘   └──────────────┘            │
│                                                                    │
│  REMEMBER: Every step stores learnings in Hivemind + CASS          │
└──────────────────────────────────────────────────────────────────┘
```

### Implementation Phase for Workflow Skills

These 4 new skills are lightweight (SKILL.md files only — no new MCP tools needed). They chain existing tools from GlidePlanner, GlideReviewer, KGraph, Hivemind, CASS, and Beads. Add as **Phase 7** after all agents are built.

| # | Task | Detail | Files |
|---|------|--------|-------|
| 7.1 | Create `glide-explore` skill | Proactive exploration workflow (7 steps). Chains KGraph, UBS, Hivemind, CASS. | `glide-skills/glide-explore/SKILL.md` |
| 7.2 | Create `glide-validate-plan` skill | Plan validation workflow (8 steps). Chains Beads, KGraph, Hivemind. | `glide-skills/glide-validate-plan/SKILL.md` |
| 7.3 | Create `glide-execute` skill | Systematic execution workflow (8 steps). Chains Beads, GlidePlanner, GlideReviewer. | `glide-skills/glide-execute/SKILL.md` |
| 7.4 | Create `glide-ship` skill | Intelligent commit grouping (7 steps). Chains KGraph, Beads, git. | `glide-skills/glide-ship/SKILL.md` |
| 7.5 | ADR for workflow commands | Document the lifecycle, command triggers, tool chaining. | `docs/decisions/014-workflow-commands.md` |

**Effort**: 2-3 days (skills are markdown, no code required)
**Dependencies**: Phases 2b (GlideReviewer), 3 (GlidePlanner), and Beads integration

---

## Part 4: What NOT to Adopt (and Why)

| Tool | Decision | Reason |
|------|----------|--------|
| **NTM** (Named Tmux Manager) | Skip | Go/tmux session management for VPS agent farms. glide-agents uses MCP stdio, not tmux. |
| **SLB** (Simultaneous Launch Button) | Skip | Go-based parallel launcher. pnpm scripts + task() delegation already cover this. |
| **CAAM** (Coding Agent Account Manager) | Skip | OAuth token management — not relevant. Jira/GitLab auth handled by existing env vars. |
| **RU** (Repo Updater) | Skip | Bash-based repo sync. Git + CI already handle this. |
| **Agent Mail** | Defer | Single contributor, sequential execution. Pre-work: swarmmail MCP is available when needed. |
| **Agent Farm** | Adopt patterns only | Lock-based coordination patterns are useful. Full VPS orchestration is overkill. |
| **flywheel_setup** | Build custom | Project-specific setup needs differ from VPS bootstrapping. |
| **Multi-model blending** | Skip | Single-model execution sufficient for domain-specific agents. |
| **85/15 planning ratio** | Already natural | 10 ADRs + Skills pattern already front-loads planning. |

---

## Part 5: Architecture Diagram — After Flywheel Integration

```
┌─────────────────────────────────────────────────────────┐
│                    FLYWHEEL LOOP                        │
│                                                         │
│  ┌──────────┐   ┌───────────┐   ┌──────────────────┐  │
│  │  PLAN    │──▶│  EXECUTE  │──▶│     VERIFY       │  │
│  │(Planner +│   │(Debugger +│   │ (UBS + DCG +     │  │
│  │ ADRs)    │   │ DevOps)   │   │  KGraph + CI)    │  │
│  └──────────┘   └───────────┘   └────────┬─────────┘  │
│       ▲                                   │            │
│       │         ┌───────────┐             │            │
│       └─────────│ REMEMBER  │◀────────────┘            │
│                 │ (Hivemind │                           │
│                 │  + CASS)  │                           │
│                 └───────────┘                           │
└─────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │            AGENT EXECUTION LAYER                │
    │                                                  │
    │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
    │  │Debugger  │  │  Jira    │  │   DevOps     │  │
    │  │(5 tools) │  │(5 tools) │  │  (5 tools)   │  │
    │  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
    │       │              │               │          │
    │       └──────┬───────┴───────┬───────┘          │
    │              ▼               ▼                   │
    │  ┌──────────────┐  ┌──────────────┐             │
    │  │   Visual     │  │ Investigate  │             │
    │  │  (4 tools)   │  │ (meta-skill) │             │
    │  └──────────────┘  └──────┬───────┘             │
    │                           │                      │
    │              ┌────────────┴────────────┐         │
    │              ▼                         ▼         │
    │  ┌──────────────────┐  ┌──────────────────┐     │
    │  │  Planner (NEW)   │  │  Debugger path   │     │
    │  │  (6 tools)       │  │  (existing)      │     │
    │  │  feature/task    │  │  bug/error       │     │
    │  └──────────────────┘  └──────────────────┘     │
    └─────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │              SHARED INFRASTRUCTURE               │
    │                                                  │
    │  ┌────────┐  ┌──────────┐  ┌────────┐          │
    │  │ KGraph │  │ Hivemind │  │ CASS   │          │
    │  │(Neo4j) │  │(semantic)│  │(session│          │
    │  │        │  │          │  │ search)│          │
    │  └────────┘  └──────────┘  └────────┘          │
    │                                                  │
    │  ┌────────┐  ┌──────────┐  ┌────────┐  ┌─────┐ │
    │  │ Beads  │  │   UBS    │  │ Biome  │  │ DCG │ │
    │  │(tasks) │  │ (scan)   │  │ (lint) │  │(cmd)│ │
    │  └────────┘  └──────────┘  └────────┘  └─────┘ │
    └─────────────────────────────────────────────────┘
```

---

## Part 6: Effort Estimates

| Phase | Effort | Dependencies | Risk |
|-------|--------|-------------|------|
| Phase 1: Quality Foundation | 3-4 days | None | Low — standard tooling |
| Phase 2: Safety & Verification | 2-3 days | Phase 1 (CI for hooks) | Low — DCG is install + configure |
| **Phase 2b: GlideReviewer** | **4-5 days** | Phase 1 (CI + tests) | **Medium** — new agent, 6 tools, quality standards |
| **Phase 3: GlidePlanner** ⭐ | **5-7 days** | Phase 1 (tests), KGraph running | **Medium** — new agent, 6 tools, skill design |
| Phase 4: CASS Integration | 1-2 days | None (CASS already available) | Low — additive change |
| Phase 5: Parallel Investigation | 2-3 days | None | Medium — data flow analysis |
| Phase 6: Enhanced Task Flow | 2-3 days | Phase 3 (planner + beads) | Low — incremental |
| **Phase 7: Workflow Commands** | **2-3 days** | Phases 2b + 3 | **Low** — skills only, no new code |
| **Total** | **22-30 days** | — | — |

---

## Appendix A: Flywheel Principles Already Present in glide-agents

1. **"85% planning / 15% coding"** — 10 ADRs, design doc, structured workflow. Already front-loaded.
2. **"Convert plans to beads"** — Beads/Hive integrated, 57 issues tracked.
3. **"Learn from every session"** — Three-Layer Learning Loop (ADR-009), Hivemind with 9,490 memories.
4. **"Show your work"** — Step Transparency pattern (ADR-004), structured RCA template.
5. **"Composable agents"** — Hybrid MCP + Skill pattern (ADR-002), 5 independent agents.

The flywheel's PHILOSOPHY is already deeply embedded. What's missing is:
- **VERIFICATION stage**: UBS (bug scanning) + DCG (destructive command guard) + CI pipeline
- **MEMORY stage**: CASS (cross-session search, not just RCA memories) + CM (three-layer memory promotion)
- **SAFETY layer**: No guard against destructive AI-generated commands (DCG fills this)

## Appendix B: Quick Reference — What Changes Per Phase

### Phase 1 New Files
- `biome.json`
- `.gitlab-ci.yml`
- `.lefthook.yml`
- `setup.sh`
- `glide-jira/test/tools.test.ts` (expand)
- `glide-visual/test/tools.test.ts` (expand)
- `glide-devops/test/tools.test.ts` (expand)

### Phase 2 New/Modified Files
- `.lefthook.yml` (add DCG pre-commit hook)
- `shared/src/kubectl-client.ts` (wrap with DCG validation)
- New: `shared/src/command-guard.ts` (DCG integration layer)
- New: `docs/decisions/011-safety-layers.md`
- `.gitlab-ci.yml` (expand UBS to scan Java files)

### Phase 3 Modified Files
- `glide-skills/glide-debugger/SKILL.md` (add CASS to Step 5)
- New: `shared/src/cass-integration.ts`

### Phase 4 Modified Files
- `glide-skills/glide-investigate/SKILL.md` (parallel step groups)
- New: `docs/decisions/012-parallel-investigation.md`

### Phase 5 Modified Files
- `glide-debugger/src/tools/persist-rca.ts` (auto-create beads)
- `glide-jira/src/tools.ts` (KGraph priority scoring)
- New: `shared/src/hive-jira-sync.ts`
