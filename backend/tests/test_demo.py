"""Each demo visitor gets a private copy; copies expire; the demo domain is reserved."""
from datetime import timedelta

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import FoodEntry, User
from app.models._mixins import utcnow
from app.services import demo_service


def _demo(client):
    r = client.post("/api/auth/demo")
    assert r.status_code == 200, r.text
    return r.json()["user"], {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_visitors_are_isolated(client):
    u1, h1 = _demo(client)
    u2, h2 = _demo(client)
    assert u1["email"] != u2["email"] and u1["is_demo"] and u2["is_demo"]
    # visitor 1 deletes an entry; visitor 2 is unaffected and still signed in
    day1 = client.get("/api/nutrition/day", headers=h1).json()
    day2 = client.get("/api/nutrition/day", headers=h2).json()
    eid = day1["entries"][0]["id"]
    assert client.delete(f"/api/nutrition/entries/{eid}", headers=h1).status_code == 204
    assert len(client.get("/api/nutrition/day", headers=h2).json()["entries"]) == len(day2["entries"])
    assert client.get("/api/auth/me", headers=h1).status_code == 200
    assert client.get("/api/dashboard", headers=h1).json()["user"]["is_demo"] is True


def test_expired_copies_are_deleted(client):
    u, h = _demo(client)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == u["email"]))
        uid = user.id
        user.created_at = utcnow() - timedelta(hours=7)
        db.commit()
        assert demo_service.purge_expired_demos(db) >= 1
        assert db.get(User, uid) is None
        assert db.scalar(select(func.count()).select_from(FoodEntry).where(FoodEntry.user_id == uid)) == 0
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_cap_keeps_newest(client):
    _demo(client)
    newest, _ = _demo(client)
    with SessionLocal() as db:
        demo_service.purge_expired_demos(db, keep_newest=1)
        left = list(db.scalars(select(User.email).where(User.is_demo.is_(True))))
    assert left == [newest["email"]]


def test_demo_domain_reserved(client):
    r = client.post("/api/auth/register", json={"full_name": "Test User", "email": "visitor-abc@demo.fitai.app", "password": "secret123"})
    assert r.status_code == 400
