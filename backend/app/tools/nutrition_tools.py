from datetime import date

from app.models import SavedRecommendation
from app.services import fitness_service, nutrition_service
from app.tools.registry import tool


@tool("get_daily_nutrition", "Get the user's logged food totals for a date (default today) compared with their targets.",
      {"date": {"type": "string", "description": "YYYY-MM-DD; default today"}})
def get_daily_nutrition(db, user, date_str=None, **kw):
    d = kw.get("date") or date_str
    day = date.fromisoformat(d) if d else date.today()
    s = nutrition_service.daily_summary(db, user.id, day)
    t = fitness_service.profile_targets(user.profile)
    targets = {"calories": t["calories"]["calorie_target"], "protein_g": t["macros"]["protein_g"],
               "carbs_g": t["macros"]["carbs_g"], "fat_g": t["macros"]["fat_g"]}
    remaining = {k: round(targets[k] - s["totals"][k], 1) for k in targets}
    return {**s, "targets": targets, "remaining": remaining,
            "_card": {"type": "nutrition_day", "title": f"Nutrition · {day.strftime('%b %d')}",
                      "totals": s["totals"], "targets": targets}}


@tool("search_food", "Search foods and their nutrition per 100 g (Open Food Facts with an offline reference fallback).",
      {"query": {"type": "string"}}, ["query"])
def search_food(db, user, query):
    r = nutrition_service.search_food(query, limit=6)
    return {**r, "_card": {"type": "foods", "title": f"Foods matching “{query}”", "results": r["results"][:5],
                           "warning": r.get("warning")}}


@tool("save_fitness_recommendation", "Save a recommendation to the user's dashboard so they can revisit it. Use only when the user agrees or asks to save.",
      {"title": {"type": "string"}, "content": {"type": "string"},
       "category": {"type": "string", "enum": ["nutrition", "workout", "recovery", "general"]}}, ["title", "content"])
def save_fitness_recommendation(db, user, title, content, category="general"):
    rec = SavedRecommendation(user_id=user.id, title=title[:160], content=content[:4000], category=category, source="coach")
    db.add(rec)
    db.commit()
    return {"saved": True, "id": rec.id, "_card": {"type": "saved", "title": "Saved to your dashboard", "text": title}}
