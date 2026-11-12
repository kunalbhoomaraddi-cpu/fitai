from app.services import progress_service
from app.tools.registry import tool


@tool("get_weight_history", "Get stored weight records with Python-computed changes, weekly averages, trend and plateau detection.",
      {"days": {"type": "integer", "description": "look-back window in days, default 30"}})
def get_weight_history(db, user, days=30):
    a = progress_service.weight_analysis(db, user, int(days))
    recs = a["records"]
    change = round(recs[-1]["weight_kg"] - recs[0]["weight_kg"], 2) if len(recs) >= 2 else None
    return {**{k: v for k, v in a.items() if k != "records"}, "records": recs[-30:],
            "change_in_window_kg": change, "window_days": days,
            "_card": {"type": "weight_trend", "title": f"Weight · last {days} days", "records": recs[-30:],
                      "change_kg": change, "target_kg": a["target_weight_kg"], "trend": a["trend_kg_per_week"]}}


@tool("analyze_progress", "Get a full deterministic progress analysis: weight trend, plateau check, workout and nutrition consistency, goal progress and safety flags.")
def analyze_progress(db, user):
    a = progress_service.full_analysis(db, user)
    return {"insights": a["insights"], "goal_progress_pct": a["weight"]["goal_progress_pct"],
            "trend_kg_per_week": a["weight"]["trend_kg_per_week"], "plateau": a["weight"]["plateau"],
            "workouts_this_week": a["workouts"]["this_week"], "streak": a["workouts"]["streak"],
            "nutrition": a["nutrition"],
            "_card": {"type": "insights", "title": "Progress analysis", "insights": a["insights"][:5]}}
