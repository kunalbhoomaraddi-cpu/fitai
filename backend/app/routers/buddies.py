"""Workout buddies (see services/buddy_service.py for exactly what is shared)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.lifestyle import BuddyJoinIn, BuddySharingIn
from app.services import buddy_service as svc
from app.services.auth_service import require_profile
from app.utils.http import SlidingWindowLimiter

router = APIRouter(prefix="/buddies", tags=["buddies"])
_join_limiter = SlidingWindowLimiter(limit=10, window=3600)  # stops anyone guessing codes
DEMO_MSG = "Workout buddies are turned off in the demo. Create your own account to pair with a friend."


def _call(fn, *a):
    try:
        return fn(*a)
    except svc.BuddyError as e:
        raise HTTPException(e.status, e.message) from None


def _real(user: User = Depends(require_profile)) -> User:
    if user.is_demo:
        raise HTTPException(403, DEMO_MSG)
    return user


@router.get("")
def overview(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    """Your invite code, your sharing setting, each buddy's week and streak, and nudges you haven't seen."""
    return svc.overview(db, user)


@router.post("/join", status_code=201)
def join(body: BuddyJoinIn, user: User = Depends(_real), db: Session = Depends(get_db)):
    if not _join_limiter.allow(f"u{user.id}"):
        raise HTTPException(429, "Too many tries. Please wait a while and check the code with your friend.")
    other = _call(svc.join, db, user, body.code)
    return {"detail": f"You and {svc.first_name(other)} are now workout buddies.", **svc.overview(db, user)}


@router.post("/code")
def new_code(user: User = Depends(_real), db: Session = Depends(get_db)):
    """Make a new invite code. The old one stops working; current buddies stay."""
    svc.reset_code(db, user)
    return svc.overview(db, user)


@router.put("/sharing")
def sharing(body: BuddySharingIn, user: User = Depends(_real), db: Session = Depends(get_db)):
    user.buddy_sharing = body.sharing
    db.commit()
    return svc.overview(db, user)


@router.delete("/{buddy_id}", status_code=204)
def remove(buddy_id: int, user: User = Depends(_real), db: Session = Depends(get_db)):
    _call(svc.remove, db, user, buddy_id)


@router.post("/{buddy_id}/nudge")
def nudge(buddy_id: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    if user.is_demo:  # the demo's sample buddy isn't a real person: pretend it worked
        if buddy_id != 0:
            raise HTTPException(404, "That person isn't your buddy.")
        return {"detail": "Nudge sent to Priya."}
    name = _call(svc.nudge, db, user, buddy_id)
    return {"detail": f"Nudge sent to {name}."}


@router.post("/nudges/seen")
def nudges_seen(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    if not user.is_demo:
        svc.mark_seen(db, user)
    return {"detail": "ok"}
