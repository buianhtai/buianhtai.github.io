# Self-Hosted RAG Platforms: Onyx, RAGFlow, Kotaemon, and When to Use Each

*You don't have to glue a chunker, vector database, reranker, and generation loop into a working app anymore. A mature layer of deployable open-source RAG platforms exists — but they bet on different things. Here is what each engine actually optimizes, and how to choose.*

---

Search "best open-source RAG framework" and you'll get the same three names every time: LangChain, LlamaIndex, Haystack. All excellent — and all the *same kind of thing*: libraries you import and assemble into your own application. But there's a second layer of the open-source RAG world that gets far less coverage: **finished engines** you deploy, point at your documents, and use — ingestion, retrieval, and often a whole UI already wired together.

That's the real first decision, and most teams get it backwards: **library or engine at all?** Building your own pipeline means owning chunking strategy, embedding refresh, reranking, evaluation, and connectors forever. Deploying an engine means trading flexibility for a working system on day one. This post maps the engine layer — Onyx, RAGFlow, and Kotaemon, with AnythingLLM and the cautionary tales — because these are exactly the "ready-built open source" teams reach for when the knowledge base has multiple sources and nobody wants to write parsers per format.

## The four bets

Each leading engine optimizes a different bottleneck:

| Engine | Its bet | License | Stars | Know it by |
| --- | --- | --- | --- | --- |
| Onyx (formerly Danswer) | Connector-driven enterprise search — the open-source Glean | MIT | Most-deployed for workforce search | 40–50+ data-source connectors with permission syncing |
| RAGFlow | Document understanding — quality in, quality out | Apache-2.0 | ~89k | DeepDoc layout-aware parsing before chunking |
| Kotaemon | Turnkey chat-with-documents interface | Apache-2.0 | ~25k | Working app in an afternoon, citations in a PDF viewer |
| AnythingLLM | Simplest all-in-one, laptop to Docker | MIT | Broad adoption | Workspaces with pluggable vector DBs |

They aren't competing on the same axis. RAGFlow optimizes what goes *into* the index, Onyx optimizes *which sources* feed it and who's allowed to see results, Kotaemon optimizes the experience on top, and R2R (worth an honorable mention) optimizes the retrieval *backend-as-a-service* — though its release cadence has cooled, so weigh momentum before committing.

## Onyx: the connector and permission play

If your problem is "knowledge scattered across Confluence, Drive, Slack, Jira, GitHub, Salesforce, Zendesk…" then nothing else in the open-source world matches Onyx's breadth: 40–50+ native indexing connectors with **continuous sync and permission inheritance** — ACLs sync from each source system into the index, and filtering happens pre-retrieval, not at the chat UI. That last part is the difference between a demo and an enterprise deployment: without source-system permission sync, every answer is a potential data-leak incident.

> 📈 **Onyx deployment architecture** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/self-hosted-rag-platforms-compared/).

Under the hood: OpenSearch-backed hybrid index, Redis for caching, MinIO for blobs, dedicated inference servers for embedding/reranking models — the standard deployment is a real distributed system, not a single container (a lite mode exists under 1GB if you just want the chat UI). Any LLM via LiteLLM, first-class local inference. Deployment via Docker, Kubernetes, Helm/Terraform; fully air-gapped works — UC San Diego runs it for 37,000+ users on internal GPUs. Community Edition covers chat, RAG, agents, and actions under MIT; Enterprise adds large-org extras.

**Pick Onyx when:** knowledge lives in many SaaS systems, permission correctness matters, and the users are your workforce. **Look elsewhere when:** your corpus is mostly messy files — Onyx's parsing is not its differentiator.

## RAGFlow: the document-understanding play

RAGFlow's identity is *"quality in, quality out"* — earned before retrieval ever happens. Its DeepDoc pipeline is a vision-and-parsing layer that recognizes document layout (tables, figures, headings, multi-column PDFs, scanned pages) and applies **template-based, explainable chunking you can visualize and correct**. This attacks the quiet killer of production RAG: a table flattened into garbage text poisons the embedding of its whole chunk, and no downstream reranker recovers what the parser destroyed.

> 📈 **RAGFlow ingestion — parsing before chunking** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/self-hosted-rag-platforms-compared/).

At ~89k stars it's the most-adopted of the set, shipping actively through mid-2026: agent flows, MCP support, GraphRAG, Confluence/S3/Notion/Google Drive sync, multi-modal sense-making for images inside PDFs, even chat channels (Discord, Telegram, Feishu). Trade-offs: its connector ecosystem is thinner than Onyx's, there's no first-class permission inheritance from SaaS sources, and the stack is heavier (Elasticsearch, MinIO, Redis, MySQL behind Docker Compose).

**Pick RAGFlow when:** your corpus is messy real-world documents — contracts, filings, scanned manuals — and parsing fidelity is the binding constraint.

## Kotaemon: the turnkey interface play

Kotaemon is the one you stand up in an afternoon: a clean Gradio-based chat-with-your-documents UI with hybrid (full-text + vector) retrieval and reranking as sane defaults, advanced citations rendered as highlights in an in-browser PDF viewer, multi-modal QA over figures and tables, and multi-user collections. It supports cloud providers and local models alike, plus reasoning modes (ReAct, ReWOO) and GraphRAG variants as pluggable pipelines. Document parsing is swappable — Docling and PaddleOCR locally, Azure Document Intelligence or Adobe Extract as APIs.

**Pick Kotaemon when:** end users need to ask questions of a folder of documents today, and developers still want the pipeline underneath customizable.

## The comparison that matters

| Tool | Native connectors | Hybrid search | Permission-aware | Air-gapped |
| --- | --- | --- | --- | --- |
| Onyx | 40+ | Yes (OpenSearch) | Yes, at retrieval | Yes |
| RAGFlow | File, HTTP, some SaaS sync | Yes (Elasticsearch) | Limited | Yes |
| Kotaemon | File-focused | Yes | Collections | Yes |
| AnythingLLM | File, web, GitHub | Limited | Workspace-level | Yes |
| Open WebUI / LibreChat | File upload | Light | No | Yes |

Note what the last row means: Open WebUI and LibreChat are chat UIs first and light-RAG second — excellent products, wrong tool if enterprise search is the goal.

## The decision path

> 📈 **choosing an engine** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/self-hosted-rag-platforms-compared/).

## The maintenance warning

In a space this fast, **check the last release date before you check the star count.** Weaviate's Verba was archived (read-only) in June 2026 despite brand recognition. Quivr, despite a huge star count, quietly repositioned from an app into an opinionated library. R2R is maintained but hasn't tagged a release since mid-2025. The best-maintained engines here — RAGFlow and Kotaemon — aren't the ones with the most GitHub history; they're the ones still shipping.

> **REALITY CHECK:** And whichever engine you choose: no engine retrieves well by default. The work that moves quality is the same as ever — evaluate the pipeline against a golden set of real questions, and re-run those evals on every content and config change.

## How this plugs into a support-agent architecture

These engines slot straight into the capability plane of a multi-agent support system as the knowledge-base backend: Onyx's API (or its MCP support) becomes the how-to agent's retrieval tool with permissions inherited from your source systems; RAGFlow can serve purely as the parsing layer feeding your own index; Kotaemon works as an internal tooling UI while your product-facing agent runs on its own stack. The architecture doesn't change — you're choosing who owns ingestion and retrieval.

## Further reading

- [Onyx — Open Source AI Platform](https://github.com/onyx-dot-app/onyx)
- [RAGFlow](https://github.com/infiniflow/ragflow/)
- [Kotaemon](https://github.com/Cinnamon/kotaemon/)
- [Self-Hosted RAG in 2026 — the complete guide](https://onyx.app/insights/self-hosted-rag)
- [The best open-source RAG platforms: RAGFlow vs R2R vs Kotaemon](https://dreaming.press/posts/2026-06-23-best-open-source-rag-platforms.html)

---

*Originally published with interactive diagrams at [buianhtai.dev](https://buianhtai.dev/en/blog/self-hosted-rag-platforms-compared/)*
