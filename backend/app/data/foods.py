"""Reference nutrition values per 100 g (approximate, compiled from USDA FoodData Central-style
generic entries and common Indian food composition references). Used as an offline fallback
when Open Food Facts is unavailable and to compute template meal plans.

These are typical average values for the generic food, NOT laboratory-verified for any specific product.
diet: minimum diet that may eat it -> vegan < vegetarian < eggetarian < non_vegetarian
allergens: dairy, gluten, nuts, soy, eggs, seafood, peanuts
"""

# key: (name, kcal, protein, carbs, fat, diet, allergens)
REFERENCE_FOODS: dict[str, tuple] = {
    "oats": ("Rolled oats (dry)", 389, 16.9, 66.3, 6.9, "vegan", ["gluten"]),
    "milk": ("Milk, toned (1.5–3% fat)", 58, 3.3, 4.8, 3.0, "vegetarian", ["dairy"]),
    "soy_milk": ("Soy milk, unsweetened", 33, 3.3, 0.3, 1.8, "vegan", ["soy"]),
    "banana": ("Banana", 89, 1.1, 22.8, 0.3, "vegan", []),
    "apple": ("Apple", 52, 0.3, 13.8, 0.2, "vegan", []),
    "berries": ("Mixed berries", 50, 0.8, 12.0, 0.3, "vegan", []),
    "greek_yogurt": ("Greek yogurt, plain low-fat", 73, 10.0, 3.9, 1.9, "vegetarian", ["dairy"]),
    "curd": ("Curd / plain yogurt", 61, 3.5, 4.7, 3.3, "vegetarian", ["dairy"]),
    "paneer": ("Paneer", 265, 18.3, 1.2, 20.8, "vegetarian", ["dairy"]),
    "tofu": ("Tofu, firm", 144, 17.3, 2.8, 8.7, "vegan", ["soy"]),
    "egg": ("Whole egg", 143, 12.6, 0.7, 9.5, "eggetarian", ["eggs"]),
    "egg_white": ("Egg white", 52, 10.9, 0.7, 0.2, "eggetarian", ["eggs"]),
    "chicken_breast": ("Chicken breast, cooked", 165, 31.0, 0.0, 3.6, "non_vegetarian", []),
    "fish": ("White fish, cooked", 128, 26.0, 0.0, 2.7, "non_vegetarian", ["seafood"]),
    "salmon": ("Salmon, cooked", 206, 22.1, 0.0, 12.4, "non_vegetarian", ["seafood"]),
    "rice": ("White rice, cooked", 130, 2.7, 28.2, 0.3, "vegan", []),
    "brown_rice": ("Brown rice, cooked", 123, 2.7, 25.6, 1.0, "vegan", []),
    "quinoa": ("Quinoa, cooked", 120, 4.4, 21.3, 1.9, "vegan", []),
    "roti": ("Whole-wheat roti / chapati", 297, 9.6, 55.0, 4.0, "vegan", ["gluten"]),
    "wholegrain_bread": ("Whole-grain bread", 252, 12.4, 42.7, 3.5, "vegan", ["gluten"]),
    "poha": ("Poha (flattened rice), cooked", 130, 2.5, 26.0, 2.0, "vegan", []),
    "idli": ("Idli", 132, 4.5, 27.0, 0.4, "vegan", []),
    "sambar": ("Sambar", 60, 3.0, 8.5, 1.8, "vegan", []),
    "dal": ("Cooked lentils / dal", 116, 9.0, 20.1, 0.4, "vegan", []),
    "rajma": ("Kidney beans, cooked", 127, 8.7, 22.8, 0.5, "vegan", []),
    "chickpeas": ("Chickpeas, cooked", 164, 8.9, 27.4, 2.6, "vegan", []),
    "sprouts": ("Moong sprouts", 30, 3.0, 5.9, 0.2, "vegan", []),
    "peanut_butter": ("Peanut butter", 588, 25.0, 20.0, 50.0, "vegan", ["peanuts"]),
    "almonds": ("Almonds", 579, 21.2, 21.6, 49.9, "vegan", ["nuts"]),
    "pumpkin_seeds": ("Pumpkin seeds", 559, 30.2, 10.7, 49.1, "vegan", []),
    "olive_oil": ("Olive oil", 884, 0.0, 0.0, 100.0, "vegan", []),
    "ghee": ("Ghee", 900, 0.0, 0.0, 100.0, "vegetarian", ["dairy"]),
    "mixed_veg": ("Mixed vegetables, cooked", 65, 2.6, 13.1, 0.3, "vegan", []),
    "spinach": ("Spinach, cooked", 23, 2.9, 3.6, 0.4, "vegan", []),
    "broccoli": ("Broccoli, cooked", 35, 2.4, 7.2, 0.4, "vegan", []),
    "salad": ("Green salad vegetables", 20, 1.2, 3.6, 0.2, "vegan", []),
    "sweet_potato": ("Sweet potato, baked", 90, 2.0, 20.7, 0.2, "vegan", []),
    "potato": ("Potato, boiled", 87, 1.9, 20.1, 0.1, "vegan", []),
    "whey": ("Whey protein powder", 400, 80.0, 8.0, 6.0, "vegetarian", ["dairy"]),
    "hummus": ("Hummus", 166, 7.9, 14.3, 9.6, "vegan", []),
    "cottage_cheese": ("Cottage cheese, low-fat", 72, 12.4, 2.7, 1.0, "vegetarian", ["dairy"]),
    "whole_wheat_pasta": ("Whole-wheat pasta, cooked", 149, 5.8, 30.0, 1.7, "vegan", ["gluten"]),
    "tomato_sauce": ("Tomato sauce", 29, 1.3, 6.0, 0.2, "vegan", []),
    "chana_roasted": ("Roasted chana", 369, 22.0, 58.0, 5.0, "vegan", []),
    "dates": ("Dates", 282, 2.5, 75.0, 0.4, "vegan", []),
    "makhana": ("Makhana (fox nuts), roasted", 350, 9.7, 77.0, 0.1, "vegan", []),
    "orange": ("Orange", 47, 0.9, 11.8, 0.1, "vegan", []),
    "turkey": ("Turkey breast, cooked", 135, 30.0, 0.0, 1.0, "non_vegetarian", []),
    "tempeh": ("Tempeh", 192, 20.3, 7.6, 10.8, "vegan", ["soy"]),
}

DIET_RANK = {"vegan": 0, "vegetarian": 1, "eggetarian": 2, "non_vegetarian": 3, "custom": 3}


def food_allowed(food_key: str, diet: str, restrictions: list[str]) -> bool:
    _, _, _, _, _, fdiet, allergens = REFERENCE_FOODS[food_key]
    if DIET_RANK[fdiet] > DIET_RANK.get(diet, 3):
        # eggetarian can eat eggs but vegetarians can't; vegetarian (dairy) is fine for eggetarians
        return False
    restr = {r.strip().lower() for r in restrictions}
    aliases = {"lactose": "dairy", "milk": "dairy", "wheat": "gluten", "egg": "eggs", "fish": "seafood",
               "shellfish": "seafood", "peanut": "peanuts", "tree nuts": "nuts", "nut": "nuts"}
    restr = {aliases.get(r, r) for r in restr}
    if "nuts" in restr:
        restr.add("peanuts")
    return not (set(allergens) & restr)


def search_reference_foods(query: str, limit: int = 10) -> list[dict]:
    q = query.lower().strip()
    out = []
    for key, (name, kcal, p, c, f, *_rest) in REFERENCE_FOODS.items():
        if q in name.lower() or q in key.replace("_", " "):
            out.append({"id": f"ref:{key}", "name": name, "brand": None, "calories_100g": kcal,
                        "protein_100g": p, "carbs_100g": c, "fat_100g": f, "source": "reference",
                        "image_url": None})
    return out[:limit]


def nutrition_for(food_key: str, grams: float) -> dict:
    name, kcal, p, c, f, *_ = REFERENCE_FOODS[food_key]
    k = grams / 100
    return {"name": name, "grams": round(grams), "calories": round(kcal * k), "protein_g": round(p * k, 1),
            "carbs_g": round(c * k, 1), "fat_g": round(f * k, 1)}
