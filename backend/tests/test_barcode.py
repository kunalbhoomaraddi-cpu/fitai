"""Barcode lookup: Open Food Facts product mapping, serving size, not-found, failures, input checks."""
import pytest

from app.services import nutrition_service as ns

PRODUCT = {"status": 1, "product": {
    "code": "8901058851298", "product_name": "Masala Oats", "brands": "Saffola,Marico",
    "serving_size": "40 g", "serving_quantity": 40,
    "nutriments": {"energy-kcal_100g": 388, "proteins_100g": 10.6, "carbohydrates_100g": 64.2, "fat_100g": 9.8},
}}


@pytest.fixture
def online(monkeypatch):
    monkeypatch.setattr(ns.settings, "enable_external_apis", True)
    ns._barcode_cache._d.clear()
    calls = []

    def fake(url, params=None, headers=None, **kw):
        calls.append(url)
        code = url.rsplit("/", 1)[-1].removesuffix(".json")
        if code == "8901058851298":
            return PRODUCT
        if code == "11111111":
            raise TimeoutError("slow")
        return {"status": 0, "status_verbose": "product not found"}
    monkeypatch.setattr(ns, "http_get_json", fake)
    return calls


def test_found_product_maps_to_a_food(client, auth, online):
    r = client.get("/api/nutrition/barcode/8901058851298", headers=auth).json()
    assert r["found"] and r["warning"] is None
    f = r["result"]
    assert (f["name"], f["brand"], f["calories_100g"], f["protein_100g"]) == ("Masala Oats", "Saffola", 388, 10.6)
    assert f["source"] == "open_food_facts" and f["id"] == "off:8901058851298"
    assert f["servings"] == [{"label": "1 serving (40 g)", "grams": 40.0}]
    client.get("/api/nutrition/barcode/8901058851298", headers=auth)
    assert len(online) == 1  # second scan answered from the cache


def test_unknown_and_unreachable(client, auth, online):
    r = client.get("/api/nutrition/barcode/0000000000000", headers=auth).json()
    assert r == {"found": False, "result": None, "warning": None}
    r = client.get("/api/nutrition/barcode/11111111", headers=auth).json()
    assert not r["found"] and "can't be reached" in r["warning"]


def test_rejects_non_barcodes_and_needs_login(client, auth):
    assert client.get("/api/nutrition/barcode/12ab5678", headers=auth).status_code == 422
    assert client.get("/api/nutrition/barcode/123", headers=auth).status_code == 422
    assert client.get("/api/nutrition/barcode/8901058851298").status_code == 401


def test_offline_setting_gives_a_clear_message(client, auth):
    r = client.get("/api/nutrition/barcode/8901058851298", headers=auth).json()
    assert not r["found"] and "Search by name" in r["warning"]
