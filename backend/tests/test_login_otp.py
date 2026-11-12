from tests.conftest import LOGIN_CODES, verify


def _verified_user(client, email):
    r = client.post("/api/auth/register", json={"full_name": "Otp User", "email": email, "password": "secret123"})
    verify(client, {"Authorization": f"Bearer {r.json()['access_token']}"}, email)


def _start(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "secret123"})
    assert r.status_code == 200, r.text
    return r.json()


def test_every_login_needs_a_code(client):
    _verified_user(client, "o1@example.com")
    for _ in range(2):  # a new code each time
        body = _start(client, "o1@example.com")
        assert body["otp_required"] and body["email_masked"].startswith("o1") and "@example.com" in body["email_masked"]
        r = client.post("/api/auth/login/verify", json={"otp_token": body["otp_token"], "code": LOGIN_CODES["o1@example.com"]})
        assert r.status_code == 200
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 200


def test_pending_token_cannot_access_api(client):
    _verified_user(client, "o2@example.com")
    body = _start(client, "o2@example.com")
    h = {"Authorization": f"Bearer {body['otp_token']}"}
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.get("/api/dashboard", headers=h).status_code == 401


def test_wrong_codes_lock_and_old_code_dies(client):
    _verified_user(client, "o3@example.com")
    body = _start(client, "o3@example.com")
    real = LOGIN_CODES["o3@example.com"]
    wrong = "000000" if real != "000000" else "111111"
    r = client.post("/api/auth/login/verify", json={"otp_token": body["otp_token"], "code": wrong})
    assert r.status_code == 400 and "4 attempts left" in r.json()["detail"]
    for _ in range(4):
        client.post("/api/auth/login/verify", json={"otp_token": body["otp_token"], "code": wrong})
    assert client.post("/api/auth/login/verify", json={"otp_token": body["otp_token"], "code": real}).status_code == 429
    # starting a new login invalidates the previous pending session
    body2 = _start(client, "o3@example.com")
    assert client.post("/api/auth/login/verify", json={"otp_token": body["otp_token"], "code": LOGIN_CODES["o3@example.com"]}).status_code == 401
    assert client.post("/api/auth/login/verify", json={"otp_token": body2["otp_token"], "code": LOGIN_CODES["o3@example.com"]}).status_code == 200


def test_code_single_use_and_resend_cooldown(client):
    _verified_user(client, "o4@example.com")
    body = _start(client, "o4@example.com")
    code = LOGIN_CODES["o4@example.com"]
    assert client.post("/api/auth/login/resend", json={"otp_token": body["otp_token"]}).status_code == 429
    assert client.post("/api/auth/login/verify", json={"otp_token": body["otp_token"], "code": code}).status_code == 200
    assert client.post("/api/auth/login/verify", json={"otp_token": body["otp_token"], "code": code}).status_code == 401


def test_demo_and_unverified_skip_login_code(client):
    assert "access_token" in client.post("/api/auth/demo").json()
    client.post("/api/auth/register", json={"full_name": "Not Yet", "email": "o5@example.com", "password": "secret123"})
    r = client.post("/api/auth/login", json={"email": "o5@example.com", "password": "secret123"})
    assert "access_token" in r.json() and r.json()["user"]["email_verified"] is False
