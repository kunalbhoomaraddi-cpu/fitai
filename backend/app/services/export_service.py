"""'Export my data': everything FitAI stores about a person, as one ZIP they can keep or move elsewhere
(the DPDP Act's right to access). Contains JSON for every record, CSV copies of the food log, weigh-ins
and workout sets for spreadsheets, and the original progress photos. Password hashes and sign-in codes
are never included."""
import csv
import io
import json
import tempfile
import zipfile
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    BodyMeasurement,
    Break,
    Conversation,
    DietPlan,
    FoodEntry,
    Message,
    ProgressPhoto,
    SavedMeal,
    SavedRecommendation,
    User,
    UserAchievement,
    WaterLog,
    WeeklyCheckin,
    WeightRecord,
    WorkoutPlan,
    WorkoutSession,
)
from app.utils.clock import local_today

SKIP_COLUMNS = {"hashed_password", "image", "thumb", "user_id"}

README = """Your FitAI data
================
Exported on {date} for {email}.

fitai-data.json   Every record FitAI holds about you: account, profile, food log, saved meals, meal and
                  workout plans, workouts with every set, weigh-ins, measurements, water, breaks,
                  weekly check-ins, achievements and coach conversations.
food_log.csv      Your food log, one row per item (opens in Excel or Google Sheets).
weights.csv       Your weigh-ins.
workout_sets.csv  Every set you logged.
photos/           Your progress photos, as uploaded (location data was already removed).

Weights are in kilograms and lengths in centimetres. To delete your account and all of this data,
use Settings, then Delete account.
"""


def _row(obj) -> dict:
    out = {}
    for col in obj.__table__.columns:
        if col.key in SKIP_COLUMNS:
            continue
        v = getattr(obj, col.key)
        out[col.key] = v.isoformat() if isinstance(v, (date, datetime)) else v
    return out


def _all(db: Session, model, user_id: int, order) -> list:
    return list(db.scalars(select(model).where(model.user_id == user_id).order_by(order)))


def _csv(rows: list[dict], fields: list[str]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def build_export(db: Session, user: User):
    """Writes the ZIP to a temporary file (kept in memory only while small) and returns it, rewound."""
    uid = user.id
    food = [_row(e) for e in _all(db, FoodEntry, uid, FoodEntry.eaten_on)]
    weights = [_row(w) for w in _all(db, WeightRecord, uid, WeightRecord.recorded_on)]
    sessions = [_row(s) for s in _all(db, WorkoutSession, uid, WorkoutSession.started_at)]
    convs = []
    for c in _all(db, Conversation, uid, Conversation.id):
        msgs = db.scalars(select(Message).where(Message.conversation_id == c.id).order_by(Message.id))
        convs.append({**_row(c), "messages": [_row(m) for m in msgs]})
    photos = _all(db, ProgressPhoto, uid, ProgressPhoto.taken_on)

    data = {
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "account": {k: v for k, v in _row(user).items() if k not in ("id",)},
        "profile": _row(user.profile) if user.profile else None,
        "food_log": food,
        "saved_meals": [_row(x) for x in _all(db, SavedMeal, uid, SavedMeal.id)],
        "meal_plans": [_row(x) for x in _all(db, DietPlan, uid, DietPlan.id)],
        "workout_plans": [_row(x) for x in _all(db, WorkoutPlan, uid, WorkoutPlan.id)],
        "workouts": sessions,
        "weigh_ins": weights,
        "measurements": [_row(x) for x in _all(db, BodyMeasurement, uid, BodyMeasurement.recorded_on)],
        "water": [_row(x) for x in _all(db, WaterLog, uid, WaterLog.logged_on)],
        "breaks": [_row(x) for x in _all(db, Break, uid, Break.start_on)],
        "weekly_checkins": [_row(x) for x in _all(db, WeeklyCheckin, uid, WeeklyCheckin.week_start)],
        "achievements": [_row(x) for x in _all(db, UserAchievement, uid, UserAchievement.id)],
        "saved_tips": [_row(x) for x in _all(db, SavedRecommendation, uid, SavedRecommendation.id)],
        "coach_conversations": convs,
        "progress_photos": [{**_row(p), "file": f"photos/{p.taken_on.isoformat()}-{p.pose}-{p.id}.jpg"} for p in photos],
    }

    sets = []
    for s in sessions:
        for ex in s.get("exercises") or []:
            for n, st in enumerate(ex.get("set_log") or [], 1):
                if isinstance(st, dict) and st.get("done"):
                    sets.append({"date": (s.get("started_at") or "")[:10], "workout": s.get("name"), "exercise": ex.get("name"),
                                 "set": n, "kg": st.get("kg"), "reps": st.get("reps")})

    out = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.txt", README.format(date=local_today().isoformat(), email=user.email))
        z.writestr("fitai-data.json", json.dumps(data, indent=2, ensure_ascii=False, default=str))
        z.writestr("food_log.csv", _csv(food, ["eaten_on", "meal", "name", "quantity_g", "calories", "protein_g", "carbs_g", "fat_g", "source"]))
        z.writestr("weights.csv", _csv(weights, ["recorded_on", "weight_kg", "note"]))
        z.writestr("workout_sets.csv", _csv(sets, ["date", "workout", "exercise", "set", "kg", "reps"]))
        for p in photos:  # one image in memory at a time
            img = db.scalar(select(ProgressPhoto.image).where(ProgressPhoto.id == p.id))
            if img:
                z.writestr(f"photos/{p.taken_on.isoformat()}-{p.pose}-{p.id}.jpg", img, compress_type=zipfile.ZIP_STORED)
    out.seek(0)
    return out
