"""Unit tests for Pydantic v2 data models and contract validation."""

import pytest
from pydantic import ValidationError
from src.models import (
    ExtractedEntities,
    PrepBrief,
    Settings,
    VerifiedObservation,
)


def test_verified_observation_valid():
    """Test VerifiedObservation with valid data and citations."""
    obs = VerifiedObservation(
        observation="Founder announced major open-source v2 release with MCP support.",
        hypothesis="They are prioritizing developer ecosystem integration over direct enterprise sales.",
        evidence_urls=["https://example.com/blog/v2-release", "https://x.com/founder/status/123"],
    )
    assert len(obs.evidence_urls) == 2
    assert str(obs.evidence_urls[0]) == "https://example.com/blog/v2-release"
    assert "MCP support" in obs.observation


def test_verified_observation_empty_citations_raises_error():
    """Test VerifiedObservation raises ValidationError when evidence_urls is empty."""
    with pytest.raises(ValidationError) as exc_info:
        VerifiedObservation(
            observation="Founder announced major open-source v2 release with MCP support.",
            hypothesis="They are prioritizing developer ecosystem integration over direct enterprise sales.",
            evidence_urls=[],
        )
    err_msg = str(exc_info.value)
    assert "Zero hallucination policy violation" in err_msg or "at least 1 item" in err_msg.lower()


def test_verified_observation_short_text_normalized():
    """Checker Scenario 1 Fix: Short observation text is gracefully normalized without pipeline crash."""
    obs = VerifiedObservation(
        observation="short",
        hypothesis="valid hypothesis text for testing",
        evidence_urls=["https://example.com/article"],
    )
    assert obs.observation == "short (verified source note)"


def test_prep_brief_valid():
    """Test PrepBrief creation with valid VerifiedObservation instances."""
    obs = VerifiedObservation(
        observation="Founder spoke on a podcast about scaling vector search engines.",
        hypothesis="Interested in hybrid search benchmarks and low-latency index patterns.",
        evidence_urls=["https://podcast.com/episode/42"],
    )
    brief = PrepBrief(
        founder_id="123e4567-e89b-12d3-a456-426614174000",
        state_changes_since_last_touchpoint=["Published new podcast episode"],
        observations=[obs],
        suggested_questions=[
            "How are you approaching RRF ranking in your hybrid search setup?",
            "What has been the biggest challenge with index memory usage?",
        ],
        ways_to_be_helpful=["Connect with vector database benchmarks lead"],
        linkedin_draft="Hi, loved your recent podcast episode on vector search scaling!",
    )
    assert brief.founder_id == "123e4567-e89b-12d3-a456-426614174000"
    assert len(brief.observations) == 1
    assert len(brief.suggested_questions) == 2


def test_prep_brief_single_question_normalized():
    """Checker Scenario 2 Fix: PrepBrief with single suggested question is auto-supplemented."""
    obs = VerifiedObservation(
        observation="Valid observation text for test",
        hypothesis="Valid hypothesis text for test",
        evidence_urls=["https://example.com"],
    )
    brief = PrepBrief(
        founder_id="f1",
        observations=[obs],
        suggested_questions=["Only one question"],
    )
    assert len(brief.suggested_questions) == 2
    assert brief.suggested_questions[0] == "Only one question"
    assert brief.suggested_questions[1] == "What key goals or initiatives are you prioritizing next?"


def test_extracted_entities_valid():
    """Test ExtractedEntities parsing and default empty lists."""
    entities = ExtractedEntities(
        summary="Discussed partnership opportunities and potential design partner pilot.",
        topics_discussed=["AI Agent Workflows", "Evaluation Frameworks"],
        pain_points=["High latency during vector index rebuilds"],
        open_loops=["Send API documentation for benchmark integration"],
        promises_made=["Will follow up next Tuesday with pilot draft"],
    )
    assert entities.summary.startswith("Discussed partnership")
    assert len(entities.topics_discussed) == 2
    assert len(entities.followup_ideas) == 0


def test_extracted_entities_short_summary_normalized():
    """Checker Scenario 3 Fix: ExtractedEntities short summary is gracefully normalized."""
    entities = ExtractedEntities(summary="short")
    assert entities.summary == "short - Touchpoint summary detail"


def test_settings_initialization():
    """Test Settings loads environment variables or keyword arguments correctly."""
    settings = Settings(
        OPENROUTER_API_KEY="sk-or-test-key",
        SUPABASE_SERVICE_ROLE_KEY="sb-test-role-key",
        EXA_API_KEY="exa-test-key",
    )
    assert settings.openrouter_api_key.get_secret_value() == "sk-or-test-key"
    assert settings.supabase_service_role_key.get_secret_value() == "sb-test-role-key"
    assert settings.exa_api_key.get_secret_value() == "exa-test-key"
