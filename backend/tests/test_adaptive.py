"""Adaptive calorie target: maintenance estimated from logged food and the weight trend."""
from datetime import timedelta

from app.database import SessionLocal
from app.models import FoodEntry, User, WeightRecord
from app.services.adaptive_service import _slope_per_day, estimate
from app.utils.clock import local_today


def _uid(client, auth):
    return client.get("/api/auth/me", headers=auth).json()["id"]


def _seed(uid, days=21, kcal=2000, start_kg=71.5, kg_per_week=-0.5, weigh_every=2, partial_days=0):
    """`days` fully logged days at `kcal`, weigh-ins every `weigh_every` days on a steady trend."""
    today = local_today()
    with SessionLocal() as db:
        for i in range(1, days + 1):
            d = today - timedelta(days=i)
            db.add(FoodEntry(user_id=uid, eaten_on=d, meal="lunch", name="Logged day", quantity_g=100, calories=kcal,
                             protein_g=100, carbs_g=200, fat_g=60, source="custom"))
        for i in range(days + 1, days + 1 + partial_days):  # only a snack logged
            db.add(FoodEntry(user_id=uid, eaten_on=today - timedelta(days=i), meal="snack", name="Biscuit", quantity_g=20,
                             calories=90, protein_g=1, carbs_g=14, fat_g=3, source="custom"))
        for i in range(days, -1, -weigh_every):
            db.add(WeightRecord(user_id=uid, recorded_on=today - timedelta(days=i),
                                weight_kg=round(start_kg + kg_per_week / 7 * (days - i), 2)))
        db.commit()


def _targets(client, auth):
    return client.get("/api/profile/targets", headers=auth).json()


def test_trend_fit():
    d = local_today()
    pts = [(d + timedelta(days=i), 80 - 0.1 * i + (0.6 if i % 2 else -0.6)) for i in range(20)]  # noisy, -0.1 kg/day
    assert abs(_slope_per_day(pts) - -0.1) < 0.02


def test_waits_for_enough_data(client, auth):
    r = client.get("/api/profile/adaptive", headers=auth).json()
    assert r["enabled"] is False and r["status"] == "collecting" and r["needs"]["logged_days"] == 10
    _seed(_uid(client, auth), days=6)
    r = client.get("/api/profile/adaptive", headers=auth).json()
    assert r["status"] == "collecting" and r["logged_days"] == 6
    # switching it on early changes nothing: the formula stays until there's enough data
    before = _targets(client, auth)["calories"]["calorie_target"]
    t = client.put("/api/profile/adaptive", json={"enabled": True}, headers=auth).json()
    assert t["calories"]["calorie_target"] == before and t["adaptive"]["status"] == "collecting"


def test_estimates_maintenance_from_logs_and_weight(client, auth):
    _seed(_uid(client, auth))  # 21 days at 2,000 kcal while losing 0.5 kg a week
    r = client.get("/api/profile/adaptive", headers=auth).json()
    assert r["status"] == "ready" and r["logged_days"] == 21 and r["weigh_ins"] == 12  # 11 seeded + the sign-up weight
    assert abs(r["weekly_change_kg"] - -0.5) < 0.02
    assert abs(r["estimated_tdee"] - 2550) <= 10            # 2,000 + 0.5 kg/week x 7,700 / 7
    assert r["confidence"] == 1.0 and abs(r["tdee"] - 2550) <= 10
    formula = r["formula_tdee"]

    off = _targets(client, auth)
    assert off["calories"]["calorie_target"] < 2050 and "adaptive" not in off   # still the formula while it's off
    on = client.put("/api/profile/adaptive", json={"enabled": True}, headers=auth).json()
    assert abs(on["tdee"]["tdee"] - 2550) <= 10 and on["tdee"]["formula_tdee"] == formula
    assert abs(on["calories"]["calorie_target"] - 2050) <= 10   # the usual 500 kcal deficit, from real maintenance
    assert on["calories"]["rationale"].startswith("Adaptive:")
    m = on["macros"]  # the macros are rebuilt for the new target
    assert abs(4 * m["protein_g"] + 4 * m["carbs_g"] + 9 * m["fat_g"] - on["calories"]["calorie_target"]) <= 30
    assert client.get("/api/dashboard", headers=auth).json()["targets"]["calories"] == on["calories"]["calorie_target"]
    assert client.get("/api/profile", headers=auth).json()["adaptive_target"] is True
    # and off again
    back = client.put("/api/profile/adaptive", json={"enabled": False}, headers=auth).json()
    assert back["calories"]["calorie_target"] == off["calories"]["calorie_target"]


def test_partly_logged_days_are_ignored(client, auth):
    _seed(_uid(client, auth), days=12, partial_days=8)
    r = client.get("/api/profile/adaptive", headers=auth).json()
    assert r["logged_days"] == 12 and r["avg_intake"] == 2000   # the snack-only days don't drag the average down


def test_never_more_than_25_percent_from_the_formula(client, auth):
    _seed(_uid(client, auth), kcal=1200, kg_per_week=0.8)   # gaining weight on 1,200 kcal: logs must be missing food
    r = client.get("/api/profile/adaptive", headers=auth).json()
    assert r["capped"] and r["estimated_tdee"] == round(r["formula_tdee"] * 0.75)


def test_blends_while_data_builds_up(client, auth):
    _seed(_uid(client, auth), days=12, weigh_every=2)
    r = client.get("/api/profile/adaptive", headers=auth).json()
    assert r["status"] == "ready" and 0.5 < r["confidence"] < 1
    lo, hi = sorted([r["formula_tdee"], r["estimated_tdee"]])
    assert lo < r["tdee"] < hi                                # part formula, part estimate


def test_breaks_use_the_adaptive_maintenance(client, auth):
    uid = _uid(client, auth)
    _seed(uid)
    client.put("/api/profile/adaptive", json={"enabled": True}, headers=auth)
    s = local_today()
    client.post("/api/profile/breaks", headers=auth, json={"kind": "festival", "start_on": s.isoformat(), "end_on": s.isoformat()})
    t = _targets(client, auth)
    assert abs(t["calories"]["calorie_target"] - 2550) <= 10   # maintenance = what the logs say


def test_estimate_is_private(client, auth, second_user):
    _seed(_uid(client, auth))
    assert client.get("/api/profile/adaptive", headers=second_user).json()["status"] == "collecting"
    with SessionLocal() as db:
        u = db.get(User, _uid(client, auth))
        assert estimate(db, u.id, 2200, local_today())["status"] == "ready"
