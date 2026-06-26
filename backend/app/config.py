"""Central configuration, loaded from environment variables.

Secrets are read from the environment only — never hard-coded. In production
they are injected via `--env-file` (Docker) or systemd/host env (VM).
"""
from __future__ import annotations

import os
from functools import lru_cache


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_float(value: str | None, default: float) -> float:
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


class Settings:
    """Runtime settings. Instantiated once via `get_settings()`."""

    def __init__(self) -> None:
        self.port: int = int(os.getenv("PORT", "8787"))
        self.log_level: str = os.getenv("LOG_LEVEL", "info")

        # Primary provider: Google Gemini
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()

        # Fallback provider: OpenAI
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o").strip()

        # Latency / cost controls
        self.llm_timeout_seconds: float = _as_float(os.getenv("LLM_TIMEOUT_SECONDS"), 12.0)
        self.request_budget_seconds: float = _as_float(os.getenv("REQUEST_BUDGET_SECONDS"), 25.0)
        self.use_llm: bool = _as_bool(os.getenv("USE_LLM"), True)

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def llm_enabled(self) -> bool:
        """LLM is usable only if enabled AND at least one provider key exists."""
        return self.use_llm and (self.has_gemini or self.has_openai)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
