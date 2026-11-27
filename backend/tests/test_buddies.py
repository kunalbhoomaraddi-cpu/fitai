"""Workout buddies: pairing by invite code, what is (and isn't) shared, nudges, privacy and removal."""
import io
import json
import zipfile
from datetime import date, timedelta

from app.services import buddy_service as svc

BANNED = ("weight", "calorie", "food", "photo", "email", "protein", "measurement", "kg", "goal")


def _code(client, h):
    return client.get("/api/buddies", headers=h).json()["code"]


def _pair(client, a, b):
    r = client.post("/api/buddies/join", json={"code": _code(client, b)}, headers=a)
    assert r.status_code == 201, r.text
    return r.json()


def _train(client, h):
    plan = client.post("/api/workouts/generate", json={"days_per_week": 3}, headers=h).json()
    s = client.post("/api/workouts/sessions/start", json={"plan_id": plan["id"], "day_index": 0}, headers=h).json()
    client.patch(f"/api/workouts/sessions/{s['id']}", json={"status": "completed"}, headers=h)


def _keys(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _keys(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _keys(v)


def test_code_format_and_normalising():
    assert svc.normalize_code(" k7qm-2xrp ") == "K7QM2XRP"
    assert svc.pretty_code("K7QM2XRP") == "K7QM-2XRP"
    assert not set("01ILO") & set(svc.ALPHABET)


def test_pair_by_code_and_see_only_workouts(client, auth, second_user):
    code = _code(client, auth)
    assert len(code) == 9 and code[4] == "-" and _code(client, auth) == code  # stable once made
    _train(client, second_user)
    r = client.post("/api/buddies/join", json={"code": _code(client, second_user).lower()}, headers=auth)  # any case works
    assert r.status_code == 201 and "Other" in r.json()["detail"]
    mine = client.get("/api/buddies", headers=auth).json()
    b = mine["buddies"][0]
    assert b["name"] == "Other" and b["sharing"] is True
    a = b["activity"]
    assert a["workouts_this_week"] == 1 and a["trained_today"] and a["streak"] == 1 and a["planned_per_week"] == 3
    assert len(a["week"]) == 7 and sum(d["trained"] for d in a["week"]) == 1
    # it's mutual, and nothing about food, weight, photos or email is shared
    theirs = client.get("/api/buddies", headers=second_user).json()
    assert theirs["buddies"][0]["name"] == "Test" and theirs["buddies"][0]["activity"]["workouts_this_week"] == 0
    for k in _keys(mine["buddies"]):
        assert not any(w in k.lower() for w in BANNED), k


def test_bad_codes(client, auth, second_user):
    own = _code(client, auth)
    assert client.post("/api/buddies/join", json={"code": own}, headers=auth).status_code == 422
    assert client.post("/api/buddies/join", json={"code": "ABCD"}, headers=auth).status_code == 422
    assert client.post("/api/buddies/join", json={"code": "ZZZZ-ZZZZ"}, headers=auth).status_code == 404
    _pair(client, auth, second_user)
    r = client.post("/api/buddies/join", json={"code": _code(client, second_user)}, headers=auth)
    assert r.status_code == 409 and "already buddies" in r.json()["detail"]
    r = client.post("/api/buddies/join", json={"code": own}, headers=second_user)
    assert r.status_code == 409


def test_new_code_stops_the_old_one(client, auth, second_user):
    old = _code(client, auth)
    new = client.post("/api/buddies/code", headers=auth).json()["code"]
    assert new != old
    assert client.post("/api/buddies/join", json={"code": old}, headers=second_user).status_code == 404
    assert client.post("/api/buddies/join", json={"code": new}, headers=second_user).status_code == 201


def test_at_most_five_buddies(client, auth, make_user):
    for _ in range(svc.MAX_BUDDIES):
        _pair(client, make_user(), auth)
    r = client.post("/api/buddies/join", json={"code": _code(client, auth)}, headers=make_user())
    assert r.status_code == 409 and "already has 5" in r.json()["detail"]


def test_sharing_off_hides_workouts(client, auth, second_user):
    _pair(client, auth, second_user)
    r = client.put("/api/buddies/sharing", json={"sharing": False}, headers=second_user)
    assert r.json()["sharing"] is False
    b = client.get("/api/buddies", headers=auth).json()["buddies"][0]
    assert b["sharing"] is False and b["activity"] is None and b["name"] == "Other"


def test_nudge_once_a_day_and_seen(client, auth, second_user):
    _pair(client, auth, second_user)
    bid = client.get("/api/buddies", headers=auth).json()["buddies"][0]["id"]
    r = client.post(f"/api/buddies/{bid}/nudge", headers=auth)
    assert r.status_code == 200 and r.json()["detail"] == "Nudge sent to Other."
    assert client.post(f"/api/buddies/{bid}/nudge", headers=auth).status_code == 429
    assert client.get("/api/buddies", headers=auth).json()["buddies"][0]["nudged_today"] is True
    got = client.get("/api/buddies", headers=second_user).json()["nudges"]
    assert [n["from_name"] for n in got] == ["Test"]
    client.post("/api/buddies/nudges/seen", headers=second_user)
    assert client.get("/api/buddies", headers=second_user).json()["nudges"] == []


def test_strangers_cant_nudge_or_remove(client, auth, second_user):
    other_id = client.get("/api/auth/me", headers=second_user).json()["id"]
    assert client.post(f"/api/buddies/{other_id}/nudge", headers=auth).status_code == 404
    assert client.delete(f"/api/buddies/{other_id}", headers=auth).status_code == 404


def test_remove_ends_pairing_for_both(client, auth, second_user):
    _pair(client, auth, second_user)
    bid = client.get("/api/buddies", headers=auth).json()["buddies"][0]["id"]
    client.post(f"/api/buddies/{bid}/nudge", headers=auth)
    assert client.delete(f"/api/buddies/{bid}", headers=auth).status_code == 204
    theirs = client.get("/api/buddies", headers=second_user).json()
    assert theirs["buddies"] == [] and theirs["nudges"] == []


def test_deleting_account_removes_pairings(client, auth, make_user):
    gone = make_user()
    _pair(client, auth, gone)
    client.post(f"/api/buddies/{client.get('/api/auth/me', headers=auth).json()['id']}/nudge", headers=gone)
    assert client.delete("/api/settings/account", headers=gone).status_code == 204
    mine = client.get("/api/buddies", headers=auth).json()
    assert mine["buddies"] == [] and mine["nudges"] == []


def test_export_lists_buddies(client, auth, second_user):
    _pair(client, auth, second_user)
    r = client.get("/api/settings/export", headers=auth)
    data = json.loads(zipfile.ZipFile(io.BytesIO(r.content)).read("fitai-data.json"))
    assert [b["buddy"] for b in data["workout_buddies"]] == ["Other"]


def test_demo_shows_a_sample_buddy(client):
    h = {"Authorization": f"Bearer {client.post('/api/auth/demo').json()['access_token']}"}
    o = client.get("/api/buddies", headers=h).json()
    assert o["demo"] is True and o["code"] is None and o["buddies"][0]["name"] == "Priya"
    assert client.post("/api/buddies/0/nudge", headers=h).status_code == 200
    assert client.post("/api/buddies/join", json={"code": "ABCD-EFGH"}, headers=h).status_code == 403
    assert client.post("/api/buddies/code", headers=h).status_code == 403
    assert client.put("/api/buddies/sharing", json={"sharing": False}, headers=h).status_code == 403


def test_demo_buddy_never_trains_in_the_future():
    wed = date(2026, 11, 25)
    week = svc.demo_overview(wed)["buddies"][0]["activity"]["week"]
    assert [d["trained"] for d in week] == [True, False, True, False, False, False, False]
    assert [d["future"] for d in week] == [False, False, False, True, True, True, True]
    assert week[0]["date"] == (wed - timedelta(days=2)).isoformat()


def test_demo_codes_cant_be_joined(client, auth):
    from app.database import SessionLocal
    from app.models import User
    h = {"Authorization": f"Bearer {client.post('/api/auth/demo').json()['access_token']}"}
    demo_id = client.get("/api/auth/me", headers=h).json()["id"]
    with SessionLocal() as db:  # even if a demo copy somehow had a code, real people can't pair with it
        db.get(User, demo_id).buddy_code = "DEMOCODE"
        db.commit()
    assert client.post("/api/buddies/join", json={"code": "DEMO-CODE"}, headers=auth).status_code == 404
