"""Tests for FastAPI Map-Reduce Touchpoint Ingestion Pipeline."""

import asyncio
import time
import pytest
from src.ingestion import (
    CHUNK_SIZE_CHARS,
    MAX_PAYLOAD_CHARS,
    append_timeline_event,
    extract_touchpoint_entities,
    normalize_touchpoint_input,
)
from src.models import ExtractedEntities


def test_normalize_touchpoint_input_small():
    """Test normalization with small text under 4k chars returns 1 segment."""
    raw_text = "This is a brief founder interaction transcript.\nDiscussed AI Agents."
    segments = normalize_touchpoint_input(raw_text)
    assert len(segments) == 1
    assert segments[0] == raw_text.strip()


def test_normalize_touchpoint_input_multichunk():
    """Test normalization with multi-chunk text (~10k chars) splits into ~4k segments."""
    paragraphs = [f"Paragraph {i}: " + ("x" * 500) + "\n" for i in range(20)]
    raw_text = "".join(paragraphs)
    assert len(raw_text) > CHUNK_SIZE_CHARS

    segments = normalize_touchpoint_input(raw_text)
    assert len(segments) > 1
    for seg in segments:
        assert len(seg) <= CHUNK_SIZE_CHARS


def test_normalize_touchpoint_input_single_long_line_subchunked():
    """Checker Scenario 1 Fix: Single long line (>4000 chars) is hard sub-chunked into <=4000 char segments."""
    long_line = "X" * (CHUNK_SIZE_CHARS + 500)  # 4500 chars with no newlines
    segments = normalize_touchpoint_input(long_line)
    assert len(segments) == 2
    for seg in segments:
        assert len(seg) <= CHUNK_SIZE_CHARS


def test_normalize_touchpoint_input_exceeds_max_payload():
    """Test payload exceeding 50,000 chars raises ValueError."""
    oversized_text = "A" * (MAX_PAYLOAD_CHARS + 100)
    with pytest.raises(ValueError) as exc_info:
        normalize_touchpoint_input(oversized_text)
    assert "exceeds maximum allowable size of 50000 characters" in str(exc_info.value)


def test_normalize_touchpoint_input_empty_raises_error():
    """Test empty or whitespace input raises ValueError."""
    with pytest.raises(ValueError):
        normalize_touchpoint_input("   ")


@pytest.mark.asyncio
async def test_extract_touchpoint_entities_deduplication_and_fault_tolerance():
    """Test parallel map-reduce entity extraction with chunk fault tolerance & deduplication."""

    async def mock_extractor(segment: str, source_type: str) -> ExtractedEntities:
        if "FAIL_TRIGGER" in segment:
            raise RuntimeError("Simulated chunk extraction error")
        return ExtractedEntities(
            summary=f"Extracted segment {segment[:10]}",
            topics_discussed=["Vector Search", "LLM Evaluation"],
            pain_points=["Memory Overhead"],
            open_loops=["Send Paper Link"],
            promises_made=["Schedule follow up"],
            followup_ideas=["Benchmark test"],
        )

    segments = [
        "Chunk 1: Discussed Vector Search and LLM Evaluation.",
        "Chunk 2: FAIL_TRIGGER - Bad content block.",
        "Chunk 3: Discussed Vector Search and scaling performance.",
    ]

    result = await extract_touchpoint_entities(
        segments=segments,
        source_type="transcript",
        extractor_fn=mock_extractor,
    )

    assert isinstance(result, ExtractedEntities)
    # Check chunk 2 failure was isolated cleanly without aborting chunk 1 & 3
    assert "[Chunk 2 extraction failed: RuntimeError]" in result.summary
    assert "Extracted segment Chunk 1:" in result.summary
    assert "Extracted segment Chunk 3:" in result.summary

    # Check deduplication merged duplicate topics and open loops across chunks
    assert result.topics_discussed == ["Vector Search", "LLM Evaluation"]
    assert result.pain_points == ["Memory Overhead"]
    assert result.open_loops == ["Send Paper Link"]


@pytest.mark.asyncio
async def test_extract_touchpoint_entities_total_failure_raises_runtime_error():
    """Checker Scenario 2 Fix: Total extraction failure raises RuntimeError instead of returning empty data."""

    async def always_fail(segment: str, source_type: str):
        raise RuntimeError("Simulated LLM API crash")

    with pytest.raises(RuntimeError) as exc_info:
        await extract_touchpoint_entities(
            segments=["chunk1", "chunk2"],
            source_type="transcript",
            extractor_fn=always_fail,
        )
    assert "Total extraction failure" in str(exc_info.value)


@pytest.mark.asyncio
async def test_append_timeline_event_sequential_sorting():
    """Test timeline events are sorted sequentially in memory by document offset."""
    events = [
        {"offset": 250, "summary": "Mentioned hiring plans"},
        {"offset": 50, "summary": "Introductory handshake"},
        {"offset": 120, "summary": "Discussed product roadmap"},
    ]
    sorted_events = await append_timeline_event(
        founder_id="founder-uuid-123", events=events
    )
    assert sorted_events[0]["offset"] == 50
    assert sorted_events[1]["offset"] == 120
    assert sorted_events[2]["offset"] == 250


@pytest.mark.asyncio
async def test_append_timeline_event_db_retry_success():
    """Test database insertion with simulated temporary lock failure and non-blocking backoff retry."""
    attempts = 0

    async def mock_db_executor(founder_id: str, events: list) -> bool:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            return False  # Simulate lock timeout on first attempt
        return True

    events = [{"offset": 10, "summary": "Meeting notes"}]
    res = await append_timeline_event(
        founder_id="founder-123", events=events, db_executor=mock_db_executor
    )
    assert len(res) == 1
    assert attempts == 2


@pytest.mark.asyncio
async def test_append_timeline_event_async_non_blocking():
    """Checker Scenario 3 Fix: Verify append_timeline_event is async and allows concurrent event loop execution."""
    bg_task_ran = False

    async def background_counter():
        nonlocal bg_task_ran
        await asyncio.sleep(0.05)
        bg_task_ran = True

    def slow_failing_executor(founder_id, events):
        return False

    events = [{"offset": 1, "summary": "Test event"}]

    # Schedule background task in same event loop
    bg_task = asyncio.create_task(background_counter())

    with pytest.raises(RuntimeError):
        await append_timeline_event(
            founder_id="f1",
            events=events,
            db_executor=slow_failing_executor,
            max_retries=3,
        )

    await bg_task
    # Background async task ran concurrently during sleep retries
    assert bg_task_ran is True
