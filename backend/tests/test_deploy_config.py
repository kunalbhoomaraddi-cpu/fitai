"""Production safety checks, database URL normalising and the Brevo (HTTPS) email path."""
import httpx
import pytest

from app.config import Settings
from app.services import email_service

GOOD = dict(environment="production", jwt_secret="x" * 48,
            database_url="postgresql://u:p@ep-x.neon.tech/db?sslmode=require",
            brevo_api_key="k", email_from="FitAI <me@gmail.com>", cors_origins="https://fitai.vercel.app")


def _s(**kw):
    return Settings(_env_file=None, **{**GOOD, **kw})


def test_good_production_settings_pass():
    s = _s()
    assert s.production_problems() == []
    assert s.database_url.startswith("postgresql+psycopg://")
    assert _s(database_url="postgres://u:p@h/db").database_url == "postgresql+psycopg://u:p@h/db"


@pytest.mark.parametrize("kw,needle", [
    ({"jwt_secret": "change-me-in-.env-this-is-only-for-local-dev"}, "JWT_SECRET"),
    ({"jwt_secret": "short"}, "JWT_SECRET"),
    ({"database_url": "sqlite:///./fitai.db"}, "SQLite"),
    ({"brevo_api_key": "", "smtp_host": ""}, "Email"),
    ({"cors_origins": "http://localhost:5173"}, "CORS_ORIGINS"),
])
def test_bad_production_settings_are_reported(kw, needle):
    assert any(needle in p for p in _s(**kw).production_problems())


def test_free_mode_without_email_is_allowed():
    s = _s(brevo_api_key="", email_verification_required=False, login_otp_required=False)
    assert s.production_problems() == []


def test_brevo_send(monkeypatch):
    sent = {}

    def fake_post(url, **kw):
        sent.update(url=url, **kw)
        return httpx.Response(201, json={"messageId": "x"})

    monkeypatch.setattr(email_service, "get_settings", lambda: _s())
    monkeypatch.setattr(email_service.httpx, "post", fake_post)
    assert email_service.real_send_verification_code("a@b.com", "Kunal", "123456", purpose="login") == "email"
    assert sent["url"] == email_service.BREVO_URL and sent["headers"]["api-key"] == "k"
    body = sent["json"]
    assert body["sender"] == {"name": "FitAI", "email": "me@gmail.com"}
    assert body["to"][0]["email"] == "a@b.com" and "123456" in body["subject"] and body["htmlContent"].count(">1</div>") == 1 and "123456" in body["textContent"]


def test_brevo_error_is_raised(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _s())
    monkeypatch.setattr(email_service.httpx, "post", lambda url, **kw: httpx.Response(400, json={"message": "sender invalid"}))
    with pytest.raises(RuntimeError, match="sender invalid"):
        email_service.real_send_verification_code("a@b.com", "Kunal", "123456")


def test_pasted_values_are_trimmed():
    s = _s(brevo_api_key="xkeysib-abc123\n", email_from=" FitAI <me@gmail.com>\n",
           cors_origins="https://fitai.vercel.app\n")
    assert s.brevo_api_key == "xkeysib-abc123" and s.email_from == "FitAI <me@gmail.com>"
    assert s.cors_origin_list == ["https://fitai.vercel.app"]


def test_logged_errors_never_contain_keys(monkeypatch):
    from app.utils import redact
    key = "xkeysib-75c6d76f9a0d6898b0d93b7c346d0e3c-SECRET"
    monkeypatch.setattr(redact, "get_settings", lambda: _s(brevo_api_key=key, gemini_api_key="AIzaSyFAKEKEY1234567890"))
    msg = redact.describe_error(ValueError(f"Illegal header value b'{key}\\n' and AIzaSyFAKEKEY1234567890 and xkeysib-other"))
    assert "SECRET" not in msg and "75c6d76f" not in msg and "AIzaSyFAKE" not in msg and "other" not in msg
    assert msg.startswith("ValueError:") and "[hidden]" in msg


def test_brevo_network_error_hides_headers(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _s(brevo_api_key="xkeysib-SECRET"))

    def boom(url, **kw):
        raise httpx.LocalProtocolError(f"Illegal header value {kw['headers']['api-key']!r}")

    monkeypatch.setattr(email_service.httpx, "post", boom)
    with pytest.raises(RuntimeError) as e:
        email_service.real_send_verification_code("a@b.com", "K", "123456")
    assert "SECRET" not in str(e.value) and "LocalProtocolError" in str(e.value)


def _gmail_settings(**kw):
    return _s(gmail_client_id="cid.apps.googleusercontent.com", gmail_client_secret="GOCSPX-secret",
              gmail_refresh_token="1//refresh-SECRET", brevo_api_key="", **kw)


def test_gmail_is_preferred_and_sends_mime(monkeypatch):
    import base64
    import email
    calls = []

    def fake_post(url, **kw):
        calls.append((url, kw))
        if url == email_service.GOOGLE_TOKEN_URL:
            assert kw["data"]["refresh_token"] == "1//refresh-SECRET"
            return httpx.Response(200, json={"access_token": "ya29.token", "expires_in": 3599})
        return httpx.Response(200, json={"id": "abc"})

    email_service._gmail_token.update(value="", expires=0.0)
    monkeypatch.setattr(email_service, "get_settings", lambda: _gmail_settings(email_from="FitAI <me@gmail.com>"))
    monkeypatch.setattr(email_service.httpx, "post", fake_post)
    assert email_service.real_send_verification_code("a@b.com", "Kunal", "123456", purpose="login") == "email"
    assert email_service.real_send_verification_code("c@d.com", "Kunal", "654321", purpose="login") == "email"
    urls = [u for u, _ in calls]
    assert urls.count(email_service.GOOGLE_TOKEN_URL) == 1  # access token cached between sends
    send = [kw for u, kw in calls if u == email_service.GMAIL_SEND_URL][0]
    assert send["headers"]["Authorization"] == "Bearer ya29.token"
    msg = email.message_from_bytes(base64.urlsafe_b64decode(send["json"]["raw"]))
    assert msg["To"] == "a@b.com" and msg["From"] == "FitAI <me@gmail.com>" and "123456" in msg["Subject"]
    assert _gmail_settings().email_configured and _gmail_settings().production_problems() == []


def test_gmail_bad_refresh_token_is_explained(monkeypatch):
    email_service._gmail_token.update(value="", expires=0.0)
    monkeypatch.setattr(email_service, "get_settings", lambda: _gmail_settings())
    monkeypatch.setattr(email_service.httpx, "post", lambda url, **kw: httpx.Response(
        400, json={"error": "invalid_grant", "error_description": "Token has been expired or revoked."}))
    with pytest.raises(RuntimeError, match="gmail_token.py") as e:
        email_service.real_send_verification_code("a@b.com", "K", "123456")
    assert "SECRET" not in str(e.value)
