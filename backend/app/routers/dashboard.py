import json
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import SAFETY_RULES
from app.ai.provider import ProviderError, get_provider
from app.data.quotes import quote_of_the_day
from app.database import get_db
from app.models import SavedRecommendation, User, WorkoutPlan
from app.services import fitness_service, nutrition_service, progress_service
from app.services.auth_service import require_profile
from app.utils.clock import local_today

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

GOAL_LABEL = {"weight_loss": "Weight loss", "muscle_gain": "Muscle building", "recomposition": "Body recomposition",
              "general_fitness": "General fitness", "maintenance": "Weight maintenance"}
WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _upcoming_workout(db: Session, user: User):
    p = db.scalar(select(WorkoutPlan).where(WorkoutPlan.user_id == user.id, WorkoutPlan.is_saved.is_(True))
                  .order_by(WorkoutPlan.id.desc())) or \
        db.scalar(select(WorkoutPlan).where(WorkoutPlan.user_id == user.id).order_by(WorkoutPlan.id.desc()))
    if not p or not p.days:
        return None
    today = local_today().weekday()
    best = None
    for offset in range(7):
        wd = WEEK[(today + offset) % 7]
        for i, d in enumerate(p.days):
            if d.get("weekday") == wd:
                best = (offset, i, d)
                break
        if best:
            break
    if not best:
        best = (0, 0, p.days[0])
    offset, i, d = best
    return {"plan_id": p.id, "split": p.split, "day_index": i, "name": d["name"], "weekday": d["weekday"],
            "when": "Today" if offset == 0 else "Tomorrow" if offset == 1 else d["weekday"],
            "exercise_count": len(d["exercises"]), "duration_minutes": d.get("duration_minutes"),
            "focus": d.get("focus", []), "exercises": [e["name"] for e in d["exercises"][:4]]}


def _rule_recommendation(user: User, today_n: dict, targets: dict, analysis: dict, upcoming) -> str:
    t = today_n["totals"]
    w = analysis["weight"]
    n = analysis["nutrition"]
    if analysis["weight"]["flags"] or n["flags"]:
        return (analysis["weight"]["flags"] or n["flags"])[0]
    if upcoming and upcoming["when"] == "Today":
        return (f"{upcoming['name']} is on the plan today. Have a carb-and-protein meal 1–2 hours before, "
                f"and aim for {targets['protein_g']} g protein across the day to support recovery.")
    if w["plateau"]:
        return "Your weekly averages have been flat for ~3 weeks. Before eating less, tighten logging (oils, drinks) and add 2,000 daily steps."
    if n["avg_protein_g"] and n["avg_protein_g"] < targets["protein_g"] * 0.85:
        return (f"You've averaged ~{n['avg_protein_g']} g protein vs a {targets['protein_g']} g target. "
                "Add a protein source to breakfast — Greek yogurt, eggs, paneer or tofu are easy wins.")
    if t["calories"] == 0:
        return "Start today strong: log your breakfast so your coach can track calories and protein in real time."
    return "Recovery day? A 30-minute walk and 7–9 hours of sleep do more for progress than an extra hard session."


def _daily_recommendation(db: Session, user: User, today_n, targets, analysis, upcoming, refresh: bool) -> dict:
    key = f"daily:{local_today().isoformat()}"
    cached = db.scalar(select(SavedRecommendation).where(SavedRecommendation.user_id == user.id,
                                                         SavedRecommendation.category == "daily",
                                                         SavedRecommendation.title == key))
    if cached and not refresh:
        return {"text": cached.content, "source": cached.source}
    provider = get_provider(user.ai_provider_pref)
    text, source = None, "rule-based"
    if provider.is_real_llm:
        facts = {"goal": user.profile.goal, "today_logged": today_n["totals"], "targets": targets,
                 "weight_trend_kg_per_week": analysis["weight"]["trend_kg_per_week"], "plateau": analysis["weight"]["plateau"],
                 "workouts_this_week": analysis["workouts"]["this_week"], "planned_days": user.profile.workout_days_per_week,
                 "streak": analysis["workouts"]["streak"], "upcoming_workout": upcoming,
                 "avg_protein_14d": analysis["nutrition"]["avg_protein_g"], "days_logged_14d": analysis["nutrition"]["days_logged"]}
        try:
            raw = provider.generate_json("You are FitAI Coach. Write ONE specific, actionable recommendation for today "
                                         "(max 45 words) using only these facts. No invented numbers.\n" + SAFETY_RULES,
                                         json.dumps(facts, default=str) + '\nReturn JSON {"recommendation": str}')
            text = str(json.loads(raw).get("recommendation", "")).strip() or None
            source = provider.label[:100]
        except (ProviderError, json.JSONDecodeError, AttributeError):
            text = None
    if not text:
        text, source = _rule_recommendation(user, today_n, targets, analysis, upcoming), "rule-based"
    if cached:
        cached.content, cached.source = text, source
    else:
        db.add(SavedRecommendation(user_id=user.id, category="daily", title=key, content=text, source=source))
    db.commit()
    return {"text": text, "source": source}


@router.get("")
def dashboard(refresh_recommendation: bool = False, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    p = user.profile
    calc = fitness_service.profile_targets(p)
    targets = {"calories": calc["calories"]["calorie_target"], "protein_g": calc["macros"]["protein_g"],
               "carbs_g": calc["macros"]["carbs_g"], "fat_g": calc["macros"]["fat_g"]}
    today_n = nutrition_service.daily_summary(db, user.id, local_today())
    analysis = progress_service.full_analysis(db, user)
    w = analysis["weight"]
    hist = nutrition_service.history(db, user.id, 14)
    upcoming = _upcoming_workout(db, user)
    achievements = progress_service.evaluate_achievements(db, user)
    weight_series = [r for r in w["records"] if r["date"] >= (local_today() - timedelta(days=60)).isoformat()]
    saved = db.scalars(select(SavedRecommendation).where(SavedRecommendation.user_id == user.id,
                                                         SavedRecommendation.category != "daily")
                       .order_by(SavedRecommendation.id.desc()).limit(3))
    return {
        "user": {"name": user.full_name, "first_name": user.full_name.split(" ")[0], "is_demo": user.is_demo},
        "goal": {"code": p.goal, "label": GOAL_LABEL.get(p.goal, p.goal)},
        "unit_system": p.unit_system,
        "weight": {"current_kg": w["current_weight_kg"], "target_kg": p.target_weight_kg, "start_kg": p.start_weight_kg,
                   "difference_kg": round(w["current_weight_kg"] - p.target_weight_kg, 1),
                   "change_since_start_kg": w["change_since_start_kg"], "trend_kg_per_week": w["trend_kg_per_week"],
                   "goal_progress_pct": w["goal_progress_pct"], "series": weight_series},
        "targets": targets, "calc": {"bmr": calc["bmr"]["bmr"], "tdee": calc["tdee"]["tdee"], "bmi": calc["bmi"]},
        "today": today_n, "nutrition_history": hist,
        "workouts": analysis["workouts"], "upcoming_workout": upcoming,
        "recommendation": _daily_recommendation(db, user, today_n, targets, analysis, upcoming, refresh_recommendation),
        "quote": quote_of_the_day(),
        "achievements": achievements,
        "new_achievements": [a for a in achievements if a["unlocked"] and not a["seen"]],
        "challenges": progress_service.weekly_challenges(db, user),
        "saved_recommendations": [{"id": s.id, "title": s.title, "content": s.content, "category": s.category} for s in saved],
        "insights": analysis["insights"][:4],
        "disclaimer": fitness_service.DISCLAIMER,
    }
