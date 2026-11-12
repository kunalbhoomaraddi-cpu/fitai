import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
_db = Path(__file__).parent / "test_fitai.db"
if _db.exists():
    _db.unlink()
os.environ.update({"DATABASE_URL": os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_db}"), "GEMINI_API_KEY": "", "GROQ_API_KEY": "",
                   "AI_PROVIDER": "auto", "ENABLE_EXTERNAL_APIS": "false", "ENVIRONMENT": "test",
                   "JWT_SECRET": "test-secret-key-for-pytest-only-0123456789", "AI_REQUESTS_PER_MINUTE": "1000", "AUTH_REQUESTS_PER_MINUTE": "1000"})

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import email_service  # noqa: E402

SENT_CODES: dict[str, str] = {}
LOGIN_CODES: dict[str, str] = {}


def _capture(to_email, name, code, purpose="verify"):  # stand-in for SMTP during tests
    (LOGIN_CODES if purpose == "login" else SENT_CODES)[to_email] = code
    return "console"


email_service.send_verification_code = _capture


def verify(client, headers, email):
    r = client.post("/api/auth/verify-email", json={"code": SENT_CODES[email]}, headers=headers)
    assert r.status_code == 200, r.text

PROFILE = {"age": 30, "gender": "female", "height_cm": 165, "current_weight_kg": 70, "target_weight_kg": 63,
           "activity_level": "moderate", "experience": "beginner", "goal": "weight_loss",
           "diet_preference": "vegetarian", "food_restrictions": ["nuts"], "workout_days_per_week": 3,
           "workout_minutes": 45, "equipment": ["dumbbells"], "unit_system": "metric"}


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


_counter = {"n": 0}


@pytest.fixture
def auth(client):
    _counter["n"] += 1
    email = f"user{_counter['n']}@example.com"
    r = client.post("/api/auth/register", json={"full_name": "Test User", "email": email, "password": "secret123"})
    assert r.status_code == 201, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, h, email)
    r = client.put("/api/profile", json=PROFILE, headers=h)
    assert r.status_code == 200, r.text
    return h
