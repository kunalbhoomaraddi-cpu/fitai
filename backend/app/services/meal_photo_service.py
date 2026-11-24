"""Snap your meal: estimate what's on a plate from a photo.

The AI only *identifies* each food and *estimates its portion* (grams). Calories and macros come from
FitAI's own food database (Indian dishes + reference foods), the same "AI identifies, code calculates"
rule the coach follows. Only foods the database doesn't know fall back to the AI's per-100 g estimate,
and those are labelled as estimates. The photo is processed in memory and never stored.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import re
import threading
import time
from datetime import date

from fastapi import HTTPException
from PIL import Image

from app.ai.provider import ProviderError, get_provider
from app.config import get_settings
from app.data.foods import search_reference_foods
from app.services import photo_service
from app.services.nutrition_service import search_indian_foods
from app.utils.clock import local_today
from app.utils.redact import describe_error

log = logging.getLogger("fitai.meal_photo")
AI_PX = 1024  # enough detail to tell dal from sambar, small enough to be quick and cheap

SYSTEM = (
    "You are a nutrition assistant that identifies foods in a meal photo, with deep knowledge of Indian home "
    "cooking (North and South Indian, Karnataka dishes such as jolada rotti, ragi mudde, bisi bele bath). "
    "Identify each distinct food or drink you can see and estimate the portion in grams from visual cues "
    "(plate ~26 cm, katori ~150 ml, roti ~40 g, dosa ~120 g, a cup of rice ~150 g cooked). "
    "Do not guess foods you can't see. Never give medical advice."
)
PROMPT = (
    "Return JSON only, in this shape:\n"
    '{"is_food": true, "items": [{"name": "common dish name in English", '
    '"aliases": ["regional or alternative names"], "count": 2, "unit": "roti", "grams": 80, '
    '"kcal_per_100g": 297, "protein_per_100g": 9.6, "carbs_per_100g": 57, "fat_per_100g": 3.6, '
    '"confidence": 0.8}], "note": "one short sentence about the meal"}\n'
    "Rules: one entry per distinct food; grams = the total amount visible for that food; count/unit = household "
    "units when natural (roti, dosa, idli, katori, cup, piece, glass), else null; per-100g values are your best "
    "typical estimate for that food as cooked; confidence 0-1. Maximum 8 items. "
    'If the photo shows no food, return {"is_food": false, "items": [], "note": "why"}.'
)

_daily: dict[tuple[int, date], int] = {}
_daily_lock = threading.Lock()


def _check_daily_limit(user_id: int, is_demo: bool = False) -> None:
    """Free-tier AI quota is shared by everyone, so each user gets a daily allowance of photo analyses."""
    limit = get_settings().meal_photo_daily_limit
    if is_demo:
        limit = min(limit, 10)
    key = (user_id, local_today())
    with _daily_lock:
        for k in [k for k in _daily if k[1] != key[1]]:  # forget previous days
            del _daily[k]
        if _daily.get(key, 0) >= limit:
            raise HTTPException(429, f"You've analysed {limit} meal photos today. Search and add foods by hand, or try again tomorrow.")
        _daily[key] = _daily.get(key, 0) + 1


def _ai_jpeg(raw: bytes) -> str:
    cleaned = photo_service.process(raw)["image"]  # validates, straightens, strips GPS/camera data
    img = Image.open(io.BytesIO(cleaned))
    img.thumbnail((AI_PX, AI_PX), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return base64.b64encode(buf.getvalue()).decode()


def _parse(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise ProviderError("The AI's answer wasn't readable") from None
        data = json.loads(m.group(0))
    return data if isinstance(data, dict) else {"items": []}


def _num(v, lo: float = 0, hi: float = 5000) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if lo <= x <= hi else None


# Generic words a dish name can lose and still mean the same food ("dal curry" -> "dal").
_GENERIC = {"curry", "sabzi", "sabji", "gravy", "dish", "bowl", "plate", "side", "serving", "portion"}


def _candidates(name: str, aliases: list[str]) -> list[str]:
    out = [name, *aliases]
    for q in [name, *aliases]:
        words = [w for w in (q or "").split() if w.lower() not in _GENERIC]
        if words and len(words) < len((q or "").split()):
            out.append(" ".join(words))
    seen, uniq = set(), []
    for q in out:
        k = (q or "").strip().lower()
        if len(k) >= 2 and k not in seen:
            seen.add(k)
            uniq.append(q.strip())
    return uniq


def match_food(name: str, aliases: list[str]) -> dict | None:
    """Best database match for a dish name the AI gave (Indian library first, then reference foods).

    Matching is strict: a shared word like "curry" alone is never enough, so an unknown dish
    falls back to the AI's own estimate (clearly labelled) instead of a wrong database food."""
    for q in _candidates(name, aliases):
        hits = search_indian_foods(q, limit=1, word_guess=False) or search_reference_foods(q, limit=1)
        if hits:
            return hits[0]
    return None


def _round_macros(grams: float, per100: dict) -> dict:
    k = grams / 100
    return {"calories": round(per100["calories"] * k), "protein_g": round(per100["protein_g"] * k, 1),
            "carbs_g": round(per100["carbs_g"] * k, 1), "fat_g": round(per100["fat_g"] * k, 1)}


def build_items(raw_items: list) -> list[dict]:
    items = []
    for it in raw_items[:8]:
        if not isinstance(it, dict) or not str(it.get("name", "")).strip():
            continue
        name = str(it["name"]).strip()[:80]
        aliases = [str(a)[:60] for a in (it.get("aliases") or []) if isinstance(a, str)][:5]
        grams = _num(it.get("grams"), 1, 2000) or 100
        food = match_food(name, aliases)
        if food:
            per100 = {"calories": food["calories_100g"], "protein_g": food["protein_100g"],
                      "carbs_g": food["carbs_100g"], "fat_g": food["fat_100g"]}
            basis, source_id = "database", food["id"]
        else:
            kcal = _num(it.get("kcal_per_100g"), 0, 900)
            if kcal is None:
                continue  # nothing trustworthy to calculate with
            per100 = {"calories": kcal, "protein_g": _num(it.get("protein_per_100g"), 0, 100) or 0,
                      "carbs_g": _num(it.get("carbs_per_100g"), 0, 100) or 0, "fat_g": _num(it.get("fat_per_100g"), 0, 100) or 0}
            basis, source_id = "ai_estimate", None
        count = _num(it.get("count"), 0.25, 50)
        unit = str(it.get("unit") or "").strip()[:20] or None
        items.append({
            "name": food["name"] if food else name.title(), "seen_as": name, "grams": round(grams),
            "portion": f"{count:g} {unit}" if count and unit else None,
            "per_100g": per100, **_round_macros(grams, per100),
            "basis": basis, "source_id": source_id,
            "servings": (food or {}).get("servings") or [],
            "confidence": round(_num(it.get("confidence"), 0, 1) or 0.5, 2),
        })
    return items


def analyze(raw: bytes, user_id: int, preference: str | None = None, is_demo: bool = False) -> dict:
    provider = get_provider(preference)
    if provider.name != "gemini":
        raise HTTPException(503, "Meal photos need the AI (Gemini) to be switched on. You can still search and add foods by hand.")
    image_b64 = _ai_jpeg(raw)
    _check_daily_limit(user_id, is_demo)
    started = time.monotonic()
    try:
        data = _parse(provider.generate_json_with_image(SYSTEM, PROMPT, image_b64))
    except (ProviderError, ValueError) as e:
        log.warning("Meal photo analysis failed: %s", describe_error(e))
        raise HTTPException(502, "We couldn't analyse that photo right now. Please try again, or add foods by hand.") from None
    items = build_items(data.get("items") or []) if data.get("is_food", True) else []
    totals = {k: round(sum(i[k] for i in items), 1) for k in ("calories", "protein_g", "carbs_g", "fat_g")}
    totals["calories"] = round(totals["calories"])
    return {"items": items, "totals": totals, "is_food": bool(items),
            "note": str(data.get("note") or "")[:200] or None,
            "model": provider.label, "seconds": round(time.monotonic() - started, 1)}
