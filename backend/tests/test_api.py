from datetime import date, timedelta


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_register_validation_and_duplicate(client):
    assert client.post("/api/auth/register", json={"full_name": "A", "email": "bad", "password": "x"}).status_code == 422
    body = {"full_name": "Dup User", "email": "dup@example.com", "password": "secret123"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    assert client.post("/api/auth/register", json=body).status_code == 409


def test_login(client):
    from tests.conftest import LOGIN_CODES, verify
    r = client.post("/api/auth/register", json={"full_name": "Log In", "email": "login@example.com", "password": "secret123"})
    verify(client, {"Authorization": f"Bearer {r.json()['access_token']}"}, "login@example.com")
    assert client.post("/api/auth/login", json={"email": "login@example.com", "password": "wrong999"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "LOGIN@example.com", "password": "secret123"})
    assert r.status_code == 200 and r.json()["otp_required"] is True and "access_token" not in r.json()
    r = client.post("/api/auth/login/verify", json={"otp_token": r.json()["otp_token"], "code": LOGIN_CODES["login@example.com"]})
    assert r.status_code == 200 and r.json()["access_token"]


def test_protected_requires_token(client):
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/dashboard", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_profile_persists_and_targets(client, auth):
    p = client.get("/api/profile", headers=auth).json()
    assert p["goal"] == "weight_loss" and p["start_weight_kg"] == 70
    t = client.get("/api/profile/targets", headers=auth).json()
    assert t["calories"]["calorie_target"] >= 1200
    assert client.get("/api/auth/me", headers=auth).json()["onboarding_complete"] is True


def test_dashboard(client, auth):
    r = client.get("/api/dashboard", headers=auth)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["weight"]["current_kg"] == 70 and d["targets"]["calories"] > 0
    assert d["quote"]["text"] and d["recommendation"]["text"]


def test_nutrition_crud_and_isolation(client, auth):
    e = {"meal": "breakfast", "name": "Oats", "quantity_g": 60, "calories": 233, "protein_g": 10, "carbs_g": 40, "fat_g": 4}
    r = client.post("/api/nutrition/entries", json=e, headers=auth)
    assert r.status_code == 201
    eid = r.json()["id"]
    day = client.get("/api/nutrition/day", headers=auth).json()
    assert day["totals"]["calories"] == 233 and day["by_meal"]["breakfast"]["count"] == 1
    assert client.patch(f"/api/nutrition/entries/{eid}", json={"calories": 300}, headers=auth).json()["calories"] == 300
    # another user cannot touch it
    r2 = client.post("/api/auth/register", json={"full_name": "Other", "email": "other@example.com", "password": "secret123"})
    h2 = {"Authorization": f"Bearer {r2.json()['access_token']}"}
    from tests.conftest import verify
    verify(client, h2, "other@example.com")
    assert client.delete(f"/api/nutrition/entries/{eid}", headers=h2).status_code == 404
    assert client.delete(f"/api/nutrition/entries/{eid}", headers=auth).status_code == 204
    assert client.post("/api/nutrition/entries", json={**e, "calories": -5}, headers=auth).status_code == 422


def test_food_search_offline_fallback(client, auth):
    r = client.get("/api/nutrition/search", params={"q": "paneer"}, headers=auth).json()
    assert r["source"] == "reference" and any("Paneer" in x["name"] for x in r["results"])


def test_weight_tracking_and_analysis(client, auth):
    for i, w in enumerate([69.6, 69.4, 69.0]):
        d = (date.today() - timedelta(days=6 - i * 3)).isoformat()
        assert client.post("/api/progress/weights", json={"weight_kg": w, "recorded_on": d}, headers=auth).status_code == 201
    a = client.get("/api/progress/analysis", headers=auth).json()
    assert a["weight"]["current_weight_kg"] == 69.0
    assert a["weight"]["goal_progress_pct"] > 0
    assert client.post("/api/progress/weights", json={"weight_kg": 10}, headers=auth).status_code == 422
    ai = client.post("/api/progress/ai-analysis", headers=auth).json()
    assert ai["is_real_llm"] is False and ai["summary"]


def test_measurements(client, auth):
    assert client.post("/api/progress/measurements", json={"waist_cm": 80}, headers=auth).status_code == 201
    assert client.post("/api/progress/measurements", json={}, headers=auth).status_code == 400


def test_diet_plan_generation_respects_restrictions(client, auth):
    r = client.post("/api/diet/generate", json={"meals_per_day": 4}, headers=auth)
    assert r.status_code == 201, r.text
    plan = r.json()
    assert len(plan["meals"]) == 4 and plan["generated_by"] == "reference_engine"
    keys = [i["food_key"] for m in plan["meals"] for i in m["items"]]
    assert not {"chicken_breast", "fish", "salmon", "egg", "almonds", "peanut_butter"} & set(keys)
    assert 0.75 < plan["totals"]["calories"] / plan["targets"]["calorie_target"] < 1.25
    pid = plan["id"]
    assert client.post(f"/api/diet/plans/{pid}/regenerate-meal", json={"slot": 1}, headers=auth).status_code == 200
    assert client.post(f"/api/diet/plans/{pid}/save", headers=auth).json()["is_saved"] is True
    done = client.post(f"/api/diet/plans/{pid}/complete-meal", json={"slot": 0}, headers=auth).json()
    assert done["meals"][0]["completed"] is True
    assert client.get("/api/nutrition/day", headers=auth).json()["by_meal"]["breakfast"]["count"] >= 1


def test_workout_plan_and_session(client, auth):
    r = client.post("/api/workouts/generate", json={"days_per_week": 3}, headers=auth)
    assert r.status_code == 201, r.text
    plan = r.json()
    assert len(plan["days"]) == 3
    for d in plan["days"]:
        for e in d["exercises"]:
            assert set(e["equipment"]) <= {"dumbbells", "bodyweight"}
    s = client.post("/api/workouts/sessions/start", json={"plan_id": plan["id"], "day_index": 0}, headers=auth).json()
    ex = [{**e, "completed": True} for e in s["exercises"]]
    done = client.patch(f"/api/workouts/sessions/{s['id']}", json={"exercises": ex, "status": "completed"}, headers=auth).json()
    assert done["status"] == "completed" and done["duration_minutes"] >= 1
    assert "first_workout" in done["new_achievements"]
    assert client.get("/api/workouts/stats", headers=auth).json()["total_completed"] == 1


def test_coach_demo_mode_uses_tools(client, auth):
    st = client.get("/api/coach/status", headers=auth).json()
    assert st["active_provider"] == "mock" and st["is_real_llm"] is False
    r = client.post("/api/coach/chat", json={"message": "How many calories should I consume?"}, headers=auth)
    assert r.status_code == 200, r.text
    msg = r.json()["message"]
    assert "calculate_calorie_target" in msg["tools_used"]
    assert "Demo mode" in msg["content"] and msg["provider"].startswith("mock")
    cid = r.json()["conversation_id"]
    r2 = client.post("/api/coach/chat", json={"message": "What workout should I do today?", "conversation_id": cid}, headers=auth)
    assert "generate_workout" in r2.json()["message"]["tools_used"]
    conv = client.get(f"/api/coach/conversations/{cid}", headers=auth).json()
    assert len(conv["messages"]) == 4


def test_demo_account(client):
    r = client.post("/api/auth/demo")
    assert r.status_code == 200 and r.json()["user"]["is_demo"]
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    d = client.get("/api/dashboard", headers=h).json()
    assert d["user"]["is_demo"] and len(d["weight"]["series"]) > 10 and d["workouts"]["total_completed"] > 10
    assert any(a["unlocked"] for a in d["achievements"])


def test_settings_and_password(client, auth):
    assert client.put("/api/settings", json={"unit_system": "imperial", "ai_provider_pref": "mock"}, headers=auth).json()["unit_system"] == "imperial"
    assert client.post("/api/settings/password", json={"current_password": "bad", "new_password": "newpass123"}, headers=auth).status_code == 400
    r = client.post("/api/settings/password", json={"current_password": "secret123", "new_password": "newpass123"}, headers=auth)
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=auth).status_code == 401  # old session signed out
    auth.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    assert client.get("/api/auth/me", headers=auth).status_code == 200
