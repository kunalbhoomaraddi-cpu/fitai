"""Copy a meal to another day, and saved meals: save, list, log in one tap, delete, privacy, limits."""
from app.database import SessionLocal
from app.models import SavedMeal

FOOD = {"quantity_g": 100, "calories": 120, "protein_g": 4, "carbs_g": 20, "fat_g": 2, "source": "custom"}


def _log(client, auth, day, meal, *names):
    for n in names:
        assert client.post("/api/nutrition/entries", json={**FOOD, "name": n, "eaten_on": day, "meal": meal}, headers=auth).status_code == 201


def _meal(client, auth, day, meal):
    entries = client.get(f"/api/nutrition/day?date={day}", headers=auth).json()["entries"]
    return [e["name"] for e in entries if e["meal"] == meal]


def test_copy_yesterdays_meal(client, auth):
    _log(client, auth, "2026-11-23", "breakfast", "Poha", "Chai")
    r = client.post("/api/nutrition/copy", json={"from_date": "2026-11-23", "to_date": "2026-11-24", "meal": "breakfast"}, headers=auth)
    assert r.status_code == 200 and r.json() == {"copied": 2}
    assert _meal(client, auth, "2026-11-24", "breakfast") == ["Poha", "Chai"]
    r = client.post("/api/nutrition/copy", json={"from_date": "2026-11-23", "to_date": "2026-11-24", "meal": "breakfast", "to_meal": "snack"}, headers=auth)
    assert _meal(client, auth, "2026-11-24", "snack") == ["Poha", "Chai"]
    empty = client.post("/api/nutrition/copy", json={"from_date": "2026-11-20", "to_date": "2026-11-24", "meal": "dinner"}, headers=auth)
    assert empty.status_code == 400


def test_save_log_and_delete_a_meal(client, auth):
    _log(client, auth, "2026-11-23", "lunch", "Dal", "Roti", "Curd")
    saved = client.post("/api/nutrition/saved-meals", json={"name": "Usual lunch", "eaten_on": "2026-11-23", "meal": "lunch"}, headers=auth)
    assert saved.status_code == 201
    m = saved.json()
    assert m["name"] == "Usual lunch" and len(m["items"]) == 3 and m["totals"]["calories"] == 360
    assert [x["name"] for x in client.get("/api/nutrition/saved-meals", headers=auth).json()] == ["Usual lunch"]
    r = client.post(f"/api/nutrition/saved-meals/{m['id']}/log", json={"eaten_on": "2026-11-24", "meal": "dinner"}, headers=auth)
    assert r.json()["logged"] == 3 and _meal(client, auth, "2026-11-24", "dinner") == ["Dal", "Roti", "Curd"]
    assert client.delete(f"/api/nutrition/saved-meals/{m['id']}", headers=auth).status_code == 204
    assert client.get("/api/nutrition/saved-meals", headers=auth).json() == []


def test_cannot_save_an_empty_meal_or_touch_others(client, auth, second_user):
    assert client.post("/api/nutrition/saved-meals", json={"name": "x", "eaten_on": "2026-11-01", "meal": "lunch"}, headers=auth).status_code == 400
    _log(client, auth, "2026-11-23", "lunch", "Dal")
    m = client.post("/api/nutrition/saved-meals", json={"name": "Mine", "eaten_on": "2026-11-23", "meal": "lunch"}, headers=auth).json()
    assert client.post(f"/api/nutrition/saved-meals/{m['id']}/log", json={}, headers=second_user).status_code == 404
    assert client.delete(f"/api/nutrition/saved-meals/{m['id']}", headers=second_user).status_code == 404
    assert client.get("/api/nutrition/saved-meals", headers=second_user).json() == []


def test_deleting_the_account_removes_saved_meals(client, auth):
    _log(client, auth, "2026-11-23", "lunch", "Dal")
    m = client.post("/api/nutrition/saved-meals", json={"name": "Mine", "eaten_on": "2026-11-23", "meal": "lunch"}, headers=auth).json()
    with SessionLocal() as db:
        uid = db.get(SavedMeal, m["id"]).user_id
    assert client.delete("/api/settings/account", headers=auth).status_code in (200, 204)
    with SessionLocal() as db:
        assert db.query(SavedMeal).filter_by(user_id=uid).count() == 0
