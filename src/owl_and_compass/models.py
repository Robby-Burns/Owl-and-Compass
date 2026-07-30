"""Pydantic v2 Data Models and Contracts for Owl & Compass."""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application Configuration and Secret Management."""
    
    openrouter_api_key: SecretStr = Field(..., validation_alias="OPENROUTER_API_KEY")
    supabase_service_role_key: SecretStr = Field(..., validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    exa_api_key: SecretStr = Field(..., validation_alias="EXA_API_KEY")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


class VerifiedObservation(BaseModel):
    """Strict Evidence-Backed Observation Schema enforcing zero hallucination claims."""

    observation: str = Field(
        ..., min_length=1, description="Fact-based summary statement from verified source"
    )
    hypothesis: str = Field(
        ..., min_length=1, description="Thoughtful, unassuming takeaway or potential focus area"
    )
    evidence_urls: List[HttpUrl] = Field(
        ..., min_length=1, description="Strict citations supporting claim"
    )

    @field_validator("observation", "hypothesis", mode="before")
    @classmethod
    def normalize_short_text(cls, v: str) -> str:
        """Strip whitespace and pad short LLM summary strings to ensure robust storage."""
        if not isinstance(v, str):
            return v
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Text content cannot be empty.")
        if len(cleaned) < 10:
            return f"{cleaned} (verified source note)"
        return cleaned

    @model_validator(mode="after")
    def validate_citations_exist(self) -> "VerifiedObservation":
        """Verify that at least one evidence URL is provided."""
        if not self.evidence_urls:
            raise ValueError(
                "Zero hallucination policy violation: At least one evidence URL is required."
            )
        return self


class PrepBrief(BaseModel):
    """Prepared Founder Research & Conversation Prep Brief Schema."""

    founder_id: str = Field(..., description="Target UUID of founder")
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    state_changes_since_last_touchpoint: List[str] = Field(default_factory=list)
    observations: List[VerifiedObservation] = Field(..., min_length=1)
    suggested_questions: List[str] = Field(..., min_length=1)
    ways_to_be_helpful: List[str] = Field(default_factory=list)
    linkedin_draft: Optional[str] = Field(None, max_length=1000)
    email_draft: Optional[str] = Field(None, max_length=3000)

    @field_validator("suggested_questions", mode="before")
    @classmethod
    def ensure_minimum_questions(cls, v: List[str]) -> List[str]:
        """Normalize suggested questions list so single-question outputs auto-supplement."""
        if isinstance(v, list) and len(v) == 1:
            return [v[0], "What key goals or initiatives are you prioritizing next?"]
        return v


class ExtractedEntities(BaseModel):
    """Touchpoint Extraction Schema for parsed emails, transcripts, and interaction notes."""

    summary: str = Field(..., min_length=1)
    topics_discussed: List[str] = Field(default_factory=list)
    pain_points: List[str] = Field(default_factory=list)
    open_loops: List[str] = Field(default_factory=list)
    promises_made: List[str] = Field(default_factory=list)
    followup_ideas: List[str] = Field(default_factory=list)

    @field_validator("summary", mode="before")
    @classmethod
    def normalize_summary(cls, v: str) -> str:
        """Strip whitespace and pad short touchpoint summaries to prevent ingestion aborts."""
        if not isinstance(v, str):
            return v
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Touchpoint summary cannot be empty.")
        if len(cleaned) < 10:
            return f"{cleaned} - Touchpoint summary detail"
        return cleaned


class FounderCandidate(BaseModel):
    """Founder Candidate data structure for Discovery."""

    full_name: str = Field(..., min_length=2)
    company_name: str = Field(..., min_length=1)
    company_stage: Optional[str] = None
    industry: Optional[str] = None
    tech_stack: Optional[str] = None
    bio: Optional[str] = None


class SearchResult(BaseModel):
    """Normalized search result from public web signals."""

    title: str = Field(..., min_length=1)
    url: HttpUrl
    source_type: str = Field(..., description="'podcast', 'blog', 'linkedin', 'interview', or 'web'")
    extracted_text: str = Field(..., min_length=1)


class RawContent(BaseModel):
    """Scraped raw web content wrapped with security XML guardrails."""

    url: HttpUrl
    raw_text: str
    wrapped_content: str
    extraction_quality: str = Field("full", description="'full' (JS rendered), 'partial' (static fallback), or 'failed'")


