"""Log a meal by describing it: "two rotis, a katori of dal and a glass of milk".

Spoken (the browser turns speech into text, in English, Hindi or Kannada) or typed. Same rule as meal
photos: the AI only splits the sentence into foods and portions; calories and macros come from FitAI's
own food database. When no AI is available, a built-in parser handles plain English.
The result is a list to review; nothing is logged until the person confirms it.
"""
from __future__ import annotations

import logging
import re

from app.ai.provider import ProviderError, get_provider, quick
from app.services.meal_photo_service import _num, _parse, _round_macros, build_items, match_food
from app.utils.redact import describe_error

log = logging.getLogger("fitai.meal_text")

SYSTEM = (
    "You turn a person's description of what they ate into a list of foods with portions. The text may be "
    "English, Hindi, Kannada or a mix (it often comes from speech recognition, so expect small mistakes). "
    "You know Indian home cooking well (roti ~40 g, dosa ~120 g, idli ~40 g, a katori ~150 g, a cup of cooked rice ~150 g, "
    "a glass ~250 ml). List only foods the person mentions. Never give medical advice."
)
PROMPT = (
    "Text: {text}\n\nReturn JSON only, in this shape:\n"
    '{{"items": [{{"name": "common dish name in English", "aliases": ["regional names, e.g. chapati, phulka"], '
    '"count": 2, "unit": "roti", "grams": 80, "kcal_per_100g": 297, "protein_per_100g": 9.6, '
    '"carbs_per_100g": 57, "fat_per_100g": 3.6, "confidence": 0.9}}]}}\n'
    "Rules: one entry per food; grams = total amount eaten of that food (use the stated quantity, else a normal "
    "single portion); count/unit = the household units said, else null; per-100g values are typical for that food as "
    "eaten; confidence 0-1. Maximum 8 items. If the text mentions no food, return {{\"items\": []}}."
)

NUMBER_WORDS = {"a": 1, "an": 1, "one": 1, "single": 1, "two": 2, "couple": 2, "three": 3, "four": 4, "five": 5,
                "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "half": 0.5, "quarter": 0.25, "some": 1}
UNITS = {"glass": "glass", "glasses": "glass", "cup": "cup", "cups": "cup", "bowl": "bowl", "bowls": "bowl",
         "katori": "katori", "katoris": "katori", "plate": "plate", "plates": "plate", "piece": "piece", "pieces": "piece",
         "slice": "slice", "slices": "slice", "spoon": "spoon", "spoons": "spoon", "tbsp": "spoon", "tablespoon": "spoon",
         "tablespoons": "spoon", "scoop": "scoop", "scoops": "scoop", "handful": "handful", "packet": "packet", "packets": "packet"}
WEIGHT_UNITS = {"g": 1, "gm": 1, "gms": 1, "gram": 1, "grams": 1, "kg": 1000, "ml": 1, "l": 1000, "litre": 1000, "liter": 1000}
UNIT_GRAMS = {"spoon": 15, "scoop": 30, "handful": 30, "slice": 30, "piece": 50}  # when a food lists no such serving
# typical weight of one piece, for counted foods the database lists per 100 g only ("5 almonds")
PIECE_GRAMS = {"almond": 1.2, "cashew": 1.5, "walnut": 4, "peanut": 0.6, "pistachio": 0.7, "raisin": 0.5, "date": 8,
               "egg": 50, "banana": 100, "apple": 180, "orange": 130, "guava": 120, "mango": 200, "grape": 5, "strawberry": 12,
               "bread": 30, "biscuit": 8, "cookie": 15, "rusk": 10}
FILLER = {"of", "i", "had", "ate", "eaten", "have", "drank", "for", "my", "lunch", "dinner", "breakfast", "snack", "today",
          "with", "some", "the", "just", "also", "then", "about", "around"}


def _split(text: str) -> list[str]:
    parts = re.split(r",|;|\+|&|\band\b|\bwith\b|\bplus\b|\balong with\b|\n", text.lower())
    return [p.strip(" .!") for p in parts if p.strip(" .!")]


def _serving(food: dict, unit: str | None, counted: bool) -> tuple[float, str, bool]:
    """Grams in one portion, its label, and whether it's a sure thing (False = "check the amount")."""
    servings = food.get("servings") or []
    if unit:
        label_words = {"bowl": ("bowl", "katori"), "katori": ("katori", "bowl")}.get(unit, (unit,))
        for s in servings:
            if any(w in s["label"].lower() for w in label_words):
                return float(s["grams"]), s["label"].removeprefix("1 "), True
        if unit in UNIT_GRAMS:
            return UNIT_GRAMS[unit], unit, False
    one = [s for s in servings if s["label"].lower().startswith("1 ")]
    pick = next((s for s in one if "medium" in s["label"].lower()), one[0] if one else None)
    if pick:
        return float(pick["grams"]), pick["label"].removeprefix("1 "), True
    if counted:
        name = food["name"].lower()
        piece = next((g for k, g in PIECE_GRAMS.items() if re.search(rf"\b{k}", name)), None)
        if piece:
            return piece, "piece", True
    return 100.0, "100 g", False


def exact_food(q: str) -> dict | None:
    """A food whose name or alias is exactly what was said (singular or plural)."""
    from app.data.foods import search_reference_foods
    from app.services.nutrition_service import _INDIAN_VOCAB, INDIAN_FOODS, _norm, indian_result
    forms = {_norm(q)}
    n = _norm(q)
    if n.endswith("ies"):
        forms.add(n[:-3] + "y")
    elif n.endswith("es"):
        forms.update({n[:-2], n[:-1]})
    elif n.endswith("s"):
        forms.add(n[:-1])
    for f in forms:
        if f in _INDIAN_VOCAB:
            return indian_result(INDIAN_FOODS[_INDIAN_VOCAB[f]])
    for f in forms:
        for r in search_reference_foods(f, limit=3):
            base = _norm(r["name"].split(",")[0])
            if base in forms or base.rstrip("s") in forms:
                return r
    # In English the last word names the food: "whole-grain bread" is bread, "bread pakora" is a pakora.
    from app.services.nutrition_service import search_indian_foods
    for f in forms:
        for r in search_indian_foods(f, limit=10, word_guess=False, typos=False) + search_reference_foods(f, limit=5):
            head = _norm(re.split(r"[(,/]", r["name"])[0]).split()
            if head and (head[-1] in forms or head[-1].rstrip("s") in forms):
                return r
    return None


def rule_parse(text: str) -> list[dict]:
    """Plain-English fallback: '2 rotis, a bowl of dal and 200 g curd'."""
    items, missed = [], []
    for part in _split(text)[:8]:
        words = part.split()
        qty, unit, grams = None, None, None
        i = 0
        while i < len(words):
            w = words[i]
            m = re.fullmatch(r"(\d+(?:\.\d+)?)(g|gm|gms|ml|kg|l)?", w)
            if m and qty is None and grams is None:
                val = float(m.group(1))
                suffix = m.group(2) or (words[i + 1] if i + 1 < len(words) and words[i + 1] in WEIGHT_UNITS else None)
                if suffix in WEIGHT_UNITS:
                    grams = val * WEIGHT_UNITS[suffix]
                    if not m.group(2):
                        words.pop(i + 1)
                else:
                    qty = val
                words.pop(i)
                continue
            if w in NUMBER_WORDS and qty is None:
                qty = NUMBER_WORDS[w]
                words.pop(i)
                continue
            if w in UNITS and unit is None:
                unit = UNITS[w]
                words.pop(i)
                continue
            i += 1
        name = " ".join(w for w in words if w not in FILLER).strip()
        if len(name) < 2:
            continue
        food = exact_food(name) or match_food(name, [])
        if not food:
            missed.append(name)
            continue
        count = qty or 1
        per_portion, serving, sure = _serving(food, unit, counted=qty is not None)
        total = grams or per_portion * count
        per100 = {"calories": food["calories_100g"], "protein_g": food["protein_100g"],
                  "carbs_g": food["carbs_100g"], "fat_g": food["fat_100g"]}
        items.append({"name": food["name"], "seen_as": name, "grams": round(total, 1) if total < 10 else round(total),
                      "portion": None if grams else f"{count:g} × {serving}", "check_amount": not (grams or sure),
                      "per_100g": per100, **_round_macros(total, per100), "basis": "database", "source_id": food["id"],
                      "servings": food.get("servings") or [], "confidence": 0.7 if (grams or sure) else 0.4})
    return items, missed


def parse(text: str, preference: str | None = None) -> dict:
    text = re.sub(r"\s+", " ", text).strip()[:500]
    provider = quick(get_provider(preference), 16)
    items, source, notice, missed = None, "rules", None, []
    if provider.is_real_llm:
        try:
            data = _parse(provider.generate_json(SYSTEM, PROMPT.format(text=text)))
            items = build_items(data.get("items") or [])
            source = provider.label
        except (ProviderError, ValueError, TypeError) as e:
            log.warning("Meal text parsing by AI failed: %s", describe_error(e))
    if items is None:
        items, missed = rule_parse(text)
        if not items and re.search(r"[^\x00-\x7f]", text):
            notice = "Hindi and Kannada need the AI, which isn't available right now. Try English, or search foods by hand."
        elif not provider.is_real_llm:
            notice = "Understood with FitAI's built-in reader (no AI connected). Check the amounts before adding."
    totals = {k: round(sum(i[k] for i in items), 1) for k in ("calories", "protein_g", "carbs_g", "fat_g")}
    totals["calories"] = round(totals["calories"])
    return {"text": text, "items": items, "totals": totals, "source": source, "notice": notice, "not_found": missed}


__all__ = ["parse", "rule_parse", "_num"]
