import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.provider import ProviderError, get_provider
from app.ai.prompts import SAFETY_RULES
from app.database import get_db
from app.models import BodyMeasurement, User, UserAchievement, WeightRecord
from app.schemas.tracking import MeasurementIn, MeasurementOut, TargetWeightIn, WeightIn, WeightOut
from app.services import progress_service
from app.services.auth_service import require_profile
from app.utils.ratelimit import ai_rate_limit

router = APIRouter(prefix="/progress", tags=["progress"])


def _sync_current_weight(db: Session, user: User):
    latest = db.scalar(select(WeightRecord).where(WeightRecord.user_id == user.id)
                       .order_by(WeightRecord.recorded_on.desc(), WeightRecord.id.desc()))
    if latest and user.profile:
        user.profile.current_weight_kg = latest.weight_kg


@router.get("/weights", response_model=list[WeightOut])
def list_weights(days: int = 365, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    return progress_service.weight_records(db, user.id, days)


@router.post("/weights", response_model=WeightOut, status_code=201)
def add_weight(body: WeightIn, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    r = WeightRecord(user_id=user.id, recorded_on=body.recorded_on or date.today(), weight_kg=body.weight_kg, note=body.note)
    if r.recorded_on > date.today():
        raise HTTPException(400, "Date can't be in the future")
    db.add(r)
    db.flush()
    _sync_current_weight(db, user)
    db.commit()
    return r


@router.delete("/weights/{rid}", status_code=204)
def delete_weight(rid: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    r = db.get(WeightRecord, rid)
    if not r or r.user_id != user.id:
        raise HTTPException(404, "Record not found")
    db.delete(r)
    db.flush()
    _sync_current_weight(db, user)
    db.commit()


@router.get("/measurements", response_model=list[MeasurementOut])
def list_measurements(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    return list(db.scalars(select(BodyMeasurement).where(BodyMeasurement.user_id == user.id)
                           .order_by(BodyMeasurement.recorded_on)))


@router.post("/measurements", response_model=MeasurementOut, status_code=201)
def add_measurement(body: MeasurementIn, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    data = body.model_dump()
    if not any(v for k, v in data.items() if k != "recorded_on"):
        raise HTTPException(400, "Enter at least one measurement")
    data["recorded_on"] = data["recorded_on"] or date.today()
    m = BodyMeasurement(user_id=user.id, **data)
    db.add(m)
    db.commit()
    return m


@router.delete("/measurements/{mid}", status_code=204)
def delete_measurement(mid: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    m = db.get(BodyMeasurement, mid)
    if not m or m.user_id != user.id:
        raise HTTPException(404, "Record not found")
    db.delete(m)
    db.commit()


@router.put("/target")
def set_target(body: TargetWeightIn, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    user.profile.target_weight_kg = body.target_weight_kg
    db.commit()
    return {"target_weight_kg": body.target_weight_kg}


@router.get("/analysis")
def analysis(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    return progress_service.full_analysis(db, user)


@router.post("/ai-analysis")
def ai_analysis(user: User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    """LLM narrative grounded ONLY in the deterministic analysis computed from stored data."""
    if user.profile is None:
        raise HTTPException(409, "Complete onboarding first")
    facts = progress_service.full_analysis(db, user)
    compact = {"weight": {k: v for k, v in facts["weight"].items() if k != "records"},
               "workouts": {k: facts["workouts"][k] for k in ("total_completed", "streak", "this_week", "weekly_counts")},
               "nutrition": facts["nutrition"], "goal": user.profile.goal}
    provider = get_provider(user.ai_provider_pref)
    if provider.is_real_llm:
        try:
            raw = provider.generate_json(
                "You are FitAI Coach. Analyse ONLY the facts provided (computed from the user's stored data). "
                "Do not invent numbers. Short-term weight changes are not necessarily fat changes. No medical diagnoses.\n" + SAFETY_RULES,
                "Facts:\n" + json.dumps(compact, default=str) +
                '\nReturn JSON {"summary": str (2-3 sentences), "highlights": [str] (2-4 items), "next_steps": [str] (2-3 items)}')
            data = json.loads(raw)
            return {"provider": provider.label, "is_real_llm": True, "summary": str(data.get("summary", "")),
                    "highlights": [str(x) for x in data.get("highlights", [])][:4],
                    "next_steps": [str(x) for x in data.get("next_steps", [])][:3], "insights": facts["insights"]}
        except (ProviderError, json.JSONDecodeError, AttributeError) as e:
            notice = f"AI analysis unavailable ({e}); showing rule-based analysis."
    else:
        notice = "Demo mode: rule-based analysis of your stored data (no LLM configured)."
    w, ws, n = facts["weight"], facts["workouts"], facts["nutrition"]
    summary = (f"You're {w['goal_progress_pct']}% of the way to your target. "
               + (f"Your 4-week trend is {w['trend_kg_per_week']:+.2f} kg/week. " if w["trend_kg_per_week"] is not None else "Log more weigh-ins for a trend. ")
               + f"{ws['this_week']} workout(s) this week; food logged {n['days_logged']}/14 days.")
    steps = []
    if n["days_logged"] < 10:
        steps.append("Log food on at least 5 days this week for a clearer picture.")
    if n["avg_protein_g"] and n["avg_protein_g"] < n["protein_target_g"] * 0.85:
        steps.append(f"Raise protein toward {n['protein_target_g']} g/day (currently ~{n['avg_protein_g']} g).")
    if ws["this_week"] < user.profile.workout_days_per_week:
        steps.append("Schedule your remaining workouts for this week.")
    if w["plateau"]:
        steps.append("Plateau check: tighten logging and add 2–3k daily steps before cutting calories.")
    steps = steps or ["Keep doing what you're doing — consistency is working."]
    return {"provider": provider.label if not provider.is_real_llm else "rule-based", "is_real_llm": False,
            "notice": notice, "summary": summary, "highlights": [i["text"] for i in facts["insights"][:3]],
            "next_steps": steps[:3], "insights": facts["insights"]}


@router.get("/achievements")
def achievements(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    return progress_service.evaluate_achievements(db, user)


@router.post("/achievements/seen", status_code=204)
def mark_seen(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    for a in db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id, UserAchievement.seen.is_(False))):
        a.seen = True
    db.commit()


@router.get("/challenges")
def challenges(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    return progress_service.weekly_challenges(db, user)
