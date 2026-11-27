"""Adaptive calorie target: an estimate of someone's real maintenance calories (TDEE) from what they
logged and how their weight actually moved, instead of a formula guess.

    maintenance ≈ average calories eaten − (weight trend in kg/day × 7,700 kcal per kg)

The formula (Mifflin-St Jeor × activity) can be off by 10–20% for an individual; four weeks of honest
logs usually narrow that down. Guard rails:
  * only fully logged days count (a day with a snack logged isn't a day of eating);
  * the weight trend is a straight-line fit over all weigh-ins, so one salty dinner doesn't move it;
  * it needs at least 10 logged days and 5 weigh-ins spread over 10+ days;
  * it is blended with the formula until there are 3 weeks of data, and never more than 25% from it;
  * the usual safety floors still apply to the final target.
"""
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FoodEntry, WeightRecord

WINDOW_DAYS = 28
KCAL_PER_KG = 7700
MIN_LOGGED_DAYS = 10
MIN_WEIGH_INS = 5
MIN_WEIGH_SPAN_DAYS = 10
FULL_CONFIDENCE_DAYS = 21
MAX_DEVIATION = 0.25


def _slope_per_day(points: list[tuple[date, float]]) -> float:
    """Least-squares slope of weight against time, in kg per day."""
    t0 = points[0][0]
    xs = [(d - t0).days for d, _ in points]
    ys = [w for _, w in points]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    return 0.0 if sxx == 0 else sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True)) / sxx


def estimate(db: Session, user_id: int, formula_tdee: float, today: date) -> dict:
    """Returns the estimate and what it is based on. status is 'ready' or 'collecting'."""
    start, end = today - timedelta(days=WINDOW_DAYS), today - timedelta(days=1)  # today's log isn't finished yet
    rows = db.execute(select(FoodEntry.eaten_on, func.sum(FoodEntry.calories))
                      .where(FoodEntry.user_id == user_id, FoodEntry.eaten_on >= start, FoodEntry.eaten_on <= end)
                      .group_by(FoodEntry.eaten_on)).all()
    complete = max(800.0, 0.45 * formula_tdee)  # below this a day was probably only partly logged
    days = {d: float(kcal or 0) for d, kcal in rows if (kcal or 0) >= complete}
    weights = [(d, float(w)) for d, w in db.execute(
        select(WeightRecord.recorded_on, WeightRecord.weight_kg)
        .where(WeightRecord.user_id == user_id, WeightRecord.recorded_on >= start, WeightRecord.recorded_on <= today)
        .order_by(WeightRecord.recorded_on)).all()]
    span = (weights[-1][0] - weights[0][0]).days if len(weights) >= 2 else 0
    base = {"formula_tdee": round(formula_tdee), "logged_days": len(days), "weigh_ins": len(weights),
            "weigh_span_days": span, "window_days": WINDOW_DAYS,
            "needs": {"logged_days": MIN_LOGGED_DAYS, "weigh_ins": MIN_WEIGH_INS, "weigh_span_days": MIN_WEIGH_SPAN_DAYS}}
    if len(days) < MIN_LOGGED_DAYS or len(weights) < MIN_WEIGH_INS or span < MIN_WEIGH_SPAN_DAYS:
        return {**base, "status": "collecting", "estimated_tdee": None, "tdee": round(formula_tdee), "confidence": 0.0}

    avg_intake = sum(days.values()) / len(days)
    slope = _slope_per_day(weights)
    raw = avg_intake - slope * KCAL_PER_KG
    lo, hi = formula_tdee * (1 - MAX_DEVIATION), formula_tdee * (1 + MAX_DEVIATION)
    estimated = min(hi, max(lo, raw))
    confidence = round(min(1.0, len(days) / FULL_CONFIDENCE_DAYS, len(weights) / (MIN_WEIGH_INS * 2)), 2)
    blended = confidence * estimated + (1 - confidence) * formula_tdee
    return {**base, "status": "ready", "avg_intake": round(avg_intake), "weekly_change_kg": round(slope * 7, 2),
            "raw_estimate": round(raw), "estimated_tdee": round(estimated), "capped": raw != estimated,
            "confidence": confidence, "tdee": round(blended), "difference": round(blended - formula_tdee)}
