from app.services import fitness_service as fs
from app.tools.registry import tool

_P = lambda u: u.profile


@tool("get_user_profile", "Get the user's fitness profile (age, height, weight, goal, diet, equipment, schedule). Call this when you need personal context.")
def get_user_profile(db, user):
    p = _P(user)
    return {"name": user.full_name, "age": p.age, "gender": p.gender, "height_cm": p.height_cm,
            "current_weight_kg": p.current_weight_kg, "start_weight_kg": p.start_weight_kg,
            "target_weight_kg": p.target_weight_kg, "activity_level": p.activity_level, "experience": p.experience,
            "goal": p.goal, "diet_preference": p.custom_diet if p.diet_preference == "custom" else p.diet_preference,
            "food_restrictions": p.food_restrictions, "workout_days_per_week": p.workout_days_per_week,
            "workout_minutes": p.workout_minutes, "equipment": p.equipment, "unit_system": p.unit_system,
            "_card": {"type": "profile", "title": "Your profile"}}


@tool("calculate_bmr", "Calculate Basal Metabolic Rate with Mifflin-St Jeor. Omitted args default to the user's profile.",
      {"weight_kg": {"type": "number"}, "height_cm": {"type": "number"}, "age": {"type": "integer"},
       "gender": {"type": "string", "enum": ["male", "female", "other"]}})
def calculate_bmr(db, user, weight_kg=None, height_cm=None, age=None, gender=None):
    p = _P(user)
    r = fs.calculate_bmr(weight_kg or p.current_weight_kg, height_cm or p.height_cm, age or p.age, gender or p.gender)
    return {**r, "approximate": True, "_card": {"type": "metrics", "title": "Basal Metabolic Rate",
            "items": [{"label": "BMR", "value": f"{r['bmr']} kcal/day"}, {"label": "Formula", "value": r["formula"]}]}}


@tool("calculate_tdee", "Calculate Total Daily Energy Expenditure (BMR x activity multiplier). Omitted args default to the profile.",
      {"activity_level": {"type": "string", "enum": list(fs.ACTIVITY_MULTIPLIERS)}, "weight_kg": {"type": "number"}})
def calculate_tdee(db, user, activity_level=None, weight_kg=None):
    p = _P(user)
    bmr = fs.calculate_bmr(weight_kg or p.current_weight_kg, p.height_cm, p.age, p.gender)["bmr"]
    r = fs.calculate_tdee(bmr, activity_level or p.activity_level)
    return {"bmr": bmr, **r, "approximate": True, "_card": {"type": "metrics", "title": "Daily energy expenditure",
            "items": [{"label": "BMR", "value": f"{bmr} kcal"}, {"label": "Activity ×", "value": str(r['activity_multiplier'])},
                      {"label": "TDEE", "value": f"{r['tdee']} kcal/day", "highlight": True}]}}


@tool("calculate_calorie_target", "Calculate a safe daily calorie target for a goal (includes safety floors and max deficit). Omitted args default to the profile.",
      {"goal": {"type": "string", "enum": list(fs.GOALS)}, "activity_level": {"type": "string", "enum": list(fs.ACTIVITY_MULTIPLIERS)},
       "weight_kg": {"type": "number"}})
def calculate_calorie_target(db, user, goal=None, activity_level=None, weight_kg=None):
    p = _P(user)
    full = fs.full_calculation(weight_kg or p.current_weight_kg, p.height_cm, p.age, p.gender,
                               activity_level or p.activity_level, goal or p.goal)
    c = full["calories"]
    return {"bmr": full["bmr"]["bmr"], "tdee": full["tdee"]["tdee"], **c, "goal": goal or p.goal,
            "disclaimer": fs.DISCLAIMER, "_card": {"type": "metrics", "title": "Daily calorie target",
            "items": [{"label": "BMR", "value": f"{full['bmr']['bmr']} kcal"}, {"label": "TDEE", "value": f"{full['tdee']['tdee']} kcal"},
                      {"label": "Adjustment", "value": f"{c['adjustment']:+} kcal"},
                      {"label": "Target", "value": f"{c['calorie_target']} kcal/day", "highlight": True}],
            "note": "Approximate estimate — adjust based on 2–3 weeks of real trend data."}}


@tool("calculate_macros", "Calculate daily protein, carbohydrate and fat targets. Omitted args default to the profile's calorie target and goal.",
      {"calorie_target": {"type": "number"}, "goal": {"type": "string", "enum": list(fs.GOALS)}, "weight_kg": {"type": "number"}})
def calculate_macros(db, user, calorie_target=None, goal=None, weight_kg=None):
    p = _P(user)
    goal = goal or p.goal
    if not calorie_target:
        calorie_target = fs.full_calculation(weight_kg or p.current_weight_kg, p.height_cm, p.age, p.gender,
                                             p.activity_level, goal)["calories"]["calorie_target"]
    m = fs.calculate_macros(calorie_target, weight_kg or p.current_weight_kg, goal, p.height_cm)
    return {"calorie_target": round(calorie_target), **m, "approximate": True,
            "_card": {"type": "macros", "title": "Daily macro targets", "calories": round(calorie_target),
                      "protein_g": m["protein_g"], "carbs_g": m["carbs_g"], "fat_g": m["fat_g"]}}
