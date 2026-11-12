import json
from datetime import date, datetime, timedelta

from app.database import SessionLocal
from app.models import FoodEntry, WeightRecord, WorkoutSession
from app.services import checkin_service


def _uid(client, auth):
    return client.get("/api/auth/me", headers=auth).json()["id"]


def _seed(uid, workouts=3, food_days=5, protein=130, weights=((13, 70.6), (10, 70.4), (5, 70.2), (2, 70.1), (0, 70.0))):
    today = date.today()
    with SessionLocal() as db:
        for i in range(workouts):
            t = datetime.combine(today - timedelta(days=i * 2), datetime.min.time()) + timedelta(hours=8)
            db.add(WorkoutSession(user_id=uid, name=f"Day {i + 1}", started_at=t, completed_at=t + timedelta(minutes=45),
                                  duration_minutes=45, exercises=[], status="completed"))
        for i in range(food_days):
            db.add(FoodEntry(user_id=uid, eaten_on=today - timedelta(days=i), meal="lunch", name="Meal", quantity_g=500,
                             calories=1700, protein_g=protein, carbs_g=150, fat_g=55, source="custom"))
        for ago, kg in weights:
            db.add(WeightRecord(user_id=uid, recorded_on=today - timedelta(days=ago), weight_kg=kg))
        db.commit()


def test_empty_week_and_due_flag(client, auth):
    cur = client.get("/api/checkins/current", headers=auth).json()
    assert cur["due"] is True and cur["checkin"] is None
    r = client.post("/api/checkins/generate", headers=auth)
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["score"] == 0 and c["generated_by"] == "rules_engine" and "Demo mode" in c["notice"]
    assert c["summary"]["headline"] and c["summary"]["wins"] and c["summary"]["next_week"]
    assert client.get("/api/checkins/current", headers=auth).json()["due"] is False


def test_facts_score_and_one_per_week(client, auth):
    _seed(_uid(client, auth))
    c = client.post("/api/checkins/generate", headers=auth).json()
    f = c["facts"]
    assert f["workouts"]["done"] == 3 and f["workouts"]["planned"] == 3 and f["workouts"]["minutes"] == 135
    assert f["nutrition"]["days_logged"] == 5 and f["nutrition"]["avg_calories"] == 1700
    assert f["nutrition"]["protein_days"] == 5
    assert f["weight"]["weigh_ins"] >= 3 and f["weight"]["prev_avg_kg"] == 70.5 and f["weight"]["change_kg"] < 0
    assert c["score"] == 100 and not f["weight"]["losing_too_fast"]
    assert any("workout" in w.lower() or "trained" in w.lower() for w in c["summary"]["wins"])
    # regenerating replaces this week's check-in instead of adding a second one
    client.post("/api/checkins/generate", headers=auth)
    assert len(client.get("/api/checkins", headers=auth).json()) == 1


def test_fast_loss_is_flagged(client, auth):
    _seed(_uid(client, auth), workouts=1, food_days=2, protein=40, weights=((10, 74.0), (8, 74.0), (3, 72.5), (1, 72.3)))
    c = client.post("/api/checkins/generate", headers=auth).json()
    assert c["facts"]["weight"]["losing_too_fast"] is True
    assert any("eating enough" in x for x in c["summary"]["focus"])
    assert c["score"] == round(40 * 1 / 3 + 30 * 2 / 5)


def test_checkins_are_private(client, auth):
    cid = client.post("/api/checkins/generate", headers=auth).json()["id"]
    r = client.post("/api/auth/register", json={"full_name": "Other", "email": "peek@example.com", "password": "secret123"})
    from tests.conftest import PROFILE, verify
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, h, "peek@example.com")
    client.put("/api/profile", json=PROFILE, headers=h)
    assert client.get("/api/checkins", headers=h).json() == []
    assert client.delete(f"/api/checkins/{cid}", headers=h).status_code == 404
    assert client.delete(f"/api/checkins/{cid}", headers=auth).status_code == 204


def test_bad_llm_json_falls_back(monkeypatch, client, auth):
    class Broken:
        is_real_llm, label = True, "gemini:test"
        def generate_json(self, s, p):
            return json.dumps(["not", "an", "object"])
    monkeypatch.setattr(checkin_service, "get_provider", lambda pref=None: Broken())
    c = client.post("/api/checkins/generate", headers=auth).json()
    assert c["generated_by"] == "rules_engine" and "unavailable" in c["notice"]
