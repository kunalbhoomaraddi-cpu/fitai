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
