"""LLM Provider Configuration & Auto-Resolution for Owl & Compass.

Automatically detects and configures OpenAI-compatible client settings for:
- Google Gemini (using GEMINI_API_KEY, GOOGLE_API_KEY, or LLM_API_KEY with gemini models)
- OpenAI (using OPENAI_API_KEY or LLM_API_KEY)
- OpenRouter (using OPENROUTER_API_KEY or LLM_API_KEY)
- Groq (using GROQ_API_KEY or LLM_API_KEY)
- Local Ollama / Custom endpoints
"""

import os
from typing import Tuple

PROVIDER_BASE_URLS = {
    "google": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
    "openai": "https://api.openai.com/v1",
    "ollama": "http://localhost:11434/v1",
}


def resolve_llm_config() -> Tuple[str, str, str]:
    """Resolves (api_key, base_url, model) automatically from environment variables.

    Supports zero-config provider resolution so users do not need to manually pass base URLs.
    """
    # Resolve API Key in priority order
    api_key = (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("OPENROUTER_API_KEY")
        or os.getenv("GROQ_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or os.getenv("LLM_API_KEY")
        or ""
    )

    explicit_base_url = os.getenv("LLM_BASE_URL")
    model = os.getenv("LLM_MODEL") or "gemini-2.0-flash"

    # If base_url is explicitly provided, respect it unconditionally
    if explicit_base_url:
        return api_key, explicit_base_url, model

    # Auto-detect base_url based on present environment keys or model naming patterns
    if (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or model.startswith("gemini")
    ):
        base_url = PROVIDER_BASE_URLS["google"]
    elif os.getenv("GROQ_API_KEY") or model.startswith("llama-") or "groq" in model:
        base_url = PROVIDER_BASE_URLS["groq"]
    elif os.getenv("OPENROUTER_API_KEY") or "/" in model:
        base_url = PROVIDER_BASE_URLS["openrouter"]
    elif "ollama" in model or "localhost" in os.getenv("LLM_HOST", ""):
        base_url = PROVIDER_BASE_URLS["ollama"]
    else:
        base_url = PROVIDER_BASE_URLS["openai"]

    return api_key, base_url, model
