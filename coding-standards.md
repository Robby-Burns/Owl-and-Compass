# Coding Standards — Owl & Compass

## Tier 1: Researched Ecosystem Defaults
- **Python Package & Dependency Manager:** `hatchling` / `uv` / `pip` (configured via `pyproject.toml`)
- **Python Test Runner:** `pytest` / `pytest-asyncio`
- **Python Linter & Formatter:** `ruff`
- **TypeScript / Node Environment:** Next.js (App Router), TypeScript, `node:test` test runner (`node --import tsx --test`)
- **Containerization:** Docker (`Dockerfile`, multi-stage Node + Python setup)

## Tier 2: Framework Conventions
- **Pydantic v2:** Enforce strict type validation models (`BaseModel`, `HttpUrl`, `Field`) for all agent inputs and schemas.
- **FastAPI / Async Python:** Bounded concurrency via `asyncio.Semaphore`, async execution for IO-heavy operations.
- **Next.js Server Actions:** All UI data mutations use `"use server"` Server Actions with input sanitization, rate limiting, and async locking.

## Tier 3: Agentic Framework Conventions
- **XML Untrusted Content Boundary:** Web scraped content must be sanitized and enclosed within `<untrusted_web_content>` XML guardrail tags.
- **Zero Hallucination Citation Policy:** Every observation in research briefs must be backed by at least one valid evidence URL.

## Tier 4: Project-Specific Decisions
- **Web Scraping Adapter:** `crawl4ai` (with `AsyncWebCrawler` and Playwright JS rendering) as the primary web scraper, managed by `DiscoveryConfig` (10s JS timeout, `asyncio.Semaphore(3)` concurrency pool, sensitive token filtering, and 50k character max content limits) with static HTML fallback (`clean_html_content`).
