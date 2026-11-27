from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Break, FitnessProfile, User, WeightRecord
from app.schemas.lifestyle import AdaptiveIn, BreakIn
from app.schemas.profile import CalcIn, ProfileIn, ProfileOut
from app.services import fitness_service, lifestyle_service
from app.services.auth_service import get_current_user, require_profile
from app.utils.clock import local_today

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut | None)
def get_profile(user: User = Depends(get_current_user)):
    return user.profile


@router.put("", response_model=ProfileOut)
def upsert_profile(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"full_name"})
    if body.full_name:
        user.full_name = body.full_name
    p = user.profile
    if p is None:
        p = FitnessProfile(user_id=user.id, start_weight_kg=body.current_weight_kg, **data)
        db.add(p)
        db.add(WeightRecord(user_id=user.id, recorded_on=local_today(), weight_kg=body.current_weight_kg,
                            note="Starting weight"))
    else:
        for k, v in data.items():
            setattr(p, k, v)
    user.onboarding_complete = True
    db.commit()
    db.refresh(user)
    return user.profile


@router.get("/targets")
def targets(user: User = Depends(require_profile)):
    return fitness_service.profile_targets(user.profile)


@router.get("/adaptive")
def adaptive(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    """What the adaptive target would be (worked out even while it's off, so the app can suggest it)."""
    from app.services.adaptive_service import estimate
    p = user.profile
    formula = fitness_service.full_calculation(p.current_weight_kg, p.height_cm, p.age, p.gender, p.activity_level, p.goal)
    est = estimate(db, user.id, formula["tdee"]["tdee"], local_today())
    return {"enabled": p.adaptive_target, **est}


@router.put("/adaptive")
def set_adaptive(body: AdaptiveIn, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    """Turns the adaptive calorie target on or off; returns the resulting targets."""
    user.profile.adaptive_target = body.enabled
    db.commit()
    return fitness_service.profile_targets(user.profile)


@router.post("/calculate")
def calculate(body: CalcIn, _: User = Depends(get_current_user)):
    return fitness_service.full_calculation(body.weight_kg, body.height_cm, body.age, body.gender,
                                            body.activity_level, body.goal)


# --------------------------------------------------------------------------- travel and festival breaks
@router.get("/breaks")
def list_breaks(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    today = local_today()
    rows = [b for b in lifestyle_service.breaks(db, user.id) if b.end_on >= today]
    return {"active": lifestyle_service.break_out(lifestyle_service.active_break(db, user.id)),
            "upcoming": [lifestyle_service.break_out(b) for b in rows if b.start_on > today]}


@router.post("/breaks", status_code=201)
def add_break(body: BreakIn, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    today = local_today()
    if body.end_on < today:
        raise HTTPException(400, "Breaks are for today or later. Past days can't be paused.")
    if (body.start_on - today).days > 90:
        raise HTTPException(400, "Plan breaks up to 90 days ahead")
    start = max(body.start_on, today)  # starting "yesterday" would quietly rewrite a missed day
    clash = db.scalar(select(Break).where(Break.user_id == user.id, Break.start_on <= body.end_on, Break.end_on >= start))
    if clash:
        raise HTTPException(409, "That overlaps a break you already have. End or delete it first.")
    b = Break(user_id=user.id, kind=body.kind, start_on=start, end_on=body.end_on, note=(body.note or "").strip() or None)
    db.add(b)
    db.commit()
    return lifestyle_service.break_out(b)


@router.post("/breaks/{bid}/end")
def end_break(bid: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    """Ends a break today. One that hasn't started yet is simply removed."""
    b = db.get(Break, bid)
    if not b or b.user_id != user.id:
        raise HTTPException(404, "Break not found")
    today = local_today()
    if b.start_on >= today:
        db.delete(b)
    else:
        b.end_on = min(b.end_on, today - timedelta(days=1))
    db.commit()
    return {"detail": "Break ended. Normal targets are back."}
