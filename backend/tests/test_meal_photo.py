"""Snap your meal: the AI identifies foods and portions; FitAI's database calculates the nutrition."""
import io
import json

import pytest
from PIL import Image

from app.ai.provider import ProviderError
from app.services import meal_photo_service as svc


def _jpeg(w=640, h=480, color=(200, 150, 90)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "JPEG")
    return buf.getvalue()


class FakeGemini:
    name, model, is_real_llm = "gemini", "gemini-test", True
    label = "gemini:gemini-test"

    def __init__(self, reply: dict | str | Exception):
        self.reply, self.calls = reply, []

    def generate_json_with_image(self, system, prompt, image_b64, mime="image/jpeg"):
        self.calls.append(image_b64)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply if isinstance(self.reply, str) else json.dumps(self.reply)


PLATE = {"is_food": True, "note": "A Karnataka thali.", "items": [
    {"name": "Jowar roti", "aliases": ["jolada rotti"], "count": 2, "unit": "roti", "grams": 90, "confidence": 0.9,
     "kcal_per_100g": 999, "protein_per_100g": 1, "carbs_per_100g": 1, "fat_per_100g": 1},
    {"name": "Toor dal", "aliases": ["dal"], "grams": 150, "count": 1, "unit": "katori", "confidence": 0.8},
    {"name": "Mystery chutney", "aliases": [], "grams": 30, "kcal_per_100g": 120, "protein_per_100g": 2,
     "carbs_per_100g": 10, "fat_per_100g": 8, "confidence": 0.4},
    {"name": "Unknown thing", "grams": 50},  # no database match and no estimate -> dropped
]}


@pytest.fixture
def gemini(monkeypatch):
    def use(reply):
        fake = FakeGemini(reply)
        monkeypatch.setattr(svc, "get_provider", lambda pref=None: fake)
        return fake
    svc._daily.clear()
    return use


def _post(client, auth, data=None):
    return client.post("/api/nutrition/photo", files={"file": ("meal.jpg", data or _jpeg(), "image/jpeg")}, headers=auth)


def test_database_calculates_not_the_ai(client, auth, gemini):
    fake = gemini(PLATE)
    r = _post(client, auth)
    assert r.status_code == 200, r.text
    body = r.json()
    names = [i["name"] for i in body["items"]]
    assert len(body["items"]) == 3 and "Unknown thing" not in str(names)
    roti = body["items"][0]
    assert roti["basis"] == "database" and roti["source_id"].startswith("in:")
    assert roti["per_100g"]["calories"] != 999  # the AI's number is ignored when the database knows the food
    assert roti["calories"] == round(roti["per_100g"]["calories"] * 0.9) and roti["portion"] == "2 roti"
    chutney = body["items"][2]
    assert chutney["basis"] == "ai_estimate" and chutney["calories"] == 36 and chutney["source_id"] is None
    assert body["totals"]["calories"] == sum(i["calories"] for i in body["items"])
    assert body["note"] == "A Karnataka thali." and body["is_food"] is True
    assert len(fake.calls) == 1 and len(fake.calls[0]) < 400_000  # photo downsized before sending


def test_photo_is_not_stored(client, auth, gemini):
    from sqlalchemy import func, select

    from app.database import SessionLocal
    from app.models import ProgressPhoto
    gemini(PLATE)
    with SessionLocal() as db:
        before = db.scalar(select(func.count()).select_from(ProgressPhoto))
    assert _post(client, auth).status_code == 200
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(ProgressPhoto)) == before


def test_items_can_be_added_to_the_log(client, auth, gemini):
    gemini(PLATE)
    item = _post(client, auth).json()["items"][0]
    r = client.post("/api/nutrition/entries", headers=auth, json={
        "meal": "lunch", "name": item["name"], "quantity_g": item["grams"], "calories": item["calories"],
        "protein_g": item["protein_g"], "carbs_g": item["carbs_g"], "fat_g": item["fat_g"],
        "source": "meal_photo", "source_id": item["source_id"]})
    assert r.status_code == 201, r.text


def test_no_food_in_photo(client, auth, gemini):
    gemini({"is_food": False, "items": [], "note": "This looks like a laptop."})
    body = _post(client, auth).json()
    assert body["is_food"] is False and body["items"] == [] and "laptop" in body["note"]


def test_messy_ai_answer_is_still_read(client, auth, gemini):
    gemini('```json\n{"items": [{"name": "masala dosa", "grams": 200}]}\n```')
    assert _post(client, auth).json()["items"][0]["name"] == "Masala Dosa"


def test_ai_failure_is_a_friendly_error(client, auth, gemini):
    gemini(ProviderError("quota", retryable=True, status=429))
    r = _post(client, auth)
    assert r.status_code == 502 and "add foods by hand" in r.json()["detail"]


def test_needs_gemini(client, auth, monkeypatch):
    from app.ai.mock import MockProvider
    monkeypatch.setattr(svc, "get_provider", lambda pref=None: MockProvider())
    r = _post(client, auth)
    assert r.status_code == 503 and "Gemini" in r.json()["detail"]


def test_rejects_non_photos(client, auth, gemini):
    gemini(PLATE)
    assert client.post("/api/nutrition/photo", files={"file": ("x.txt", b"hello", "text/plain")}, headers=auth).status_code == 415
    assert _post(client, auth, _jpeg(60, 60)).status_code == 400


def test_daily_limit(client, auth, gemini, monkeypatch):
    gemini(PLATE)
    monkeypatch.setattr(svc.get_settings(), "meal_photo_daily_limit", 2)
    assert _post(client, auth).status_code == 200 and _post(client, auth).status_code == 200
    r = _post(client, auth)
    assert r.status_code == 429 and "2 meal photos today" in r.json()["detail"]


def test_requires_login(client):
    assert client.post("/api/nutrition/photo", files={"file": ("m.jpg", _jpeg(), "image/jpeg")}).status_code == 401


def test_shared_word_is_not_a_match():
    """A dish the database doesn't list by that name must not borrow another dish's numbers."""
    from app.services.meal_photo_service import match_food

    assert match_food("Dal curry", [])["name"].startswith("Dal")  # 'curry' dropped -> dal
    assert match_food("Chicken curry", [])["name"] == "Chicken Curry"
    assert match_food("Malabar parotta", [])["name"] == "Kerala Parotta"
    assert match_food("Chapathi", [])["name"].startswith("Roti")  # typo still understood
    assert match_food("Xyzzy curry", []) is None  # unknown -> AI estimate, never "Egg Curry"


def test_search_box_keeps_loose_matching():
    from app.services.nutrition_service import search_indian_foods

    assert search_indian_foods("chapathi", 1)[0]["name"].startswith("Roti")
