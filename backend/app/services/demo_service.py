"""Demo mode: a clearly-labelled sample account with realistic sample data so every screen
is demonstrable without API keys. Data is synthetic and flagged (`users.is_demo`)."""
import random
import secrets
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (BodyMeasurement, DietPlan, FitnessProfile, FoodEntry, User, WeightRecord, WorkoutPlan,
                        WorkoutSession)
from app.services import fitness_service, nutrition_service, progress_service, workout_service
from app.services.auth_service import hash_password

DEMO_EMAIL = "demo@fitai.app"


def create_or_reset_demo(db: Session) -> User:
    existing = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if existing:
        db.delete(existing)
        db.commit()
    rng = random.Random(42)
    user = User(email=DEMO_EMAIL, full_name="Alex Morgan", hashed_password=hash_password(secrets.token_urlsafe(24)),
                is_demo=True, email_verified=True, onboarding_complete=True)
    db.add(user)
    db.flush()
    today = date.today()
    start_w, days_back = 84.6, 63
    prof = FitnessProfile(user_id=user.id, age=29, gender="male", height_cm=178, current_weight_kg=start_w,
                          start_weight_kg=start_w, target_weight_kg=76.0, activity_level="moderate",
                          experience="intermediate", goal="weight_loss", diet_preference="eggetarian",
                          food_restrictions=[], workout_days_per_week=4, workout_minutes=50,
                          equipment=["dumbbells", "barbell", "bench", "machines", "cables", "pullup_bar"],
                          unit_system="metric")
    db.add(prof)
    db.flush()
    # weight: ~0.45 kg/week down with water noise, small plateau-free trend; weigh-ins ~4x/week
    w = start_w
    for i in range(days_back, -1, -1):
        d = today - timedelta(days=i)
        w -= 0.064
        if i == days_back or rng.random() < 0.6:
            db.add(WeightRecord(user_id=user.id, recorded_on=d, weight_kg=round(w + rng.uniform(-0.45, 0.45), 1)))
    for k, i in enumerate(range(days_back, -1, -14)):
        db.add(BodyMeasurement(user_id=user.id, recorded_on=today - timedelta(days=i), waist_cm=round(92 - k * 0.8, 1),
                               chest_cm=round(103 - k * 0.3, 1), hips_cm=round(100 - k * 0.5, 1), arm_cm=35.5, thigh_cm=round(58 - k * 0.3, 1)))
    # workouts: 3–4/week for 9 weeks with a current streak
    plan_data = workout_service.generate_plan("weight_loss", "intermediate", 4, prof.equipment, 50, seed=7)
    wp = WorkoutPlan(user_id=user.id, title=f"{plan_data['split_name']} · 4 days/week", split=plan_data["split"],
                     inputs={"goal": "weight_loss", "experience": "intermediate", "days_per_week": 4, "equipment": prof.equipment,
                             "duration_minutes": 50, "split": "auto", "target_muscles": [], "recovery": "standard",
                             "rest_days": plan_data["rest_days"], "recovery_note": plan_data["recovery_note"]},
                     days=plan_data["days"], generated_by="fitai_engine (demo)", is_saved=True,
                     coach_note="Sample plan for the demo account: an upper/lower split that balances strength work with recovery while in a calorie deficit.")
    db.add(wp)
    db.flush()
    sched = {0, 1, 3, 4}
    for i in range(days_back, 0, -1):
        d = today - timedelta(days=i)
        recent = i <= 14
        if d.weekday() in sched and (recent or rng.random() < 0.85):
            day = plan_data["days"][[0, 1, 3, 4].index(d.weekday())]
            started = datetime.combine(d, time(18, rng.randint(0, 40)))
            dur = rng.randint(42, 58)
            ex = [{**e, "completed": True, "sets_done": e["sets"]} for e in day["exercises"]]
            db.add(WorkoutSession(user_id=user.id, plan_id=wp.id, name=day["name"], started_at=started,
                                  completed_at=started + timedelta(minutes=dur), duration_minutes=dur, exercises=ex, status="completed"))
    # nutrition: last 13 days + partial today
    targets = fitness_service.profile_targets(prof)
    t = {"calorie_target": targets["calories"]["calorie_target"], **{k: targets["macros"][k] for k in ("protein_g", "carbs_g", "fat_g")}}
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        if i > 0 and rng.random() < 0.12:
            continue
        meals = nutrition_service.generate_reference_plan(t, "eggetarian", [], 4, "medium", seed=i * 3 + 1)
        if i == 0:
            meals = meals[:2]
        for m in meals:
            jitter = rng.uniform(0.88, 1.1)
            tt = m["totals"]
            db.add(FoodEntry(user_id=user.id, eaten_on=d, meal=m["meal_type"], name=m["name"],
                             quantity_g=round(sum(x["grams"] for x in m["items"]) * jitter),
                             calories=round(tt["calories"] * jitter), protein_g=round(tt["protein_g"] * jitter, 1),
                             carbs_g=round(tt["carbs_g"] * jitter, 1), fat_g=round(tt["fat_g"] * jitter, 1), source="reference"))
    plan_meals = nutrition_service.generate_reference_plan(t, "eggetarian", [], 4, "medium", seed=99)
    db.add(DietPlan(user_id=user.id, title=f"Eggetarian plan · {t['calorie_target']} kcal", plan_date=today, targets=t,
                    preferences={"diet": "eggetarian", "restrictions": [], "budget": "medium", "meals_per_day": 4},
                    meals=plan_meals, generated_by="reference_engine (demo)", is_saved=True,
                    coach_note="Sample plan for the demo account, scaled to the calorie target with reference nutrition values."))
    db.flush()
    latest = db.scalar(select(WeightRecord).where(WeightRecord.user_id == user.id).order_by(WeightRecord.recorded_on.desc()))
    prof.current_weight_kg = latest.weight_kg
    db.commit()
    db.refresh(user)
    progress_service.evaluate_achievements(db, user)
    return user
