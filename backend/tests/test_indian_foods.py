import pytest

from app.data.indian_foods import INDIAN_FOODS
from app.services.nutrition_service import search_indian_foods


def test_library_is_large_and_consistent():
    assert len(INDIAN_FOODS) >= 180
    for k, f in INDIAN_FOODS.items():
        est = 4 * f["protein"] + 4 * f["carbs"] + 9 * f["fat"]
        # stated calories should match the macros (fibre/rounding allow some slack)
        assert abs(est - f["kcal"]) <= max(12, 0.15 * f["kcal"]), (k, f["kcal"], est)
        assert f["servings"] and all(5 <= s["grams"] <= 400 for s in f["servings"]), k
        assert f["diet"] in ("vegan", "vegetarian", "eggetarian", "non_vegetarian")


@pytest.mark.parametrize("q,expected", [
    ("roti", "Roti / Phulka (no ghee)"), ("chapathi", "Roti / Phulka (no ghee)"), ("jolada rotti", "Jolada Rotti / Jowar Bhakri"),
    ("dal", "Dal Tadka / Toor Dal"), ("biriyani", "Biryani"), ("chiken biryani", "Chicken Biryani"),
    ("tea", "Masala Chai (milk + sugar)"), ("avalakki", "Poha"), ("uppittu", "Upma / Khara Bath"), ("holige", "Obbattu"),
])
def test_search_finds_regional_names_and_typos(q, expected):
    names = [r["name"] for r in search_indian_foods(q)]
    assert names and any(expected in n for n in names[:3]), (q, names)


def test_short_queries_dont_match_inside_words():
    assert "Pomegranate" not in [r["name"] for r in search_indian_foods("dal")]
    assert all("Steamed" not in r["name"] for r in search_indian_foods("tea"))


def test_search_api_returns_servings_and_replaces_duplicates(client, auth):
    r = client.get("/api/nutrition/search?q=idli", headers=auth).json()
    first = r["results"][0]
    assert first["source"] == "indian" and first["servings"][0] == {"label": "1 idli", "grams": 40}
    assert sum(1 for x in r["results"] if "Idli" == x["name"]) == 1  # generic reference idli hidden


def test_log_indian_food_by_serving(client, auth):
    f = INDIAN_FOODS["roti"]
    grams = 2 * f["servings"][1]["grams"]
    r = client.post("/api/nutrition/entries", headers=auth, json={
        "eaten_on": "2026-01-05", "meal": "lunch", "name": "Roti / Phulka (no ghee) · 2 × 1 medium roti", "quantity_g": grams,
        "calories": round(f["kcal"] * grams / 100), "protein_g": 7.2, "carbs_g": 41.6, "fat_g": 1.4, "source": "reference", "source_id": "in:roti"})
    assert r.status_code == 201 and r.json()["calories"] == 211
