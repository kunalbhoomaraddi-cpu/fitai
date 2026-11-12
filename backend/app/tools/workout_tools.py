from app.services import progress_service, workout_service
from app.tools.registry import tool


@tool("get_workout_history", "Get completed workouts, current streak and weekly workout counts from stored history.",
      {"days": {"type": "integer", "description": "look-back window, default 30"}})
def get_workout_history(db, user, days=30):
    ws = progress_service.workout_stats(db, user.id)
    sessions = progress_service.completed_sessions(db, user.id, int(days))
    return {"completed_in_window": len(sessions), "window_days": days, "streak": ws["streak"],
            "this_week": ws["this_week"], "total_completed": ws["total_completed"],
            "recent": ws["recent"], "weekly_counts": ws["weekly_counts"],
            "_card": {"type": "metrics", "title": "Workout history",
                      "items": [{"label": f"Last {days} days", "value": f"{len(sessions)} workouts"},
                                {"label": "This week", "value": str(ws["this_week"])},
                                {"label": "Streak", "value": str(ws["streak"]), "highlight": True},
                                {"label": "All time", "value": str(ws["total_completed"])}]}}


@tool("generate_workout", "Generate a workout session for today using the deterministic programming engine, based on the user's goal, experience and equipment.",
      {"focus_muscles": {"type": "array", "items": {"type": "string"}, "description": "e.g. chest, back, quads, glutes, core"},
       "duration_minutes": {"type": "integer"}, "intensity": {"type": "string", "enum": ["easy", "normal"]}})
def generate_workout(db, user, focus_muscles=None, duration_minutes=None, intensity="normal"):
    p = user.profile
    plan = workout_service.generate_plan(p.goal, p.experience, 1, p.equipment, int(duration_minutes or p.workout_minutes),
                                         "custom" if focus_muscles else "auto", focus_muscles or [],
                                         "extra_rest" if intensity == "easy" else "standard")
    day = plan["days"][0]
    return {"workout": day, "split": plan["split_name"], "warmup": workout_service.warmup_note(p.experience),
            "_card": {"type": "workout", "title": day["name"], "duration_minutes": day["duration_minutes"],
                      "exercises": [{k: e[k] for k in ("name", "muscle", "sets", "reps", "rest_seconds")} for e in day["exercises"]]}}
