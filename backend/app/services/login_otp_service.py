"""Two-step login: password, then a 6-digit code emailed on every login.
The browser holds only a short-lived 'pending' token (typ=login_otp) that can't access the API."""
import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import LoginChallenge, User
from app.models._mixins import utcnow
from app.services import email_service

log = logging.getLogger("fitai.email")

MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60
PENDING_TOKEN_MINUTES = 15


def _hash(cid: int, code: str) -> str:
    return hmac.new(get_settings().jwt_secret.encode(), f"login:{cid}:{code}".encode(), hashlib.sha256).hexdigest()


def _send(db: Session, user: User, ch: LoginChallenge) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    try:
        channel = email_service.send_verification_code(user.email, user.full_name.split(" ")[0], code, purpose="login")
    except email_service.EmailNotConfigured as e:
        raise HTTPException(503, str(e)) from None
    except Exception as exc:  # log the reason, with any keys hidden
        log.error("Sending login email failed: %s", email_service.describe_error(exc))
        raise HTTPException(502, "We couldn't send your login code. Please try again in a moment.") from None
    now = utcnow()
    ch.code_hash = _hash(ch.id, code)
    ch.sent_at = now
    ch.expires_at = now + timedelta(minutes=get_settings().verification_code_minutes)
    ch.attempts = 0
    db.commit()
    return channel


def _pending_token(user_id: int, cid: int, nonce: str) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    return jwt.encode({"sub": str(user_id), "cid": cid, "n": nonce, "typ": "login_otp", "iat": now,
                       "exp": now + timedelta(minutes=PENDING_TOKEN_MINUTES)}, s.jwt_secret, algorithm=s.jwt_algorithm)


def _read_pending(db: Session, token: str) -> tuple[User, LoginChallenge]:
    s = get_settings()
    try:
        p = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
        if p.get("typ") != "login_otp":
            raise ValueError
        uid, cid, nonce = int(p["sub"]), int(p["cid"]), str(p["n"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Your login session expired. Please log in again.") from None
    ch = db.get(LoginChallenge, cid)
    user = db.get(User, uid)
    if ch is None or user is None or ch.user_id != uid or not hmac.compare_digest(ch.nonce, nonce):
        raise HTTPException(401, "Your login session expired. Please log in again.")
    return user, ch


def mask_email(email: str) -> str:
    name, _, domain = email.partition("@")
    return (name[:2] + "•" * max(1, len(name) - 2)) + "@" + domain


def start(db: Session, user: User) -> dict:
    # one pending login per user: clear older challenges
    db.execute(delete(LoginChallenge).where(LoginChallenge.user_id == user.id))
    now = utcnow()
    ch = LoginChallenge(user_id=user.id, code_hash="", expires_at=now, sent_at=now, attempts=0,
                        nonce=secrets.token_hex(16))
    db.add(ch)
    db.flush()
    channel = _send(db, user, ch)
    return {"otp_required": True, "otp_token": _pending_token(user.id, ch.id, ch.nonce), "delivery": channel,
            "email_masked": mask_email(user.email), "expires_in_minutes": get_settings().verification_code_minutes,
            "resend_in_seconds": RESEND_COOLDOWN_SECONDS}


def resend(db: Session, token: str) -> dict:
    user, ch = _read_pending(db, token)
    wait = RESEND_COOLDOWN_SECONDS - int((utcnow() - ch.sent_at).total_seconds())
    if wait > 0:
        raise HTTPException(429, f"Please wait {wait} seconds before requesting a new code.")
    channel = _send(db, user, ch)
    return {"delivery": channel, "resend_in_seconds": RESEND_COOLDOWN_SECONDS}


def verify(db: Session, token: str, code: str) -> User:
    user, ch = _read_pending(db, token)
    if ch.attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Request a new code.")
    if utcnow() > ch.expires_at:
        raise HTTPException(400, "This code has expired. Request a new one.")
    if not hmac.compare_digest(ch.code_hash, _hash(ch.id, code.strip())):
        ch.attempts += 1
        db.commit()
        left = MAX_ATTEMPTS - ch.attempts
        raise HTTPException(400, f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left." if left
                            else "Too many incorrect attempts. Request a new code.")
    db.delete(ch)
    db.commit()
    return user
