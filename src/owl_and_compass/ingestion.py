"""Map-Reduce Touchpoint Ingestion Pipeline for Owl & Compass."""

import asyncio
import random
from typing import Any, Callable, Dict, List, Optional
from owl_and_compass.models import ExtractedEntities

MAX_PAYLOAD_CHARS = 50000
CHUNK_SIZE_CHARS = 4000
CONCURRENCY_LIMIT = 5


def normalize_touchpoint_input(raw_text: str) -> List[str]:
    """Clean and split raw touchpoint text into parallelizable segments (~4k chars each).

    Raises ValueError if raw_text exceeds MAX_PAYLOAD_CHARS (50,000 chars) or is empty.
    Guarantees every segment is <= CHUNK_SIZE_CHARS (4,000 chars).
    """
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise ValueError("Touchpoint payload cannot be empty.")

    cleaned_text = raw_text.strip()
    if len(cleaned_text) > MAX_PAYLOAD_CHARS:
        raise ValueError(
            f"Payload length ({len(cleaned_text)} chars) exceeds maximum allowable size of {MAX_PAYLOAD_CHARS} characters."
        )

    if len(cleaned_text) <= CHUNK_SIZE_CHARS:
        return [cleaned_text]

    segments: List[str] = []
    lines = cleaned_text.splitlines(keepends=True)
    current_chunk: List[str] = []
    current_len = 0

    for line in lines:
        # Hard sub-chunking if a single line exceeds CHUNK_SIZE_CHARS
        while len(line) > CHUNK_SIZE_CHARS:
            if current_chunk:
                segments.append("".join(current_chunk).strip())
                current_chunk = []
                current_len = 0
            segments.append(line[:CHUNK_SIZE_CHARS].strip())
            line = line[CHUNK_SIZE_CHARS:]

        if not line:
            continue

        if current_len + len(line) > CHUNK_SIZE_CHARS and current_chunk:
            segments.append("".join(current_chunk).strip())
            current_chunk = [line]
            current_len = len(line)
        else:
            current_chunk.append(line)
            current_len += len(line)

    if current_chunk:
        segments.append("".join(current_chunk).strip())

    return [s for s in segments if s]


def _default_mock_extractor(segment: str, source_type: str) -> ExtractedEntities:
    """Default fallback extraction logic for testing segment parsing."""
    summary_snippet = segment[:80].replace("\n", " ").strip()
    return ExtractedEntities(
        summary=f"Parsed {source_type} segment: {summary_snippet}",
        topics_discussed=["Founders", "Tech Stack"],
        pain_points=["Scaling Vector DB"],
        open_loops=["Send API Documentation"],
        promises_made=["Follow up next week"],
        followup_ideas=["Schedule tech deep dive"],
    )


async def extract_touchpoint_entities(
    segments: List[str],
    source_type: str,
    extractor_fn: Optional[Callable[[str, str], ExtractedEntities]] = None,
) -> ExtractedEntities:
    """Execute bounded parallel map-reduce extraction over text segments.

    Uses asyncio.Semaphore(5) concurrency limiting, return_exceptions=True for chunk isolation,
    and cross-segment entity deduplication. Raises RuntimeError if all chunks fail.
    """
    if not segments:
        raise ValueError("Segments list cannot be empty.")

    semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
    extractor = extractor_fn or _default_mock_extractor

    async def _process_chunk(chunk: str) -> Optional[ExtractedEntities]:
        async with semaphore:
            if asyncio.iscoroutinefunction(extractor):
                return await extractor(chunk, source_type)
            return extractor(chunk, source_type)

    tasks = [_process_chunk(chunk) for chunk in segments]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successful_extractions = [
        res for res in results if isinstance(res, ExtractedEntities)
    ]
    if not successful_extractions:
        raise RuntimeError(
            f"Total extraction failure: All {len(segments)} chunks encountered errors during extraction."
        )

    summaries: List[str] = []
    topics: List[str] = []
    pains: List[str] = []
    loops: List[str] = []
    promises: List[str] = []
    followups: List[str] = []

    def _dedupe_add(target: List[str], items: List[str]):
        for item in items:
            clean_item = item.strip()
            if clean_item and clean_item not in target:
                target.append(clean_item)

    for i, res in enumerate(results):
        if isinstance(res, Exception):
            summaries.append(f"[Chunk {i+1} extraction failed: {type(res).__name__}]")
            continue
        if isinstance(res, ExtractedEntities):
            if res.summary:
                summaries.append(res.summary)
            _dedupe_add(topics, res.topics_discussed)
            _dedupe_add(pains, res.pain_points)
            _dedupe_add(loops, res.open_loops)
            _dedupe_add(promises, res.promises_made)
            _dedupe_add(followups, res.followup_ideas)

    combined_summary = (
        " | ".join(summaries)
        if summaries
        else "No touchpoint entities extracted successfully."
    )

    return ExtractedEntities(
        summary=combined_summary,
        topics_discussed=topics,
        pain_points=pains,
        open_loops=loops,
        promises_made=promises,
        followup_ideas=followups,
    )


async def append_timeline_event(
    founder_id: str,
    events: List[Dict[str, Any]],
    db_executor: Optional[Callable[[str, List[Dict[str, Any]]], bool]] = None,
    max_retries: int = 3,
    lock_timeout_seconds: float = 5.0,
) -> List[Dict[str, Any]]:
    """Sort extracted events sequentially by offset/timestamp in memory and batch insert.

    Uses non-blocking asyncio.sleep for exponential backoff to preserve event loop performance.
    """
    if not founder_id or not isinstance(founder_id, str):
        raise ValueError("Invalid founder_id provided.")
    if not events:
        return []

    # Sort events sequentially in memory by document offset or occurred_at timestamp
    sorted_events = sorted(
        events, key=lambda e: (e.get("offset", 0), e.get("occurred_at", ""))
    )

    if db_executor is None:
        return sorted_events

    attempts = 0
    while attempts < max_retries:
        try:
            attempts += 1
            if asyncio.iscoroutinefunction(db_executor):
                success = await db_executor(founder_id, sorted_events)
            else:
                success = db_executor(founder_id, sorted_events)

            if success:
                return sorted_events
            raise RuntimeError("Database insertion lock acquisition failed.")
        except Exception as e:
            if attempts >= max_retries:
                raise RuntimeError(
                    f"Failed to append timeline events for founder {founder_id} after {max_retries} attempts: {e}"
                ) from e
            # Non-blocking async sleep with exponential backoff and jitter
            backoff = (0.1 * (2 ** (attempts - 1))) + random.uniform(0.01, 0.05)
            await asyncio.sleep(backoff)

    return sorted_events
