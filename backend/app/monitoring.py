"""Error reporting with Sentry. Switched off unless SENTRY_DSN is set, so local runs and tests send nothing.

Privacy: reports carry the error, the stack trace and the request path only. Request bodies, query
strings, cookies, headers and anything that identifies the person are removed before sending
(see the Privacy Policy, which promises this)."""
import logging

from app.config import get_settings

log = logging.getLogger("fitai")
_KEEP_HEADERS = {"user-agent", "content-type"}


def scrub(event: dict, _hint: dict | None = None) -> dict:
    req = event.get("request")
    if isinstance(req, dict):
        for k in ("data", "cookies", "query_string", "env"):
            req.pop(k, None)
        h = req.get("headers")
        if isinstance(h, dict):
            req["headers"] = {k: v for k, v in h.items() if k.lower() in _KEEP_HEADERS}
        if isinstance(req.get("url"), str):
            req["url"] = req["url"].split("?", 1)[0]
    event.pop("user", None)
    # local variables in stack frames could hold someone's meals or messages
    for exc in (event.get("exception") or {}).get("values", []) or []:
        for fr in ((exc.get("stacktrace") or {}).get("frames") or []):
            fr.pop("vars", None)
    for crumb in (event.get("breadcrumbs") or {}).get("values", []) or []:
        crumb.pop("data", None)
    return event


def init_sentry() -> bool:
    s = get_settings()
    if not s.sentry_dsn:
        return False
    try:
        import sentry_sdk
    except ImportError:  # the package is optional for local development
        log.warning("SENTRY_DSN is set but sentry-sdk isn't installed; error reports are off")
        return False
    sentry_sdk.init(
        dsn=s.sentry_dsn, environment=s.environment, send_default_pii=False, include_local_variables=False,
        traces_sample_rate=0.0, max_request_body_size="never", before_send=scrub, before_send_transaction=lambda e, h: None,
    )
    log.info("Sentry error reporting is on")
    return True


def report(exc: BaseException) -> None:
    """Send an error we handled ourselves (does nothing when Sentry is off)."""
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    except ImportError:
        pass
