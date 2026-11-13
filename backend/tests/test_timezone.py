"""Server clock is UTC; user is in India just after midnight. "Today" must be the Indian date."""
from datetime import UTC, datetime
from unittest.mock import patch

from app.utils import clock

# 2026-03-10 19:00 UTC == 2026-03-11 00:30 IST
FIXED = datetime(2026, 3, 10, 19, 0, tzinfo=UTC)


class _FakeDT(datetime):
    @classmethod
    def now(cls, tz=None):
        return FIXED.astimezone(tz) if tz else FIXED.replace(tzinfo=None)


def _entry():
    return {"meal": "dinner", "name": "Dal rice", "quantity_g": 300, "calories": 400,
            "protein_g": 12, "carbs_g": 60, "fat_g": 8}


def test_today_follows_header(client, auth):
    with patch.object(clock, "datetime", _FakeDT):
        h = {**auth, "X-Timezone": "Asia/Kolkata"}
        r = client.post("/api/nutrition/entries", json=_entry(), headers=h)
        assert r.status_code == 201, r.text
        assert r.json()["eaten_on"] == "2026-03-11"
        r = client.post("/api/nutrition/entries", json=_entry(), headers={**auth, "X-Timezone": "UTC"})
        assert r.json()["eaten_on"] == "2026-03-10"


def test_saved_timezone_used_without_header(client, auth):
    with patch.object(clock, "datetime", _FakeDT):
        client.get("/api/profile", headers={**auth, "X-Timezone": "America/New_York"})
        r = client.post("/api/nutrition/entries", json=_entry(), headers=auth)  # no header
        assert r.json()["eaten_on"] == "2026-03-10"  # 15:00 in New York


def test_bad_header_falls_back_to_default(client, auth):
    with patch.object(clock, "datetime", _FakeDT):
        r = client.post("/api/nutrition/entries", json=_entry(), headers={**auth, "X-Timezone": "Mars/Base"})
        assert r.json()["eaten_on"] == "2026-03-11"  # default Asia/Kolkata


def test_local_date_converts_utc():
    with patch.object(clock, "datetime", _FakeDT):
        clock.set_request_tz("Asia/Kolkata")
        assert str(clock.local_date(datetime(2026, 3, 10, 20, 0))) == "2026-03-11"


def test_legacy_india_name_from_chrome(client, auth):
    with patch.object(clock, "datetime", _FakeDT):
        r = client.post("/api/nutrition/entries", json=_entry(), headers={**auth, "X-Timezone": "Asia/Calcutta"})
        assert r.json()["eaten_on"] == "2026-03-11"
        assert client.get("/api/profile", headers={**auth, "X-Timezone": "Asia/Calcutta"}).status_code == 200
