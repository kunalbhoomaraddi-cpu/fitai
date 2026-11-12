from fastapi import Depends, HTTPException

from app.config import get_settings
from app.models import User
from app.services.auth_service import get_current_user
from app.utils.http import SlidingWindowLimiter

_ai_limiter = SlidingWindowLimiter(limit=get_settings().ai_requests_per_minute, window=60)
_auth_limiter = SlidingWindowLimiter(limit=get_settings().auth_requests_per_minute, window=60)


def ai_rate_limit(user: User = Depends(get_current_user)) -> User:
    if not _ai_limiter.allow(f"u{user.id}"):
        raise HTTPException(429, "You're sending AI requests quickly. Please wait a moment and try again.")
    return user


def auth_rate_limit(key: str) -> None:
    if not _auth_limiter.allow(key):
        raise HTTPException(429, "Too many attempts. Please wait a minute and try again.")
