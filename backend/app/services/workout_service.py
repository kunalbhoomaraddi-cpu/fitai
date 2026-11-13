"""Deterministic workout programming engine + wger exercise enrichment."""
from __future__ import annotations

import logging
import random
import re

from app.config import get_settings
from app.data.exercises import EXERCISE_BY_ID, EXERCISES
from app.utils.http import SlidingWindowLimiter, TTLCache, http_get_json

log = logging.getLogger("fitai.workouts")
settings = get_settings()
_wger_cache = TTLCache(maxsize=500, ttl=24 * 3600)
_wger_limiter = SlidingWindowLimiter(limit=30, window=60)

SPLIT_NAMES = {
    "full_body": "Full Body", "upper_lower": "Upper / Lower", "push_pull_legs": "Push / Pull / Legs",
    "beginner": "Beginner Foundations", "muscle_building": "Muscle Building", "fat_loss": "Fat Loss Circuit",
    "custom": "Custom Focus",
}

DAY_TEMPLATES: dict[str, list[tuple[str, list[str]]]] = {
    "full_body": [("Full Body A", ["quads", "chest", "back", "hamstrings", "shoulders", "core", "biceps", "triceps"]),
                  ("Full Body B", ["hamstrings", "back", "chest", "glutes", "shoulders", "core", "triceps", "calves"]),
                  ("Full Body C", ["quads", "back", "shoulders", "glutes", "chest", "core", "biceps", "calves"])],
    "upper_lower": [("Upper Strength", ["chest", "back", "shoulders", "back", "biceps", "triceps", "shoulders"]),
                    ("Lower Strength", ["quads", "hamstrings", "glutes", "quads", "calves", "core"]),
                    ("Upper Volume", ["back", "chest", "shoulders", "chest", "triceps", "biceps", "shoulders"]),
                    ("Lower Volume", ["hamstrings", "quads", "glutes", "hamstrings", "calves", "core"])],
    "push_pull_legs": [("Push", ["chest", "shoulders", "chest", "triceps", "shoulders", "triceps"]),
                       ("Pull", ["back", "back", "shoulders", "biceps", "back", "biceps"]),
                       ("Legs", ["quads", "hamstrings", "glutes", "quads", "calves", "core"])],
    "fat_loss": [("Metabolic Full Body", ["quads", "chest", "back", "cardio", "glutes", "core", "cardio"]),
                 ("Strength + Conditioning", ["hamstrings", "shoulders", "back", "cardio", "quads", "core", "cardio"])],
    "beginner": [("Foundations A", ["quads", "chest", "back", "core", "glutes"]),
                 ("Foundations B", ["hamstrings", "shoulders", "back", "core", "quads"])],
}
WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SCHEDULE = {1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5]}


def choose_split(goal: str, experience: str, days: int, requested: str) -> str:
    if requested not in ("auto", "muscle_building", "custom"):
        return requested
    if requested == "muscle_building":
        return "push_pull_legs" if days >= 5 or (days == 3 and experience != "beginner") else "upper_lower" if days >= 4 else "full_body"
    if experience == "beginner":
        return "beginner" if days <= 3 else "upper_lower"
    if goal == "weight_loss" and days <= 3:
        return "fat_loss"
    if days <= 3:
        return "full_body"
    if days == 4:
        return "upper_lower"
    return "push_pull_legs"


def _prescription(ex: dict, goal: str, experience: str, recovery: str) -> dict:
    if ex["type"] == "conditioning":
        sets, reps, rest = 3, "30–40 sec", 45
    elif ex["type"] == "compound":
        if goal in ("muscle_gain", "recomposition"):
            sets, reps, rest = 4, "6–10", 120
        elif goal == "weight_loss":
            sets, reps, rest = 3, "8–12", 75
        else:
            sets, reps, rest = 3, "8–12", 90
    else:
        sets, reps, rest = 3, "10–15", 60
    if experience == "beginner":
        sets = min(sets, 3)
    if experience == "advanced" and ex["type"] != "conditioning":
        sets += 0 if goal == "weight_loss" else 1 if ex["type"] == "compound" else 0
    if recovery == "extra_rest":
        sets = max(2, sets - 1)
        rest += 15
    if ex["id"] in ("plank", "side_plank"):
        reps = "30–45 sec"
    return {"sets": sets, "reps": reps, "rest_seconds": rest}


def _available(ex: dict, equipment: set[str]) -> bool:
    return bool(set(ex["equipment"]) & equipment)


def _pick(muscle: str, equipment: set[str], used: set[str], rng: random.Random, experience: str) -> dict | None:
    cands = [e for e in EXERCISES if e["muscle"] == muscle and _available(e, equipment) and e["id"] not in used]
    if experience == "beginner":
        cands = [e for e in cands if e["id"] not in ("deadlift", "hanging_knee_raise", "chest_dip")] or cands
    if not cands:
        cands = [e for e in EXERCISES if muscle in e["secondary"] and _available(e, equipment) and e["id"] not in used]
    if not cands:
        return None
    cands.sort(key=lambda e: (e["type"] != "compound", rng.random()))
    return cands[0] if rng.random() < 0.7 else rng.choice(cands)


def generate_plan(goal: str, experience: str, days: int, equipment: list[str], duration: int,
                  split: str = "auto", target_muscles: list[str] | None = None, recovery: str = "standard",
                  seed: int | None = None) -> dict:
    rng = random.Random(seed)
    eq = set(equipment) | {"bodyweight"}
    chosen = choose_split(goal, experience, days, split)
    n_ex = max(3, min(8, round(duration / 9)))
    if chosen == "custom" or (target_muscles and split == "custom"):
        muscles = target_muscles or ["chest", "back", "quads", "shoulders", "core"]
        templates = [(f"Focus Day {i+1}", (muscles * 3)[i: i + n_ex]) for i in range(min(days, 3))]
        chosen = "custom"
    else:
        templates = DAY_TEMPLATES.get(chosen, DAY_TEMPLATES["full_body"])
    plan_days = []
    schedule = SCHEDULE.get(days, SCHEDULE[3])
    for i in range(days):
        name, muscles = templates[i % len(templates)]
        if target_muscles and chosen != "custom":
            muscles = list(dict.fromkeys(list(target_muscles)[:2] + muscles))
        used: set[str] = set()
        exercises = []
        for m in muscles:
            if len(exercises) >= n_ex:
                break
            ex = _pick(m, eq, used, rng, experience)
            if ex is None:
                continue
            used.add(ex["id"])
            exercises.append({"exercise_id": ex["id"], "name": ex["name"], "muscle": ex["muscle"],
                              "secondary": ex["secondary"], "equipment": [e for e in ex["equipment"] if e in eq],
                              "instructions": ex["instructions"], "image": f"muscle-{ex['muscle']}",
                              **_prescription(ex, goal, experience, recovery), "completed": False})
        plan_days.append({"index": i, "weekday": WEEK[schedule[i]], "name": name,
                          "focus": sorted({e["muscle"] for e in exercises}), "duration_minutes": duration,
                          "exercises": exercises})
    rest_days = [WEEK[d] for d in range(7) if d not in schedule]
    return {
        "split": chosen, "split_name": SPLIT_NAMES.get(chosen, chosen.replace("_", " ").title()),
        "days": plan_days, "rest_days": rest_days,
        "recovery_note": ("Active recovery on rest days: 20–30 min easy walk plus mobility." if recovery == "active_recovery"
                          else "Rest days are part of the program. Aim for 7–9 hours of sleep."),
    }


def warmup_note(experience: str) -> str:
    return "Warm up 5–8 minutes (easy cardio + 1–2 light ramp-up sets) before the first exercise."


# --------------------------------------------------------------------------- wger enrichment
def _clean_html(s: str) -> str:
    return re.sub(r"<[^>]+>", " ", s or "").replace("&nbsp;", " ").strip()


def wger_exercise_info(name: str) -> dict:
    """Look up an exercise on wger (public, no auth). Returns image/description when available.
    Falls back to the local library without raising."""
    key = name.lower().strip()
    local = next((e for e in EXERCISES if e["name"].lower() == key), None)
    fallback = {"name": name, "source": "fitai_library", "image_url": None,
                "description": local["instructions"] if local else None, "warning": None}
    if not settings.enable_external_apis:
        return fallback
    cached = _wger_cache.get(key)
    if cached is not None:
        return cached
    if not _wger_limiter.allow():
        return {**fallback, "warning": "wger rate limit reached locally; using FitAI library."}
    try:
        simple = re.sub(r"\(.*?\)", "", name).replace("Barbell", "").replace("Dumbbell", "").strip() or name
        data = http_get_json(f"{settings.wger_base_url}/exercise/search/", params={"term": simple, "language": "en"},
                             headers={"Accept": "application/json", "User-Agent": "FitAI/1.0"})
        sugg = data.get("suggestions") or []
        result = dict(fallback)
        for s in sugg:
            d = s.get("data") or {}
            img = d.get("image") or d.get("image_thumbnail")
            if img:
                result.update({"source": "wger", "image_url": img if img.startswith("http") else f"https://wger.de{img}",
                               "wger_id": d.get("base_id") or d.get("id"), "wger_name": d.get("name") or s.get("value")})
                break
        if result["source"] != "wger" and sugg:
            d = sugg[0].get("data") or {}
            result.update({"source": "wger", "wger_id": d.get("base_id") or d.get("id"),
                           "wger_name": d.get("name") or sugg[0].get("value")})
        _wger_cache.set(key, result)
        return result
    except Exception as exc:
        log.warning("wger unavailable: %s", type(exc).__name__)
        return {**fallback, "warning": "wger exercise database unreachable; showing FitAI library info."}


def library(muscle: str | None = None, equipment: str | None = None) -> list[dict]:
    out = EXERCISES
    if muscle:
        out = [e for e in out if e["muscle"] == muscle]
    if equipment:
        out = [e for e in out if equipment in e["equipment"]]
    return [{**e, "image": f"muscle-{e['muscle']}"} for e in out]


def get_exercise(eid: str) -> dict | None:
    return EXERCISE_BY_ID.get(eid)
