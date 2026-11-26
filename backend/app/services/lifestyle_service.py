"""Water, travel/festival breaks and streak freezes. All deterministic and computed from stored data."""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Break, User, WaterLog
from app.utils.clock import local_today

BREAK_KINDS = {"travel": "Travel", "festival": "Festival"}
MAX_BREAK_DAYS = 21
FREEZE_EVERY = 7   # one streak freeze earned for every 7 workouts in a streak
MAX_FREEZES = 2


# --------------------------------------------------------------------------- water
def water_goal_ml(weight_kg: float | None) -> int:
    """About 35 ml per kg of body weight, rounded to a glass (250 ml), kept between 2 and 4 litres.
    A general guide; heat, sweat and training raise it."""
    if not weight_kg:
        return 2500
    return int(min(4000, max(2000, round(weight_kg * 35 / 250) * 250)))


def water_day(db: Session, user: User, day: date) -> dict:
    row = db.scalar(select(WaterLog).where(WaterLog.user_id == user.id, WaterLog.logged_on == day))
    goal = water_goal_ml(user.profile.current_weight_kg if user.profile else None)
    ml = row.ml if row else 0
    return {"date": day.isoformat(), "ml": ml, "goal_ml": goal, "glasses": round(ml / 250, 1), "goal_glasses": goal // 250}


def add_water(db: Session, user: User, day: date, delta_ml: int) -> dict:
    row = db.scalar(select(WaterLog).where(WaterLog.user_id == user.id, WaterLog.logged_on == day))
    if not row:
        row = WaterLog(user_id=user.id, logged_on=day, ml=0)
        db.add(row)
    row.ml = max(0, min(10000, (row.ml or 0) + delta_ml))
    db.commit()
    return water_day(db, user, day)


# --------------------------------------------------------------------------- breaks
def breaks(db: Session, user_id: int) -> list[Break]:
    return list(db.scalars(select(Break).where(Break.user_id == user_id).order_by(Break.start_on)))


def active_break(db: Session, user_id: int, day: date | None = None) -> Break | None:
    day = day or local_today()
    return db.scalar(select(Break).where(Break.user_id == user_id, Break.start_on <= day, Break.end_on >= day)
                     .order_by(Break.start_on.desc()))


def paused_days(rows: list[Break]) -> set[date]:
    out: set[date] = set()
    for b in rows:
        d = b.start_on
        while d <= b.end_on:
            out.add(d)
            d += timedelta(days=1)
    return out


def break_out(b: Break | None, today: date | None = None) -> dict | None:
    if not b:
        return None
    today = today or local_today()
    return {"id": b.id, "kind": b.kind, "label": BREAK_KINDS.get(b.kind, b.kind), "start_on": b.start_on.isoformat(),
            "end_on": b.end_on.isoformat(), "note": b.note, "active": b.start_on <= today <= b.end_on,
            "days_left": max(0, (b.end_on - today).days + 1) if b.end_on >= today else 0}


# --------------------------------------------------------------------------- streaks
def streak_detail(dates: list[date], today: date | None = None, paused: set[date] | None = None) -> dict:
    """Workout streak where one rest day between sessions is fine.

    - Days inside a travel or festival break don't count as missed.
    - Every 7 workouts in a streak earns a freeze (at most 2 held). A freeze covers one extra missed day,
      and is used automatically, so a busy week doesn't wipe out a long streak.
    Returns the current streak, freezes left, the days freezes covered, and the best streak ever."""
    today = today or local_today()
    paused = paused or set()
    uniq = sorted(set(d for d in dates if d <= today))
    if not uniq:
        return {"streak": 0, "freezes": 0, "frozen_days": [], "best": 0, "paused_today": today in paused}

    def missed_between(a: date, b: date) -> list[date]:
        """Days strictly between a and b that weren't in a break."""
        return [a + timedelta(days=i) for i in range(1, (b - a).days) if a + timedelta(days=i) not in paused]

    run, held, best = 1, 0, 1
    frozen: list[date] = []
    for prev, cur in zip(uniq, uniq[1:], strict=False):
        missed = missed_between(prev, cur)
        extra = len(missed) - 1  # one rest day is always allowed
        if extra > 0 and held >= extra:
            held -= extra
            frozen += missed[1:]
        elif extra > 0:
            run, held, frozen = 0, 0, []
        run += 1
        if run % FREEZE_EVERY == 0:
            held = min(MAX_FREEZES, held + 1)
        best = max(best, run)

    # From the last workout to today: today itself isn't missed yet (there's still time to train).
    missed = missed_between(uniq[-1], today)
    extra = len(missed) - 1
    if extra > 0 and held >= extra:
        held -= extra
        frozen += missed[1:]
    elif extra > 0:
        run, held, frozen = 0, 0, []
    return {"streak": run, "freezes": held, "frozen_days": [d.isoformat() for d in frozen if run], "best": best,
            "paused_today": today in paused}
