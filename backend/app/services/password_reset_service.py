"""Forgot-password flow: email a 6-digit code, then set a new password.
- Unknown emails get a clear "no account found" error (product choice; rate-limited per IP).
- Codes are hashed, expire after 15 min, 5 attempts, 60 s resend cooldown, single use.
- A successful reset signs out every existing session (users.password_changed_at)."""
import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import LoginChallenge, PasswordReset, User
from app.models._mixins import utcnow
from app.services import email_service
from app.services.auth_service import hash_password

log = logging.getLogger("fitai.email")
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60
TOKEN_MINUTES = 20
GENERIC = "If an account exists for that email, we've sent a 6-digit reset code."


def _hash(rid: int, code: str) -> str:
    return hmac.new(get_settings().jwt_secret.encode(), f"reset:{rid}:{code}".encode(), hashlib.sha256).hexdigest()


def _token(rid: int, nonce: str) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    return jwt.encode({"rid": rid, "n": nonce, "typ": "pwd_reset", "iat": now,
                       "exp": now + timedelta(minutes=TOKEN_MINUTES)}, s.jwt_secret, algorithm=s.jwt_algorithm)


def _read(db: Session, token: str) -> PasswordReset:
    s = get_settings()
    try:
        p = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
        if p.get("typ") != "pwd_reset":
            raise ValueError
        rid, nonce = int(p["rid"]), str(p["n"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(400, "This reset session expired. Please start again.") from None
    rec = db.get(PasswordReset, rid)
    if rec is None or not hmac.compare_digest(rec.nonce, nonce):
        raise HTTPException(400, "This reset session expired. Please start again.")
    return rec


def _send(db: Session, rec: PasswordReset, user: User | None) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    channel = "email"
    if user is not None:
        try:
            channel = email_service.send_verification_code(user.email, user.full_name.split(" ")[0], code, purpose="reset")
        except email_service.EmailNotConfigured as e:
            raise HTTPException(503, str(e)) from None
        except Exception as exc:
            log.error("Sending password reset email failed: %s", email_service.describe_error(exc))
            raise HTTPException(502, "We couldn't send the reset email. Please try again in a moment.") from None
    elif not get_settings().email_configured and get_settings().environment != "production":
        channel = "console"  # keep dev responses identical for unknown emails too
    now = utcnow()
    rec.code_hash = _hash(rec.id, code)
    rec.sent_at = now
    rec.expires_at = now + timedelta(minutes=get_settings().verification_code_minutes)
    rec.attempts = 0
    db.commit()
    return channel


def start(db: Session, email: str) -> dict:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    if user is None:
        raise HTTPException(404, "No FitAI account found with this email. Check for typos.")
    if user.is_demo:
        raise HTTPException(400, "The demo account doesn't have a password to reset.")
    db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
    now = utcnow()
    rec = PasswordReset(user_id=user.id if user else None, code_hash="", nonce=secrets.token_hex(16),
                        expires_at=now, sent_at=now, attempts=0)
    db.add(rec)
    db.flush()
    channel = _send(db, rec, user)
    return {"detail": f"We've sent a 6-digit reset code to {user.email}.", "reset_token": _token(rec.id, rec.nonce), "delivery": channel,
            "expires_in_minutes": get_settings().verification_code_minutes, "resend_in_seconds": RESEND_COOLDOWN_SECONDS}


def resend(db: Session, token: str) -> dict:
    rec = _read(db, token)
    wait = RESEND_COOLDOWN_SECONDS - int((utcnow() - rec.sent_at).total_seconds())
    if wait > 0:
        raise HTTPException(429, f"Please wait {wait} seconds before requesting a new code.")
    user = db.get(User, rec.user_id) if rec.user_id else None
    return {"delivery": _send(db, rec, user), "resend_in_seconds": RESEND_COOLDOWN_SECONDS}


def complete(db: Session, token: str, code: str, new_password: str) -> None:
    rec = _read(db, token)
    if rec.attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Request a new code.")
    if utcnow() > rec.expires_at:
        raise HTTPException(400, "This code has expired. Request a new one.")
    ok = rec.user_id is not None and hmac.compare_digest(rec.code_hash, _hash(rec.id, code.strip()))
    if not ok:
        rec.attempts += 1
        db.commit()
        left = MAX_ATTEMPTS - rec.attempts
        raise HTTPException(400, f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left." if left
                            else "Too many incorrect attempts. Request a new code.")
    user = db.get(User, rec.user_id)
    user.hashed_password = hash_password(new_password)
    user.password_changed_at = utcnow()
    user.email_verified = True  # they proved access to the inbox
    db.execute(delete(LoginChallenge).where(LoginChallenge.user_id == user.id))
    db.delete(rec)
    db.commit()
