# Building Support Agents for Your Platform

*Support volume for an API platform spans how-to questions, account issues, and deep technical errors with traceIds. Here is how enterprises build multi-agent support systems that cover it all — architecture, knowledge pipelines, deployment, determinism, scaling, cost, and the open source to assemble it from.*

---

Support volume for an API platform arrives in three very different shapes. Most tickets are **how-to questions** — how to authenticate, paginate, find a feature in the UI. A steady stream is **account work** — billing confusion, plan changes, access problems. And the hardest slice is **technical failures**: *"Your API returned 500. Here's the traceId: `a4f8...`. I was calling `POST /v2/orders`."* No reproduction steps, no payload — just artifacts and an expectation that you'll figure it out.

Today these land in one human queue, where an engineer pivots between docs, logs, and traces for thirty minutes per ticket. Every piece of that work is mechanical except the judgment at the end — which makes support exactly the kind of workflow enterprises are now handing to **multi-agent systems**: one front door, specialized agents behind it, humans for what genuinely needs humans. This post walks through the architecture that keeps such a system trustworthy, what Salesforce, Intercom, Sierra, and Klarna learned building theirs, and the open source you can assemble today.

## The core insight: orchestration is the system

The most instructive enterprise write-up comes from Salesforce's Agentforce team, and their conclusion generalizes: **the model is not the system — the orchestration is**. They call their approach *guided determinism*, and it rests on a distinction every troubleshooting agent needs.

An LLM reasoning freely about a customer's error is probabilistic. But the workflow around it — *verify the customer, fetch the trace, check auth errors before suggesting bug reports* — must be deterministic. Salesforce models each business process as a graph of nodes where some transitions are guarded by hard validation gates. Their slogan is worth stealing: each node is *"a deterministic exit despite probabilistic internals"* — the node thinks locally, but the graph guarantees the path globally.

They also codified the two ways agents cooperate, which map directly onto a support architecture:

- **Handoff** — one agent passes full context to another and exits (triage hands a confirmed billing issue to the billing specialist).
- **Delegation** — an orchestrator farms subtasks out to specialists in parallel and synthesizes results (one question needing both docs and logs fans out to both).

## The reference architecture

General support decomposes into specialist lanes behind one entry point — how-to questions, account work, and deep technical failures each get an agent with its own tools:

> 📈 **multi-agent support topology** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/).

Each specialist has a narrow contract:

- **Triage** classifies intent and extracts structured artifacts (endpoint, status code, traceId, timestamp, tenant identity), validating them against the OpenAPI spec where relevant. It routes; it never investigates.
- **How-to agent** handles the majority of volume — usage questions about the API and UI — answering purely from the knowledge-base pipeline with mandatory citations.
- **Account agent** resolves billing, plan, and access questions using narrowly-scoped read tools; anything touching money moves to a human.
- **Docs agent** answers "what is this endpoint supposed to do, and which error codes are documented?" via retrieval over your OpenAPI spec and documentation.
- **Observability agent** owns the traceId. It fetches the distributed trace, identifies the failing span and service, pulls correlated logs, and reports findings — read-only.
- **Knowledge agent** searches known issues and historical resolutions; a surprising share of tickets match something already fixed.
- **Synthesis** correlates specialist reports into one answer with next steps — and is explicitly allowed to say "we need a human."

The end-to-end flow for our opening ticket looks like this:

> 📈 **from '500 with a traceId' to a root-cause answer** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/).

### The platform at a glance

Zoom out one level and the whole system is four swappable bands — channels, the agent platform itself, a capability plane of tools and engines, and state stores. Read it as a plug-and-play map: providers change behind the gateway, MCP servers come and go per capability, engines attach from the side, and nothing outside the platform band knows an LLM is involved.

> 📈 **support agent platform — containers view** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/).

## The traceId is the whole ballgame

This is the deepest lane in the topology — most volume never reaches it, but when a ticket arrives carrying correlation artifacts, automation has everything it needs.

The reason this works at all is that the customer hands you a correlation key. A traceId collapses "search millions of log lines" into "fetch one trace and its neighbors." Three pieces of infrastructure make it agent-ready:

**Trace-to-log correlation.** Your tracing backend must link spans to log lines sharing the trace ID, with a small time-window shift (±2s is the common starting point) because span timestamps are millisecond-precise while log lines land slightly outside them. If your services don't inject trace IDs into logs yet, fix that first — no agent can compensate for missing correlation.

**MCP servers over your observability stack.** This is the newest and most important piece. Grafana ships a production MCP server exposing Loki queries, Tempo TraceQL, `get-trace` by ID, Sift investigations (automated error-pattern and slow-request detection), and datasource metadata as agent tools. Tempo's own MCP server exposes `traceql-search`, `get-trace`, and attribute discovery — and notably serves an LLM-optimized response format (`Accept: application/vnd.grafana.llm`) that strips detail to fit traces inside a context window. Standalone `loki-mcp` servers exist if you run just Loki. Your agent doesn't screen-scrape a dashboard; it calls the same tools your engineers do.

**Query guardrails.** The Grafana MCP server's defaults encode hard-won lessons: log-line limits per query, and a *guardrail mode* that blocks unselective LogQL queries — because a broad selector over a wide time range can scan terabytes, and an LLM will absolutely try that. Enforce selective stream selectors, cap time ranges, and reject-with-guidance so the model learns to narrow its own queries.

> **REALITY CHECK:** Tenant isolation is non-negotiable. The observability agent must scope every query to the calling customer's tenant (in Loki terms, the org/tenant header) using identity resolved server-side at triage — never a tenant name the customer typed. A support agent that can read another tenant's logs is not a support agent; it's an incident.

## The knowledge-base pipeline: teaching customers your API and UI

Troubleshooting is only half the support volume. The other half is *"how do I...?"* — how to authenticate, how to paginate, which UI screen exports data, whether the API supports idempotency keys. This is a second agent with a different engine behind it: not logs and traces, but a **knowledge-base pipeline** that turns your documentation into a grounded answer machine.

The pipeline has two halves. Ingestion runs whenever your docs change; retrieval runs on every question.

```text
Ingestion:   Sources → Normalize → Chunk → Embed → Index (+ metadata)
Retrieval:   Question → Hybrid search → Rerank → Filter by metadata → Grounded answer + citations
```

> 📈 **Diagram** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/).

### Sources: each one earns its place

| Source | What it answers | Gotcha |
| --- | --- | --- |
| OpenAPI spec |  | Never hand-summarize it; chunk per operation so contracts stay intact |
| API guides & tutorials |  | Duplicates spec content — dedupe or the agent cites both inconsistently |
| UI help center |  | Screenshots age fast; tag chunks with UI version or release |
| Changelog / release notes |  | Must be version-filtered or old breaking-change notes mislead |
| SDK samples |  | Keep snippets whole — splitting code across chunks destroys it |
| Resolved support tickets |  | PII scrubbing before anything enters the index |

### The three decisions that make or break it

**Chunk along the spec's seams, not fixed character counts.** A naive 500-token splitter cuts an endpoint definition mid-schema. Instead: one OpenAPI operation = one chunk (path, method, parameters, responses together); markdown chunks follow headings and carry their breadcrumb ("Guides → Authentication → Rotating keys") as metadata; code blocks never split. Retrieval quality is decided here more than in any model choice.

**Metadata is the real retrieval power tool.** Every chunk carries `api_version`, `product_area`, `audience` (`api-developer` vs `ui-user`), and `updated_at`. At query time these become filters: a customer on v2 of the API should never see a v1 answer; a UI question shouldn't retrieve endpoint schemas. This single design choice eliminates the most common failure mode — confidently correct answers for the wrong version.

**Freshness is a deployment event, not a cron job.** Hook re-indexing into the same CI pipeline that publishes your docs and spec: merge to main → docs build → re-embed changed chunks → swap index. Stale documentation silently poisons every downstream answer, and a nightly job means up-to-24-hours of wrong guidance.

### Query time: hybrid search and honest refusals

Pure vector search fails on exactly the things users ask about — exact error codes, field names, HTTP verbs are keyword matches, not semantic ones. Run **hybrid retrieval**: BM25 keyword search plus embedding similarity, merged and reranked. Then two rules for generation:

- **Citations are mandatory.** Every claim links to the doc section it came from. This lets customers verify, and lets you audit *why* the agent said what it said.
- **Refusal is a feature.** When retrieval confidence is low or sources conflict, the agent says so and offers the human path — the same escalation contract as the troubleshooting side. Intercom's Fin behaves this way by defaulting to Help Center grounding and escalating when nothing solid matches; the pattern transfers directly.

Finally, close the loop with evaluation: maintain a golden set of real customer questions with known-correct answers, and run it on every docs change and prompt tweak. A KB agent without regression evals degrades silently as content evolves.

### The zero-infrastructure starting point: a git repo of markdown

Before choosing any platform, note that the open knowledge format already exists and you're looking at it every day: **a git repository of markdown files**. Folders are metadata, filenames are titles, git is versioning and review, and a merge is the re-index trigger. Every serious tool ingests it natively — RAG platforms index it, LlamaIndex reads it, and an MCP filesystem server exposes it to agents directly with zero conversion:

```text
knowledge-base/
  how-to/                  # majority-volume lane
    authentication.md
    pagination.md
    ui-export-data.md
  product/
    feature-list.md
    integrations.md
    release-notes/
  pricing/
    trial-policy.md
    enterprise-onboarding.md
  support/
    common-issues.md       # retrieval corpus
    escalation-rules.md    # agent POLICY — see below
  api/                     # OpenAPI spec lives here too (machine truth)
```

Two upgrades turn this from a folder into a knowledge base. First, **YAML frontmatter per file** makes routing explicit instead of inferred-from-path:

```yaml
---
title: Trial policy
audience: customer      # customer | support | internal
lane: account           # how-to | account | technical
product_area: billing
api_version: v2         # only when version-specific
updated: 2026-08-24
---
```

Second, **separate the two kinds of markdown**. Most files are *corpus* — content the agent retrieves and cites to customers. A few are *policy* — `escalation-rules.md` tells the agent how to behave (when to hand off, what never to promise). Policy files belong in the same repo for review and versioning, but they get injected into system prompts, never indexed for retrieval — quoting your escalation rules back at a customer is a leak, not an answer.

This repo then plugs into anything: your own pipeline (CI merge → re-embed changed chunks), a platform's connector, or an MCP filesystem server for direct agent access. When sources beyond markdown arrive — PDFs, scanned docs, Confluence — add a parser (Docling, Unstructured) or adopt a platform's ingestion rather than changing the format. Markdown-plus-git scales further than teams expect, and if it ever truly doesn't, the format migrates into any platform's ingestion unchanged.

> **KEY INSIGHT:** One knowledge base, two audiences: the same indexed corpus serves both the troubleshooting flow (the docs agent cites endpoint contracts during RCA) and a standalone "how do I" assistant for customers exploring your API and UI. Build the pipeline once; the `audience` metadata filter routes it.

## What the enterprises learned

**Salesforce (Agentforce)** contributes the runtime philosophy: graph-shaped orchestration with validation gates, specialized subagents instead of one generalist, fine-tuned routing models, and deep per-conversation traces so engineers can see which subagent took which action. Their testing story matters as much as the architecture — synthetic utterances at scale, scored by LLM judges, before a real customer ever reaches the agent.

**Intercom (Fin)** shows what the failure modes actually look like in production. Their debugging model is refreshingly concrete: every procedure step emits *"Fin's thoughts"* events explaining its reasoning; connector failures are classified (auth vs network vs response-mapping); and their top recommendation for flaky integrations is structural — make the external API return a fallback value instead of an error, so the agent always has something actionable rather than improvising. The lesson: design your platform's APIs for agent consumption, not just human consumption.

**Sierra** built Agent Traces on the observation that traditional logs show inputs and outputs, while agents need the *decision path* in between — which tool was chosen, what alternatives existed, whether conflicting instructions pushed it off course, and how many milliseconds each step cost. For a support product, latency is UX; per-step timing is how you keep voice-grade responsiveness.

Beyond those three engineering write-ups, the deployment record is broad enough to read as an industry pattern rather than a novelty:

| Enterprise | What they shipped | Documented outcome |
| --- | --- | --- |
| Klarna | OpenAI-powered assistant handling service chats end-to-end across 23 markets, 35 languages | 2.3M conversations in month one (~2/3 of chats); work of ~700 full-time agents; repeat inquiries down 25%; resolution time 11 min → under 2 min; est. $40M profit improvement |
| LinkedIn / Uber | Production agent workloads on LangGraph's graph orchestration | Cited as reference production deployments for stateful, durable agent workflows |
| Coinbase / Box | Agents prototyped and deployed on the OpenAI Agents SDK | Days-not-weeks deployment timelines using handoffs, guardrails, and built-in tracing |
| BlackRock / JPMorgan / Cisco | Regulated-industry agent workloads on graph-based runtimes | Audit trails and checkpoint semantics as the deciding factor over role-based frameworks |

Two readings of that table matter. First, Klarna proved the **volume ceiling**: month-one numbers settled whether AI support could carry high-volume customer service (it could — though the 700 figure counts avoided hires, not replaced staff, and by 2025 Klarna publicly rehired humans for complex, emotionally charged tickets; the lesson isn't "AI failed," it's that volume and complexity ceilings are different ceilings — which is precisely why the determinism stack and escalation paths above exist). Second, *the regulated industries chose graph orchestration*, not because it's fashionable but because audit trails and deterministic gates are what their compliance teams demand — the same determinism stack described above. One clarification the tables can't show: Klarna's assistant was OpenAI-powered at the model layer and later migrated orchestration to LangGraph — provider and framework are different layers, not competing claims.

The common thread across all of these: **agent observability is a first-class product surface**, not an afterthought. If you can't replay why your agent said something, you can't operate it.

## Choosing the orchestration framework

The framework landscape has consolidated into four viable options (plus one to avoid):

| Framework | Model | Strengths | Watch out for |
| --- | --- | --- | --- |
| LangGraph | Directed graph over typed state | Checkpointing/durable execution, human-in-the-loop gates, time-travel debugging, LangSmith tracing; runs at Klarna, Uber, LinkedIn | Steepest learning curve; most verbose |
| CrewAI | Role-based crews | Fastest prototyping; native MCP + A2A; visual editor; huge community | ~8–35% token overhead from role prompts (one 2026 benchmark's midpoint); harder to debug complex flows |
| OpenAI Agents SDK | Minimal handoff chains | Five clean primitives (agents, handoffs, guardrails, sessions, tracing); first-class MCP; fastest hello-world | OpenAI-first; no durable checkpointing; simple chains only |
| Claude Agent SDK | Batteries-included Claude toolkit | Native tool use, MCP, and subagents; smoothest path on Claude | Committed to one provider |
| AutoGen / AG2 | Agent conversations | Great for research and debate-style reasoning | In maintenance mode; not recommended for new production work |

The industry's dominant pattern is two-phase: prototype the crew in whatever gets you answers fastest, then move the production-critical path to a framework with durable state once requirements harden. For a support agent specifically, the deciding questions are: does it hold state across a long investigation (→ checkpointing), do you need approval gates before certain answers ship (→ human-in-the-loop), and can you trace a bad answer back to the exact step (→ observability)?

## The open-source assembly kit

Nothing here requires a proprietary platform. The stack assembles from:

| Block | Project | What it gives the agent |
| --- | --- | --- |
| Logs | Grafana MCP server / loki-mcp | LogQL queries, label discovery, pattern analysis, stats — with cost guardrails |
| Traces | Tempo MCP server | TraceQL search, get-trace by ID, attribute discovery, LLM-optimized trace format |
| Auto-investigation | Grafana Sift (via MCP) | Elevated error-pattern detection, slow-request analysis without hand-written queries |
| Orchestration | LangGraph / CrewAI / OpenAI Agents SDK | Routing, delegation, state, guardrails, tracing |
| API knowledge | RAG over your OpenAPI spec | Endpoint contracts, documented error codes, request/response schemas |
| Instrumentation | OpenTelemetry | The trace IDs and correlated logs the whole system depends on |

## Deploying and operating the agents

An agent is not a chat prompt living in someone's IDE. Treat every agent as a **versioned configuration artifact**: system prompt, tool allowlist, pinned model, guardrail thresholds, escalation rules — one declarative file per agent, reviewed in git like any other production config. The deployment unit is the config, not the code; the orchestration runtime stays stable while agent definitions iterate.

Deployment shape follows from workload shape. Triage sits on the synchronous request path — it must answer routing decisions in milliseconds. The investigation leg is different: fetching traces, querying logs, correlating findings takes tens of seconds, which is far past what an HTTP request should hold open. So investigations run **queue-backed**: triage accepts the ticket, enqueues the investigation, and the customer gets an async answer via webhook or polling — the same 202-pattern discipline as any long-running job.

Every investigation is itself a stateful run you can observe end to end:

> 📈 **investigation run lifecycle** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/).

> **KEY INSIGHT:** Rollout is a pipeline, not a flip: config change lands in git → golden-set evals gate the merge → new version runs in shadow mode beside production (same inputs, logged outputs, no customer sees it) → canary percentage → full traffic. Rollback is `git revert`. If you cannot answer "which agent version answered this ticket, with which prompt?", you are operating on vibes.

Two operational disciplines separate toys from production systems here. First, **secrets scoping**: the observability agent's MCP credentials are read-only and environment-scoped — staging investigations never touch production log indexes. Second, **trace everything**: every subagent invocation records its inputs, tool calls, token spend, and latency as a structured trace (Salesforce's per-conversation execution traces and Sierra's Agent Traces both exist because "the agent seemed confused" is undiagnosable without them).

## Implementation structure: an agent is a module, not magic

Concretely, each agent in the repo is a small, boring package:

```text
agents/
  triage/
    agent.ts          # definition: model, instructions, handoff targets
    tools.ts          # typed tool functions (validate_endpoint, resolve_tenant)
    schema.ts         # structured output contract (JSON Schema)
    prompts/*.md      # versioned prompt templates
    evals/golden.json # questions + expected answers for this agent
  observability/
    agent.ts
    tools.ts          # get_trace, query_logs — thin clients over MCP
    ...
orchestrator/         # graph wiring, routing, budgets — no business logic
shared/               # MCP clients, provider gateway, redaction utils
```

Three rules keep this sane. **Tools are just typed functions** — the same discipline as any internal API client, with schemas that double as the LLM's function-calling contract. **Prompts live in files**, reviewed in pull requests, never inline strings. **The orchestrator holds no business logic** — routing, budgets, and delegation only — so specialists stay independently testable.

## Yes — deploy it like a normal backend service

The honest answer to "is this special?" is no. The agent runtime is a **stateless containerized worker service** behind your existing ingress and queues, scaled on queue depth and CPU exactly like any other backend component. Nothing about an LLM call requires new infrastructure — it's an outbound HTTP call to a provider, best routed through a small gateway sidecar that centralizes rate limiting, retries, cost attribution, and logging for every model call in one place.

The only architectural rule that matters: **the runtime stays stateless; all state lives in databases** (next section). A worker pod dying mid-investigation loses nothing because run state was checkpointed externally — which is precisely why the framework choice (checkpointing support) mattered earlier.

> 📈 **where agents sit in a classic backend landscape** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/).

## CI/CD: prompts get the same pipeline as code

A workable agent pipeline has two tracks merging into one gate:

1. **Code track** — unit tests for tools (mocked MCP responses), schema validation tests, integration test of the orchestrator graph with recorded fixtures.
2. **Prompt/config track** — every prompt or model change runs the agent's golden-set evals in CI; scores below threshold block the merge exactly like a failing unit test.

Both land in the same artifact: a versioned config bundle. Promotion then follows one gate and three stages:

> 📈 **agent CI/CD — two tracks, one gate** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/).

## Composing with workflow engines: Kestra, Temporal, Camunda

The sharpest question backend teams ask: *do agent frameworks replace our workflow engines?* No — they solve different halves, and the composition is where systems get good:

| Engine | Sweet spot with agents | Concrete example |
| --- | --- | --- |
| Kestra | Event-driven data pipelines around the agent — not the reasoning itself | Docs merge triggers KB re-index flow: chunk → embed → swap index → run eval suite → report regressions |
| Temporal | Durable execution of long, resumable investigations with retries and signals | One workflow per investigation: activities wrap tool calls; crash resumes from last checkpoint; human approval arrives days later as a signal |
| Camunda | BPMN human-in-the-loop processes with SLAs and audit requirements | Escalation process: agent output → review task → approve/reject → notify customer, fully auditable |

The division of labor that works in practice: **the agent framework decides what the model does next within a node; the workflow engine guarantees what happens between nodes and after failures.** Don't let the LLM own control flow that must be auditable, and don't hand-roll retry/checkpoint machinery that Temporal provides natively. A pragmatic split many teams land on: Temporal (or similar) supervises the investigation workflow; the agent framework runs *inside* one activity; Kestra handles the scheduled/event-driven plumbing (KB indexing, eval sweeps, nightly quality reports); Camunda owns escalation processes where humans sign off.

## What state lives in which database

Agent systems add three new state categories to a classic backend — none of them belong in your system-of-record RDBMS's core tables, but most of them still fit in Postgres:

| State | Store | Why |
| --- | --- | --- |
| Conversation/session context | Redis (with TTL) | Ephemeral by nature; expiration IS the retention policy |
| Run checkpoints / workflow state | Postgres (framework checkpointer) or Temporal's persistence | Durable, resumable, queryable for debugging — but operational, not business data |
| KB vector index | pgvector, Qdrant, or Elasticsearch | pgvector if Postgres-native simplicity wins; dedicated vector DB when scale/filtering demands it |
| Tickets, answers, feedback, eval results | Postgres | This IS business data — quality metrics and audit history worth keeping forever |
| Tool-call audit log | Append-only table or log platform | Every query the agent ran, scoped to whom — compliance reads this daily |
| Retrieval / known-issue caches | Redis | Cost lever from the scaling section; TTL-bounded staleness |

The boundary rule from the caching world applies verbatim: **durable truth lives in the RDBMS; agent state is operational data with TTLs and rebuildability.** If losing a store would corrupt customer trust rather than merely slow responses, it was never agent state to begin with.

## Engineering determinism

"Make the agent deterministic" is really five layered techniques, each buying certainty in a different place:

| Layer | Technique | What it guarantees | Cost |
| --- | --- | --- | --- |
| Structural | Graph topology with validation gates between nodes | Workflow path is fixed regardless of what the model says — verification nodes cannot be persuaded | Less conversational freedom; more upfront design |
| Interface | Structured outputs (JSON schema) and typed tool contracts | Downstream code parses agent output reliably; malformed findings rejected at the boundary | Occasional retries when output fails schema validation |
| Inference | Temperature 0, pinned model versions, fixed prompts | Reproducible behavior within a model version — no silent drift from provider updates | Pinning means missing new model improvements until you choose to upgrade |
| Behavioral | Golden-set evals as CI regression tests; replay real tickets from traces | Known questions keep producing known-good answers after every change | Maintaining the question set is ongoing work |
| Operational | Read-only, idempotent tools with bounded parameters | Even a wrong decision causes no side effects and no runaway cost | Agent cannot fix anything itself — by design |

This is Salesforce's *"deterministic exit despite probabilistic internals"* made concrete: you cannot make the model deterministic, but you can make its **boundaries** deterministic — where it may go, what shape it must return, which answers ship. The honest trade-off: every layer you add trades flexibility for reliability. A fully-pinned, fully-gated agent handles novel situations worse than a free one — which is exactly why the escalation path exists. Determinism engineering is about choosing *where* flexibility lives, not eliminating it.

## Scaling: what actually grows

Multi-agent support has an uncomfortable arithmetic: one ticket fans out into a triage call plus three specialist investigations, each making multiple tool calls, each tool call potentially triggering another reasoning round. A single hard ticket can mean on the order of 15–30 LLM invocations (illustrative, not measured). Four levers keep that bounded:

1. **Short-circuit before the model.** A known-issue hash match (error signature → existing resolution) skips every LLM call. In mature platforms this resolves a meaningful share of tickets for free.
2. **Tier the models.** Triage and routing run on small fast models; only synthesis earns the frontier model. Salesforce built dedicated fine-tuned routing models for exactly this reason — one budget does not fit all tasks.
3. **Cap concurrency per tenant.** One customer submitting fifty tickets must not monopolize provider quota and starve everyone else — the same per-tenant fairness rule Redis-based import systems use.
4. **Degrade gracefully under pressure.** When provider rate limits bite, the queue absorbs the load and answers arrive slower — never partially. Per-agent timeouts mean a hung log query degrades the answer to "docs + known issues found nothing unusual; escalating with context" instead of hanging the whole investigation.

Latency composes the same way: delegation runs specialists in parallel, so wall-clock time is the slowest specialist, not the sum. Streaming the synthesis keeps perceived responsiveness acceptable even when the full investigation takes half a minute.

## The cost model

Per-ticket cost is arithmetic you can actually control. An illustrative investigation spends roughly 30–80K tokens end-to-end: triage is cheap (small model, ~1–2K tokens), but each specialist re-sends accumulated context on every reasoning round, and tool results — log lines, trace spans, doc chunks — all land in the input window. **Input tokens dominate the bill**, which is why the scaling levers above matter more than output length.

| Lever | Mechanism | Typical impact |
| --- | --- | --- |
| Known-issue short-circuit | Error-signature hash match resolves without any LLM call | Removes an entire class of tickets from the bill entirely |
| Model tiering | Small models for routing/extraction; frontier only for synthesis | Largest single reduction — most steps don't need frontier reasoning |
| Context discipline | LLM-optimized trace formats, log-line limits, chunk-level retrieval instead of whole pages | Directly shrinks the dominant input-token cost per round |
| Retrieval caching | Cache doc-chunk and known-issue lookups by query signature | Cuts repeated embedding/search spend across similar tickets |
| Budget guardrails | Per-run token budgets, per-tenant daily caps, cost attributed per agent step | Doesn't save money — prevents surprises; attribution shows which agent burns it |

Attribute cost per agent step, not per ticket — otherwise you're optimizing blind. The frameworks' tracing layers (LangSmith, OpenAI tracing) all provide this; treat cost-per-resolution as the headline metric and cost variance as the early-warning signal.

## LLM providers: one vendor is a single point of failure

A support agent is production infrastructure, and infrastructure with exactly one model provider inherits that provider's outages, price changes, and silent capability shifts. Three practices de-risk it:

**Route through an abstraction.** Framework-native adapters (LangGraph and CrewAI are model-agnostic; CrewAI routes via LiteLLM) or a standalone gateway let you swap providers per agent role without touching orchestration code. The OpenAI Agents SDK's tightest integration is also its lock-in — fine for prototypes, a liability for production support.

**Match provider to task, not to brand.** Model tiering generalizes across vendors: a fast small model from any provider handles triage; the synthesis agent earns the strongest reasoner you can afford; the observability leg may demand a *self-hosted open-weight model* purely for data-policy reasons — sending raw customer logs to a third-party API is exactly the perimeter question the guardrails section raises.

**Build fallback chains — then test them.** Primary provider fails or rate-limits → route to secondary. But models differ in behavior, not just price: an answer chain validated only on your primary is untested the day it fails over. Golden-set evals must run against every provider path you intend to serve, or your fallback is theoretical.

## Multi-cloud and data residency

Support agents occupy a niche where multi-cloud stops being fashion and becomes compliance: the logs and traces they read are customer telemetry, and residency rules may require EU customer investigations to touch only EU-hosted infrastructure. Two patterns dominate:

- **Region-pinned deployment:** agent workers run in-region, call provider endpoints in-region, and the observability stack stays where the data lives. You move the *model call* to the data's jurisdiction — never ship the data to the model.
- **Cloud-managed agent runtimes:** if you're already committed to a cloud, managed options (Amazon Bedrock Agents, Google ADK, Azure OpenAI) keep models, storage, and governance inside one vendor's compliance boundary — trading flexibility for auditability.

The honest counsel: true active-active multi-cloud for agents multiplies your operational surface for a rare failure mode. Most teams get 90% of the value from **one cloud + one alternate provider route** (the fallback chain above) plus region pinning where law requires it. Reserve full multi-cloud for jurisdictions that mandate it.

## Failure modes: what goes wrong and how you know

| Failure | Detection signal | Mitigation |
| --- | --- | --- |
| Hallucinated root cause | Answer cites no retrievable evidence; customer replies 'that endpoint doesn't exist' | Mandatory citations; refusal below retrieval-confidence threshold |
| Runaway investigation (cost bomb) | Token spend per ticket spikes; step count hits limits | Hard step/token budgets per run; circuit breaker halts and escalates |
| Prompt drift after an edit | Golden-set scores drop on merge | Eval gate blocks promotion; shadow-mode diff before canary |
| Stale knowledge answers | Cited doc sections older than last release; customers report outdated guidance | CI-hooked re-indexing; freshness metadata surfaced in answers |
| Cascading subagent timeouts | p99 investigation duration climbing; partial-finding answers increase | Per-agent timeouts; synthesize from whatever completed; escalate the rest |
| Cross-tenant data exposure | Audit log shows query outside caller's scope — target: zero, ever | Server-side identity injection; read-only scoped credentials; audit every query |
| Over-confident wrong answers | Escalation rate drops while CSAT drops — the agent stopped admitting uncertainty | Calibration checks on confidence scores; reward honest escalation in evals |

That last row deserves emphasis: the most dangerous failure mode is quiet. An agent that escalates often is annoying but safe; an agent that learned to always sound confident is a liability wearing a success metric. Track escalation rate alongside satisfaction — divergence between them is your early-warning system.

## Guardrails: what the agent must never do

The constraint list is shorter and more important than the feature list:

1. **Read-only tools.** The support agent observes; it never mutates. No retries on the customer's behalf against production, no config changes, no data writes. If a fix requires action, the output is instructions or an escalated ticket — not an executed change.
2. **Server-side tenant scoping.** Identity resolved from authentication at triage, injected into every downstream query. Tenant identifiers from the customer's message are hints, never credentials.
3. **PII discipline end-to-end.** Traces and logs routinely contain tokens and personal data. Redact before data reaches any LLM provider, and prefer self-hosted models for the observability leg if policy demands it — the Tempo docs themselves warn teams to review what tracing data leaves the perimeter.
4. **Bounded curiosity.** Query limits, time-range caps, and selective-selector enforcement on every log tool — both for cost and to stop the model from wandering into scan-the-world queries.
5. **Honest escalation.** Confidence thresholds below which the agent stops synthesizing and hands a fully-contextualized ticket to a human. A wrong confident answer costs more than a slow human handoff — Intercom's connector fallback pattern (always give the agent something structured to act on) applies to your own escalation design too.

> **KEY INSIGHT:** The maturity ladder in practice: start with retrieval-only over docs and known issues (no log access). Add trace-by-ID lookup once correlation infrastructure is solid. Add open-ended log querying last, with guardrails on. Each rung earns the next by demonstrating it can cite evidence instead of hallucinating causes.

## Further reading

- [Salesforce Engineering — Building enterprise AI agents that are autonomous and reliable](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/)
- [Salesforce Engineering — Agentforce's Agent Graph: Toward Guided Determinism (Jan 2026)](https://engineering.salesforce.com/)
- [Sierra — Agent Traces: getting to the fix, fast](https://sierra.ai/blog/agent-traces)
- [Klarna — AI assistant handles two-thirds of customer service chats in first month](https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/)
- [Intercom — Troubleshooting Fin procedures and data connectors](https://www.intercom.com/help/en/articles/13704396-troubleshooting-fin-procedures-and-data-connectors)
- [Grafana MCP server](https://github.com/grafana/mcp-grafana)
- [Tempo MCP server documentation](https://grafana.com/docs/tempo/latest/api_docs/mcp-server/)
- [Tempo and AI — LLM-optimized endpoints](https://grafana.com/docs/tempo/latest/introduction/tempo-and-ai/)
- [grafana/loki-mcp](https://github.com/grafana/loki-mcp)
- [Grafana — Configure trace-to-logs correlation](https://grafana.com/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/)
- [AgentsCamp — Which agent framework in 2026?](https://agentscamp.com/guides/concepts/agent-frameworks-2026)

---

*Originally published with interactive diagrams at [buianhtai.dev](https://buianhtai.dev/en/blog/building-support-agents-for-your-platform/)*
