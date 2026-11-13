"""Food search (Open Food Facts + offline reference DB), daily nutrition aggregation and the
deterministic reference meal-plan engine."""
from __future__ import annotations

import difflib
import logging
import random
import re
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.data.foods import REFERENCE_FOODS, food_allowed, nutrition_for, search_reference_foods
from app.data.indian_foods import INDIAN_FOODS, REPLACES_REFERENCE
from app.data.meals import MEAL_TEMPLATES
from app.models import FoodEntry
from app.utils.clock import local_today
from app.utils.http import SlidingWindowLimiter, TTLCache, http_get_json

log = logging.getLogger("fitai.nutrition")
settings = get_settings()

_off_cache = TTLCache(maxsize=300, ttl=6 * 3600)
# Open Food Facts allows ~10 search requests/minute per IP. Stay under it.
_off_limiter = SlidingWindowLimiter(limit=8, window=60)

MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"]


# --------------------------------------------------------------------------- food search
def _map_off_product(p: dict) -> dict | None:
    n = p.get("nutriments") or {}
    kcal = n.get("energy-kcal_100g")
    if kcal is None and n.get("energy_100g") is not None:
        kcal = float(n["energy_100g"]) / 4.184  # kJ -> kcal
    name = (p.get("product_name") or "").strip()
    if not name or kcal is None:
        return None
    return {
        "id": f"off:{p.get('code', '')}", "name": name, "brand": (p.get("brands") or "").split(",")[0] or None,
        "calories_100g": round(float(kcal)), "protein_100g": round(float(n.get("proteins_100g") or 0), 1),
        "carbs_100g": round(float(n.get("carbohydrates_100g") or 0), 1),
        "fat_100g": round(float(n.get("fat_100g") or 0), 1), "source": "open_food_facts",
        "image_url": p.get("image_front_small_url"),
    }


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


_INDIAN_INDEX = [(k, _norm(f["name"]), [_norm(a) for a in f["aliases"]]) for k, f in INDIAN_FOODS.items()]
_INDIAN_VOCAB = {term: k for k, name, aliases in _INDIAN_INDEX for term in [name, *aliases]}


def indian_result(f: dict) -> dict:
    return {"id": f"in:{f['key']}", "name": f["name"], "brand": None, "calories_100g": f["kcal"],
            "protein_100g": f["protein"], "carbs_100g": f["carbs"], "fat_100g": f["fat"], "source": "indian",
            "image_url": None, "servings": f["servings"], "diet": f["diet"], "category": f["category"]}


def search_indian_foods(query: str, limit: int = 10) -> list[dict]:
    """Ranked search over names + regional aliases, with typo tolerance (e.g. 'chapathi', 'biriyani')."""
    q = _norm(query)
    if len(q) < 2:
        return []
    tokens = q.split()
    scored: dict[str, int] = {}
    for key, name, aliases in _INDIAN_INDEX:
        best = 0
        for i, term in enumerate([name, *aliases]):
            words = term.split()
            bonus = 5 if i == 0 else 0
            # short words (dal, tea, egg) must match whole words, so "dal" doesn't match "dalimbe"
            pre = lambda w, t: w == t if len(t) < 4 else w.startswith(t)  # noqa: E731
            if term == q:
                s = 100
            elif term.startswith(q + " ") or (len(q) >= 4 and term.startswith(q)):
                s = 80
            elif all(any(pre(w, t) for w in words) for t in tokens):
                s = 60
            elif len(q) >= 5 and q in term:
                s = 30
            else:
                continue
            best = max(best, s + bonus)
        if best:
            scored[key] = best
    if not scored:  # typo tolerance
        for term in difflib.get_close_matches(q, list(_INDIAN_VOCAB), n=limit, cutoff=0.78):
            scored.setdefault(_INDIAN_VOCAB[term], 20)
        if not scored and len(tokens) > 1:
            for t in tokens:
                for term in difflib.get_close_matches(t, list(_INDIAN_VOCAB), n=3, cutoff=0.82):
                    scored.setdefault(_INDIAN_VOCAB[term], 10)
    ranked = sorted(scored, key=lambda k: (-scored[k], len(INDIAN_FOODS[k]["name"])))
    return [indian_result(INDIAN_FOODS[k]) for k in ranked[:limit]]


def search_food(query: str, limit: int = 12) -> dict:
    """Returns {results, source, warning}. Never raises for upstream failures."""
    query = query.strip()[:80]
    if not query:
        return {"results": [], "source": "none", "warning": None}
    indian = search_indian_foods(query, limit=10)
    reference = (indian + [r for r in search_reference_foods(query, limit=6)
                           if r["id"].removeprefix("ref:") not in REPLACES_REFERENCE])[:12]
    if not settings.enable_external_apis:
        return {"results": reference, "source": "reference", "warning": "External food database disabled; showing FitAI reference foods."}
    cached = _off_cache.get(query.lower())
    if cached is not None:
        return {"results": (reference + cached)[:max(limit, len(reference) + 4)], "source": "open_food_facts", "warning": None}
    if not _off_limiter.allow():
        return {"results": reference, "source": "reference",
                "warning": "Open Food Facts search limit reached (≈10/min). Showing reference foods — try again in a minute."}
    try:
        data = http_get_json(
            f"{settings.off_base_url}/cgi/search.pl",
            params={"search_terms": query, "search_simple": 1, "action": "process", "json": 1, "page_size": 15,
                    "fields": "code,product_name,brands,nutriments,image_front_small_url"},
            headers={"User-Agent": settings.off_user_agent},
        )
        mapped = [m for m in (_map_off_product(p) for p in data.get("products", [])) if m][:10]
        _off_cache.set(query.lower(), mapped)
        return {"results": (reference + mapped)[:max(limit, len(reference) + 4)], "source": "open_food_facts", "warning": None}
    except Exception as exc:  # network, timeout, 5xx, JSON
        log.warning("Open Food Facts unavailable: %s", type(exc).__name__)
        return {"results": reference, "source": "reference",
                "warning": "Open Food Facts is unreachable right now. Showing FitAI reference foods instead."}


# --------------------------------------------------------------------------- tracking
def day_entries(db: Session, user_id: int, d: date) -> list[FoodEntry]:
    return list(db.scalars(select(FoodEntry).where(FoodEntry.user_id == user_id, FoodEntry.eaten_on == d)
                           .order_by(FoodEntry.id)))


def summarize(entries) -> dict:
    t = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    by_meal = {m: {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "count": 0} for m in MEAL_ORDER}
    for e in entries:
        for k in t:
            t[k] += getattr(e, k)
            by_meal[e.meal][k] += getattr(e, k)
        by_meal[e.meal]["count"] += 1
    rnd = lambda d: {k: round(v) if k == "calories" else (round(v, 1) if isinstance(v, float) else v) for k, v in d.items()}
    return {"totals": rnd(t), "by_meal": {m: rnd(v) for m, v in by_meal.items()}, "entry_count": len(entries)}


def daily_summary(db: Session, user_id: int, d: date) -> dict:
    return {"date": d.isoformat(), **summarize(day_entries(db, user_id, d))}


def history(db: Session, user_id: int, days: int = 14, end: date | None = None) -> list[dict]:
    end = end or local_today()
    start = end - timedelta(days=days - 1)
    rows = db.scalars(select(FoodEntry).where(FoodEntry.user_id == user_id, FoodEntry.eaten_on >= start,
                                              FoodEntry.eaten_on <= end))
    agg: dict = defaultdict(lambda: {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "entries": 0})
    for e in rows:
        a = agg[e.eaten_on]
        a["calories"] += e.calories
        a["protein_g"] += e.protein_g
        a["carbs_g"] += e.carbs_g
        a["fat_g"] += e.fat_g
        a["entries"] += 1
    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        a = agg.get(d, {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "entries": 0})
        out.append({"date": d.isoformat(), "calories": round(a["calories"]), "protein_g": round(a["protein_g"], 1),
                    "carbs_g": round(a["carbs_g"], 1), "fat_g": round(a["fat_g"], 1), "entries": a["entries"]})
    return out


# --------------------------------------------------------------------------- reference meal-plan engine
FOOD_ROLE = {
    "protein": ["chicken_breast", "fish", "salmon", "turkey", "egg", "egg_white", "paneer", "tofu", "tempeh",
                "greek_yogurt", "cottage_cheese", "whey", "dal", "rajma", "chickpeas"],
    "carb": ["rice", "brown_rice", "quinoa", "roti", "wholegrain_bread", "oats", "poha", "idli", "potato",
             "sweet_potato", "whole_wheat_pasta"],
    "fat": ["olive_oil", "ghee", "almonds", "pumpkin_seeds", "peanut_butter"],
    "veg": ["mixed_veg", "spinach", "broccoli", "salad", "sprouts"],
    "fruit": ["banana", "apple", "berries", "orange", "dates"],
}
ROLE_OF = {k: role for role, keys in FOOD_ROLE.items() for k in keys}

SLOTS = {
    3: [("Breakfast", "breakfast", 0.30), ("Lunch", "lunch", 0.40), ("Dinner", "dinner", 0.30)],
    4: [("Breakfast", "breakfast", 0.25), ("Lunch", "lunch", 0.35), ("Evening Snack", "snack", 0.12),
        ("Dinner", "dinner", 0.28)],
    5: [("Breakfast", "breakfast", 0.22), ("Mid-morning Snack", "snack", 0.09), ("Lunch", "lunch", 0.30),
        ("Evening Snack", "snack", 0.11), ("Dinner", "dinner", 0.28)],
}

NUTRITION_SOURCE_LABEL = {
    "reference_calculated": "Calculated from FitAI reference nutrition values (typical averages, not lab-verified)",
    "ai_estimate": "AI-estimated nutrition values — approximate, not lab-verified",
}


def _template_allowed(t: dict, diet: str, restrictions: list[str]) -> bool:
    return all(food_allowed(k, diet, restrictions) for k, _ in t["ingredients"])


def _round_grams(key: str, g: float) -> float:
    if ROLE_OF.get(key) == "fat" or key in ("whey",):
        return max(3, round(g))
    return max(10, round(g / 5) * 5)


def _build_meal(t: dict, kcal_target: float, label: str, slot: int) -> dict:
    base_kcal = sum(nutrition_for(k, g)["calories"] for k, g in t["ingredients"])
    factor = min(2.2, max(0.5, kcal_target / max(base_kcal, 1)))
    items = [{**nutrition_for(k, _round_grams(k, g * factor)), "food_key": k} for k, g in t["ingredients"]]
    return _finalize_meal({
        "slot": slot, "label": label, "meal_type": t["meal"], "template_id": t["id"], "name": t["name"],
        "image": t["image"], "items": items, "instructions": t["instructions"],
        "nutrition_source": "reference_calculated", "completed": False,
    })


def _finalize_meal(m: dict) -> dict:
    tot = {"calories": 0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    for it in m["items"]:
        for k in tot:
            tot[k] += it[k]
    m["totals"] = {"calories": round(tot["calories"]), "protein_g": round(tot["protein_g"], 1),
                   "carbs_g": round(tot["carbs_g"], 1), "fat_g": round(tot["fat_g"], 1)}
    m["nutrition_note"] = NUTRITION_SOURCE_LABEL.get(m.get("nutrition_source"), "")
    return m


def plan_totals(meals: list[dict]) -> dict:
    t = {"calories": 0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    for m in meals:
        for k in t:
            t[k] += m["totals"][k]
    return {"calories": round(t["calories"]), "protein_g": round(t["protein_g"], 1),
            "carbs_g": round(t["carbs_g"], 1), "fat_g": round(t["fat_g"], 1)}


def _pick_template(meal_type: str, diet: str, restrictions: list[str], budget: str, protein_ratio: float,
                   exclude: set[str], rng: random.Random, preferences: str = "") -> dict | None:
    pool = [t for t in MEAL_TEMPLATES if t["meal"] == meal_type and _template_allowed(t, diet, restrictions)
            and t["id"] not in exclude]
    if not pool:
        pool = [t for t in MEAL_TEMPLATES if t["meal"] == meal_type and _template_allowed(t, diet, restrictions)]
    if not pool:
        return None
    budget_rank = {"low": 0, "medium": 1, "high": 2}
    prefs = preferences.lower()

    def score(t):
        kc = sum(nutrition_for(k, g)["calories"] for k, g in t["ingredients"])
        pr = sum(nutrition_for(k, g)["protein_g"] for k, g in t["ingredients"]) * 4 / max(kc, 1)
        s = abs(pr - protein_ratio) * 3
        s += max(0, budget_rank[t["budget"]] - budget_rank[budget]) * 0.25
        if prefs and any(w in t["name"].lower() for w in prefs.replace(",", " ").split() if len(w) > 3):
            s -= 0.4
        return s + rng.random() * 0.35

    return sorted(pool, key=score)[0]


def generate_reference_plan(targets: dict, diet: str, restrictions: list[str], meals_per_day: int = 4,
                            budget: str = "medium", preferences: str = "", seed: int | None = None) -> list[dict]:
    rng = random.Random(seed)
    cal = targets["calorie_target"]
    protein_ratio = targets["protein_g"] * 4 / max(cal, 1)
    meals, used = [], set()
    for i, (label, meal_type, frac) in enumerate(SLOTS.get(meals_per_day, SLOTS[4])):
        t = _pick_template(meal_type, diet, restrictions, budget, protein_ratio, used, rng, preferences)
        if t is None:
            continue
        used.add(t["id"])
        meals.append(_build_meal(t, cal * frac, label, i))
    return balance_macros(meals, targets)


def _kcal_per_g(key: str) -> float:
    return REFERENCE_FOODS[key][1] / 100


def _rescale_item(it: dict, grams: float) -> None:
    it.update(nutrition_for(it["food_key"], _round_grams(it["food_key"], grams)))


def balance_macros(meals: list[dict], targets: dict, rounds: int = 3) -> list[dict]:
    """Deterministic portion tuning: nudge protein foods up toward the protein target and trim
    added fats when over, trading the calories against carbohydrate portions so total energy
    stays near target. Only portion sizes change — nutrition is always recomputed from reference values."""
    for _ in range(rounds):
        tot = plan_totals(meals)
        need_p = targets["protein_g"] - tot["protein_g"]
        over_f = tot["fat_g"] - targets["fat_g"] * 1.05
        if need_p <= targets["protein_g"] * 0.04 and over_f <= 0:
            break
        for m in meals:
            items = [it for it in m["items"] if it.get("food_key")]
            prot = [it for it in items if ROLE_OF.get(it["food_key"]) == "protein"]
            carbs = [it for it in items if ROLE_OF.get(it["food_key"]) == "carb"]
            fats = [it for it in items if ROLE_OF.get(it["food_key"]) == "fat"]
            delta_kcal = 0.0
            if need_p > 0 and prot:
                share = need_p * (m["totals"]["calories"] / max(tot["calories"], 1))
                for it in prot:
                    p_per_g = REFERENCE_FOODS[it["food_key"]][2] / 100
                    if p_per_g <= 0:
                        continue
                    add_g = min(share / len(prot) / p_per_g, it["grams"] * 0.5)
                    before = it["calories"]
                    _rescale_item(it, it["grams"] + add_g)
                    delta_kcal += it["calories"] - before
            if over_f > 0 and fats:
                for it in fats:
                    before = it["calories"]
                    _rescale_item(it, max(3, it["grams"] * 0.6))
                    delta_kcal += it["calories"] - before
            if carbs and delta_kcal:
                per = delta_kcal / len(carbs)
                for it in carbs:
                    new_g = it["grams"] - per / max(_kcal_per_g(it["food_key"]), 0.1)
                    _rescale_item(it, max(it["grams"] * 0.45, new_g))
            _finalize_meal(m)
    return meals


def regenerate_meal(meals: list[dict], slot: int, targets: dict, diet: str, restrictions: list[str],
                    budget: str = "medium") -> list[dict]:
    idx = next((i for i, m in enumerate(meals) if m["slot"] == slot), None)
    if idx is None:
        raise ValueError("Meal slot not found")
    old = meals[idx]
    kcal = old["totals"]["calories"] or targets["calorie_target"] * 0.25
    exclude = {m.get("template_id") for m in meals if m.get("template_id")}
    protein_ratio = targets["protein_g"] * 4 / max(targets["calorie_target"], 1)
    t = _pick_template(old["meal_type"], diet, restrictions, budget, protein_ratio, exclude, random.Random())
    if t is None:
        raise ValueError("No alternative meal fits your dietary settings")
    meals[idx] = _build_meal(t, kcal, old["label"], slot)
    return meals


def replace_item(meals: list[dict], slot: int, item_index: int, diet: str, restrictions: list[str]) -> list[dict]:
    meal = next((m for m in meals if m["slot"] == slot), None)
    if meal is None or item_index >= len(meal["items"]):
        raise ValueError("Item not found")
    item = meal["items"][item_index]
    key = item.get("food_key")
    role = ROLE_OF.get(key)
    if not key or not role:
        raise ValueError("This item can't be swapped automatically. Try regenerating the meal instead.")
    present = {it.get("food_key") for it in meal["items"]}
    options = [k for k in FOOD_ROLE[role] if k not in present and food_allowed(k, diet, restrictions)]
    if not options:
        raise ValueError("No suitable replacement found for your dietary settings")
    new_key = random.choice(options)
    kcal_per_g = REFERENCE_FOODS[new_key][1] / 100
    grams = _round_grams(new_key, item["calories"] / kcal_per_g if kcal_per_g else item["grams"])
    meal["items"][item_index] = {**nutrition_for(new_key, grams), "food_key": new_key}
    meal["nutrition_source"] = "reference_calculated"
    _finalize_meal(meal)
    return meals


def finalize_ai_meals(raw_meals: list[dict], meals_per_day: int) -> list[dict]:
    """Normalize & label LLM-produced meals. Totals are recomputed in Python from item values."""
    slots = SLOTS.get(meals_per_day, SLOTS[4])
    out = []
    for i, m in enumerate(raw_meals[: len(slots)]):
        label, meal_type, _ = slots[i]
        items = []
        for it in (m.get("items") or [])[:8]:
            items.append({"name": str(it.get("name", "Item"))[:80], "grams": round(float(it.get("grams", 0) or 0)),
                          "calories": round(float(it.get("calories", 0) or 0)),
                          "protein_g": round(float(it.get("protein_g", 0) or 0), 1),
                          "carbs_g": round(float(it.get("carbs_g", 0) or 0), 1),
                          "fat_g": round(float(it.get("fat_g", 0) or 0), 1), "food_key": None})
        if not items:
            raise ValueError("AI meal missing items")
        out.append(_finalize_meal({
            "slot": i, "label": label, "meal_type": meal_type, "template_id": None,
            "name": str(m.get("name", label))[:100], "image": f"{meal_type}-generic",
            "items": items, "instructions": str(m.get("instructions", ""))[:800],
            "nutrition_source": "ai_estimate", "completed": False,
        }))
    if len(out) < len(slots):
        raise ValueError("AI returned too few meals")
    return out
