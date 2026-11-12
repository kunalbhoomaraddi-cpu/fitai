from tests.conftest import SENT_CODES


def _register(client, email):
    r = client.post("/api/auth/register", json={"full_name": "Verify Me", "email": email, "password": "secret123"})
    assert r.status_code == 201, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body


def test_new_user_is_unverified_and_blocked(client):
    h, body = _register(client, "v1@example.com")
    assert body["user"]["email_verified"] is False and body["verification"]["delivery"] == "console"
    assert client.get("/api/auth/me", headers=h).status_code == 200          # allowed
    r = client.put("/api/profile", json={}, headers=h)
    assert r.status_code == 403 and "verify" in r.json()["detail"].lower()   # blocked
    assert client.get("/api/dashboard", headers=h).status_code == 403


def test_wrong_code_then_right_code(client):
    h, _ = _register(client, "v2@example.com")
    real = SENT_CODES["v2@example.com"]
    wrong = "000000" if real != "000000" else "111111"
    r = client.post("/api/auth/verify-email", json={"code": wrong}, headers=h)
    assert r.status_code == 400 and "4 attempts left" in r.json()["detail"]
    assert client.post("/api/auth/verify-email", json={"code": "12ab56"}, headers=h).status_code == 422
    r = client.post("/api/auth/verify-email", json={"code": real}, headers=h)
    assert r.status_code == 200 and r.json()["email_verified"] is True
    assert client.get("/api/profile", headers=h).status_code == 200


def test_attempt_limit_and_resend(client):
    h, _ = _register(client, "v3@example.com")
    real = SENT_CODES["v3@example.com"]
    wrong = "000000" if real != "000000" else "111111"
    for _ in range(5):
        client.post("/api/auth/verify-email", json={"code": wrong}, headers=h)
    r = client.post("/api/auth/verify-email", json={"code": real}, headers=h)
    assert r.status_code == 429                                               # locked after 5 tries
    r = client.post("/api/auth/resend-code", headers=h)
    assert r.status_code == 429 and "wait" in r.json()["detail"]              # 60 s cooldown


def test_code_is_not_stored_in_plain_text(client):
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import EmailVerification, User
    _register(client, "v4@example.com")
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == "v4@example.com"))
        rec = db.scalar(select(EmailVerification).where(EmailVerification.user_id == u.id))
        assert rec.code_hash != SENT_CODES["v4@example.com"] and len(rec.code_hash) == 64


def test_demo_account_is_verified(client):
    r = client.post("/api/auth/demo")
    assert r.json()["user"]["email_verified"] is True


def test_migration_adds_column_to_old_database(tmp_path):
    """Simulates a database created before email verification existed."""
    from sqlalchemy import create_engine, inspect, text

    import app.database as dbm
    eng = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with eng.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255))"))
        c.execute(text("INSERT INTO users (id, email) VALUES (1, 'old@example.com')"))
    orig = dbm.engine
    dbm.engine = eng
    try:
        dbm.run_light_migrations()
        dbm.run_light_migrations()  # idempotent
    finally:
        dbm.engine = orig
    assert "email_verified" in {c["name"] for c in inspect(eng).get_columns("users")}
    with eng.connect() as c:
        assert c.execute(text("SELECT email_verified FROM users")).scalar() in (1, True)
