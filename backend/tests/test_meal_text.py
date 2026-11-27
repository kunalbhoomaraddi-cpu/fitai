"""Log a meal by voice or text: the AI (or the built-in reader) lists foods and portions; FitAI's food
database does the calories; nothing is saved until the person adds it."""
import json

import pytest

from app.ai.provider import ProviderError
from app.services import meal_text_service as svc


class FakeAI:
    name, model, is_real_llm, label = "gemini", "gemini-test", True, "gemini:gemini-test"

    def __init__(self, reply):
        self.reply, self.prompts = reply, []

    def generate_json(self, system, prompt):
        self.prompts.append(prompt)
        if isinstance(self.reply, Exception):
            raise self.reply
        return json.dumps(self.reply)


@pytest.fixture
def ai(monkeypatch):
    def use(reply):
        fake = FakeAI(reply)
        monkeypatch.setattr(svc, "get_provider", lambda pref=None: fake)
        return fake
    return use


def _describe(client, auth, text):
    r = client.post("/api/nutrition/describe", json={"text": text}, headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


def test_built_in_reader_understands_everyday_english(client, auth):
    r = _describe(client, auth, "two rotis, a bowl of dal and a glass of milk")
    got = [(i["name"], i["grams"], i["portion"]) for i in r["items"]]
    assert got == [("Roti / Phulka (no ghee)", 80, "2 × medium roti"), ("Dal Tadka / Toor Dal", 150, "1 × katori / bowl"),
                   ("Milk (full cream)", 250, "1 × glass")]
    assert all(i["basis"] == "database" for i in r["items"])
    assert r["totals"]["calories"] == sum(i["calories"] for i in r["items"])
    assert r["source"] == "rules" and "built-in reader" in r["notice"]   # the test setup has no AI


@pytest.mark.parametrize("text,expected", [
    ("200 g curd and half plate rice", [("Curd / Dahi", 200), ("Steamed Rice (white)", 125)]),
    ("3 eggs + 1 banana", [("Boiled Egg", 150), ("Banana", 100)]),
    ("5 almonds", [("Almonds", 6.0)]),                                  # not 500 g, and not badam milk
    ("2 slices of bread", [("Whole-grain bread", 60)]),                 # bread, not bread pakora
    ("I had 2 idlis with sambar for breakfast", [("Idli", 80), ("Sambar", 150)]),
])
def test_built_in_reader_portions(client, auth, text, expected):
    items, _ = svc.rule_parse(text)
    assert [(i["name"], i["grams"]) for i in items] == expected


def test_unknown_foods_are_reported_not_guessed(client, auth):
    r = _describe(client, auth, "a cup of green tea and 2 kiwis")
    assert r["items"] == [] and set(r["not_found"]) == {"green tea", "kiwis"}


def test_ai_reads_hindi_and_the_database_does_the_maths(client, auth, ai):
    fake = ai({"items": [
        {"name": "Roti", "aliases": ["chapati"], "count": 2, "unit": "roti", "grams": 80, "kcal_per_100g": 999, "confidence": 0.9},
        {"name": "Dal Tadka", "count": 1, "unit": "katori", "grams": 150, "kcal_per_100g": 120, "confidence": 0.9},
        {"name": "Mystery Mithai", "grams": 50, "kcal_per_100g": 420, "protein_per_100g": 6, "carbs_per_100g": 60,
         "fat_per_100g": 18, "confidence": 0.6},
    ]})
    r = _describe(client, auth, "मैंने दो रोटी और एक कटोरी दाल खाई और थोड़ी मिठाई")
    assert "दो रोटी" in fake.prompts[0]                       # the words reach the AI as spoken
    roti, dal, sweet = r["items"]
    assert roti["basis"] == "database" and roti["calories"] < 300 # the database's figure, not the AI's 999/100 g
    assert dal["basis"] == "database"
    assert sweet["basis"] == "ai_estimate" and sweet["calories"] == 210   # unknown food: the AI's estimate, labelled
    assert r["source"] == "gemini:gemini-test" and r["notice"] is None


def test_ai_failure_falls_back_to_the_built_in_reader(client, auth, ai):
    ai(ProviderError("down", retryable=True))
    r = _describe(client, auth, "2 idlis and sambar")
    assert [i["name"] for i in r["items"]] == ["Idli", "Sambar"] and r["source"] == "rules"


def test_hindi_without_ai_says_so(client, auth, ai):
    ai(ProviderError("down", retryable=True))
    r = _describe(client, auth, "दो रोटी और दाल")
    assert r["items"] == [] and "Hindi and Kannada need the AI" in r["notice"]


def test_items_log_with_the_voice_tag(client, auth):
    item = _describe(client, auth, "one dosa")["items"][0]
    r = client.post("/api/nutrition/entries", headers=auth, json={
        "eaten_on": "2026-11-20", "meal": "breakfast", "name": item["name"], "quantity_g": item["grams"],
        "calories": item["calories"], "protein_g": item["protein_g"], "carbs_g": item["carbs_g"], "fat_g": item["fat_g"],
        "source": "voice", "source_id": item["source_id"]})
    assert r.status_code == 201 and r.json()["source"] == "voice"


def test_describe_rules(client, auth):
    assert client.post("/api/nutrition/describe", json={"text": "x"}, headers=auth).status_code == 422
    assert client.post("/api/nutrition/describe", json={"text": "a" * 501}, headers=auth).status_code == 422
    assert client.post("/api/nutrition/describe", json={"text": "two rotis"}).status_code in (401, 403)
