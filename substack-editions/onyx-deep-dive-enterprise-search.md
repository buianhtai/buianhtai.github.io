# Onyx Deep-Dive: Self-Hosted Enterprise Search That Respects Permissions

*Onyx (formerly Danswer) is the open-source answer to Glean — 40+ connectors, permission-aware retrieval, and a surprisingly serious distributed architecture underneath. A component-level tour: the worker fleet, ACL sync machinery, the Vespa-to-OpenSearch migration, and what operations actually feel like.*

---

In the [platform comparison](/en/blog/self-hosted-rag-platforms-compared/), Onyx won the "knowledge scattered across SaaS tools" lane: 40–50+ connectors, permission-aware retrieval, and workforce-scale deployments. This deep-dive opens up the box — because underneath the chat UI sits one of the more serious distributed architectures in open-source RAG: a nine-type background worker fleet, Redis-coordinated priority queues, permission-sync machinery with watchdog-validated fences, and a live storage-engine migration executed chunk-by-chunk under traffic.

## The container view

A standard Onyx deployment is a set of Docker containers (Kubernetes/Helm for production scale):

> 📈 **Onyx services and data stores** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/onyx-deep-dive-enterprise-search/).

Two design choices stand out immediately. First, **the model servers are split**: query-time embedding/reranking runs on its own inference server, while a dedicated `INDEXING_ONLY` model server handles bulk document embedding — heavy indexing workloads never contend with live query traffic. Second, search has been through a migration: Onyx originally used **Vespa** as its vector backbone (the Docker service is still named `index` because of Vespa hostname restrictions) and has been moving to **OpenSearch** via chunk-level batched migration tasks that run under live traffic with continuation tokens and per-tenant locks. The repo's own guidance now says OpenSearch is the current index backend and Vespa references are migration artifacts.

## The worker fleet

All asynchronous work runs as Celery tasks under supervisord — organized into nine specialized worker types so that resource-heavy jobs never starve fast ones:

| Worker | Role |
| --- | --- |
| primary | Core coordination: connector management/deletion, document-index sync, pruning checks, LLM model updates, user file sync |
| docfetching | Fetches documents from connectors; spawns docprocessing tasks per batch; watchdog monitors stuck connectors |
| docprocessing | The indexing pipeline: upsert metadata to Postgres → chunk → embed via indexing model server → write chunks to the index |
| light | Fast ops at higher concurrency: permissions upsert, checkpoint cleanup |
| heavy | Resource-intensive: document pruning, external group sync, CSV generation |
| monitoring | Health checks on Celery queues and process memory, every 5 minutes |
| user_file_processing | Personal file uploads and project sync |
| scheduled_tasks | User-scheduled (Craft) task runs |
| beat | Periodic scheduler with DynamicTenantScheduler for multi-tenancy |

The beat schedule tells you what the system considers urgent: indexing checks every 15 seconds, connector-deletion and sync checks every 20, knowledge-graph processing every 60, monitoring every 5 minutes. Tasks route through High/Medium/Low priority queues with Redis coordinating state — and every task must carry an `expires=`, because the maintainers learned that tasks without expiration cause unbounded queue growth.

## Permission sync: the hard part done properly

The feature that separates Onyx from lighter platforms is **permission inheritance** — ACLs synced from each connected source (Confluence, Drive, SharePoint…) into the index, enforced *pre-retrieval*. The implementation is worth studying because distributed permission sync is genuinely hard:

- Dedicated Celery tasks check which connector-permission pairs are due, guarded by Redis locks so instances never overlap.
- Each sync run sets an **indexing fence** in Redis — a marker that work is in flight.
- A **fence validator** periodically hunts for orphaned fences: the failure mode where an indexing worker hard-crashes after setting the fence, leaving state that would never clear without intervention. The validator renews TTLs when it sees tasks alive in queues, and clears dead ones.
- Progress telemetry tracks documents remaining per sync, marking completion only when the count hits zero.

This is the machinery behind the claim "filtering happens pre-retrieval rather than at the chat-UI layer" — and it's also why document-level permissioning sits in the Enterprise Edition: the sync infrastructure is free, but mirroring external ACLs at scale is the paid surface.

## Community vs Enterprise: where the line falls

Both editions share identical core topology — EE layers features on top, activated by license key, gated at the API-router level in a separate `backend/ee/` directory:

| Capability | Community (MIT) | Enterprise |
| --- | --- | --- |
| Chat, RAG, agents, actions, 40+ connectors, hybrid retrieval | Yes | Yes |
| Advanced SSO (SAML, OIDC with PKCE) | Basic auth / OAuth2 | Yes |
| Multi-tenancy | Single-tenant schemas | Tenant-isolated DB schemas |
| Audit logging | No | Full query history with user attribution |
| Document-level permissioning | Connector-level ACL basics | Mirrors external app ACLs |

## Operational honesty

Three things the README won't tell you, but the maintainer guidance does:

1. **Celery time limits don't work here.** All workers use thread pools (not process forks), which silently disables Celery's built-in time-limit features — timeout logic must be implemented inside each task. If you deploy Onyx and wonder why a stuck task isn't killed, that's why.
2. **Tasks without expiration are a bug.** The contributing guide mandates `expires=` on every enqueue; unbounded queue growth was real enough to become a rule.
3. **Search engine choice is effectively permanent.** The docs state OpenSearch is tightly integrated with retrieval functionality — switching engines would require significant development. Plan capacity for it accordingly (multi-node clusters are supported but "typically not necessary").

And the honest caveat carried over from the fact-checked comparison: the widely-cited UC San Diego deployment (37,000+ users, air-gapped) traces to community discussion rather than a primary source we could verify — treat it as directional, not documented.

## When Onyx is the right engine

Knowledge lives across many SaaS systems, permission correctness is non-negotiable, users are your workforce, and you want any-LLM freedom (LiteLLM, Ollama, vLLM, SGLang) including fully air-gapped operation. If your corpus is instead dominated by messy PDFs where parsing fidelity is the bottleneck, [RAGFlow](/en/blog/ragflow-deep-dive-document-understanding-engine/) is the better-matched engine — the two solve different halves of enterprise RAG.

> **KEY INSIGHT:** The transferable lesson: Onyx's real product isn't the chat UI — it's the sync-and-permission machinery that keeps an index continuously truthful about dozens of live systems. Whatever platform you build on, that machinery (or the decision to skip it) is your biggest architectural commitment.

## Further reading

- [Onyx — GitHub](https://github.com/onyx-dot-app/onyx)
- [Onyx docs — System description & security architecture](https://docs.onyx.app/security/architecture/system_description)
- [Onyx — Architecture reference](https://onyx-dot-app-onyx.mintlify.app/architecture)
- [backend/AGENTS.md — worker and task conventions](https://github.com/onyx-dot-app/onyx/blob/main/backend/AGENTS.md)
- [Self-hosted RAG in 2026 — deployment guide](https://onyx.app/insights/self-hosted-rag)

---

*Originally published with interactive diagrams at [buianhtai.dev](https://buianhtai.dev/en/blog/onyx-deep-dive-enterprise-search/)*
