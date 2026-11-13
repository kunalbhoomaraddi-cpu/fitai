"""6-digit email verification codes: hashed at rest, 15-minute expiry, 5 attempts, 60 s resend cooldown."""
import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import EmailVerification, User
from app.models._mixins import utcnow
from app.services import email_service

log = logging.getLogger("fitai.email")

MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60


def _hash(user_id: int, code: str) -> str:
    key = get_settings().jwt_secret.encode()
    return hmac.new(key, f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def issue_code(db: Session, user: User, enforce_cooldown: bool = True) -> dict:
    s = get_settings()
    rec = db.scalar(select(EmailVerification).where(EmailVerification.user_id == user.id))
    now = utcnow()
    if rec and enforce_cooldown:
        wait = RESEND_COOLDOWN_SECONDS - int((now - rec.sent_at).total_seconds())
        if wait > 0:
            raise HTTPException(429, f"Please wait {wait} seconds before requesting a new code.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    try:
        channel = email_service.send_verification_code(user.email, user.full_name.split(" ")[0], code)
    except email_service.EmailNotConfigured as e:
        raise HTTPException(503, str(e)) from None
    except Exception as exc:  # log the reason, with any keys hidden
        log.error("Sending verification email failed: %s", email_service.describe_error(exc))
        raise HTTPException(502, "We couldn't send the verification email. Check the SMTP settings and try again.") from None
    if rec is None:
        rec = EmailVerification(user_id=user.id, code_hash="", expires_at=now, sent_at=now, attempts=0)
        db.add(rec)
    rec.code_hash = _hash(user.id, code)
    rec.expires_at = now + timedelta(minutes=s.verification_code_minutes)
    rec.sent_at = now
    rec.attempts = 0
    db.commit()
    return {"delivery": channel, "expires_in_minutes": s.verification_code_minutes,
            "resend_in_seconds": RESEND_COOLDOWN_SECONDS}


def verify_code(db: Session, user: User, code: str) -> None:
    rec = db.scalar(select(EmailVerification).where(EmailVerification.user_id == user.id))
    if rec is None:
        raise HTTPException(400, "No code found. Request a new one.")
    if rec.attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Request a new code.")
    if utcnow() > rec.expires_at:
        raise HTTPException(400, "This code has expired. Request a new one.")
    if not hmac.compare_digest(rec.code_hash, _hash(user.id, code.strip())):
        rec.attempts += 1
        db.commit()
        left = MAX_ATTEMPTS - rec.attempts
        raise HTTPException(400, f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left." if left else
                            "Too many incorrect attempts. Request a new code.")
    user.email_verified = True
    db.delete(rec)
    db.commit()
