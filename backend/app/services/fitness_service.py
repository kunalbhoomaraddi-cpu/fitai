"""Deterministic fitness calculations. The LLM never computes these numbers itself —
it calls tools which call these functions.

All values are population-level estimates (approximate), not medical measurements.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

ACTIVITY_MULTIPLIERS: dict[str, float] = {
    "sedentary": 1.2,      # little or no exercise
    "light": 1.375,        # light exercise 1-3 days/week
    "moderate": 1.55,      # moderate exercise 3-5 days/week
    "active": 1.725,       # hard exercise 6-7 days/week
    "very_active": 1.9,    # physical job + hard training
}

GOALS = ("weight_loss", "muscle_gain", "recomposition", "general_fitness", "maintenance")

# Safety floors: never recommend intakes below these without medical supervision.
MIN_CALORIES = {"male": 1500, "female": 1200, None: 1200, "other": 1200}
MAX_DEFICIT_KCAL = 500       # ~0.5 kg/week upper bound for a general-population app
MAX_SURPLUS_KCAL = 300       # lean-gain surplus

DISCLAIMER = ("These are approximate estimates based on population formulas (Mifflin-St Jeor). "
              "Individual needs vary. Consult a qualified professional for medical or clinical nutrition advice.")


def _r(x: float, nd: int = 1) -> float:
    return round(float(x), nd)


def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    if weight_kg <= 0 or height_cm <= 0:
        raise ValueError("Weight and height must be positive")
    h = height_cm / 100
    bmi = weight_kg / (h * h)
    if bmi < 18.5:
        cat = "Underweight"
    elif bmi < 25:
        cat = "Healthy range"
    elif bmi < 30:
        cat = "Overweight"
    else:
        cat = "Obese range"
    return {"bmi": _r(bmi), "category": cat,
            "note": "BMI is a screening measure and does not distinguish muscle from fat."}


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str | None) -> dict:
    """Mifflin-St Jeor. If gender is not provided, uses the midpoint of the male/female constants."""
    if not (10 <= age <= 100):
        raise ValueError("Age must be between 10 and 100")
    if weight_kg <= 0 or height_cm <= 0:
        raise ValueError("Weight and height must be positive")
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    g = (gender or "").lower()
    if g == "male":
        const, method = 5, "Mifflin-St Jeor (male)"
    elif g == "female":
        const, method = -161, "Mifflin-St Jeor (female)"
    else:
        const, method = -78, "Mifflin-St Jeor (sex-neutral midpoint)"
    return {"bmr": round(base + const), "formula": method}


def calculate_tdee(bmr: float, activity_level: str) -> dict:
    if activity_level not in ACTIVITY_MULTIPLIERS:
        raise ValueError(f"activity_level must be one of {list(ACTIVITY_MULTIPLIERS)}")
    m = ACTIVITY_MULTIPLIERS[activity_level]
    return {"tdee": round(bmr * m), "activity_multiplier": m}


def calculate_calorie_target(tdee: float, bmr: float, goal: str, gender: str | None = None) -> dict:
    if goal not in GOALS:
        raise ValueError(f"goal must be one of {GOALS}")
    warnings: list[str] = []
    if goal == "weight_loss":
        adjustment = -min(MAX_DEFICIT_KCAL, round(tdee * 0.20))
        rationale = "Moderate deficit (≤20% of TDEE, max 500 kcal) for sustainable fat loss of roughly 0.25–0.5 kg/week."
    elif goal == "recomposition":
        adjustment = -min(300, round(tdee * 0.10))
        rationale = "Small deficit (~10%) paired with high protein and resistance training."
    elif goal == "muscle_gain":
        adjustment = min(MAX_SURPLUS_KCAL, round(tdee * 0.10))
        rationale = "Lean surplus (~10%, max 300 kcal) to support muscle gain while limiting fat gain."
    else:
        adjustment = 0
        rationale = "Maintenance calories to support performance and steady weight."
    target = tdee + adjustment
    floor = max(MIN_CALORIES.get((gender or None) and gender.lower(), 1200), round(bmr * 0.95))
    if target < floor:
        warnings.append(f"Target raised to the safety floor of {floor} kcal. Very low intakes should only be "
                        "followed under medical supervision.")
        target = floor
    return {"calorie_target": round(target), "adjustment": round(target - tdee), "rationale": rationale,
            "warnings": warnings}


PROTEIN_G_PER_KG = {"weight_loss": 1.8, "muscle_gain": 1.8, "recomposition": 2.0,
                    "general_fitness": 1.4, "maintenance": 1.4}


def calculate_macros(calorie_target: float, weight_kg: float, goal: str, height_cm: float | None = None) -> dict:
    """Protein by bodyweight (reference weight capped at BMI 25 for higher BMIs), fat ~27% of kcal
    (min 0.6 g/kg), carbohydrates fill the remainder."""
    ref_weight = weight_kg
    if height_cm:
        bmi25_weight = 25 * (height_cm / 100) ** 2
        if weight_kg > bmi25_weight * 1.2:
            ref_weight = bmi25_weight
    protein_g = round(PROTEIN_G_PER_KG.get(goal, 1.6) * ref_weight)
    fat_g = round(max(calorie_target * 0.27 / 9, 0.6 * ref_weight))
    carbs_kcal = calorie_target - protein_g * 4 - fat_g * 9
    carbs_g = max(round(carbs_kcal / 4), 50)
    total = protein_g * 4 + carbs_g * 4 + fat_g * 9
    return {
        "protein_g": protein_g, "carbs_g": carbs_g, "fat_g": fat_g,
        "protein_pct": round(protein_g * 4 / total * 100), "carbs_pct": round(carbs_g * 4 / total * 100),
        "fat_pct": round(fat_g * 9 / total * 100),
        "protein_g_per_kg": PROTEIN_G_PER_KG.get(goal, 1.6),
    }


@dataclass
class FullPlan:
    bmi: dict
    bmr: dict
    tdee: dict
    calories: dict
    macros: dict
    disclaimer: str = DISCLAIMER

    def to_dict(self) -> dict:
        return asdict(self)


def full_calculation(weight_kg: float, height_cm: float, age: int, gender: str | None,
                     activity_level: str, goal: str) -> dict:
    bmi = calculate_bmi(weight_kg, height_cm)
    bmr = calculate_bmr(weight_kg, height_cm, age, gender)
    tdee = calculate_tdee(bmr["bmr"], activity_level)
    cal = calculate_calorie_target(tdee["tdee"], bmr["bmr"], goal, gender)
    macros = calculate_macros(cal["calorie_target"], weight_kg, goal, height_cm)
    return FullPlan(bmi, bmr, tdee, cal, macros).to_dict()


def profile_targets(profile) -> dict:
    """Targets for a FitnessProfile ORM object."""
    return full_calculation(profile.current_weight_kg, profile.height_cm, profile.age, profile.gender,
                            profile.activity_level, profile.goal)
