# Owl & Compass (Atlas) — Technical Specification

**Version:** 1.8 | **Generated:** July 29, 2026  
**Framework:** Atlas Guides v1.0  
**Naming Note:** Product brand identity is **Owl & Compass** (formerly internally referenced as **Atlas**).

---

## Problem Statement

Founders and networking professionals waste hours manually searching for peers and researching individuals across disparate public channels, often relying on superficial AI flattery or forgetting historical context when building relationships. Owl & Compass solves this by providing discovery by topic/stage, transforming verified public signals and past conversation logs into structured, evidence-backed research briefs with temporal source diffing, tailored conversation preparation (including evidence-backed hypotheses and outreach drafts), and cross-founder pattern analysis—without ever making ungrounded claims or automating outreach.

---

## Success Metrics

- **Zero Hallucinated Claims:** 100% of generated observations, hypotheses, and interview points in research briefs map directly to verified, user-accessible source links, validated in CI/CD via Pydantic URL regex assertions against the fetched source map.
- **Context-to-Prep Speedup:** Reduces founder prep time (from initial discovery/import to a full "Conversation Prep" brief) from ~45 minutes to < 3 minutes.
- **Relationship Memory Retention:** 100% of valid segments in pasted touchpoints (transcripts, emails, notes up to 50k chars) are parsed into Pydantic-validated timeline events, open loops, and promises without total pipeline execution failure.

---

## User Stories & Implementation Plan

### Story 1.1: Database Schemas & Pydantic v2 Contract Validation
- **As a** developer
- **I want to** establish PostgreSQL database tables (founders, founder_sources, workspace_touchpoints, founder_timeline_events) with RRF hybrid search and define Pydantic v2 validation contracts
- **So that** data integrity and zero-hallucination citation policies are strictly enforced at the database and adapter boundary.
- **Acceptance Criteria:**
  1. `founders`, `founder_sources`, `workspace_touchpoints`, and `founder_timeline_events` schemas defined with indices and `hybrid_workspace_search` SQL function.
  2. Pydantic models `VerifiedObservation`, `PrepBrief`, `ExtractedEntities`, and `Settings` defined with strict validation rules.
  3. `VerifiedObservation` enforces at least one valid evidence URL.
  4. Unit tests pass for database schemas and Pydantic validation rules.
- **Risk Level:** LOW

### Story 1.2: FastAPI Map-Reduce Touchpoint Ingestion Pipeline
- **As a** system orchestrator
- **I want to** process multi-segment touchpoint inputs up to 50k characters using bounded async concurrency (`asyncio.Semaphore(5)`)
- **So that** transcripts and emails are cleanly parsed into timeline events, open loops, and promises under 30 seconds without pipeline failure.
- **Acceptance Criteria:**
  1. `normalize_touchpoint_input` cleans and splits inputs into ~4k character segments.
  2. `extract_touchpoint_entities` extracts entities concurrently with `return_exceptions=True`.
  3. Batch insertion uses lock timeouts and retries for safety.
  4. Integration tests verify ingestion performance and fault tolerance.
- **Risk Level:** LOW

### Story 1.3: Discovery & Research Agent with Untrusted XML Guardrails
- **As a** scout / founder
- **I want to** discover founder public signals, scrape JS-rendered pages via Crawl4AI / Playwright (with static fallback), and format source-attributed briefs wrapped in `<untrusted_web_content>` XML guardrails
- **So that** research briefs are generated without hallucinated claims or prompt injection vulnerabilities.
- **Acceptance Criteria:**
  1. `discover_founders_by_criteria` and `search_public_signals` tools implemented.
  2. Scraped web content uses Crawl4AI JS rendering (or static fallback) and is wrapped in `<untrusted_web_content>` tags.
  3. Prompt instructions strictly enforce passive data handling for untrusted tags.
  4. Unit/integration tests verify search tools, Crawl4AI fallback logic, and XML guardrails.
- **Risk Level:** LOW

### Story 1.4: Next.js Server Actions & Prep Brief UI Components
- **As Alex / Maya**
- **I want to** view evidence-backed research briefs, temporal source diffs, and conversation prep starters in a modern Next.js UI
- **So that** I can prepare high-signal founder conversations in under 3 minutes.
- **Acceptance Criteria:**
  1. Next.js Server Actions implemented for founder creation and touchpoint saving.
  2. Prep Brief UI component displays observations with evidence links, hypotheses, questions, and outreach drafts.
  3. UI adheres to modern aesthetics (dark mode, glassmorphism, responsive design).
  5. Outreach Assistant supports default combined synthesis (Danielle Robay + Pain Point + Chris Voss) with interactive UI methodology toggles (Combined, Danielle Robay, Pain Point, Chris Voss).
- **Risk Level:** LOW

### Story 2.1: Visual Node-Based Founder Relationship Timeline Graph (Pillar 8)
- **As a** investor / network builder
- **I want to** view an interactive 5-stage node graph (*Discovery → First Note → Meeting → Deliverable → Active Rapport*) for every saved founder
- **So that** I immediately understand the exact status, open loops, and promised deliverables of every relationship.
- **Acceptance Criteria:**
  1. Derives 5 discrete relationship stages from touchpoint history and timeline events.
  2. Renders node indicators with date stamps, amber **Open Loop** pills, and emerald **Promise** check badges.
  3. Clicking a node opens touchpoint details with full source citations.
- **Risk Level:** LOW

### Story 2.2: RRF Natural Language Global Workspace Search (Pillar 10)
- **As Alex / Maya**
- **I want to** search across all saved founder profiles, signals, and touchpoint notes using natural language queries (*"Who mentioned RAG?", "Who discussed evaluation frameworks?"*)
- **So that** I can instantaneously retrieve relevant conversations with 100% citation traceability under 200ms.
- **Acceptance Criteria:**
  1. `searchWorkspace` Server Action implemented with PostgreSQL RRF score formula: $\text{RRF}(d) = \frac{0.6}{60 + \text{Rank}_{\text{fts}}} + \frac{0.4}{60 + \text{Rank}_{\text{vec}}}$.
  2. Automatic fallback: if vector embeddings time out ($> 500\text{ms}$), query seamlessly degrades to full-text BM25 ranking.
  3. Every search result item includes a clickable citation link (`founder_id`, `touchpoint_date`, `source_type`, snippet).
- **Risk Level:** LOW

### Story 2.3: Cross-Founder Pattern Analysis Engine (Pillar 9)
- **As a** scout / ecosystem builder
- **I want to** view a dedicated Pattern Analysis tab surfacing aggregated trends (*"5 founders discussed enterprise trust"*, *"4 founders hiring AI PMs"*)
- **So that** I can discover macro ecosystem patterns without automating outreach or introducing AI flattery.
- **Acceptance Criteria:**
  1. `analyzeWorkspacePatterns` Server Action clusters topics and pain points using confidence metric $\text{Pattern\_Score}(T) \ge 0.15$ and $N_{\text{founders}} \ge 2$.
  2. Renders clickable contributing founder profile tags and frequency heatmaps.
  3. 100% zero-hallucination compliance: patterns are pure aggregates of user-entered and scraped touchpoint extractions.
- **Risk Level:** LOW

---

## Personas

### Alex (The Early-Stage Investor / Scout)
- **Role:** Scout / Venture Partner at a seed-stage firm.
- **Goal:** Identify promising founders early and build genuine, long-term rapport before competing funds do.
- **Pain point:** Spends 45+ minutes per founder searching LinkedIn, podcasts, and blogs to write customized outreach, yet often misses key nuances or previous touchpoints.
- **Technical level:** Intermediate (comfortable with Web apps, CRM workflows, and Markdown).

### Maya (The Technical Founder / Ecosystem Builder)
- **Role:** Founder of an open-source AI project looking to connect with potential design partners and peers.
- **Goal:** Have high-signal, peer-to-peer conversations with other founders working on adjacent hard technical problems (e.g., evaluation frameworks, MCP).
- **Pain point:** Dislikes cringey AI sales emails and superficial networking; wants context-driven, evidence-backed talking points without corporate fluff.
- **Technical level:** High (developer, comfortable reading specs, uses modern SaaS tools).

---

## Architecture

### System Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│            Next.js App Router (Server Actions)         │
│   - Client UI (Tailwind, Lucide Icons)                 │
│   - Direct DB mutations via Server Actions             │
└───────────────────────────┬────────────────────────────┘
│ Heavy Async Execution
▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
│   - Pydantic v2 Contract Validation                    │
│   - Untrusted XML Content Guardrails                   │
│   - Map-Reduce Touchpoint Ingestion Pipeline           │
└───────┬───────────────────┬────────────────────┬───────┘
│                   │                    │
▼                   ▼                    ▼
┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ Supabase DB     │ │ OpenRouter       │ │ Exa Search      │
│ (Postgres +     │ │ (Claude 3.5      │ │ Public Signals  │
│  pgvector)      │ │  Sonnet)         │ │ Adapter         │
└─────────────────┘ └──────────────────┘ └─────────────────┘
```

---

## Configuration Surface (scale.yaml)

```yaml
version: "1.8"
app_name: "Owl & Compass"

llm:
  provider: openrouter
  model: anthropic/claude-3.5-sonnet
  temperature: 0.1 # Low variance for strict source verification
  max_retries: 3

search:
  provider: exa
  max_results_per_query: 5
  timeout_seconds: 10

database:
  provider: supabase
  vector_dimension: 1536
  lock_timeout_ms: 5000
  retry_jitter: true

ingestion:
  max_payload_chars: 50000
  chunk_size_chars: 4000
  concurrency_limit: 5
```
