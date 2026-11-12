"""Runs every AI feature through a simulated *real* LLM provider (long model name, tool calls,
JSON outputs). Catches database issues (e.g. PostgreSQL VARCHAR limits) that the mock provider can't."""
import json

import pytest

from app.ai import provider as prov
from app.ai.provider import LLMProvider, LLMResult, ToolCall

LONG_MODEL = "gemini-3.5-flash-lite-preview-with-a-deliberately-long-model-name"


class FakeLLM(LLMProvider):
    name = "gemini"
    model = LONG_MODEL
    is_real_llm = True

    def start(self, system, history, user_message):
        return {"n": 0, "results": []}

    def step(self, state, tools):
        state["n"] += 1
        if state["n"] == 1 and tools:
            return LLMResult(tool_calls=[ToolCall(id="c1", name="calculate_macros", args={}),
                                         ToolCall(id="c2", name="get_weight_history", args={"days": 30})])
        return LLMResult(text="Here is your plan, based on the numbers above.")

    def add_tool_results(self, state, results):
        state["results"].extend(results)

    def generate_json(self, system, prompt):
        if "weekly check-in" in system:
            return json.dumps({"headline": "Strong week, keep stacking wins " * 10, "wins": ["Trained hard. " * 40, 7, None],
                               "focus": ["Log dinner daily."], "next_week": ["Complete 3 workouts", "Log 5 days"]})
        if "Meals in order" in prompt:
            n = prompt.count("kcal)")
            meal = {"name": "Paneer bowl " * 20, "instructions": "Cook it. " * 200,
                    "items": [{"name": "Paneer", "grams": 120, "calories": 320, "protein_g": 22, "carbs_g": 4, "fat_g": 24}]}
            return json.dumps({"meals": [meal] * n, "coach_note": "Balanced plan. " * 200})
        return json.dumps({"coach_note": "Progress by adding reps. " * 120, "recommendation": "Walk 30 minutes today.",
                           "summary": "Steady progress.", "highlights": ["Trend down"], "next_steps": ["Log food"]})


@pytest.fixture
def real_llm(monkeypatch):
    monkeypatch.setattr(prov, "get_provider", lambda pref=None: FakeLLM())
    for mod in ("app.ai.agent", "app.routers.diet", "app.routers.workouts", "app.routers.progress", "app.routers.dashboard", "app.services.checkin_service"):
        monkeypatch.setattr(f"{mod}.get_provider", lambda pref=None: FakeLLM())


def test_all_ai_features_persist_with_real_provider(client, auth, real_llm):
    r = client.post("/api/coach/chat", json={"message": "How much protein do I need?"}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["message"]["provider"].startswith("gemini:") and "calculate_macros" in r.json()["message"]["tools_used"]

    r = client.post("/api/diet/generate", json={"meals_per_day": 4, "use_ai": True}, headers=auth)
    assert r.status_code == 201, r.text
    assert r.json()["generated_by"].startswith("llm:gemini") and r.json()["meals"][0]["nutrition_source"] == "ai_estimate"

    for split, muscles in [("custom", ["shoulders", "biceps", "triceps"]), ("auto", []), ("push_pull_legs", [])]:
        r = client.post("/api/workouts/generate", json={"split": split, "target_muscles": muscles, "days_per_week": 3, "use_ai": True}, headers=auth)
        assert r.status_code == 201, r.text
        assert r.json()["generated_by"].startswith("fitai_engine+llm:gemini")

    assert client.post("/api/progress/ai-analysis", headers=auth).status_code == 200
    r = client.get("/api/dashboard?refresh_recommendation=true", headers=auth)
    assert r.status_code == 200 and r.json()["recommendation"]["text"]


def test_weekly_checkin_with_real_provider(client, auth, real_llm):
    r = client.post("/api/checkins/generate", headers=auth)
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["is_ai"] and len(c["generated_by"]) <= 100 and c["notice"] is None
    assert len(c["summary"]["headline"]) <= 120 and all(isinstance(x, str) and len(x) <= 240 for x in c["summary"]["wins"])
