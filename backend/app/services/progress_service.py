"""Progress analytics computed from real stored data: weight trends, workout consistency,
nutrition consistency, streaks, achievements and weekly challenges. Deterministic."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FoodEntry, User, UserAchievement, WeightRecord, WorkoutSession
from app.models._mixins import utcnow
from app.services import fitness_service

ACHIEVEMENTS = [
    {"code": "first_workout", "title": "First Rep", "description": "Complete your first workout.", "icon": "dumbbell"},
    {"code": "five_workouts", "title": "Momentum", "description": "Complete five workouts.", "icon": "flame"},
    {"code": "streak_7", "title": "Seven Strong", "description": "Reach a 7-workout streak (one rest day between sessions keeps it alive).", "icon": "zap"},
    {"code": "first_kg", "title": "First Kilogram", "description": "Your logged weight is 1 kg below your starting weight.", "icon": "trending-down"},
    {"code": "nutrition_week", "title": "Mindful Eater", "description": "Log food on 7 consecutive days.", "icon": "salad"},
    {"code": "first_milestone", "title": "Quarter Way", "description": "Reach 25% of your weight goal.", "icon": "flag"},
    {"code": "goal_reached", "title": "Goal Achieved", "description": "Reach your target weight.", "icon": "trophy"},
]
ACH_BY_CODE = {a["code"]: a for a in ACHIEVEMENTS}


# --------------------------------------------------------------------------- weight
def weight_records(db: Session, user_id: int, days: int | None = None) -> list[WeightRecord]:
    q = select(WeightRecord).where(WeightRecord.user_id == user_id)
    if days:
        q = q.where(WeightRecord.recorded_on >= date.today() - timedelta(days=days))
    return list(db.scalars(q.order_by(WeightRecord.recorded_on, WeightRecord.id)))


def _slope_per_week(points: list[tuple[date, float]]) -> float | None:
    if len(points) < 3:
        return None
    x0 = points[0][0]
    xs = [(d - x0).days for d, _ in points]
    ys = [w for _, w in points]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den * 7


def weekly_averages(records: list[WeightRecord]) -> list[dict]:
    buckets: dict = defaultdict(list)
    for r in records:
        monday = r.recorded_on - timedelta(days=r.recorded_on.weekday())
        buckets[monday].append(r.weight_kg)
    return [{"week_start": k.isoformat(), "avg_weight_kg": round(sum(v) / len(v), 2), "entries": len(v)}
            for k, v in sorted(buckets.items())]


def goal_progress(start: float, current: float, target: float) -> float:
    total = start - target
    if abs(total) < 0.05:
        return 100.0
    pct = (start - current) / total * 100
    return round(max(0.0, min(100.0, pct)), 1)


def weight_analysis(db: Session, user: User, days: int = 90) -> dict:
    p = user.profile
    recs = weight_records(db, user.id, days)
    allrecs = weight_records(db, user.id)
    current = allrecs[-1].weight_kg if allrecs else p.current_weight_kg
    out = {
        "records": [{"date": r.recorded_on.isoformat(), "weight_kg": r.weight_kg} for r in recs],
        "start_weight_kg": p.start_weight_kg, "current_weight_kg": current, "target_weight_kg": p.target_weight_kg,
        "change_since_start_kg": round(current - p.start_weight_kg, 2),
        "remaining_kg": round(current - p.target_weight_kg, 2),
        "goal_progress_pct": goal_progress(p.start_weight_kg, current, p.target_weight_kg),
        "weekly_averages": weekly_averages(recs)[-12:],
        "trend_kg_per_week": None, "plateau": False, "flags": [], "data_points": len(recs),
    }
    last28 = [(r.recorded_on, r.weight_kg) for r in allrecs if r.recorded_on >= date.today() - timedelta(days=28)]
    slope = _slope_per_week(last28)
    if slope is not None:
        out["trend_kg_per_week"] = round(slope, 2)
    month = [r for r in allrecs if r.recorded_on >= date.today() - timedelta(days=30)]
    out["change_30d_kg"] = round(month[-1].weight_kg - month[0].weight_kg, 2) if len(month) >= 2 else None
    wk = out["weekly_averages"]
    if len(wk) >= 3 and p.goal in ("weight_loss", "recomposition", "muscle_gain"):
        last3 = [w["avg_weight_kg"] for w in wk[-3:]]
        if max(last3) - min(last3) < 0.3:
            out["plateau"] = True
    if slope is not None and current > 0:
        pct_week = abs(slope) / current * 100
        if slope < 0 and pct_week > 1.0:
            out["flags"].append("Weight is trending down faster than ~1% of body weight per week. Consider eating "
                                "closer to your target and speak with a healthcare professional if this is unintentional.")
        if slope > 0 and p.goal == "weight_loss" and slope > 0.3:
            out["flags"].append("Weight is trending upward while your goal is weight loss.")
    return out


# --------------------------------------------------------------------------- workouts
def completed_sessions(db: Session, user_id: int, days: int | None = None) -> list[WorkoutSession]:
    q = select(WorkoutSession).where(WorkoutSession.user_id == user_id, WorkoutSession.status == "completed")
    if days:
        q = q.where(WorkoutSession.started_at >= datetime.now() - timedelta(days=days))
    return list(db.scalars(q.order_by(WorkoutSession.started_at)))


def workout_streak(dates: list[date], today: date | None = None) -> int:
    """Consecutive workouts where gaps are at most one rest day; resets if the last workout
    was more than 2 days ago. Rest days never add to the count."""
    today = today or date.today()
    uniq = sorted(set(dates), reverse=True)
    if not uniq or (today - uniq[0]).days > 2:
        return 0
    streak = 1
    for prev, cur in zip(uniq, uniq[1:]):
        if (prev - cur).days <= 2:
            streak += 1
        else:
            break
    return streak


def workout_stats(db: Session, user_id: int) -> dict:
    sessions = completed_sessions(db, user_id)
    dates = [s.started_at.date() for s in sessions]
    today = date.today()
    week = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        ss = [s for s in sessions if s.started_at.date() == d]
        week.append({"date": d.isoformat(), "day": d.strftime("%a"), "workouts": len(ss),
                     "minutes": sum(s.duration_minutes or 0 for s in ss)})
    weeks = []
    for i in range(7, -1, -1):
        start = today - timedelta(days=today.weekday()) - timedelta(weeks=i)
        cnt = sum(1 for d in dates if start <= d < start + timedelta(days=7))
        weeks.append({"week_start": start.isoformat(), "workouts": cnt})
    return {"total_completed": len(sessions), "streak": workout_streak(dates, today),
            "this_week": sum(w["workouts"] for w in week[-(today.weekday() + 1):]),
            "last_7_days": week, "weekly_counts": weeks,
            "avg_duration_min": round(sum(s.duration_minutes or 0 for s in sessions) / len(sessions)) if sessions else 0,
            "recent": [{"id": s.id, "name": s.name, "date": s.started_at.date().isoformat(),
                        "duration_minutes": s.duration_minutes} for s in sessions[-5:][::-1]]}


# --------------------------------------------------------------------------- nutrition consistency
def nutrition_consistency(db: Session, user: User, days: int = 14) -> dict:
    start = date.today() - timedelta(days=days - 1)
    rows = list(db.scalars(select(FoodEntry).where(FoodEntry.user_id == user.id, FoodEntry.eaten_on >= start)))
    per_day: dict = defaultdict(lambda: {"cal": 0.0, "protein": 0.0})
    for e in rows:
        per_day[e.eaten_on]["cal"] += e.calories
        per_day[e.eaten_on]["protein"] += e.protein_g
    targets = fitness_service.profile_targets(user.profile)
    logged = len(per_day)
    avg_cal = round(sum(v["cal"] for v in per_day.values()) / logged) if logged else 0
    avg_pro = round(sum(v["protein"] for v in per_day.values()) / logged) if logged else 0
    streak = 0
    d = date.today()
    if d not in per_day:
        d -= timedelta(days=1)
    while d in per_day:
        streak += 1
        d -= timedelta(days=1)
    flags = []
    floor = fitness_service.MIN_CALORIES.get(user.profile.gender, 1200)
    if logged >= 4 and avg_cal and avg_cal < floor * 0.9:
        flags.append(f"Average logged intake (~{avg_cal} kcal) is below a safe general floor (~{floor} kcal). "
                     "This may also mean some meals weren't logged. Very low intakes should be supervised by a professional.")
    return {"days_window": days, "days_logged": logged, "logging_streak": streak, "avg_calories": avg_cal,
            "avg_protein_g": avg_pro, "calorie_target": targets["calories"]["calorie_target"],
            "protein_target_g": targets["macros"]["protein_g"], "flags": flags}


# --------------------------------------------------------------------------- achievements & challenges
def evaluate_achievements(db: Session, user: User) -> list[dict]:
    """Unlocks achievements based on stored data; returns all with status. Idempotent."""
    p = user.profile
    have = {a.code: a for a in db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id))}
    earned: set[str] = set()
    ws = workout_stats(db, user.id)
    if ws["total_completed"] >= 1:
        earned.add("first_workout")
    if ws["total_completed"] >= 5:
        earned.add("five_workouts")
    dates = [s.started_at.date() for s in completed_sessions(db, user.id)]
    # best historical streak
    best, run = 0, 0
    prev = None
    for d in sorted(set(dates)):
        run = run + 1 if prev and (d - prev).days <= 2 else 1
        best, prev = max(best, run), d
    if best >= 7:
        earned.add("streak_7")
    if p:
        recs = weight_records(db, user.id)
        if recs:
            cur = recs[-1].weight_kg
            if p.goal in ("weight_loss", "recomposition") and min(r.weight_kg for r in recs) <= p.start_weight_kg - 1:
                earned.add("first_kg")
            prog = goal_progress(p.start_weight_kg, cur, p.target_weight_kg)
            if abs(p.start_weight_kg - p.target_weight_kg) >= 0.5:
                if prog >= 25:
                    earned.add("first_milestone")
                if prog >= 100:
                    earned.add("goal_reached")
        if nutrition_consistency(db, user, 14)["logging_streak"] >= 7:
            earned.add("nutrition_week")
    new = []
    for code in earned - set(have):
        ua = UserAchievement(user_id=user.id, code=code, unlocked_at=utcnow(), seen=False)
        db.add(ua)
        have[code] = ua
        new.append(code)
    if new:
        db.commit()
    return [{**a, "unlocked": a["code"] in have,
             "unlocked_at": have[a["code"]].unlocked_at.isoformat() + "Z" if a["code"] in have else None,
             "seen": have[a["code"]].seen if a["code"] in have else True} for a in ACHIEVEMENTS]


def weekly_challenges(db: Session, user: User) -> list[dict]:
    p = user.profile
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sessions = [s for s in completed_sessions(db, user.id, 10) if s.started_at.date() >= monday]
    rows = list(db.scalars(select(FoodEntry).where(FoodEntry.user_id == user.id, FoodEntry.eaten_on >= monday)))
    days_logged = len({e.eaten_on for e in rows})
    targets = fitness_service.profile_targets(p)
    prot_t = targets["macros"]["protein_g"]
    per_day = defaultdict(float)
    for e in rows:
        per_day[e.eaten_on] += e.protein_g
    protein_days = sum(1 for v in per_day.values() if v >= prot_t * 0.9)
    weighins = [r for r in weight_records(db, user.id, 7) if r.recorded_on >= monday]
    goal_days = min(p.workout_days_per_week, 5)
    ch = [
        {"id": "workouts", "title": f"Complete {goal_days} workouts", "progress": len(sessions), "goal": goal_days, "icon": "dumbbell"},
        {"id": "logging", "title": "Log meals on 5 days", "progress": days_logged, "goal": 5, "icon": "notebook"},
        {"id": "protein", "title": f"Hit {prot_t} g protein on 4 days", "progress": protein_days, "goal": 4, "icon": "beef"},
        {"id": "weighin", "title": "Weigh in 3 times (same time of day)", "progress": len(weighins), "goal": 3, "icon": "scale"},
    ]
    for c in ch:
        c["completed"] = c["progress"] >= c["goal"]
        c["progress"] = min(c["progress"], c["goal"])
    return ch


def full_analysis(db: Session, user: User) -> dict:
    """Deterministic insights used by the progress page and as the factual basis for AI analysis."""
    w = weight_analysis(db, user, 90)
    ws = workout_stats(db, user.id)
    nc = nutrition_consistency(db, user, 14)
    p = user.profile
    insights = []
    if w["data_points"] < 3:
        insights.append({"type": "info", "title": "Not enough weigh-ins yet",
                         "text": "Log your weight 3–4 times per week for a reliable trend. Single readings fluctuate with water, salt and digestion."})
    else:
        t = w["trend_kg_per_week"]
        if t is not None:
            dir_ = "down" if t < -0.05 else "up" if t > 0.05 else "flat"
            insights.append({"type": "trend", "title": f"Weight trend: {dir_}",
                             "text": f"Your 4-week trend is {t:+.2f} kg/week based on {w['data_points']} weigh-ins. "
                                     "Short-term changes include water and glycogen, so they don't necessarily reflect fat change."})
        if w["plateau"]:
            insights.append({"type": "warning", "title": "Possible plateau",
                             "text": "Your last three weekly averages are within 0.3 kg. Review logging accuracy, daily steps and sleep before reducing calories; plateaus of 2–3 weeks are common."})
    insights.append({"type": "workout", "title": "Training consistency",
                     "text": f"{ws['this_week']} workout(s) this week vs a plan of {p.workout_days_per_week}. Current streak: {ws['streak']}."})
    insights.append({"type": "nutrition", "title": "Nutrition consistency",
                     "text": f"Food logged on {nc['days_logged']} of the last 14 days. Average intake on logged days: "
                             f"{nc['avg_calories']} kcal and {nc['avg_protein_g']} g protein (targets {nc['calorie_target']} kcal / {nc['protein_target_g']} g)."})
    insights.append({"type": "goal", "title": "Goal progress",
                     "text": f"{w['goal_progress_pct']}% of the way from {p.start_weight_kg} kg to {p.target_weight_kg} kg."})
    for f in w["flags"] + nc["flags"]:
        insights.append({"type": "safety", "title": "Worth checking", "text": f})
    return {"weight": w, "workouts": ws, "nutrition": nc, "insights": insights}
