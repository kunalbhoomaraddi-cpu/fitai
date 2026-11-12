from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, WeeklyCheckin
from app.services import checkin_service as svc
from app.services.auth_service import require_profile
from app.utils.ratelimit import ai_rate_limit

router = APIRouter(prefix="/checkins", tags=["checkins"])


@router.get("")
def list_checkins(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    rows = db.scalars(select(WeeklyCheckin).where(WeeklyCheckin.user_id == user.id)
                      .order_by(WeeklyCheckin.week_start.desc()).limit(26))
    return [svc.out(c) for c in rows]


@router.get("/current")
def current(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    """Is this week's check-in done? Used for the dashboard reminder."""
    ws = svc.week_start()
    c = db.scalar(select(WeeklyCheckin).where(WeeklyCheckin.user_id == user.id, WeeklyCheckin.week_start == ws))
    return {"week_start": ws.isoformat(), "due": c is None, "checkin": svc.out(c) if c else None}


@router.post("/generate", status_code=201)
def generate(user: User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    if user.profile is None:
        raise HTTPException(409, "Complete onboarding first")
    c, notice = svc.generate(db, user)
    return {**svc.out(c), "notice": notice}


@router.delete("/{checkin_id}", status_code=204)
def delete(checkin_id: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    c = db.get(WeeklyCheckin, checkin_id)
    if c is None or c.user_id != user.id:
        raise HTTPException(404, "Check-in not found")
    db.delete(c)
    db.commit()
