"""Make error messages safe to log: API keys and passwords are replaced with [hidden]."""
import re

from app.config import get_settings

_KEY_PATTERN = re.compile(r"(xkeysib-|xsmtpsib-|AIza|gsk_|npg_)[A-Za-z0-9_\-]+")


def describe_error(exc: Exception) -> str:
    """Error text that is safe to log: never contains API keys or passwords."""
    s = get_settings()
    msg = f"{type(exc).__name__}: {exc}"
    for secret in (s.brevo_api_key, s.smtp_password, s.gemini_api_key, s.groq_api_key, s.jwt_secret):
        if secret and len(secret) >= 6:
            msg = msg.replace(secret, "[hidden]")
    return _KEY_PATTERN.sub(r"\1[hidden]", msg)[:500]
