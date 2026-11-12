import os

from app.ai import provider as prov
from app.ai.gemini import GeminiProvider, _to_gemini_schema
from app.ai.mock import MockProvider
from app.config import get_settings


def test_falls_back_to_mock_without_keys():
    assert isinstance(prov.get_provider("auto"), MockProvider)
    assert isinstance(prov.get_provider("gemini"), MockProvider)


def test_gemini_selected_when_key_present(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-key")
    get_settings.cache_clear()
    try:
        p = prov.get_provider("auto")
        assert isinstance(p, GeminiProvider) and p.model == get_settings().gemini_model
        assert isinstance(prov.get_provider("mock"), MockProvider)
    finally:
        monkeypatch.delenv("GEMINI_API_KEY")
        get_settings.cache_clear()


def test_schema_conversion():
    s = _to_gemini_schema({"type": "object", "properties": {"days": {"type": "integer"}, "x": {"type": "array", "items": {"type": "string"}}}})
    assert s["type"] == "OBJECT" and s["properties"]["days"]["type"] == "INTEGER" and s["properties"]["x"]["items"]["type"] == "STRING"


def test_gemini_tool_loop_with_fake_http(monkeypatch):
    """Simulates Gemini choosing a tool, then answering; verifies the function-response round trip."""
    calls = []

    def fake_post(self, model, body):
        calls.append(body)
        if len(calls) == 1:
            return {"candidates": [{"content": {"role": "model", "parts": [
                {"functionCall": {"name": "calculate_bmr", "args": {}}, "thoughtSignature": "sig"}]}}]}
        return {"candidates": [{"content": {"role": "model", "parts": [{"text": "Your BMR is shown above."}]}}]}

    monkeypatch.setattr(GeminiProvider, "_post", fake_post)
    p = GeminiProvider("k", "gemini-test")
    state = p.start("sys", [], "what's my bmr")
    r1 = p.step(state, [prov.ToolSpec("calculate_bmr", "d", {"type": "object", "properties": {}})])
    assert r1.tool_calls[0].name == "calculate_bmr"
    p.add_tool_results(state, [(r1.tool_calls[0], {"bmr": 1700})])
    r2 = p.step(state, None)
    assert r2.text.startswith("Your BMR")
    # thought signature preserved, function response sent back
    assert calls[1]["contents"][1]["parts"][0]["thoughtSignature"] == "sig"
    assert calls[1]["contents"][2]["parts"][0]["functionResponse"]["response"]["result"]["bmr"] == 1700
