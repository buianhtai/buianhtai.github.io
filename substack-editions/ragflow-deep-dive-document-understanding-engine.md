# RAGFlow Deep-Dive: The Document-Understanding RAG Engine

*RAGFlow bets that retrieval quality is decided before embeddings — at parse time. A close look at its DeepDoc pipeline, template chunking, orchestrable ingestion graphs, honest pain points from production issues, and when it's the right engine.*

---

In the [platform comparison](/en/blog/self-hosted-rag-platforms-compared/), RAGFlow was the *document-understanding* bet: while Onyx optimizes which sources feed your index and Kotaemon optimizes the experience on top, RAGFlow optimizes what goes *into* the index — because a table flattened into garbage text poisons its chunk's embedding, and nothing downstream recovers it.

This deep-dive walks through how that bet is engineered: the parsing layer, the template system, the new orchestrable ingestion pipelines, retrieval mechanics, and — just as importantly — the rough edges reported by teams running it in production.

## The stack in one view

RAGFlow self-hosts as a Docker Compose family: Elasticsearch (or Infinity, their own high-performance store) for hybrid indexing, MinIO for object storage, Redis for caching and queues, MySQL for metadata. The published floor is modest — 4 CPU cores, 16GB RAM, 50GB disk — but serious deployments grow the Elasticsearch node first, since both the keyword and vector indexes live there.

> 📈 **RAGFlow ingestion — parsing decides everything downstream** — interactive diagram in the [canonical post](https://buianhtai.dev/en/blog/ragflow-deep-dive-document-understanding-engine/).

## The parser ecosystem: five ways to read a PDF

Since v0.17, RAGFlow decouples PDF *extraction* from *chunking* — you pick them independently. The parser dropdown is where its document-understanding identity lives:

| Parser | What it does | Trade-off |
|---|---|---|
| **DeepDoc** (default) | Vision models performing OCR, TSR (table structure recognition), DLR (document layout recognition) | Best fidelity on complex layouts; can be time-consuming |
| **Naive** | Skips OCR/TSR/DLR entirely | Fast — right choice when PDFs are plain text |
| **MinerU** (≥ v0.22, experimental) | Open-source PDF-to-markdown converter; RAGFlow acts as a remote client calling its API | External service to run; output passes through unmodified |
| **Docling** (experimental) | IBM's document processor via Docling Serve, or local package | Another service dependency |
| **Third-party VLM** | Any provider's vision model for extraction | Experimental; per-provider behavior varies |

The practical guidance from the docs: if your PDFs contain formatted or image-based text, use a visual model; if they're plain text, Naive cuts parsing time dramatically.

## Chunking templates: thirteen ways to slice

RAGFlow ships pre-built chunking templates mapped to document genres — this is the "template-based, explainable chunking" differentiator. Each dataset picks a default, and individual files can override it:

| Template | Designed for | Formats |
| --- | --- | --- |
| General | Consecutive token-based chunking (default 512 tokens) | MD, DOCX, XLSX, PPT, PDF, TXT, images, CSV, JSON, EML, HTML |
| Q&A | Question-answer pair extraction | XLSX, CSV/TXT |
| Paper / Book / Laws / Manual | Structured long-form documents | PDF, DOCX |
| Presentation | Slide decks | PDF, PPTX |
| Table | Tabular data via TSI technology | XLSX, CSV/TXT |
| One | Entire document as a single chunk | DOCX, XLSX, PDF, TXT |
| Picture | Image understanding | JPEG, PNG, TIF, GIF |
| Tag | Dataset as a tag set feeding others | XLSX, CSV/TXT |

Chunks aren't black boxes either: you can attach keywords to individual chunks to boost their ranking for matching queries, enable/disable specific files inside a dataset, and preview exactly how content was segmented — the "explainable and correctable" part of the pitch.

## Orchestrable ingestion pipelines (v0.21+)

The fixed templates hit limits in production — diverse sources, preprocessing needs, semantic-gap bridging — so v0.21 introduced **ingestion pipelines**: visual DAGs where Parser, Chunker, Transformer, and Indexer nodes compose with your own configuration.

The two Chunker modes encode a real trade-off: **Token** slicing (default 512) balances recall-unit size against model compatibility, while **Title** slicing uses configurable heading regexes (`^#[^#]` for H1, `^##[^#]` for H2) to produce structurally complete chapters — better for manuals, papers, and legal texts. The Transformer node then optionally runs LLM enrichment (summaries, keywords, hierarchy) over chunks to close the gap between user vocabulary and document language.

Pipelines associate to datasets as their default parsing process, with community templates like Chunk Summary as starting points.

## Retrieval mechanics worth knowing

- **Multi-recall by default**: every chat fuses full-text (keyword) and vector search, then re-ranks.
- **Tunable fusion**: similarity threshold (default 0.2 filters low-relevance chunks) and vector-similarity weight (default 0.3 of the blended score) are exposed per chat configuration.
- **Embedding lock-in per dataset**: the embedding model cannot change once a dataset has chunks — switching means deleting all chunks, because vectors must live in one embedding space.
- **Cross-knowledge-base retrieval works** (chat/agents/search can query multiple datasets at once) with one hard prerequisite: every queried dataset must use the same embedding model.

## Honest pain points from production

GitHub issues tell you where the bodies are buried, and RAGFlow's are documented:

1. **Chunk token size is a soft limit.** With DeepDoc, configured `chunk_token_num` isn't strictly enforced — the Splitter prioritizes delimiter boundaries, so oversized chunks are common when documents have large sections or infrequent delimiters. There's no built-in way to skip problematic chunks: *if one chunk fails, the whole parsing task fails*. Workarounds: lower targets (256), custom delimiters, manual pre-splitting.
2. **MinerU output passes through untouched.** RAGFlow consumes MinerU's chunks as-is; fragmentation complaints about MinerU parses are about MinerU, and won't be fixed on the RAGFlow side.
3. **Search is rudimentary** (as of v0.27): dataset search by name only.
4. **Ordering constraints in pipelines**: configuring Token and Title chunkers together currently requires Title connected *after* Token, or certain file types error out — flagged for future fixes.

None of these are disqualifying; all of them are the kind of thing you want to know *before* committing, not after.

## Delivery surface

Beyond the chat UI: a REST API for integration, an agent workflow builder with pre-built templates, MCP support, a sandboxed Python/JavaScript code-executor component (gVisor-isolated), agent memory (late 2025), and native chat-channel deployment to Discord, Telegram, Feishu, and Line (mid 2026). Recent releases track the frontier closely — DeepSeek v4 and Gemini 3 Pro support landed within weeks of those models' availability.

## When RAGFlow is the right engine

Recapping the decision path: corpus dominated by **messy real-world documents** (contracts, filings, scanned manuals, slide decks) where parsing fidelity is the binding constraint → RAGFlow. Knowledge scattered across SaaS tools with permission requirements → Onyx instead. Need-it-today folder QA → Kotaemon. And if your documents are mostly clean markdown/text, much of DeepDoc's machinery is idle weight — a lighter stack serves you fine.

> **KEY INSIGHT:** The transferable lesson regardless of engine: retrieval quality is decided at ingestion. Budget parsing time, choose chunking templates per document genre, inspect your chunks visually, and treat oversized-chunk failures as signals about document structure — not as bugs to suppress.

## Further reading

- [RAGFlow — GitHub](https://github.com/infiniflow/ragflow/)
- [Configure dataset — chunking templates](https://ragflow.io/docs/configure_knowledge_base)
- [Select PDF parser — DeepDoc/MinerU/Docling](https://ragflow.io/docs/select_pdf_parser)
- [Ingestion pipeline explained](https://ragflow.io/blog/is-data-processing-like-building-with-lego-here-is-a-detailed-explanation-of-the-ingestion-pipeline)
- [Issue #13066 — chunk size behavior](https://github.com/infiniflow/ragflow/issues/13066)

---

*Originally published with interactive diagrams at [buianhtai.dev](https://buianhtai.dev/en/blog/ragflow-deep-dive-document-understanding-engine/)*
