"""Tests for LLM provider resolution in Owl & Compass."""

import os
from src.llm_provider import resolve_llm_config, PROVIDER_BASE_URLS


def test_resolve_google_gemini_key(monkeypatch):
    """Test auto-resolution of Google Gemini when GEMINI_API_KEY is present."""
    monkeypatch.setenv("GEMINI_API_KEY", "test_gemini_key_123")
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)

    api_key, base_url, model = resolve_llm_config()
    assert api_key == "test_gemini_key_123"
    assert base_url == PROVIDER_BASE_URLS["google"]
    assert model == "gemini-2.0-flash"


def test_resolve_google_by_model_name(monkeypatch):
    """Test auto-resolution of Google Gemini when model name starts with gemini."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("LLM_API_KEY", "test_generic_key")
    monkeypatch.setenv("LLM_MODEL", "gemini-1.5-pro")
    monkeypatch.delenv("LLM_BASE_URL", raising=False)

    api_key, base_url, model = resolve_llm_config()
    assert api_key == "test_generic_key"
    assert base_url == PROVIDER_BASE_URLS["google"]
    assert model == "gemini-1.5-pro"


def test_resolve_explicit_base_url_override(monkeypatch):
    """Test that explicit LLM_BASE_URL takes precedence over auto-detection."""
    monkeypatch.setenv("LLM_API_KEY", "custom_key")
    monkeypatch.setenv("LLM_BASE_URL", "https://custom.proxy.com/v1")
    monkeypatch.setenv("LLM_MODEL", "gemini-2.0-flash")

    api_key, base_url, model = resolve_llm_config()
    assert api_key == "custom_key"
    assert base_url == "https://custom.proxy.com/v1"
    assert model == "gemini-2.0-flash"


def test_resolve_openrouter_by_model_format(monkeypatch):
    """Test auto-resolution of OpenRouter for namespaced models like anthropic/claude-3-5-sonnet."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("LLM_API_KEY", "or_key")
    monkeypatch.setenv("LLM_MODEL", "anthropic/claude-3.5-sonnet")
    monkeypatch.delenv("LLM_BASE_URL", raising=False)

    api_key, base_url, model = resolve_llm_config()
    assert api_key == "or_key"
    assert base_url == PROVIDER_BASE_URLS["openrouter"]
    assert model == "anthropic/claude-3.5-sonnet"
