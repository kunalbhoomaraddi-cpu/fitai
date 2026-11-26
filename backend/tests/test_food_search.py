"""Name search: Open Food Facts' search service first, the classic search page as a fallback, and
FitAI's own foods (always shown first) when both are down."""
import pytest

from app.services import nutrition_service as ns

HIT = {"code": "8901262010030", "product_name": "Amul Butter", "brands": ["xx:Amul"],
       "nutriments": {"energy-kcal_100g": 740, "proteins_100g": 0.6, "carbohydrates_100g": 0, "fat_100g": 81},
       "image_front_small_url": "https://images.openfoodfacts.org/x.jpg"}
NO_NUTRITION = {"code": "8901262010153", "product_name": "Amul Butter", "brands": ["xx:Amul"], "nutriments": {}}
CLASSIC = {"code": "3017620422003", "product_name": "Nutella", "brands": "Ferrero,Nutella",
           "nutriments": {"energy-kcal_100g": 539, "proteins_100g": 6.3, "carbohydrates_100g": 57.5, "fat_100g": 30.9}}


@pytest.fixture
def off(monkeypatch):
    """Pretend to be Open Food Facts. Set .search_down / .classic_down to simulate outages."""
    class Fake:
        calls: list[str] = []
        search_down = False
        classic_down = False

        def __call__(self, url, params=None, headers=None, **kw):
            self.calls.append(url)
            assert headers and "github.com" in headers["User-Agent"]  # OFF asks apps to identify themselves
            if url == ns.settings.off_search_url:
                if self.search_down:
                    raise TimeoutError("search service down")
                return {"hits": [HIT, NO_NUTRITION], "count": 2}
            if self.classic_down:
                raise TimeoutError("classic down")
            return {"products": [CLASSIC]}
    fake = Fake()
    fake.calls = []
    monkeypatch.setattr(ns, "http_get_json", fake)
    monkeypatch.setattr(ns.settings, "enable_external_apis", True)
    ns._off_cache._d.clear()
    return fake


def test_uses_the_search_service_and_cleans_brands(client, auth, off):
    r = client.get("/api/nutrition/search?q=amul%20butter%20pack", headers=auth).json()
    assert r["source"] == "open_food_facts" and r["warning"] is None
    packaged = [x for x in r["results"] if x["source"] == "open_food_facts"]
    assert [(x["name"], x["brand"], x["calories_100g"]) for x in packaged] == [("Amul Butter", "Amul", 740)]  # no "xx:", no empty product
    assert off.calls == [ns.settings.off_search_url]


def test_falls_back_to_the_classic_search(client, auth, off):
    off.search_down = True
    r = client.get("/api/nutrition/search?q=nutella%20jar", headers=auth).json()
    assert r["source"] == "open_food_facts" and r["warning"] is None
    assert any(x["name"] == "Nutella" and x["brand"] == "Ferrero" for x in r["results"])
    assert len(off.calls) == 2


def test_both_down_shows_fitai_foods_with_a_note(client, auth, off):
    off.search_down = off.classic_down = True
    r = client.get("/api/nutrition/search?q=paneer%20cubes", headers=auth).json()
    assert r["source"] == "reference" and "can't be reached" in r["warning"]
    assert r["results"] and r["results"][0]["source"] in ("indian", "reference")


def test_brand_formats():
    assert ns._map_off_product({**HIT, "brands": "Ferrero,Nutella"})["brand"] == "Ferrero"
    assert ns._map_off_product({**HIT, "brands": []})["brand"] is None
    assert ns._map_off_product({**HIT, "brands": ["en:Mother Dairy"]})["brand"] == "Mother Dairy"


def test_real_matches_rank_above_typo_guesses(client, auth, off, monkeypatch):
    hit = {**HIT, "code": "3017620422003", "product_name": "Nutella", "brands": ["xx:Ferrero"]}
    monkeypatch.setattr(off, "__class__", off.__class__)
    off.search_down = False
    orig = off.__class__.__call__
    off.__class__.__call__ = lambda self, url, params=None, headers=None, **kw: (
        {"hits": [hit]} if url == ns.settings.off_search_url else orig(self, url, params, headers))
    names = [x["name"] for x in client.get("/api/nutrition/search?q=nutella", headers=auth).json()["results"]]
    assert names[0] == "Nutella"                      # the real product first
    assert "Soya Chunks Curry" in names[1:]           # the "Nutrela" typo guess still offered, after it
    assert client.get("/api/nutrition/search?q=chapathi", headers=auth).json()["results"][0]["name"].startswith("Roti")
