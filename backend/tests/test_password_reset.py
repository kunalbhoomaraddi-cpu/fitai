from datetime import timedelta

from app.database import SessionLocal
from app.models import PasswordReset
from tests.conftest import RESET_CODES, verify


def _user(client, email="reset@example.com"):
    r = client.post("/api/auth/register", json={"full_name": "Reset Me", "email": email, "password": "secret123"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, h, email)
    return h


def test_reset_flow_and_old_sessions_revoked(client):
    old = _user(client)
    r = client.post("/api/auth/forgot-password", json={"email": "RESET@example.com"})
    assert r.status_code == 200 and "reset_token" in r.json()
    tok, code = r.json()["reset_token"], RESET_CODES["reset@example.com"]
    bad = client.post("/api/auth/reset-password", json={"reset_token": tok, "code": "000000" if code != "000000" else "111111", "new_password": "brandnew1"})
    assert bad.status_code == 400 and "attempts left" in bad.json()["detail"]
    weak = client.post("/api/auth/reset-password", json={"reset_token": tok, "code": code, "new_password": "short"})
    assert weak.status_code == 422
    ok = client.post("/api/auth/reset-password", json={"reset_token": tok, "code": code, "new_password": "brandnew1"})
    assert ok.status_code == 200
    # code is single-use, old session is signed out, old password no longer works, new one does
    assert client.post("/api/auth/reset-password", json={"reset_token": tok, "code": code, "new_password": "another1"}).status_code == 400
    assert client.get("/api/auth/me", headers=old).status_code == 401
    assert client.post("/api/auth/login", json={"email": "reset@example.com", "password": "secret123"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "reset@example.com", "password": "brandnew1"}).status_code == 200


def test_unknown_email_is_rejected(client):
    r = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 404 and "No FitAI account" in r.json()["detail"]
    assert "nobody@example.com" not in RESET_CODES
    demo = client.post("/api/auth/demo")
    assert demo.status_code in (200, 201)
    assert client.post("/api/auth/forgot-password", json={"email": demo.json()["user"]["email"]}).status_code == 400


def test_attempt_limit_expiry_and_cooldown(client):
    _user(client, "limit@example.com")
    tok = client.post("/api/auth/forgot-password", json={"email": "limit@example.com"}).json()["reset_token"]
    assert client.post("/api/auth/forgot-password/resend", json={"reset_token": tok}).status_code == 429
    code = RESET_CODES["limit@example.com"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        client.post("/api/auth/reset-password", json={"reset_token": tok, "code": wrong, "new_password": "brandnew1"})
    r = client.post("/api/auth/reset-password", json={"reset_token": tok, "code": code, "new_password": "brandnew1"})
    assert r.status_code == 429
    # expiry
    tok2 = client.post("/api/auth/forgot-password", json={"email": "limit@example.com"}).json()["reset_token"]
    with SessionLocal() as db:
        rec = db.query(PasswordReset).order_by(PasswordReset.id.desc()).first()
        rec.expires_at -= timedelta(hours=1)
        rec.sent_at -= timedelta(hours=1)
        db.commit()
    r = client.post("/api/auth/reset-password", json={"reset_token": tok2, "code": RESET_CODES["limit@example.com"], "new_password": "brandnew1"})
    assert r.status_code == 400 and "expired" in r.json()["detail"]
    assert client.post("/api/auth/forgot-password/resend", json={"reset_token": tok2}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"reset_token": "garbage-token-x", "code": "123456", "new_password": "brandnew1"}).status_code == 400
