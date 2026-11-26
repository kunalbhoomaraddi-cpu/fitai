"""Water, travel and festival breaks, and streak freezes."""
from datetime import date, timedelta

from app.services.lifestyle_service import streak_detail, water_goal_ml
from app.utils.clock import local_today


# --------------------------------------------------------------------------- water
def test_water_goal_follows_body_weight():
    assert water_goal_ml(70) == 2500        # 70 x 35 = 2450, rounded to a glass
    assert water_goal_ml(45) == 2000        # never below 2 litres
    assert water_goal_ml(140) == 4000       # never above 4 litres
    assert water_goal_ml(None) == 2500


def test_log_and_undo_water(client, auth):
    day = client.get("/api/nutrition/water", headers=auth).json()
    assert day["ml"] == 0 and day["goal_ml"] >= 2000 and day["goal_glasses"] == day["goal_ml"] // 250
    for _ in range(3):
        r = client.post("/api/nutrition/water", json={"ml": 250}, headers=auth)
    assert r.json()["ml"] == 750 and r.json()["glasses"] == 3
    assert client.post("/api/nutrition/water", json={"ml": -250}, headers=auth).json()["ml"] == 500
    assert client.post("/api/nutrition/water", json={"ml": -2000}, headers=auth).json()["ml"] == 0  # never negative
    assert client.post("/api/nutrition/water", json={"ml": 5000}, headers=auth).status_code == 422
    tomorrow = (local_today() + timedelta(days=1)).isoformat()
    assert client.post("/api/nutrition/water", json={"ml": 250, "date": tomorrow}, headers=auth).status_code == 400
    assert client.get("/api/dashboard", headers=auth).json()["water"]["ml"] == 0


def test_water_is_private(client, auth, second_user):
    client.post("/api/nutrition/water", json={"ml": 500}, headers=auth)
    assert client.get("/api/nutrition/water", headers=second_user).json()["ml"] == 0


# --------------------------------------------------------------------------- streaks
T = date(2026, 11, 26)
D = timedelta


def test_streak_allows_one_rest_day():
    assert streak_detail([T - D(4), T - D(2), T], T)["streak"] == 3
    assert streak_detail([T - D(2)], T)["streak"] == 1          # missed yesterday only: still alive
    assert streak_detail([T - D(3)], T)["streak"] == 0          # two missed days: gone (no freezes yet)


def test_freezes_are_earned_and_used_automatically():
    every_other_day = [T - D(30) + D(2 * i) for i in range(7)]  # 7 workouts -> 1 freeze earned
    last = every_other_day[-1]
    s = streak_detail(every_other_day, last)
    assert s["streak"] == 7 and s["freezes"] == 1
    s = streak_detail(every_other_day, last + D(3))              # missed 2 days: the freeze covers one
    assert s["streak"] == 7 and s["freezes"] == 0 and s["frozen_days"] == [(last + D(2)).isoformat()]
    assert streak_detail(every_other_day, last + D(4))["streak"] == 0  # one freeze can't cover two extra days


def test_at_most_two_freezes():
    daily = [T - D(30) + D(i) for i in range(28)]
    assert streak_detail(daily, daily[-1])["freezes"] == 2


def test_break_days_are_not_missed():
    paused = {T - D(9) + D(i) for i in range(8)}                 # a week away
    assert streak_detail([T - D(12), T - D(10)], T, paused)["streak"] == 2
    assert streak_detail([T - D(12), T - D(10)], T)["streak"] == 0


# --------------------------------------------------------------------------- breaks
def _brk(client, auth, kind="festival", start=0, days=4, note="Deepavali"):
    s = local_today() + timedelta(days=start)
    return client.post("/api/profile/breaks", headers=auth,
                       json={"kind": kind, "start_on": s.isoformat(), "end_on": (s + timedelta(days=days - 1)).isoformat(), "note": note})


def test_festival_break_sets_maintenance_and_shows_on_dashboard(client, auth):
    before = client.get("/api/profile/targets", headers=auth).json()
    r = _brk(client, auth)
    assert r.status_code == 201 and r.json()["active"] and r.json()["days_left"] == 4
    during = client.get("/api/profile/targets", headers=auth).json()
    assert during["calories"]["calorie_target"] == round(during["tdee"]["tdee"])   # maintenance
    assert during["calories"]["calorie_target"] != before["calories"]["calorie_target"]
    assert "Festival mode" in during["calories"]["rationale"]
    dash = client.get("/api/dashboard", headers=auth).json()
    assert dash["break"]["kind"] == "festival" and dash["break"]["note"] == "Deepavali"
    assert dash["targets"]["calories"] == during["calories"]["calorie_target"]
    assert dash["workouts"]["streak_paused"] is True
    # ending it brings the normal target back straight away
    assert client.post(f"/api/profile/breaks/{r.json()['id']}/end", headers=auth).status_code == 200
    assert client.get("/api/profile/targets", headers=auth).json()["calories"]["calorie_target"] == before["calories"]["calorie_target"]


def test_break_rules(client, auth, second_user):
    assert _brk(client, auth, days=22).status_code == 422                       # max 21 days
    assert _brk(client, auth, start=-5, days=2).status_code == 400              # can't pause the past
    assert _brk(client, auth, start=100).status_code == 400                     # too far ahead
    up = _brk(client, auth, kind="travel", start=10, note="Goa")
    assert up.status_code == 201 and not up.json()["active"]
    assert _brk(client, auth, start=12).status_code == 409                      # overlaps
    listed = client.get("/api/profile/breaks", headers=auth).json()
    assert listed["active"] is None and [b["note"] for b in listed["upcoming"]] == ["Goa"]
    assert client.post(f"/api/profile/breaks/{up.json()['id']}/end", headers=second_user).status_code == 404
    client.post(f"/api/profile/breaks/{up.json()['id']}/end", headers=auth)     # not started yet: removed
    assert client.get("/api/profile/breaks", headers=auth).json()["upcoming"] == []


def test_coach_knows_about_the_break(client, auth):
    from app.ai.prompts import coach_system_prompt
    from app.database import SessionLocal
    from app.models import User
    _brk(client, auth, kind="travel", note="Goa trip")
    uid = client.get("/api/auth/me", headers=auth).json()["id"]
    with SessionLocal() as db:
        prompt = coach_system_prompt(db.get(User, uid))
    assert "travel break (Goa trip)" in prompt and "Hotel-room workout" in prompt


def test_slow_ai_never_holds_up_the_dashboard(client, auth, monkeypatch):
    """A timing-out AI service gets one short try for the daily tip, then the built-in tip is used."""
    import httpx

    import app.routers.dashboard as dash
    from app.ai.gemini import GeminiProvider
    calls = []

    def fake_post(self, url, **kw):
        calls.append(self.timeout.read)
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr(dash, "get_provider", lambda pref=None: GeminiProvider("test-key", "gemini-main", "gemini-backup"))
    monkeypatch.setattr(httpx.Client, "post", fake_post)
    r = client.get("/api/dashboard", headers=auth)
    assert r.status_code == 200
    assert r.json()["recommendation"]["source"] == "rule-based" and r.json()["recommendation"]["text"]
    assert calls == [8.0]   # one attempt with an 8-second limit: no retries, no backup model
