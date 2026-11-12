"""Groq provider (OpenAI-compatible chat completions with tool calling). Optional alternative."""
from __future__ import annotations

import json
import time

import httpx

from app.ai.provider import LLMProvider, LLMResult, ProviderError, ToolCall, ToolSpec
from app.config import get_settings

URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, api_key: str, model: str):
        self.api_key, self.model = api_key, model
        s = get_settings()
        self.timeout, self.max_retries = s.ai_timeout_seconds, s.ai_max_retries

    def _post(self, body: dict) -> dict:
        last: ProviderError | None = None
        for attempt in range(self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as c:
                    r = c.post(URL, json=body, headers={"Authorization": f"Bearer {self.api_key}"})
            except httpx.HTTPError as e:
                last = ProviderError(f"Network error contacting Groq ({type(e).__name__})", retryable=True)
            else:
                if r.status_code == 200:
                    return r.json()
                retryable = r.status_code in (429, 500, 502, 503)
                last = ProviderError(f"Groq error {r.status_code}", retryable=retryable, status=r.status_code)
                if not retryable:
                    raise last
            if attempt < self.max_retries:
                time.sleep(1.5 * (2 ** attempt))
        raise last or ProviderError("Groq request failed")

    def start(self, system, history, user_message):
        msgs = [{"role": "system", "content": system}]
        msgs += [{"role": r, "content": t} for r, t in history if t]
        msgs.append({"role": "user", "content": user_message})
        return {"messages": msgs}

    def step(self, state, tools: list[ToolSpec] | None) -> LLMResult:
        body = {"model": self.model, "messages": state["messages"], "temperature": 0.6, "max_tokens": 2048}
        if tools:
            body["tools"] = [{"type": "function", "function": {"name": t.name, "description": t.description,
                                                                "parameters": t.parameters}} for t in tools]
        data = self._post(body)
        msg = data["choices"][0]["message"]
        state["messages"].append({k: v for k, v in msg.items() if k in ("role", "content", "tool_calls")})
        res = LLMResult(text=(msg.get("content") or "").strip())
        for tc in msg.get("tool_calls") or []:
            try:
                args = json.loads(tc["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            res.tool_calls.append(ToolCall(id=tc["id"], name=tc["function"]["name"], args=args))
        return res

    def add_tool_results(self, state, results):
        for call, result in results:
            state["messages"].append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result, default=str)})

    def generate_json(self, system, prompt):
        data = self._post({"model": self.model, "temperature": 0.7, "response_format": {"type": "json_object"},
                           "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]})
        return data["choices"][0]["message"]["content"]
