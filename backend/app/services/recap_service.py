"""Weekly recap: one Monday-to-Sunday summary to look back on (and share): workouts, records,
food, weight, water and the streak, with a plain highlight sentence. All figures are computed."""
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FoodEntry, User, WaterLog, WeightRecord
from app.services import fitness_service, lift_service
from app.services.lifestyle_service import water_goal_ml
from app.services.progress_service import completed_sessions, workout_stats
from app.utils.clock import local_date, local_today


def week_bounds(which: str = "last", today: date | None = None) -> tuple[date, date]:
    today = today or local_today()
    monday = today - timedelta(days=today.weekday())
    if which == "last":
        monday -= timedelta(days=7)
    return monday, monday + timedelta(days=6)


def _workouts(db: Session, user_id: int, start: date, end: date) -> dict:
    sessions = [s for s in completed_sessions(db, user_id) if start <= local_date(s.started_at) <= end]
    sets = volume = 0
    for s in sessions:
        for ex in s.exercises or []:
            done = lift_service._clean_sets(ex)
            sets += len(done)
            volume += sum(kg * reps for kg, reps in done if kg)
    return {"count": len(sessions), "minutes": sum(s.duration_minutes or 0 for s in sessions), "sets": sets,
            "volume_kg": round(volume), "days": sorted({local_date(s.started_at).isoformat() for s in sessions})}


def weekly_recap(db: Session, user: User, which: str = "last") -> dict:
    start, end = week_bounds(which)
    prev_start, prev_end = start - timedelta(days=7), start - timedelta(days=1)
    today = local_today()
    days_in = (min(end, today) - start).days + 1  # "this week" so far

    w, prev = _workouts(db, user.id, start, end), _workouts(db, user.id, prev_start, prev_end)
    prs = [{"name": lift["name"], "label": p["label"], "kg": p["kg"], "reps": p["reps"], "kind": lift["kind"], "date": p["date"]}
           for lift in lift_service.lift_progress(db, user.id)  # full history, so a "record" really is one
           for p in lift["points"] if p["pr"] and start.isoformat() <= p["date"] <= end.isoformat()]

    targets = fitness_service.profile_targets(user.profile)
    cal_target, protein_target = targets["calories"]["calorie_target"], targets["macros"]["protein_g"]
    daily = db.execute(select(FoodEntry.eaten_on, func.sum(FoodEntry.calories), func.sum(FoodEntry.protein_g))
                       .where(FoodEntry.user_id == user.id, FoodEntry.eaten_on >= start, FoodEntry.eaten_on <= end)
                       .group_by(FoodEntry.eaten_on)).all()
    logged = [(d, float(c or 0), float(p or 0)) for d, c, p in daily if (c or 0) > 0]
    nutrition = {"days_logged": len(logged), "calorie_target": cal_target, "protein_target": protein_target,
                 "avg_calories": round(sum(c for _, c, _ in logged) / len(logged)) if logged else None,
                 "avg_protein": round(sum(p for _, _, p in logged) / len(logged)) if logged else None,
                 "days_on_target": sum(1 for _, c, _ in logged if abs(c - cal_target) <= 0.1 * cal_target),
                 "protein_days": sum(1 for _, _, p in logged if p >= 0.9 * protein_target)}

    weights = list(db.execute(select(WeightRecord.recorded_on, WeightRecord.weight_kg)
                              .where(WeightRecord.user_id == user.id, WeightRecord.recorded_on >= start, WeightRecord.recorded_on <= end)
                              .order_by(WeightRecord.recorded_on, WeightRecord.id)).all())
    before = db.execute(select(WeightRecord.weight_kg).where(WeightRecord.user_id == user.id, WeightRecord.recorded_on < start)
                        .order_by(WeightRecord.recorded_on.desc(), WeightRecord.id.desc()).limit(1)).scalar()
    first = before if before is not None else (weights[0][1] if weights else None)
    last = weights[-1][1] if weights else None
    weight = {"weigh_ins": len(weights), "start_kg": first, "end_kg": last,
              "change_kg": round(last - first, 2) if first is not None and last is not None and (before is not None or len(weights) > 1) else None,
              "goal": user.profile.goal, "units": user.profile.unit_system}

    water = db.execute(select(WaterLog.ml).where(WaterLog.user_id == user.id, WaterLog.logged_on >= start,
                                                 WaterLog.logged_on <= end, WaterLog.ml > 0)).scalars().all()
    goal_ml = water_goal_ml(user.profile.current_weight_kg)
    water_out = {"days_logged": len(water), "avg_ml": round(sum(water) / len(water)) if water else None,
                 "goal_ml": goal_ml, "days_goal_met": sum(1 for ml in water if ml >= goal_ml)}

    ws = workout_stats(db, user.id)
    planned = user.profile.workout_days_per_week
    recap = {"which": which, "start": start.isoformat(), "end": end.isoformat(), "days_in": days_in,
             "name": (user.full_name or "").split(" ")[0] or None,
             "workouts": {**w, "planned": planned, "prev_count": prev["count"], "prev_volume_kg": prev["volume_kg"]},
             "prs": prs[:6], "nutrition": nutrition, "weight": weight, "water": water_out,
             "streak": ws["streak"], "best_streak": ws.get("best_streak")}
    recap["highlight"] = _highlight(recap)
    recap["empty"] = not (w["count"] or logged or weights or water)
    return recap


def _highlight(r: dict) -> str:
    """One plain sentence about the best thing in the week."""
    w, n, wt = r["workouts"], r["nutrition"], r["weight"]
    if r["prs"]:
        p = r["prs"][0]
        more = f" and {len(r['prs']) - 1} more" if len(r["prs"]) > 1 else ""
        return f"New personal record on {p['name']}{more}."
    if w["count"] and w["count"] >= w["planned"]:
        return f"Every planned workout done: {w['count']} of {w['planned']}."
    change = wt["change_kg"]
    if change is not None and ((wt["goal"] in ("weight_loss", "recomposition") and change < 0)
                               or (wt["goal"] == "muscle_gain" and change > 0)):
        lb = wt.get("units") == "imperial"
        return f"Weight moved {abs(change) / 0.45359237 if lb else abs(change):.1f} {'lb' if lb else 'kg'} in the right direction."
    if n["days_logged"] >= 5:
        return f"Food logged on {n['days_logged']} of 7 days. That's what makes the numbers trustworthy."
    if w["count"]:
        return f"{w['count']} {'workout' if w['count'] == 1 else 'workouts'} done. Every session counts."
    return "A quiet week. A fresh one starts on Monday."
