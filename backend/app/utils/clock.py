"""User-local dates.

Servers (Render, Docker, etc.) run on UTC, but "today", "this week" and streaks must follow the
user's own clock: an Indian user logging dinner at 00:30 IST must land on the new day, not the
previous UTC day. The browser sends its IANA time zone in the `X-Timezone` header; the auth
dependency also falls back to the zone saved on the user's account, then to DEFAULT_TIMEZONE.
"""
from contextvars import ContextVar
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import get_settings

# One mutable holder per request (set by the middleware). FastAPI runs sync dependencies in a
# copied context, so we mutate the holder rather than re-setting the variable.
_holder: ContextVar[dict | None] = ContextVar("fitai_tz", default=None)


def sent_tz() -> str | None:
    h = _holder.get()
    return h.get("sent") if h else None


# Old names that browsers still send but some servers' time-zone data no longer includes
_ALIASES = {"Asia/Calcutta": "Asia/Kolkata", "Asia/Katmandu": "Asia/Kathmandu", "Asia/Rangoon": "Asia/Yangon",
            "Asia/Saigon": "Asia/Ho_Chi_Minh", "Asia/Dacca": "Asia/Dhaka", "Asia/Thimbu": "Asia/Thimphu",
            "Asia/Ulan_Bator": "Asia/Ulaanbaatar", "Europe/Kiev": "Europe/Kyiv", "America/Buenos_Aires":
            "America/Argentina/Buenos_Aires", "Pacific/Truk": "Pacific/Chuuk", "Atlantic/Faeroe": "Atlantic/Faroe"}


def valid_tz(name: str | None) -> str | None:
    if not name or len(name) > 64:
        return None
    name = _ALIASES.get(name.strip(), name.strip())
    try:
        ZoneInfo(name)
        return name
    except (ZoneInfoNotFoundError, ValueError):
        return None


def set_request_tz(name: str | None) -> None:
    tz = valid_tz(name)
    if not tz:
        return
    h = _holder.get()
    if h is None:
        _holder.set({"tz": tz})
    else:
        h["tz"] = tz


def current_tz_name() -> str:
    h = _holder.get()
    return (h or {}).get("tz") or valid_tz(get_settings().default_timezone) or "UTC"


def current_tz() -> ZoneInfo:
    return ZoneInfo(current_tz_name())


def local_now() -> datetime:
    return datetime.now(current_tz())


def local_today() -> date:
    return local_now().date()


def local_date(utc_naive: datetime) -> date:
    """Convert a stored (naive UTC) timestamp to the user's local calendar date."""
    return utc_naive.replace(tzinfo=UTC).astimezone(current_tz()).date()


class TimezoneMiddleware:
    """Pure ASGI middleware: reads X-Timezone so every handler sees the user's zone."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            holder: dict = {}
            for k, v in scope.get("headers", []):
                if k == b"x-timezone":
                    tz = valid_tz(v.decode("latin-1"))
                    if tz:
                        holder = {"tz": tz, "sent": tz}
                    break
            token = _holder.set(holder)
            try:
                await self.app(scope, receive, send)
            finally:
                _holder.reset(token)
            return
        await self.app(scope, receive, send)
