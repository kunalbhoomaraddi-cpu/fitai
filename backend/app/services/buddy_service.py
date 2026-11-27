"""Workout buddies: pair with a friend by invite code and keep each other going.

What a buddy can see is deliberately small: your first name, which days you trained this week, how
many workouts you planned, and your current streak. Never food, weight, measurements, photos, email
or anything the coach knows. "Share my workouts" off hides even that (they see your first name only).
Either person can end the pairing at any time; deleting an account removes its pairings and nudges."""
import re
import secrets
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import BuddyLink, BuddyNudge, User, WorkoutPlan, WorkoutSession
from app.services import lifestyle_service as ls
from app.utils.clock import current_tz, local_today, valid_tz

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I/L, so codes are easy to read out
CODE_LEN = 8
MAX_BUDDIES = 5
NUDGE_SHOWN_DAYS = 3  # older unseen nudges are no longer useful


class BuddyError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def first_name(u: User) -> str:
    return (u.full_name or "").strip().split(" ")[0][:30] or "Your buddy"


def normalize_code(raw: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (raw or "").upper())


def pretty_code(code: str | None) -> str | None:
    return f"{code[:4]}-{code[4:]}" if code else None


def _new_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))
        if not db.scalar(select(User.id).where(User.buddy_code == code)):
            return code


def ensure_code(db: Session, user: User) -> str:
    if not user.buddy_code:
        user.buddy_code = _new_code(db)
        db.commit()
    return user.buddy_code


def reset_code(db: Session, user: User) -> str:
    """A new code: the old one stops working (people already paired stay paired)."""
    user.buddy_code = _new_code(db)
    db.commit()
    return user.buddy_code


def _links(db: Session, user_id: int) -> list[BuddyLink]:
    return list(db.scalars(select(BuddyLink).where(or_(BuddyLink.user_a_id == user_id, BuddyLink.user_b_id == user_id))
                           .order_by(BuddyLink.id)))


def buddy_ids(db: Session, user_id: int) -> list[int]:
    return [lk.user_b_id if lk.user_a_id == user_id else lk.user_a_id for lk in _links(db, user_id)]


def _link(db: Session, a: int, b: int) -> BuddyLink | None:
    lo, hi = min(a, b), max(a, b)
    return db.scalar(select(BuddyLink).where(BuddyLink.user_a_id == lo, BuddyLink.user_b_id == hi))


def join(db: Session, user: User, raw_code: str) -> User:
    code = normalize_code(raw_code)
    if len(code) != CODE_LEN:
        raise BuddyError(422, "Invite codes have 8 letters and numbers, like K7QM-2XRP.")
    other = db.scalar(select(User).where(User.buddy_code == code))
    if other is None or other.is_demo:
        raise BuddyError(404, "No one has that invite code. Check it with your friend; codes change when they make a new one.")
    if other.id == user.id:
        raise BuddyError(422, "That's your own code. Send it to a friend, or type theirs here.")
    if _link(db, user.id, other.id):
        raise BuddyError(409, f"You and {first_name(other)} are already buddies.")
    if len(buddy_ids(db, user.id)) >= MAX_BUDDIES:
        raise BuddyError(409, f"You can have up to {MAX_BUDDIES} buddies. Remove one to add someone new.")
    if len(buddy_ids(db, other.id)) >= MAX_BUDDIES:
        raise BuddyError(409, f"{first_name(other)} already has {MAX_BUDDIES} buddies, the most allowed.")
    db.add(BuddyLink(user_a_id=min(user.id, other.id), user_b_id=max(user.id, other.id)))
    db.commit()
    return other


def remove(db: Session, user: User, buddy_id: int) -> None:
    lk = _link(db, user.id, buddy_id)
    if lk is None:
        raise BuddyError(404, "That person isn't your buddy.")
    db.delete(lk)
    # Nudges between the two go too, so nothing lingers after the pairing ends
    db.execute(delete(BuddyNudge).where(or_(and_(BuddyNudge.from_id == user.id, BuddyNudge.to_id == buddy_id),
                                            and_(BuddyNudge.from_id == buddy_id, BuddyNudge.to_id == user.id))))
    db.commit()


# --------------------------------------------------------------------------- what a buddy sees
def _their_tz(u: User) -> ZoneInfo:
    return ZoneInfo(valid_tz(u.timezone) or valid_tz(get_settings().default_timezone) or "UTC")


def activity(db: Session, u: User) -> dict:
    """This week (Monday to Sunday, on the buddy's own clock) and their current streak."""
    tz = _their_tz(u)
    today = datetime.now(tz).date()
    monday = today - timedelta(days=today.weekday())
    started = db.scalars(select(WorkoutSession.started_at).where(WorkoutSession.user_id == u.id,
                                                                 WorkoutSession.status == "completed"))
    dates = [s.replace(tzinfo=UTC).astimezone(tz).date() for s in started]
    trained = set(dates)
    plan = db.scalar(select(WorkoutPlan).where(WorkoutPlan.user_id == u.id)
                     .order_by(WorkoutPlan.is_saved.desc(), WorkoutPlan.id.desc()))
    streak = ls.streak_detail(dates, today, ls.paused_days(ls.breaks(db, u.id)))
    return {
        "week": [{"date": (monday + timedelta(days=i)).isoformat(), "trained": (monday + timedelta(days=i)) in trained,
                  "future": monday + timedelta(days=i) > today} for i in range(7)],
        "workouts_this_week": sum(1 for d in dates if monday <= d <= today),
        "planned_per_week": len(plan.days) if plan and plan.days else None,
        "streak": streak["streak"],
        "on_break": streak["paused_today"],
        "trained_today": today in trained,
        "last_workout": max(dates).isoformat() if dates else None,
    }


def _day_start_utc() -> datetime:
    """Midnight today on the sender's clock, as naive UTC (how timestamps are stored)."""
    start = datetime.combine(local_today(), time(), tzinfo=current_tz())
    return start.astimezone(UTC).replace(tzinfo=None)


def _nudged_today(db: Session, from_id: int, to_id: int) -> bool:
    return db.scalar(select(BuddyNudge.id).where(BuddyNudge.from_id == from_id, BuddyNudge.to_id == to_id,
                                                 BuddyNudge.created_at >= _day_start_utc())) is not None


def nudge(db: Session, user: User, buddy_id: int) -> str:
    if not _link(db, user.id, buddy_id):
        raise BuddyError(404, "That person isn't your buddy.")
    other = db.get(User, buddy_id)
    if _nudged_today(db, user.id, buddy_id):
        raise BuddyError(429, f"You've already nudged {first_name(other)} today.")
    db.add(BuddyNudge(from_id=user.id, to_id=buddy_id))
    db.commit()
    return first_name(other)


def unseen_nudges(db: Session, user: User) -> list[dict]:
    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=NUDGE_SHOWN_DAYS)
    rows = db.execute(select(BuddyNudge, User).join(User, User.id == BuddyNudge.from_id)
                      .where(BuddyNudge.to_id == user.id, BuddyNudge.seen.is_(False), BuddyNudge.created_at >= since)
                      .order_by(BuddyNudge.created_at.desc())).all()
    return [{"id": n.id, "from_id": u.id, "from_name": first_name(u), "at": n.created_at.isoformat() + "Z"} for n, u in rows]


def mark_seen(db: Session, user: User) -> None:
    for n in db.scalars(select(BuddyNudge).where(BuddyNudge.to_id == user.id, BuddyNudge.seen.is_(False))):
        n.seen = True
    db.commit()


def overview(db: Session, user: User) -> dict:
    if user.is_demo:
        return demo_overview()
    ensure_code(db, user)
    buddies = []
    for lk in _links(db, user.id):
        other = db.get(User, lk.user_b_id if lk.user_a_id == user.id else lk.user_a_id)
        buddies.append({"id": other.id, "name": first_name(other), "since": lk.created_at.date().isoformat(),
                        "sharing": other.buddy_sharing, "activity": activity(db, other) if other.buddy_sharing else None,
                        "nudged_today": _nudged_today(db, user.id, other.id)})
    return {"code": pretty_code(user.buddy_code), "sharing": user.buddy_sharing, "max_buddies": MAX_BUDDIES,
            "buddies": buddies, "nudges": unseen_nudges(db, user), "demo": False}


def export_rows(db: Session, user: User) -> list[dict]:
    """For 'Export my data': who you're paired with (first names only) and since when."""
    out = []
    for lk in _links(db, user.id):
        other = db.get(User, lk.user_b_id if lk.user_a_id == user.id else lk.user_a_id)
        out.append({"buddy": first_name(other), "since": lk.created_at.date().isoformat()})
    return out


# --------------------------------------------------------------------------- demo
def demo_overview(today: date | None = None) -> dict:
    """The demo shows a made-up buddy (not a real account), so visitors can see the feature
    without demo copies pairing with real people."""
    today = today or local_today()
    monday = today - timedelta(days=today.weekday())
    pattern = [True, False, True, True, False, True, False]  # Mon, Wed, Thu, Sat
    week = [{"date": (monday + timedelta(days=i)).isoformat(), "future": monday + timedelta(days=i) > today,
             "trained": pattern[i] and monday + timedelta(days=i) <= today} for i in range(7)]
    done = sum(1 for d in week if d["trained"])
    last = max((d["date"] for d in week if d["trained"]), default=(monday - timedelta(days=1)).isoformat())
    sample = {"id": 0, "name": "Priya", "since": (today - timedelta(days=24)).isoformat(), "sharing": True,
              "activity": {"week": week, "workouts_this_week": done, "planned_per_week": 4, "streak": 9 + done,
                           "on_break": False, "trained_today": pattern[today.weekday()], "last_workout": last},
              "nudged_today": False}
    return {"code": None, "sharing": True, "max_buddies": MAX_BUDDIES, "buddies": [sample], "demo": True, "nudges": []}
