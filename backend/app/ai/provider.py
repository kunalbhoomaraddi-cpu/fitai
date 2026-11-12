"""LLM provider abstraction. Each provider keeps its own native message history inside a
`state` dict so tool-calling round-trips (incl. Gemini thought signatures) are preserved exactly."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.config import get_settings

log = logging.getLogger("fitai.ai")


class ProviderError(Exception):
    """Raised when an LLM provider can't serve a request (bad key, quota, outage)."""

    def __init__(self, message: str, retryable: bool = False, status: int | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.status = status


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict


@dataclass
class LLMResult:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict  # JSON schema (type: object)


class LLMProvider(ABC):
    name: str = "base"
    model: str = ""
    is_real_llm: bool = True

    @property
    def label(self) -> str:
        return f"{self.name}:{self.model}" if self.model else self.name

    @abstractmethod
    def start(self, system: str, history: list[tuple[str, str]], user_message: str) -> dict: ...

    @abstractmethod
    def step(self, state: dict, tools: list[ToolSpec] | None) -> LLMResult: ...

    @abstractmethod
    def add_tool_results(self, state: dict, results: list[tuple[ToolCall, dict]]) -> None: ...

    @abstractmethod
    def generate_json(self, system: str, prompt: str) -> str: ...


def available_providers() -> dict:
    s = get_settings()
    return {"gemini": bool(s.gemini_api_key), "groq": bool(s.groq_api_key), "mock": True}


def get_provider(preference: str | None = None) -> LLMProvider:
    """Resolve the provider: user preference -> server default -> first configured -> mock."""
    from app.ai.gemini import GeminiProvider
    from app.ai.groq import GroqProvider
    from app.ai.mock import MockProvider

    s = get_settings()
    avail = available_providers()
    order: list[str] = []
    for p in (preference, s.ai_provider):
        if p and p != "auto":
            order.append(p)
    order += ["gemini", "groq"]
    for p in order:
        if p == "mock":
            return MockProvider()
        if p == "gemini" and avail["gemini"]:
            return GeminiProvider(s.gemini_api_key, s.gemini_model, s.gemini_fallback_model)
        if p == "groq" and avail["groq"]:
            return GroqProvider(s.groq_api_key, s.groq_model)
    return MockProvider()


def ai_status(preference: str | None = None) -> dict:
    p = get_provider(preference)
    s = get_settings()
    return {
        "active_provider": p.name, "model": p.model, "is_real_llm": p.is_real_llm,
        "configured": available_providers(), "server_default": s.ai_provider,
        "message": None if p.is_real_llm else
        "No LLM API key is configured, so FitAI is running in demo mode. The coach uses a rule-based engine "
        "with your real data and the same deterministic tools. Add GEMINI_API_KEY to backend/.env to enable the AI coach.",
    }
