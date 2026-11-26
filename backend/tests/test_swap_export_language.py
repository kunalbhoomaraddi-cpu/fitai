"""Swapping an exercise mid-workout, the hotel-room workout, 'Export my data' and the coach's language."""
import io
import json
import zipfile


def _start(client, auth, **body):
    r = client.post("/api/workouts/sessions/start", json=body, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


# --------------------------------------------------------------------------- swap
def test_swap_an_exercise_mid_workout(client, auth):
    s = _start(client, auth)
    first = s["exercises"][0]
    alts = client.get(f"/api/workouts/sessions/{s['id']}/alternatives?index=0", headers=auth).json()
    assert alts and alts[0]["same_muscle"] and alts[0]["muscle"] == first["muscle"]
    in_session = {e["exercise_id"] for e in s["exercises"]}
    assert not in_session & {a["exercise_id"] for a in alts}                       # never suggests one already planned
    profile_eq = {"dumbbells", "bodyweight"}
    assert all(set(a["equipment"]) & profile_eq for a in alts)                     # only equipment they have
    r = client.post(f"/api/workouts/sessions/{s['id']}/swap", json={"index": 0, "exercise_id": alts[0]["exercise_id"]}, headers=auth)
    assert r.status_code == 200
    new = r.json()["exercises"][0]
    assert new["exercise_id"] == alts[0]["exercise_id"] and new["swapped_from"] == first["name"]
    assert new["sets"] == first["sets"] and new["sets_done"] == 0


def test_swap_rules(client, auth, second_user):
    s = _start(client, auth)
    sid = s["id"]
    assert client.post(f"/api/workouts/sessions/{sid}/swap", json={"index": 0, "exercise_id": "barbell_squat"}, headers=auth).status_code == 400  # no barbell
    assert client.post(f"/api/workouts/sessions/{sid}/swap", json={"index": 0, "exercise_id": "nope"}, headers=auth).status_code == 400
    assert client.get(f"/api/workouts/sessions/{sid}/alternatives?index=0", headers=second_user).status_code == 404
    # sets already logged: swapping would throw them away
    ex = s["exercises"]
    ex[0]["set_log"] = [{"kg": 10, "reps": 10, "done": True}]
    ex[0]["sets_done"] = 1
    client.patch(f"/api/workouts/sessions/{sid}", json={"exercises": ex}, headers=auth)
    alt = client.get(f"/api/workouts/sessions/{sid}/alternatives?index=0", headers=auth).json()[0]["exercise_id"]
    assert client.post(f"/api/workouts/sessions/{sid}/swap", json={"index": 0, "exercise_id": alt}, headers=auth).status_code == 409
    client.patch(f"/api/workouts/sessions/{sid}", json={"status": "completed"}, headers=auth)
    assert client.get(f"/api/workouts/sessions/{sid}/alternatives?index=1", headers=auth).status_code == 409   # finished


def test_hotel_room_workout_needs_no_equipment(client, auth):
    s = _start(client, auth, travel=True)
    assert s["name"] == "Hotel-room workout" and len(s["exercises"]) >= 4
    assert all(e["equipment"] == ["bodyweight"] for e in s["exercises"])
    alts = client.get(f"/api/workouts/sessions/{s['id']}/alternatives?index=0", headers=auth).json()
    assert alts and all(a["equipment"] == ["bodyweight"] or "bodyweight" in a["equipment"] for a in alts)  # still no gym kit
    assert client.post(f"/api/workouts/sessions/{s['id']}/swap", json={"index": 0, "exercise_id": "goblet_squat"}, headers=auth).status_code == 400


# --------------------------------------------------------------------------- export
def test_export_contains_everything_but_secrets(client, auth, second_user):
    client.post("/api/nutrition/entries", headers=auth, json={"name": "Masala dosa", "eaten_on": "2026-11-20", "meal": "breakfast",
                "quantity_g": 200, "calories": 330, "protein_g": 8, "carbs_g": 50, "fat_g": 11, "source": "custom"})
    client.post("/api/nutrition/water", json={"ml": 500}, headers=auth)
    from tests.test_photos import _up
    assert _up(client, auth).status_code == 201
    client.post("/api/nutrition/entries", headers=second_user, json={"name": "Someone else's lunch", "eaten_on": "2026-11-20",
                "meal": "lunch", "quantity_g": 100, "calories": 100, "protein_g": 1, "carbs_g": 1, "fat_g": 1, "source": "custom"})

    r = client.get("/api/settings/export", headers=auth)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    assert "attachment" in r.headers["content-disposition"]
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    assert {"README.txt", "fitai-data.json", "food_log.csv", "weights.csv", "workout_sets.csv"} <= set(names)
    data = json.loads(z.read("fitai-data.json"))
    assert [f["name"] for f in data["food_log"]] == ["Masala dosa"]                 # only their own data
    assert data["water"][0]["ml"] == 500 and data["profile"]["current_weight_kg"] == 70
    photo = data["progress_photos"][0]["file"]
    assert photo in names and z.read(photo)[:2] == b"\xff\xd8"                       # a real JPEG
    raw = z.read("fitai-data.json").decode()
    assert "hashed_password" not in raw and "$2b$" not in raw and "code_hash" not in raw
    assert "Masala dosa" in z.read("food_log.csv").decode()
    assert client.get("/api/settings/export").status_code in (401, 403)


# --------------------------------------------------------------------------- language
def test_coach_language_setting(client, auth):
    assert client.get("/api/auth/me", headers=auth).json()["coach_language"] == "en"
    assert client.put("/api/settings", json={"coach_language": "kn"}, headers=auth).json()["user"]["coach_language"] == "kn"
    assert client.put("/api/settings", json={"coach_language": "fr"}, headers=auth).status_code == 422
    from app.ai.prompts import coach_system_prompt
    from app.database import SessionLocal
    from app.models import User
    uid = client.get("/api/auth/me", headers=auth).json()["id"]
    with SessionLocal() as db:
        assert "Kannada script" in coach_system_prompt(db.get(User, uid))
    client.put("/api/settings", json={"coach_language": "hi"}, headers=auth)
    with SessionLocal() as db:
        assert "Devanagari" in coach_system_prompt(db.get(User, uid))


def test_demo_coach_says_it_replies_in_english(client, auth):
    client.put("/api/settings", json={"coach_language": "hi", "ai_provider_pref": "mock"}, headers=auth)
    r = client.post("/api/coach/chat", json={"message": "How much protein should I eat?"}, headers=auth)
    assert r.status_code == 200, r.text
    assert "Hindi replies need the AI coach" in (r.json().get("notice") or "")


def test_starter_questions_follow_the_language(client, auth):
    assert "How much protein do I need?" in client.get("/api/coach/suggestions", headers=auth).json()
    client.put("/api/settings", json={"coach_language": "kn"}, headers=auth)
    kn = client.get("/api/coach/suggestions", headers=auth).json()
    assert len(kn) == 8 and all(any("ಀ" <= ch <= "೿" for ch in q) for q in kn)  # Kannada script
    client.put("/api/settings", json={"coach_language": "hi"}, headers=auth)
    hi = client.get("/api/coach/suggestions", headers=auth).json()
    assert all(any("ऀ" <= ch <= "ॿ" for ch in q) for q in hi)                   # Devanagari
