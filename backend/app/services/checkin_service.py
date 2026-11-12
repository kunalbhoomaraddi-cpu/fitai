"""Weekly AI check-in.
The numbers (facts + consistency score) are always computed here, deterministically, from the
user's stored data. The LLM only writes the wording (headline, wins, focus, next-week targets);
if no LLM is configured or its answer is unusable, a rule-based writer is used instead."""
import json
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import GOAL_LABEL, SAFETY_RULES
from app.ai.provider import ProviderError, get_provider
from app.models import FoodEntry, User, UserAchievement, WeeklyCheckin
from app.services import fitness_service, progress_service

log = logging.getLogger("fitai.checkins")
ACHIEVEMENT_TITLES = {a["code"]: a["title"] for a in progress_service.ACHIEVEMENTS}


def week_start(d: date | None = None) -> date:
    d = d or date.today()
    return d - timedelta(days=d.weekday())


def _avg(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 1) if xs else None


def compute_facts(db: Session, user: User, today: date | None = None) -> dict:
    p = user.profile
    today = today or date.today()
    start = today - timedelta(days=6)
    prev_start = start - timedelta(days=7)

    # workouts
    sessions = [s for s in progress_service.completed_sessions(db, user.id, 10) if start <= s.started_at.date() <= today]
    planned = max(1, min(p.workout_days_per_week, 7))
    w_done = len(sessions)
    w_minutes = sum(s.duration_minutes or 0 for s in sessions)

    # nutrition
    targets = fitness_service.profile_targets(p)
    cal_t, pro_t = targets["calories"]["calorie_target"], targets["macros"]["protein_g"]
    rows = db.scalars(select(FoodEntry).where(FoodEntry.user_id == user.id, FoodEntry.eaten_on >= start,
                                              FoodEntry.eaten_on <= today))
    per_day: dict = defaultdict(lambda: [0.0, 0.0])
    for e in rows:
        per_day[e.eaten_on][0] += e.calories
        per_day[e.eaten_on][1] += e.protein_g
    days_logged = len(per_day)
    avg_cal = round(sum(v[0] for v in per_day.values()) / days_logged) if days_logged else None
    avg_pro = round(sum(v[1] for v in per_day.values()) / days_logged) if days_logged else None
    protein_days = sum(1 for v in per_day.values() if v[1] >= pro_t * 0.9)

    # weight (weekly averages smooth out daily water swings)
    recs = progress_service.weight_records(db, user.id, 14)
    this_w = [r.weight_kg for r in recs if start <= r.recorded_on <= today]
    prev_w = [r.weight_kg for r in recs if prev_start <= r.recorded_on < start]
    avg_this, avg_prev = _avg(this_w), _avg(prev_w)
    change = round(avg_this - avg_prev, 2) if avg_this is not None and avg_prev is not None else None
    latest = recs[-1].weight_kg if recs else p.current_weight_kg
    too_fast = (change is not None and p.goal in ("weight_loss", "recomposition") and change < 0
                and abs(change) > latest * 0.01)

    # achievements & challenges
    progress_service.evaluate_achievements(db, user)
    since = datetime.combine(start, datetime.min.time())
    new_ach = [ACHIEVEMENT_TITLES.get(a.code, a.code) for a in db.scalars(
        select(UserAchievement).where(UserAchievement.user_id == user.id, UserAchievement.unlocked_at >= since))]
    ch = progress_service.weekly_challenges(db, user)

    # consistency score: 40% training, 30% logging (5 days), 30% protein (4 days)
    score = round(40 * min(w_done / planned, 1) + 30 * min(days_logged / 5, 1) + 30 * min(protein_days / 4, 1))
    return {
        "period": {"start": start.isoformat(), "end": today.isoformat()},
        "goal": p.goal, "goal_label": GOAL_LABEL.get(p.goal, p.goal),
        "workouts": {"done": w_done, "planned": planned, "minutes": w_minutes,
                     "names": [s.name for s in sessions][:7]},
        "nutrition": {"days_logged": days_logged, "avg_calories": avg_cal, "calorie_target": cal_t,
                      "avg_protein_g": avg_pro, "protein_target_g": pro_t, "protein_days": protein_days},
        "weight": {"weigh_ins": len(this_w), "avg_kg": avg_this, "prev_avg_kg": avg_prev, "change_kg": change,
                   "latest_kg": round(latest, 1), "target_kg": p.target_weight_kg, "losing_too_fast": too_fast},
        "achievements": new_ach,
        "challenges": {"completed": sum(1 for c in ch if c["completed"]), "total": len(ch)},
        "score": score,
    }


def _trend_word(goal: str, change: float) -> str:
    if abs(change) < 0.1:
        return "held steady"
    return f"{'dropped' if change < 0 else 'rose'} {abs(change):.1f} kg"


def rule_summary(f: dict) -> dict:
    w, n, wt, s = f["workouts"], f["nutrition"], f["weight"], f["score"]
    wins, focus, nxt = [], [], []
    if w["done"] >= w["planned"]:
        wins.append(f"You trained {w['done']} time{'s' if w['done'] != 1 else ''} ({w['minutes']} min) — every planned session done.")
    elif w["done"]:
        wins.append(f"You got {w['done']} of {w['planned']} planned workouts in ({w['minutes']} min).")
    if n["days_logged"] >= 5:
        wins.append(f"Food logged on {n['days_logged']} of 7 days — that's what makes the numbers trustworthy.")
    if n["protein_days"] >= 4:
        wins.append(f"Protein target hit on {n['protein_days']} days.")
    if wt["change_kg"] is not None and not wt["losing_too_fast"]:
        good = (f["goal"] in ("weight_loss", "recomposition") and wt["change_kg"] <= 0) or \
               (f["goal"] == "muscle_gain" and wt["change_kg"] >= 0) or abs(wt["change_kg"]) < 0.3
        if good:
            wins.append(f"Weekly average weight {_trend_word(f['goal'], wt['change_kg'])} — moving the right way.")
    for a in f["achievements"]:
        wins.append(f"Unlocked: {a}.")

    if w["done"] < w["planned"]:
        focus.append(f"Training: {w['planned'] - w['done']} planned session{'s' if w['planned'] - w['done'] != 1 else ''} missed. "
                     "Put next week's workouts in your calendar like appointments.")
    if n["days_logged"] < 5:
        focus.append(f"Logging: food tracked on {n['days_logged']} day{'s' if n['days_logged'] != 1 else ''}. "
                     "Even rough entries beat none — aim for 5 days.")
    elif n["protein_days"] < 4:
        focus.append(f"Protein: averaged {n['avg_protein_g']} g vs {n['protein_target_g']} g target. "
                     "Add a protein source to breakfast and snacks.")
    if wt["weigh_ins"] < 3:
        focus.append("Weigh-ins: step on the scale 3 mornings a week so the weekly average is reliable.")
    if wt["losing_too_fast"]:
        focus.append(f"Pace: your average dropped {abs(wt['change_kg']):.1f} kg in a week, which is faster than ~1% of body "
                     "weight. Make sure you're eating enough — fast loss tends to cost muscle and energy.")

    nxt.append(f"Complete {w['planned']} workouts")
    nxt.append("Log food on at least 5 days")
    nxt.append(f"Hit {n['protein_target_g']} g protein on 4+ days")
    if wt["weigh_ins"] < 3:
        nxt.append("Weigh in 3 mornings")

    headline = ("Outstanding week — you nailed the basics." if s >= 85 else
                "Solid week with a couple of things to tighten." if s >= 60 else
                "A mixed week — small, steady steps will get you back on track." if s >= 30 else
                "A quiet week. Let's restart with one easy win at a time.")
    if not wins:
        wins.append("You checked in — reviewing your week is the first step to a better one.")
    return {"headline": headline, "wins": wins[:4], "focus": focus[:3], "next_week": nxt[:4]}


def _clean(items, n: int, maxlen: int = 240) -> list[str]:
    if not isinstance(items, list):
        return []
    return [str(x).strip()[:maxlen] for x in items if isinstance(x, (str, int, float)) and str(x).strip()][:n]


def llm_summary(provider, user: User, f: dict) -> dict | None:
    system = ("You are FitAI Coach writing a short weekly check-in. Be warm, specific and honest. "
              "Use ONLY the numbers given; never invent data. Return JSON only.\n" + SAFETY_RULES)
    prompt = f"""User first name: {user.full_name.split(" ")[0]}. Goal: {f['goal_label']}.
Facts for the last 7 days (computed by the app — treat as ground truth):
{json.dumps(f, default=str)}
Return JSON: {{"headline": str (max 12 words), "wins": [2–4 short sentences], "focus": [1–3 short sentences, each with one concrete action],
"next_week": [3–4 short measurable targets, e.g. "Complete 4 workouts"]}}.
If losing_too_fast is true, one focus item must gently address eating enough. If a section has nothing positive, be encouraging without exaggerating."""
    try:
        data = json.loads(provider.generate_json(system, prompt))
    except (ProviderError, json.JSONDecodeError, TypeError) as e:
        log.warning("AI check-in failed: %s", e)
        return None
    if not isinstance(data, dict):
        return None
    out = {"headline": str(data.get("headline") or "").strip()[:120], "wins": _clean(data.get("wins"), 4),
           "focus": _clean(data.get("focus"), 3), "next_week": _clean(data.get("next_week"), 4, 120)}
    if not out["headline"] or not out["wins"] or not out["next_week"]:
        return None
    if f["weight"]["losing_too_fast"] and not any("eat" in x.lower() for x in out["focus"]):
        out["focus"] = (out["focus"] + [rule_summary(f)["focus"][-1]])[-3:]
    return out


def out(c: WeeklyCheckin) -> dict:
    return {"id": c.id, "week_start": c.week_start.isoformat(), "period_start": c.period_start.isoformat(),
            "period_end": c.period_end.isoformat(), "score": c.score, "facts": c.facts, "summary": c.summary,
            "generated_by": c.generated_by, "is_ai": c.generated_by.startswith("llm:"),
            "created_at": c.created_at.isoformat() + "Z"}


def generate(db: Session, user: User) -> tuple[WeeklyCheckin, str | None]:
    facts = compute_facts(db, user)
    provider = get_provider(user.ai_provider_pref)
    summary, notice = None, None
    if provider.is_real_llm:
        summary = llm_summary(provider, user, facts)
        generated_by = f"llm:{provider.label}"[:100]
        if summary is None:
            notice = "The AI coach was unavailable, so this check-in was written by the FitAI rules engine."
    if summary is None:
        summary = rule_summary(facts)
        generated_by = "rules_engine"
        if not provider.is_real_llm:
            notice = "Demo mode: check-in written by the rule-based engine (no LLM configured)."
    ws = week_start()
    c = db.scalar(select(WeeklyCheckin).where(WeeklyCheckin.user_id == user.id, WeeklyCheckin.week_start == ws))
    if c is None:
        c = WeeklyCheckin(user_id=user.id, week_start=ws)
        db.add(c)
    c.period_start, c.period_end = date.fromisoformat(facts["period"]["start"]), date.fromisoformat(facts["period"]["end"])
    c.score, c.facts, c.summary, c.generated_by = facts["score"], facts, summary, generated_by
    db.commit()
    db.refresh(c)
    return c, notice
