"""FitAI agent loop: LLM reasoning + controlled backend tools.

flow: user message -> provider.step(tools) -> tool calls executed in Python against the DB ->
results returned to the model -> final explanation. Tool results also become UI cards."""
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.ai.mock import MockProvider
from app.ai.prompts import coach_system_prompt
from app.ai.provider import LLMProvider, ProviderError, get_provider
from app.models import User
from app.tools.registry import execute_tool, tool_specs
from app.utils.redact import describe_error

log = logging.getLogger("fitai.agent")
MAX_STEPS = 5
HISTORY_TURNS = 12


def _strip_card(result: dict) -> dict:
    return {k: v for k, v in result.items() if k != "_card"}


def _run(provider: LLMProvider, db: Session, user: User, history: list[tuple[str, str]], text: str):
    state = provider.start(coach_system_prompt(user), history, text)
    cards: list[dict] = []
    tools_used: list[str] = []
    specs = tool_specs()
    for _ in range(MAX_STEPS):
        res = provider.step(state, specs)
        if not res.tool_calls:
            return res.text, cards, tools_used
        results = []
        for call in res.tool_calls:
            out = execute_tool(db, user, call.name, call.args)
            tools_used.append(call.name)
            if isinstance(out, dict) and out.get("_card"):
                cards.append(out["_card"])
            payload = _strip_card(out) if isinstance(out, dict) else {"result": out}
            # keep payloads compact for the model
            if len(json.dumps(payload, default=str)) > 6000:
                payload = {k: v for k, v in payload.items() if k not in ("records", "weekly_counts", "last_7_days")}
            results.append((call, payload))
        provider.add_tool_results(state, results)
    final = provider.step(state, None)
    return final.text, cards, tools_used


def run_coach(db: Session, user: User, history: list[tuple[str, str]], text: str) -> dict:
    provider = get_provider(user.ai_provider_pref)
    notice = None
    try:
        reply, cards, tools_used = _run(provider, db, user, history, text)
        if not reply:
            reply = "I ran the numbers above — let me know what you'd like to dig into next."
    except ProviderError as e:
        log.warning("AI provider %s failed: %s", provider.name, describe_error(e))
        notice = f"{provider.name.title()} is unavailable right now ({e}). Showing a demo response instead."
        provider = MockProvider()
        reply, cards, tools_used = _run(provider, db, user, history, text)
    # de-duplicate cards of the same type/title
    seen, uniq = set(), []
    for c in cards:
        key = (c.get("type"), c.get("title"))
        if key not in seen:
            seen.add(key)
            uniq.append(c)
    return {"content": reply, "cards": uniq, "tools_used": list(dict.fromkeys(tools_used)),
            "provider": provider.label, "is_real_llm": provider.is_real_llm, "notice": notice}
