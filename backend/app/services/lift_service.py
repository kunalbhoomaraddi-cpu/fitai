"""Per-lift progress, calculated from the sets logged during workouts (`set_log` on each exercise).

Each finished session gives one point per exercise:
- weighted lifts: estimated one-rep max of the best set, using the Epley formula kg × (1 + reps / 30);
- bodyweight moves: the most reps in one set;
- timed moves (planks): the longest hold in seconds.

A point is a personal record (PR) when it beats every earlier point for that lift.
All numbers are worked out here in code; nothing is estimated by the AI.
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.services.progress_service import completed_sessions
from app.utils.clock import local_date, local_today

UNITS = {"weighted": "kg", "bodyweight": "reps", "timed": "sec"}
METRIC = {"weighted": "Estimated 1-rep max", "bodyweight": "Most reps in a set", "timed": "Longest hold"}


def epley(kg: float, reps: int) -> float:
    """Estimated one-rep max. A single rep is the max itself; above 12 reps the estimate gets unreliable, so cap there."""
    reps = max(1, min(int(reps), 12))
    return round(kg if reps == 1 else kg * (1 + reps / 30), 1)


def _clean_sets(ex: dict) -> list[tuple[float | None, int]]:
    out = []
    for s in ex.get("set_log") or []:
        if not isinstance(s, dict) or not s.get("done"):
            continue
        reps = s.get("reps")
        kg = s.get("kg")
        if not isinstance(reps, (int, float)) or not 0 < reps <= 1000:
            continue
        kg = float(kg) if isinstance(kg, (int, float)) and 0 < kg <= 1000 else None
        out.append((kg, int(reps)))
    return out


def _point(kind: str, sets: list[tuple[float | None, int]]) -> dict:
    if kind == "weighted":
        weighted = [(kg, r) for kg, r in sets if kg]
        kg, reps = max(weighted, key=lambda s: (epley(*s), s[0]))
        # kg and reps are returned separately so the app can show the set in kg or lb.
        return {"value": epley(kg, reps), "label": f"{kg:g} kg × {reps}", "kg": kg, "reps": reps,
                "volume": round(sum(k * r for k, r in weighted))}
    best = max(r for _, r in sets)
    unit = "s" if kind == "timed" else "reps"
    return {"value": float(best), "label": f"{best} {unit}", "kg": None, "reps": best, "volume": sum(r for _, r in sets)}


def lift_progress(db: Session, user_id: int, weeks: int = 52) -> list[dict]:
    """Every lift the user has logged sets for, most-trained first, each with its points over time."""
    since = local_today() - timedelta(weeks=weeks)
    raw: dict[str, dict] = {}
    for s in completed_sessions(db, user_id):
        day = local_date(s.started_at)
        if day < since:
            continue
        for ex in s.exercises or []:
            sets = _clean_sets(ex)
            key = str(ex.get("exercise_id") or ex.get("name") or "")
            if not sets or not key:
                continue
            item = raw.setdefault(key, {"exercise_id": key, "name": ex.get("name") or key,
                                        "timed": "sec" in str(ex.get("reps", "")).lower(), "sessions": []})
            item["sessions"].append((day, sets))

    lifts = []
    for item in raw.values():
        has_kg = any(kg for _, sets in item["sessions"] for kg, _ in sets)
        kind = "timed" if item["timed"] else "weighted" if has_kg else "bodyweight"
        points, best = [], None
        for day, sets in item["sessions"]:
            if kind == "weighted" and not any(kg for kg, _ in sets):
                continue  # a day logged without weights can't be compared with weighted days
            p = {"date": day.isoformat(), **_point(kind, sets)}
            p["pr"] = best is None or p["value"] > best["value"]
            if p["pr"]:
                best = p
            points.append(p)
        if not points:
            continue
        points[0]["pr"] = False  # the first session sets the baseline; it isn't a record yet
        recent = [p for p in points if p["date"] >= (local_today() - timedelta(weeks=8)).isoformat()]
        change = round(recent[-1]["value"] - recent[0]["value"], 1) if len(recent) >= 2 else None
        lifts.append({
            "exercise_id": item["exercise_id"], "name": item["name"], "kind": kind,
            "unit": UNITS[kind], "metric": METRIC[kind], "sessions": len(points),
            "last_date": points[-1]["date"], "latest": points[-1], "best": best,
            "change_8w": change, "prs": sum(1 for p in points if p["pr"]), "points": points,
        })
    lifts.sort(key=lambda lift: (-lift["sessions"], lift["name"]))
    return lifts
