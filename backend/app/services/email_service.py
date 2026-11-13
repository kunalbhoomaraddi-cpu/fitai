"""Sends transactional email, trying in order:
1. the Gmail API over HTTPS: sends from your own Gmail, so Gmail delivers it to the inbox;
2. the Brevo HTTPS API;
3. SMTP (Gmail + App Password, etc.).
The HTTPS options work on hosts that block SMTP ports, such as Render's free plan.
If nothing is configured in development, the code is printed to the server log instead."""
import base64
import logging
import smtplib
import ssl
import threading
import time
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

import httpx

from app.config import get_settings

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

_gmail_token: dict = {"value": "", "expires": 0.0}
_gmail_lock = threading.Lock()

log = logging.getLogger("fitai.email")


class EmailNotConfigured(Exception):
    pass


from app.utils.redact import describe_error  # noqa: E402,F401  (re-exported for the services)


def _verification_html(name: str, code: str, minutes: int, purpose: str = "verify") -> str:
    title, lead, ignore = {
        "login": ("Your login code", "use this code to finish logging in to FitAI.",
                  "If this wasn't you, change your FitAI password — someone may know it."),
        "reset": ("Reset your password", "use this code to choose a new FitAI password.",
                  "If you didn't ask to reset your password, ignore this email — your password stays the same."),
    }.get(purpose, ("Verify your email", "enter this code in FitAI to activate your account.",
                    "If you didn't create a FitAI account, you can ignore this email."))
    digits = "".join(
        f'<td style="padding:0 4px"><div style="width:44px;height:54px;line-height:54px;border-radius:10px;'
        f'background:#171C18;border:1px solid #29312B;color:#C6F36B;font:700 26px Arial,sans-serif;text-align:center">{d}</div></td>'
        for d in code)
    return f"""<!doctype html><html><body style="margin:0;background:#0B0D0C;padding:32px 12px;font-family:Arial,sans-serif">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#111512;border:1px solid #29312B;border-radius:18px">
<tr><td style="padding:32px">
<div style="font:800 22px Arial,sans-serif;color:#F5F7F2">Fit<span style="color:#C6F36B">AI</span></div>
<h1 style="color:#F5F7F2;font-size:20px;margin:24px 0 8px">{title}</h1>
<p style="color:#9CA69D;font-size:14px;line-height:1.6;margin:0 0 24px">Hi {name}, {lead}</p>
<table role="presentation" style="margin:0 auto"><tr>{digits}</tr></table>
<p style="color:#9CA69D;font-size:13px;line-height:1.6;margin:24px 0 0">The code expires in {minutes} minutes.
{ignore}</p>
</td></tr></table></body></html>"""


def send_verification_code(to_email: str, name: str, code: str, purpose: str = "verify") -> str:
    """Returns the delivery channel: 'email' or 'console'."""
    s = get_settings()
    label = {"login": "login", "reset": "password reset"}.get(purpose, "verification")
    subject = f"{code} is your FitAI {label} code"
    text = (f"Hi {name},\n\nYour FitAI {label} code is: {code}\n\n"
            f"It expires in {s.verification_code_minutes} minutes. If you didn't sign up, ignore this email.")
    if not s.email_configured:
        if s.environment == "production":
            raise EmailNotConfigured("Email isn't switched on for this FitAI site yet, so codes can't be sent. Please contact the site owner.")
        bar = "=" * 60
        log.warning("\n%s\n  EMAIL NOT CONFIGURED (development) — %s code\n  To: %s\n  CODE: %s\n%s",
                    bar, label, to_email, code, bar)
        return "console"
    html = _verification_html(name, code, s.verification_code_minutes, purpose)
    if s.gmail_configured:
        _send_gmail(to_email, subject, text, html)
    elif s.brevo_api_key:
        _send_brevo(to_email, name, subject, text, html)
    else:
        _send_smtp(to_email, subject, text, html)
    log.info("Verification email sent to %s", to_email.split("@")[0][:2] + "***@" + to_email.split("@")[-1])
    return "email"


def _sender() -> tuple[str, str]:
    s = get_settings()
    name_part, addr = parseaddr(s.email_from or s.smtp_from or s.smtp_username)
    return name_part or "FitAI", addr


def _mime(to_email: str, subject: str, text: str, html: str, sender: tuple[str, str]) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr(sender)
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def _gmail_access_token() -> str:
    """Swap the long-lived refresh token for a 1-hour access token, cached until shortly before it expires."""
    s = get_settings()
    with _gmail_lock:
        if _gmail_token["value"] and time.time() < _gmail_token["expires"] - 60:
            return _gmail_token["value"]
        try:
            r = httpx.post(GOOGLE_TOKEN_URL, timeout=20, data={
                "client_id": s.gmail_client_id, "client_secret": s.gmail_client_secret,
                "refresh_token": s.gmail_refresh_token, "grant_type": "refresh_token"})
        except httpx.HTTPError as e:
            raise RuntimeError(f"Google sign-in request failed ({type(e).__name__})") from None
        if r.status_code != 200:
            reason = ""
            try:
                body = r.json()
                reason = f"{body.get('error', '')} {body.get('error_description', '')}".strip()
            except Exception:
                pass
            hint = " (run scripts/gmail_token.py again for a new refresh token)" if "invalid_grant" in reason else ""
            raise RuntimeError(f"Google token error {r.status_code}: {reason[:200]}{hint}")
        body = r.json()
        _gmail_token.update(value=body["access_token"], expires=time.time() + int(body.get("expires_in", 3600)))
        return _gmail_token["value"]


def _send_gmail(to_email: str, subject: str, text: str, html: str) -> None:
    sender_name, sender_addr = _sender()
    if not sender_addr:
        raise EmailNotConfigured("Set EMAIL_FROM to the Gmail address that approved FitAI.")
    raw = base64.urlsafe_b64encode(_mime(to_email, subject, text, html, (sender_name, sender_addr)).as_bytes()).decode()
    try:
        r = httpx.post(GMAIL_SEND_URL, timeout=20, json={"raw": raw},
                       headers={"Authorization": f"Bearer {_gmail_access_token()}"})
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gmail request failed ({type(e).__name__})") from None
    if r.status_code == 401:  # token revoked or expired early: forget it so the next try refreshes
        _gmail_token.update(value="", expires=0.0)
    if r.status_code >= 300:
        msg = ""
        try:
            msg = r.json().get("error", {}).get("message", "")
        except Exception:
            pass
        raise RuntimeError(f"Gmail API {r.status_code}: {msg[:300]}")


def _send_brevo(to_email: str, name: str, subject: str, text: str, html: str) -> None:
    s = get_settings()
    sender_name, sender_addr = _sender()
    if not sender_addr:
        raise EmailNotConfigured("Set EMAIL_FROM to the sender address you verified in Brevo.")
    try:
        r = httpx.post(BREVO_URL, timeout=20, headers={"api-key": s.brevo_api_key, "accept": "application/json"},
                       json={"sender": {"name": sender_name, "email": sender_addr}, "to": [{"email": to_email, "name": name}],
                             "subject": subject, "textContent": text, "htmlContent": html})
    except httpx.HTTPError as e:
        # httpx errors can quote request headers (the API key), so only the error type is kept
        raise RuntimeError(f"Brevo request failed ({type(e).__name__})") from None
    if r.status_code >= 300:
        # Brevo's message explains the cause (e.g. unverified sender); it never contains the key
        raise RuntimeError(f"Brevo API {r.status_code}: {r.text[:300]}")


def _send_smtp(to_email: str, subject: str, text: str, html: str) -> None:
    s = get_settings()
    msg = EmailMessage()
    name_part, addr = _sender()
    msg["From"] = formataddr((name_part, addr or s.smtp_username))
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    ctx = ssl.create_default_context()
    if s.smtp_port == 465:
        with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=ctx, timeout=20) as server:
            server.login(s.smtp_username, s.smtp_password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as server:
            if s.smtp_use_tls:
                server.starttls(context=ctx)
            server.login(s.smtp_username, s.smtp_password)
            server.send_message(msg)
