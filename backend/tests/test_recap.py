"""Weekly recap: Monday to Sunday, every figure computed from the logs."""
from datetime import datetime, time, timedelta

from app.database import SessionLocal
from app.models import FoodEntry, WaterLog, WeightRecord, WorkoutSession
from app.services.recap_service import week_bounds
from app.utils.clock import local_today


def _uid(client, auth):
    return client.get("/api/auth/me", headers=auth).json()["id"]


def _session(uid, day, kg, reps=10, sets=3, minutes=45):
    ex = [{"exercise_id": "goblet_squat", "name": "Goblet Squat", "reps": "8-12", "sets": sets,
           "set_log": [{"kg": kg, "reps": reps, "done": True} for _ in range(sets)]}]
    return WorkoutSession(user_id=uid, name="Legs", status="completed", exercises=ex, duration_minutes=minutes,
                          started_at=datetime.combine(day, time(7, 0)))


def test_week_bounds():
    from datetime import date
    wed = date(2026, 11, 25)
    assert week_bounds("last", wed) == (date(2026, 11, 16), date(2026, 11, 22))
    assert week_bounds("this", wed) == (date(2026, 11, 23), date(2026, 11, 29))
    assert week_bounds("last", date(2026, 11, 23))[0] == date(2026, 11, 16)   # on Monday, "last" is the week just ended


def test_recap_of_last_week(client, auth):
    uid = _uid(client, auth)
    start, _ = week_bounds("last")
    with SessionLocal() as db:
        db.add(_session(uid, start - timedelta(days=5), kg=16))            # the week before: the baseline
        db.add(_session(uid, start, kg=16))
        db.add(_session(uid, start + timedelta(days=2), kg=20))            # heavier: a record
        db.add(_session(uid, start + timedelta(days=4), kg=18, minutes=30))
        for i in range(6):
            db.add(FoodEntry(user_id=uid, eaten_on=start + timedelta(days=i), meal="lunch", name="Food", quantity_g=100,
                             calories=1800, protein_g=120, carbs_g=200, fat_g=50, source="custom"))
        db.add(WeightRecord(user_id=uid, recorded_on=start - timedelta(days=1), weight_kg=71.0))
        db.add(WeightRecord(user_id=uid, recorded_on=start + timedelta(days=6), weight_kg=70.4))
        db.add(WaterLog(user_id=uid, logged_on=start, ml=2500))
        db.add(WaterLog(user_id=uid, logged_on=start + timedelta(days=1), ml=1500))
        db.commit()
    r = client.get("/api/progress/recap", headers=auth).json()
    assert r["start"] == start.isoformat() and r["which"] == "last" and not r["empty"]
    w = r["workouts"]
    assert (w["count"], w["minutes"], w["sets"], w["planned"], w["prev_count"]) == (3, 120, 9, 3, 1)
    assert w["volume_kg"] == 3 * 10 * (16 + 20 + 18)
    assert [(p["name"], p["kg"]) for p in r["prs"]] == [("Goblet Squat", 20.0)]        # 18 kg later isn't a record
    n = r["nutrition"]
    assert n["days_logged"] == 6 and n["avg_calories"] == 1800 and n["avg_protein"] == 120
    assert r["weight"]["change_kg"] == -0.6                                                 # from the last weigh-in before the week
    assert r["water"]["days_logged"] == 2 and r["water"]["avg_ml"] == 2000 and r["water"]["days_goal_met"] == 1
    assert r["highlight"] == "New personal record on Goblet Squat."


def test_empty_week_and_this_week(client, auth, second_user):
    r = client.get("/api/progress/recap", headers=second_user).json()
    assert r["empty"] and r["highlight"] == "A quiet week. A fresh one starts on Monday."
    this = client.get("/api/progress/recap?which=this", headers=auth).json()
    assert this["start"] == week_bounds("this")[0].isoformat() and 1 <= this["days_in"] <= 7
    assert client.get("/api/progress/recap?which=next", headers=auth).status_code == 422


def test_highlights_without_records(client, auth):
    uid = _uid(client, auth)
    start, _ = week_bounds("last")
    with SessionLocal() as db:
        for d in range(3):  # bodyweight sessions: no weights, so no records, but every planned workout done
            s = _session(uid, start + timedelta(days=d), kg=None)
            s.exercises = [{**s.exercises[0], "set_log": [{"kg": None, "reps": 10, "done": True}]}]
            db.add(s)
        db.commit()
    r = client.get("/api/progress/recap", headers=auth).json()
    assert r["highlight"] == "Every planned workout done: 3 of 3."
    assert local_today() >= start


def test_highlight_uses_the_users_units():
    from app.services.recap_service import _highlight
    base = {"prs": [], "workouts": {"count": 0, "planned": 3}, "nutrition": {"days_logged": 2}}
    kg = {**base, "weight": {"change_kg": -0.57, "goal": "weight_loss", "units": "metric"}}
    lb = {**base, "weight": {"change_kg": -0.57, "goal": "weight_loss", "units": "imperial"}}
    assert _highlight(kg) == "Weight moved 0.6 kg in the right direction."   # same rounding as the weight box
    assert _highlight(lb) == "Weight moved 1.3 lb in the right direction."
