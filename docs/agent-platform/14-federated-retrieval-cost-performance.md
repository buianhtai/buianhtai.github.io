# 14 — Federated Retrieval, Cost Governance, and Performance for Configurable Agents

**Status: proposed reference architecture — not an implemented capability, benchmark, cost estimate, or production SLO.** This chapter extends the [plug-and-play product blueprint](./13-plug-and-play-platform-blueprint.md), [adapter SPI](./08-plugin-and-adapter-architecture.md), [runtime ownership](./02-runtime-workers-and-events.md), and [reliability/operations](./09-scalability-reliability-and-operations.md).

## Executive value proposition

The platform is a **shared governed capability layer**, not just a chat UI around an LLM. A user can configure a versioned agent to use approved models, skills, knowledge sources, tools, triggers and specialists. Operators install/review reusable connectors once; agent authors bind only eligible capabilities; the shared backend enforces permission, run/cost limits, deadlines, provenance and audit.

Its benefit increases as **more agents share common source connectors, retrieval, runtime management, evaluation and governance**. Extra control-plane infrastructure adds fixed cost and latency; a small single-purpose script may remain cheaper and simpler. Do not claim any ROI or speedup without comparative measurements.

| Product advantage | Demonstrable proof |
| --- | --- |
| Configurable agents, stable core | Bind a second reviewed source without changing the agent execution loop |
| Cross-source evidence | One answer cites distinct authorized sources with timestamps and per-claim provenance |
| Central budgets | One policy limits model tokens, external requests, source fan-out, worker time and spending |
| Latency reduction | Bounded concurrent retrieval is faster than equivalent sequential calls at measured p95 under comparable load |
| Security/reliability | Revoked access denied even with cached/indexed data; slow source isolated; results resumable after reconnect |
| Model neutrality | Cheaper/stronger approved model profiles selected by task; safety and evaluation gates govern fallback |

## Architectural rule: retrieval ≠ reasoning ≠ source authorization

**Prefer one scoped agent with a federated retrieval operation** over an independent LLM agent for each data source. Create child agents only when tasks require genuinely independent reasoning, ownership, or long-running asynchronous execution.

A **Federated Retrieval Coordinator** is a **logical capability**, not a mandatory new deployment. An MVP could implement it inside the existing Knowledge/Tool Gateway and a read-focused worker. It delegates execution to reviewed **SourceConnectorAdapter** implementations through established read-only ports; live source calls still pass the Tool Gateway's authorization, quotas and audit checks. The coordinator cannot create new grants.

~~~mermaid
flowchart LR
  U["User / verified trigger"] --> API["Platform API<br/>principal + run admission"]
  API --> POLICY["Eligible AgentVersion<br/>source bindings + budgets"]
  POLICY --> PLAN["Retrieval Planner<br/>scope + route + deadlines"]
  subgraph READ["Bounded federated read plane"]
    PLAN --> I["Indexed / KB search<br/>authorized metadata filters"]
    PLAN --> L["Live typed APIs<br/>fresh authoritative records"]
    PLAN --> H["Hybrid keyword + vector<br/>restricted searchable corpus"]
  end
  I --> MERGE["Normalize + permission check<br/>deduplicate + rerank"]
  L --> MERGE
  H --> MERGE
  MERGE --> EVIDENCE["Bounded evidence pack<br/>citations + timestamps"]
  EVIDENCE --> DECIDE{"Deterministic result enough?"}
  DECIDE -->|"Yes"| OUT["Verified response"]
  DECIDE -->|"No"| MODEL["Approved model profile<br/>limited synthesis tokens"]
  MODEL --> OUT
  OUT --> EVENTS[("Run + event + cost ledger")]
  EVENTS --> API
  API --> U
~~~

### The three data-access paths

| Mode | Recommended for | Freshness / latency / cost trade-off |
| --- | --- | --- |
| **Indexed KB** | Manuals, wiki pages, approved reports | Fast bounded reads; storage and ingestion costs; explicit index lag and ACL synchronization |
| **Live connector** | Ticket status, inventory, permissions, operational records | Source-of-truth freshness; network/API fees, rate limits, transient outages and higher tail latency |
| **Hybrid** | Questions mixing exact codes/names and conceptual documents | Keyword + semantic search, result fusion (e.g. RRF) and optional reranking; relevance can improve but compute rises |

Do not blindly ingest every third-party source or use RAG indexes as authorization authorities. Some providers restrict replication, retention or residency. A source's API authorization and policy are authoritative for live reads; an index must carry enforceable source ACLs, data classification, change/version evidence and revocation behavior. No unrestricted cross-tenant/region shared evidence caches.

## One run: source selection, retrieval, synthesis

1. **Admit and authenticate.** Resolve caller, tenant, workspace and eligible published agent revision. Pin a source/capability-binding snapshot and enforce current revocations.
2. **Classify the question cheaply.** Deterministic target/ID extraction and source rules first; optional economical router only for ambiguous intent. An automatic router sees only eligible sources. Do not call a large model to decide every obvious connector.
3. **Plan a source subset.** Prefer the minimum relevant sources, not all configured connectors; select live vs indexed mode based on requested freshness and source metadata. Reject queries that cannot be authorized.
4. **Reserve budgets.** Before fan-out, acquire capacity and reserve worst-case model/tool/query budgets. Apply global deadline, per-source timeout, bounded concurrency and per-provider quotas.
5. **Perform scoped retrieval concurrently where independent.** Each connector checks its own authorization and returns typed records with source/version/timestamp, secure document ref, ACL metadata, freshness and pagination cursor. Retry safe reads only with bounded backoff.
6. **Normalize, deduplicate and rank.** Distinguish exact identifier matches from semantic matches. Combine source-local ranks with RRF when appropriate; optionally rerank the shortlisted accessible candidates. Do **not** average incomparable raw relevance scores.
7. **Bound evidence.** Select snippets under a token/bytes/chunks cap; retain provenance and conflict/freshness markers. Do not dump full documents or hidden fields into a prompt.
8. **Choose answer path.** Return deterministic data/structured extraction when sufficient. Use one low-cost synthesis model if appropriate; escalate to an approved stronger model only when evaluation-based routing or a genuinely hard case justifies it.
9. **Deliver and account.** Worker writes committed run progress, evidence, cost and terminal outcome; the API reads authorized projection and streams/replays to UI. Partial-source results disclose which sources failed or were stale.

### Scenario: support answer from three sources

Question: **“What changed in the latest support issues, documentation, and release notes?”** (fictional and domain-neutral).

- Ticket connector: **live typed query** for assigned/updated issues within caller's permitted teams.
- Documentation KB: **indexed search**, narrowed to the workspace's authorized collection, with ingest watermark.
- Release source: **indexed change feed** if fresh enough, else live API when the freshness requirement cannot be met by its index.
- Merge by stable document/record ID, rank and cap passages; show citations with dates and any unavailable source.
- The worker invokes one answer synthesizer **only if** deterministic comparison is insufficient. One source timeout must not stall indefinitely or silently become a fabricated answer.

Do **not** create “ticket agent + documentation agent + release agent” by default; this would replicate LLM planning/tool loops and increase latency, cost, failure modes and prompt-injection exposure.

## Cost control — enforce it at admission, retrieval and inference

Cost has **variable and fixed** components:

```text
C_run_variable =
    sum_over_models(input_tokens * input_price + output_tokens * output_price)
  + query_embedding_cost + optional_reranking_cost
  + metered_connector/API calls + metered workflow/remote-job calls
  + attributable compute, storage, egress and observability usage

C_total_period =
    sum(C_run_variable)
  + fixed_worker_and_gateway_capacity
  + ingestion/indexing/storage/sync infrastructure
  + operational/on-call/compliance overhead
```

Use **provider rate-card snapshots and measured usage**, not the prices assumed in a prompt or returned by an arbitrary adapter. If the gateway's reported price is incomplete, flag the run as cost-unverified rather than reporting fictitious savings.

| Control | Owner | Behavior |
| --- | --- | --- |
| Tenant/workspace monthly caps | Platform budgeting | Admission rejects or requires allowed escalation when exhausted |
| Per-run reservation | Run Service | Reserve worst-case budget; reconcile actual spend; release unused reservation |
| Agent profile | Registry + publisher | Hard model calls, tool calls, parallel sources, deadline, total input/output tokens |
| Source fan-out and query caps | Retrieval Coordinator | Maximum eligible sources, per-source topK and query/page sizes; skip irrelevant sources |
| Model choice | Model Gateway | Rules/small profile for classification; stronger model only if quality/escalation gate met |
| Context budget | Evidence packer | Deduplicate, collapse, truncate and prioritize useful authorized passages |
| Cache/indexing | Source/KB adapters | Reuse authorized safe reads; incremental ingest vs full reindex; obey freshness and ACL |
| External API fees | Tool Gateway | Quotas, call budgets, concurrency/rate caps and circuit breakers |
| Retry and delegation | Runtime/Run Service | Bound retries, turns, child runs and unknown external outcomes |
| Shared worker capacity | Operations | Autoscaling with idle cost awareness, concurrency fairness, queue latency and provider rate limits |

**Initial guardrails for a proof of concept, not production defaults:** at most **3 sources queried per answer**, **top 5 source candidates before deduplication**, **up to 12 evidence chunks**, **~6,000 evidence tokens**, **one default synthesizer call**, **bounded 2–4 second per-source request deadline** (excluding intentionally asynchronous jobs). Tune these knobs from quality/latency/cost traces; do not publish them as guarantees.

### Caching without privilege leaks

Key all result, embedding and evidence caches by effective tenant/workspace, source/version, caller's authorization context or ACL digest, query canonicalization, region/residency, and freshness policy where applicable. A public/shared document cache is safe **only** if its source policy allows it and sensitive metadata is excluded. On grants revocation, invalidate appropriately or force reauthorization on every reuse; never allow a stale “was authorized” cache entry to expand a user's current access. Caches reduce cost only when hit rates overcome retention, invalidation and infrastructure costs.

## Latency, scale and graceful degradation

For independent retrieval calls:

```text
Sequential critical path ≈ planning + sum(source_latencies) + merge + synthesis + delivery
Parallel critical path   ≈ planning + max(completed_source_latencies) + merge + synthesis + delivery
End-to-end               += admission queue wait, serialization, model/network overhead
```

Parallelism reduces latency **only** while connector/provider capacity, queueing and per-tenant quotas permit it. One slow provider still dominates the tail unless we cap deadlines and support partial outcomes. Excess parallelism amplifies cost, rate-limit failures, pool saturation and p95/p99 latency.

**Design defaults:** bounded I/O fan-out with cancellation; per-provider bulkhead; token bucket rate limit; circuit breaker; explicit partial-source statuses; fast path for exact reads; pause/resume for long external jobs; separate pools/queues for interactive requests vs ingestion/batch workloads; reuse connection pools and precompute KB indexes where authorized.

### Example performance budget (hypotheses to test)

| Stage | Proposed target for interactive retrieval | Measurement |
| --- | --- | --- |
| Queue/admission | Small share of total deadline | p50/p95 queue wait, rejected admissions |
| Eligibility/plan | Prefer rule-based fast path | p95 planner overhead, router call rate |
| Concurrent retrieval | Bound provider timeout and global remaining deadline | p95 per-source + fan-out; source timeout rate |
| Merge/evidence | Limit records/tokens and reranker pool | p95 rerank time, recall@K, bytes processed |
| Synthesis | Route to smallest adequate model, stop after budget | TTFT, tokens/sec, output tokens, fallback rate |
| Delivery | Commit durable events and replay SSE | status freshness, reconnect success, event lag |

Treat any numeric goal as a **performance hypothesis**, not a production SLA, until a representative load test runs. Model quality and evidence completeness must be tracked alongside latency.

## Observability: a real unit-economics dashboard

Use one `runId` + `traceId` across admission, planner, retrieval, model and ToolGateway; tag spans with tenant/workspace **opaque IDs only**, not sensitive content. Do not attach raw documents or prompts to high-cardinality metric labels.

- **Quality:** task-resolution rate, citation support/coverage, freshness and contradiction detection, accessible retrieval recall@K and rerank effect, human rework rate.
- **Performance:** p50/p95/p99 end-to-end latency; queue waiting; per-source p95/timeout; index lag; TTFT; cancellation and streaming reconnect rates.
- **Cost:** actual/model-token expenditure per completed answer, connector/API costs, ingestion/indexing amortization, cache hit ratio, discarded evidence tokens, rejected budget requests, self-host idle utilization.
- **Reliability/security:** partial-answer rate, connector breaker opens, retry amplification, authorized-denial rate, leaked-data findings (target **zero**), unknown-effect reconciliation count.
- **Fairness:** interactive vs batch saturation, per-tenant queue depth, source rate budgets and noisy-neighbor throttling.

Measure **cost per correctly resolved, access-compliant request**, not merely cost per model call or tokens saved. A cheap wrong answer or stale unauthorized source is not a successful optimization.

## Evaluation matrix and phased implementation

| Workload | Retrieval plan to compare | Success criteria |
| --- | --- | --- |
| Simple direct lookup | Typed API/index first vs agent model planning | Correct ACL, lower measured overhead, provenance |
| Two/three-source comparison | Sequential vs bounded parallel, with and without rerank | Accurate cited comparison; lower p95 without disproportionate API cost |
| Long document answer | Full-document prompt vs topK+dedup+evidence cap | Same-or-better supported-answer score at lower measured tokens |
| Stale KB | Indexed-only vs fresh live fallback | Proper freshness warning and authorized record use |
| Failure/timeout | One connector unavailable, 429, revoked access | Explicit partial/failed status, bounded retry, no fabricated claim |
| High concurrency | Multiple tenants with mixed interactive/batch | Noisy-neighbor protection, stable p95 and hard budget caps |
| Duplicate and cached read | Same query with changed ACL/role | Cache never returns a previously accessible revoked record |

**MVP:** single scoped retrieval tool with 2 reviewed read-only source adapters; deterministic selection; concurrent retrieval with per-source timeout; ACL, stable citations; evidence cap; budget reservation/ledger; one approved synthesis model; per-run traces. One worker and existing Tool Gateway/Registry components are enough to validate the interface.

**Phase 2:** source catalog, freshness metadata and incremental sync; hybrid keyword/vector search; source-aware reranking; auth-scoped cache; live/indexed fallbacks; dashboard and load-test harness.

**Phase 3:** richer routing, policy-governed conditional reranking/model escalation, cost-aware plans for enterprise tenants, multi-region/locality controls, optional child agents, sophisticated throughput isolation.

### Contract sketch (illustrative)

```yaml
apiVersion: agent-platform/v1alpha1
kind: RetrievalPolicy
metadata: { id: generic-assistant-retrieval, version: 1 }
spec:
  allowedSources:
    - { sourceRef: approved-docs@2, operation: kb.search }
    - { sourceRef: verified-tickets@1, operation: issues.list }
    - { sourceRef: release-notes@1, operation: changes.search }
  selection: { mode: eligible-sources-first, maxSources: 3 }
  execution:
    concurrencyLimit: 3
    perSourceTimeoutMs: 3000  # example only
    globalDeadlineMs: 10000    # example only
    maxCandidatesPerSource: 5
  evidence: { maxChunks: 12, maxTokens: 6000, requireSourceRefs: true }
  synthesis:
    deterministicFirst: true
    modelProfileRef: approved-economical@1
    allowOnlyApprovedEscalation: true
  freshness: { enforceSourceRequirement: true, discloseIndexLag: true }
  partialResults: { allowedForReadOnlyQueries: true, discloseMissingSources: true }
```

This is a **conceptual platform contract**, not validated implementation YAML; it does not grant source access. Tenant/workspace authorization, model governance, connector safety and runtime budgets must still be independently enforced.

## External technical references

- [Microsoft Azure AI Search — hybrid keyword/vector search and rank fusion](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview)
- [Microsoft Azure AI Search — RRF scoring](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking)
- [Microsoft Azure AI Search — semantic reranking](https://learn.microsoft.com/en-us/azure/search/semantic-search-overview)

These show possible techniques, **not selected platform dependencies or measured results**.
