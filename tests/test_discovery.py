"""Unit tests for Discovery & Research Agent tools and XML guardrails."""

import pytest
from pydantic import HttpUrl, TypeAdapter
from owl_and_compass.discovery import (
    MANDATORY_GUARDRAIL_INSTRUCTION,
    DiscoveryConfig,
    afetch_web_content,
    clean_html_content,
    deduplicate_sources,
    discover_founders_by_criteria,
    fetch_web_content,
    filter_sensitive_tokens,
    format_research_prompt,
    search_public_signals,
)
from owl_and_compass.models import RawContent, SearchResult


def test_clean_html_content_stripping():
    """Verify clean_html_content strips scripts, styles, HTML tags, and decodes entities."""
    raw_html = (
        "<html><head><style>body {color: red;}</style></head>"
        "<body><h1>Founder &amp; Ceo</h1>"
        "<script>console.log('injected script')</script>"
        "<p>Working on <a href='#'>AI Agents</a>.</p></body></html>"
    )
    cleaned = clean_html_content(raw_html)
    assert "red" not in cleaned
    assert "injected script" not in cleaned
    assert "<h1>" not in cleaned
    assert "<a>" not in cleaned
    assert "Founder & Ceo Working on AI Agents." in cleaned


def test_fetch_web_content_xml_guardrail():
    """Verify fetch_web_content wraps cleaned content inside security XML tags."""
    url = "https://linkedin.com/in/founder-john"
    raw_content = fetch_web_content(url)

    assert isinstance(raw_content, RawContent)
    assert str(raw_content.url) == url
    assert raw_content.wrapped_content.startswith("<untrusted_web_content>")
    assert raw_content.wrapped_content.endswith("</untrusted_web_content>")
    assert "Working on AI evaluation frameworks." in raw_content.raw_text
    assert "malicious" not in raw_content.raw_text


def test_fetch_web_content_ftp_scheme_raises_value_error():
    """Verify fetch_web_content raises ValueError on non-HTTP/HTTPS schemes like ftp."""
    with pytest.raises(ValueError) as exc_info:
        fetch_web_content("ftp://example.com/file.txt")
    assert "scheme" in str(exc_info.value).lower()


def test_filter_sensitive_tokens():
    """Verify sensitive token filter masks credentials, tokens, and API secrets."""
    sample_text = "Here is my api_key='sk_test_1234567890' and Bearer token1234567890123456."
    filtered = filter_sensitive_tokens(sample_text)
    assert "sk_test_1234567890" not in filtered
    assert "token1234567890123456" not in filtered
    assert "[REDACTED_SECRET]" in filtered


@pytest.mark.asyncio
async def test_afetch_web_content_mock_crawler():
    """Verify afetch_web_content uses injected crawler_instance for full JS extraction testing."""

    class MockCrawlResult:
        markdown = "# Founder Profile\nExtracted via Crawl4AI JS renderer."

    class MockCrawler:
        async def arun(self, url: str):
            return MockCrawlResult()

    url = "https://blog.example.com/post"
    raw_content = await afetch_web_content(url, crawler_instance=MockCrawler())

    assert isinstance(raw_content, RawContent)
    assert raw_content.extraction_quality == "full"
    assert "Extracted via Crawl4AI JS renderer." in raw_content.raw_text
    assert raw_content.wrapped_content.startswith("<untrusted_web_content>")
    assert raw_content.wrapped_content.endswith("</untrusted_web_content>")


@pytest.mark.asyncio
async def test_afetch_web_content_fallback_on_missing_crawler():
    """Verify afetch_web_content degrades gracefully to static fallback when crawler is missing."""
    url = "https://example.com/static-page"
    cfg = DiscoveryConfig(use_js_rendering=True, fallback_to_static=True)

    raw_content = await afetch_web_content(url, config=cfg)
    assert isinstance(raw_content, RawContent)
    assert raw_content.extraction_quality in ("full", "partial")
    assert raw_content.wrapped_content.startswith("<untrusted_web_content>")


@pytest.mark.asyncio
async def test_checker_scenario_1_rendering_failure_preserves_guardrails():
    """Checker Scenario 1 Fix: Verify afetch_web_content preserves XML guardrails even when JS crawler raises an exception."""

    class FailingCrawler:
        async def arun(self, url: str):
            raise RuntimeError("Playwright rendering engine crashed")

    url = "https://example.com/crashing-page"
    raw_content = await afetch_web_content(url, crawler_instance=FailingCrawler())

    assert isinstance(raw_content, RawContent)
    assert raw_content.extraction_quality == "partial"
    assert raw_content.wrapped_content.startswith("<untrusted_web_content>")
    assert raw_content.wrapped_content.endswith("</untrusted_web_content>")
    assert "Working on AI evaluation frameworks." in raw_content.raw_text


def test_checker_scenario_2_expanded_sensitive_token_redaction():
    """Checker Scenario 2 Fix: Verify filter_sensitive_tokens redacts diverse API key formats including sk-12345abcdef, ghp_, and AKIA."""
    sample_text = "Secrets: sk-12345abcdef and ghp_1234567890abcdef and AKIAIOSFODNN7EXAMPLE and secret_key='secret12345'."
    filtered = filter_sensitive_tokens(sample_text)
    assert "sk-12345abcdef" not in filtered
    assert "ghp_1234567890abcdef" not in filtered
    assert "AKIAIOSFODNN7EXAMPLE" not in filtered
    assert "secret12345" not in filtered
    assert filtered.count("[REDACTED_SECRET]") >= 3


@pytest.mark.asyncio
async def test_checker_scenario_3_content_size_truncation():
    """Checker Scenario 3 Fix: Verify afetch_web_content strictly truncates extracted markdown exceeding max_content_chars."""

    class HugeMarkdownCrawler:
        async def arun(self, url: str):
            class Res:
                markdown = "X" * 100000

            return Res()

    cfg = DiscoveryConfig(max_content_chars=50000)
    raw_content = await afetch_web_content(
        "https://example.com/huge", config=cfg, crawler_instance=HugeMarkdownCrawler()
    )

    assert len(raw_content.raw_text) == 50000
    assert (
        raw_content.wrapped_content
        == f"<untrusted_web_content>\n{'X' * 50000}\n</untrusted_web_content>"
    )


def test_deduplicate_sources_normalization():
    """Verify deduplicate_sources ignores query params, cases, and trailing slashes for dedupe."""
    url_adapter = TypeAdapter(HttpUrl)
    sources = [
        SearchResult(
            title="Interview Episode 1",
            url=url_adapter.validate_python("https://youtube.com/interview/"),
            source_type="interview",
            extracted_text="Content 1",
        ),
        SearchResult(
            title="Interview Episode 1 Dup",
            url=url_adapter.validate_python(
                "https://youtube.com/interview?ref=newsletter"
            ),
            source_type="interview",
            extracted_text="Content 1 duplicate",
        ),
        SearchResult(
            title="Unique Blog Post",
            url=url_adapter.validate_python("https://blog.com/unique-post"),
            source_type="blog",
            extracted_text="Unique blog content",
        ),
    ]

    deduped = deduplicate_sources(sources)
    assert len(deduped) == 2
    assert deduped[0].title == "Interview Episode 1"
    assert deduped[1].title == "Unique Blog Post"


def test_deduplicate_sources_www_subdomain():
    """Verify deduplicate_sources deduplicates www vs non-www hostnames."""
    url_adapter = TypeAdapter(HttpUrl)
    src1 = SearchResult(
        title="Interview",
        url=url_adapter.validate_python("https://www.example.com/video"),
        source_type="video",
        extracted_text="...",
    )
    src2 = SearchResult(
        title="Interview",
        url=url_adapter.validate_python("https://example.com/video"),
        source_type="video",
        extracted_text="...",
    )

    deduped = deduplicate_sources([src1, src2])
    assert len(deduped) == 1


def test_format_research_prompt_guardrails():
    """Verify mandatory guardrail instructions and XML tags are properly formatted in prompt."""
    url_adapter = TypeAdapter(HttpUrl)
    raw_contents = [
        RawContent(
            url=url_adapter.validate_python("https://example.com/site"),
            raw_text="Example scraped text.",
            wrapped_content="<untrusted_web_content>\nExample scraped text.\n</untrusted_web_content>",
        )
    ]
    system_prompt = "You are an assistant who summarizes web data."

    formatted_prompt = format_research_prompt(raw_contents, system_prompt)

    assert formatted_prompt.startswith(system_prompt)
    assert MANDATORY_GUARDRAIL_INSTRUCTION in formatted_prompt
    assert "--- BEGIN UNTRUSTED DATA ---" in formatted_prompt
    assert (
        "<untrusted_web_content>\nExample scraped text.\n</untrusted_web_content>"
        in formatted_prompt
    )
    assert "--- END UNTRUSTED DATA ---" in formatted_prompt


def test_format_research_prompt_newline_between_xml_blocks():
    """Verify format_research_prompt guarantees newline separation between multiple XML blocks."""
    rc1 = RawContent(
        url=TypeAdapter(HttpUrl).validate_python("https://example.com/1"),
        raw_text="foo",
        wrapped_content="<untrusted_web_content>foo</untrusted_web_content>",
    )
    rc2 = RawContent(
        url=TypeAdapter(HttpUrl).validate_python("https://example.com/2"),
        raw_text="bar",
        wrapped_content="<untrusted_web_content>bar</untrusted_web_content>",
    )

    prompt = format_research_prompt([rc1, rc2], system_prompt="You are a researcher.")
    assert "</untrusted_web_content>\n<untrusted_web_content>" in prompt


def test_discover_founders_by_criteria_tool():
    """Verify discover_founders_by_criteria tool runs default and custom execution blocks."""
    candidates = discover_founders_by_criteria(
        query="Agent evaluation",
        industry="DevTools",
        stage="Seed",
        tech_stack="FastAPI",
    )
    assert len(candidates) == 1
    assert candidates[0].full_name == "Maya Lin"
    assert candidates[0].company_stage == "Seed"

    def mock_llm_executor(prompt: str) -> list:
        return [
            {
                "full_name": "Bob Vance",
                "company_name": "Refrigeration AI",
                "company_stage": "Series A",
                "industry": "IoT",
                "tech_stack": "Python, Rust",
                "bio": "Building cold storage optimization agents.",
            }
        ]

    custom_candidates = discover_founders_by_criteria(
        query="Cold storage",
        industry="IoT",
        stage="Series A",
        tech_stack="Rust",
        llm_executor=mock_llm_executor,
    )
    assert len(custom_candidates) == 1
    assert custom_candidates[0].full_name == "Bob Vance"


def test_search_public_signals_tool():
    """Verify search_public_signals runs default and custom execution blocks."""
    results = search_public_signals(
        public_founder_name="Maya Lin",
        public_topics=["MCP", "AI Eval"],
    )
    assert len(results) == 1
    assert "Interview with Maya Lin" in results[0].title

    def mock_search_executor(name: str, topics: list) -> list:
        url_adapter = TypeAdapter(HttpUrl)
        return [
            {
                "title": f"Custom Post from {name}",
                "url": url_adapter.validate_python("https://linkedin.com/custom-post"),
                "source_type": "linkedin",
                "extracted_text": f"Discussing {', '.join(topics)}.",
            }
        ]

    custom_results = search_public_signals(
        public_founder_name="Alice",
        public_topics=["Vectara", "Pinecone"],
        search_executor=mock_search_executor,
    )
    assert len(custom_results) == 1
    assert custom_results[0].title == "Custom Post from Alice"
    assert "Discussing Vectara, Pinecone" in custom_results[0].extracted_text
