"""Multi-provider LLM configuration and unified calling interface."""

from __future__ import annotations

import os

PROVIDERS = {
    "openai": {
        "label": "OpenAI",
        "env_var": "OPENAI_API_KEY",
        "models": ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1-nano"],
    },
    "anthropic": {
        "label": "Anthropic",
        "env_var": "ANTHROPIC_API_KEY",
        "models": ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929"],
    },
    "google": {
        "label": "Google",
        "env_var": "GOOGLE_API_KEY",
        "models": ["gemini-2.0-flash", "gemini-2.5-flash"],
    },
    "minimax": {
        "label": "Minimax",
        "env_var": "MINIMAX_API_KEY",
        "base_url": "https://api.minimax.chat/v1",
        "models": ["MiniMax-Text-01"],
    },
    "kimi": {
        "label": "Kimi (Moonshot)",
        "env_var": "KIMI_API_KEY",
        "base_url": "https://api.moonshot.cn/v1",
        "models": ["moonshot-v1-8k"],
    },
    "deepseek": {
        "label": "DeepSeek",
        "env_var": "DEEPSEEK_API_KEY",
        "base_url": "https://api.deepseek.com",
        "models": ["deepseek-chat"],
    },
}

PURPOSES = ["persona_enrichment", "vision", "comment_generation", "content_generation"]

# Providers that use the OpenAI SDK with a custom base_url
_OPENAI_COMPATIBLE = {"openai", "minimax", "kimi", "deepseek"}


def get_api_key(provider_id: str) -> str:
    """Get API key for a provider: check DB first, then env var."""
    try:
        from api.models import ProviderAPIKey
        obj = ProviderAPIKey.objects.filter(provider=provider_id).first()
        if obj:
            return obj.api_key
    except Exception:
        pass
    info = PROVIDERS.get(provider_id)
    if info:
        return os.environ.get(info["env_var"], "")
    return ""


def get_available_providers() -> list[dict]:
    """Return providers with their key availability status."""
    result = []
    for provider_id, info in PROVIDERS.items():
        result.append({
            "id": provider_id,
            "label": info["label"],
            "has_key": bool(get_api_key(provider_id)),
            "models": info["models"],
        })
    return result


def _call_openai_compatible(api_key: str, model: str, prompt: str, max_tokens: int, base_url: str | None = None) -> str:
    from openai import OpenAI

    kwargs: dict = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url

    client = OpenAI(**kwargs)
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()


def _call_anthropic(api_key: str, model: str, prompt: str, max_tokens: int) -> str:
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def _call_google(api_key: str, model: str, prompt: str, max_tokens: int) -> str:
    from google import genai

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=genai.types.GenerateContentConfig(max_output_tokens=max_tokens),
    )
    return response.text.strip()


def call_llm(purpose: str, prompt: str, max_tokens: int = 300) -> str | None:
    """Look up config for purpose, call the right provider, return text response.

    Returns None if no config, no API key, or on any error.
    """
    try:
        from api.models import LLMConfig

        config = LLMConfig.objects.filter(purpose=purpose, enabled=True).first()
        if config is None:
            return None

        provider_id = config.provider
        model = config.model
        effective_max_tokens = config.max_tokens or max_tokens

        provider_info = PROVIDERS.get(provider_id)
        if provider_info is None:
            return None

        api_key = get_api_key(provider_id)
        if not api_key:
            return None

        if provider_id in _OPENAI_COMPATIBLE:
            base_url = provider_info.get("base_url")
            return _call_openai_compatible(api_key, model, prompt, effective_max_tokens, base_url)
        elif provider_id == "anthropic":
            return _call_anthropic(api_key, model, prompt, effective_max_tokens)
        elif provider_id == "google":
            return _call_google(api_key, model, prompt, effective_max_tokens)

        return None
    except Exception:
        return None
