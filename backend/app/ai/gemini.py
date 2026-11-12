"""Google Gemini provider via the public REST API (generativelanguage.googleapis.com, v1beta).
Uses native function calling. The model's content objects are appended to history verbatim,
which preserves `thoughtSignature` fields required by Gemini 3 models during tool use."""
from __future__ import annotations

import logging
import time

import httpx

from app.ai.provider import LLMProvider, LLMResult, ProviderError, ToolCall, ToolSpec
from app.config import get_settings

log = logging.getLogger("fitai.ai.gemini")
BASE = "https://generativelanguage.googleapis.com/v1beta"


def _to_gemini_schema(schema: dict) -> dict:
    out: dict = {}
    for k, v in schema.items():
        if k == "type":
            out["type"] = str(v).upper()
        elif k == "properties":
            out["properties"] = {pk: _to_gemini_schema(pv) for pk, pv in v.items()}
        elif k == "items":
            out["items"] = _to_gemini_schema(v)
        elif k in ("description", "enum", "required", "format", "minimum", "maximum", "nullable"):
            out[k] = v
    return out


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, fallback_model: str | None = None):
        self.api_key = api_key
        self.model = model
        self.fallback_model = fallback_model
        s = get_settings()
        self.timeout = s.ai_timeout_seconds
        self.max_retries = s.ai_max_retries

    # ------------------------------------------------------------------ http
    def _post(self, model: str, body: dict) -> dict:
        url = f"{BASE}/models/{model}:generateContent"
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        last_err: ProviderError | None = None
        for attempt in range(self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as c:
                    r = c.post(url, json=body, headers=headers)
            except httpx.HTTPError as e:
                last_err = ProviderError(f"Network error contacting Gemini ({type(e).__name__})", retryable=True)
            else:
                if r.status_code == 200:
                    return r.json()
                msg = ""
                try:
                    msg = r.json().get("error", {}).get("message", "")[:300]
                except Exception:
                    pass
                retryable = r.status_code in (429, 500, 502, 503, 504)
                last_err = ProviderError(
                    {429: "Gemini rate limit or free-tier quota reached",
                     400: "Gemini rejected the request", 401: "Gemini API key is invalid",
                     403: "Gemini API key is invalid or lacks access", 404: f"Gemini model '{model}' not found"}
                    .get(r.status_code, f"Gemini error {r.status_code}") + (f": {msg}" if msg else ""),
                    retryable=retryable, status=r.status_code)
                if not retryable:
                    raise last_err
            if attempt < self.max_retries:
                time.sleep(min(8, 1.5 * (2 ** attempt)))
        raise last_err or ProviderError("Gemini request failed")

    def _generate(self, body: dict) -> dict:
        try:
            return self._post(self.model, body)
        except ProviderError as e:
            if self.fallback_model and self.fallback_model != self.model and (e.retryable or e.status == 404):
                log.warning("Gemini primary model failed (%s); trying fallback %s", e.status, self.fallback_model)
                data = self._post(self.fallback_model, body)
                self.model = self.fallback_model
                return data
            raise

    # ------------------------------------------------------------------ agent API
    def start(self, system: str, history: list[tuple[str, str]], user_message: str) -> dict:
        contents = [{"role": "model" if r == "assistant" else "user", "parts": [{"text": t}]} for r, t in history if t]
        contents.append({"role": "user", "parts": [{"text": user_message}]})
        return {"system": system, "contents": contents}

    def step(self, state: dict, tools: list[ToolSpec] | None) -> LLMResult:
        body: dict = {"systemInstruction": {"parts": [{"text": state["system"]}]}, "contents": state["contents"],
                      "generationConfig": {"temperature": 0.6, "maxOutputTokens": 2048}}
        if tools:
            body["tools"] = [{"functionDeclarations": [
                {"name": t.name, "description": t.description, "parameters": _to_gemini_schema(t.parameters)}
                for t in tools]}]
        data = self._generate(body)
        cands = data.get("candidates") or []
        if not cands:
            reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
            raise ProviderError(f"Gemini returned no answer ({reason})")
        content = cands[0].get("content") or {"role": "model", "parts": []}
        content.setdefault("role", "model")
        state["contents"].append(content)
        res = LLMResult()
        texts = []
        for part in content.get("parts", []):
            if "functionCall" in part:
                fc = part["functionCall"]
                res.tool_calls.append(ToolCall(id=fc.get("id") or "", name=fc["name"],
                                               args=fc.get("args") or {}))
            elif "text" in part and not part.get("thought"):
                texts.append(part["text"])
        res.text = "".join(texts).strip()
        return res

    def add_tool_results(self, state: dict, results: list[tuple[ToolCall, dict]]) -> None:
        parts = []
        for call, result in results:
            fr = {"name": call.name, "response": {"result": result}}
            if call.id:  # echo ids issued by Gemini
                fr["id"] = call.id
            parts.append({"functionResponse": fr})
        state["contents"].append({"role": "user", "parts": parts})

    def generate_json(self, system: str, prompt: str) -> str:
        body = {"systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json", "maxOutputTokens": 4096}}
        data = self._generate(body)
        try:
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts if not p.get("thought"))
        except (KeyError, IndexError):
            raise ProviderError("Gemini returned an empty JSON response")
