from app.monitoring import scrub


def test_error_reports_carry_no_personal_data():
    event = {
        "request": {"url": "https://api/x/nutrition/log?q=paneer", "method": "POST", "data": {"food": "paneer"},
                    "cookies": {"a": "b"}, "query_string": "q=paneer",
                    "headers": {"Authorization": "Bearer secret", "User-Agent": "Phone", "Cookie": "x"}},
        "user": {"email": "me@example.com"},
        "exception": {"values": [{"stacktrace": {"frames": [{"function": "f", "vars": {"meal": "dal"}}]}}]},
        "breadcrumbs": {"values": [{"message": "query", "data": {"sql": "insert ..."}}]},
    }
    out = scrub(event)
    req = out["request"]
    assert req["url"] == "https://api/x/nutrition/log" and req["method"] == "POST"
    assert "data" not in req and "cookies" not in req and "query_string" not in req
    assert req["headers"] == {"User-Agent": "Phone"}
    assert "user" not in out
    assert "vars" not in out["exception"]["values"][0]["stacktrace"]["frames"][0]
    assert "data" not in out["breadcrumbs"]["values"][0]


def test_sentry_stays_off_without_a_dsn():
    from app.monitoring import init_sentry
    assert init_sentry() is False


def test_rate_limiter_forgets_old_keys(monkeypatch):
    import app.utils.http as h
    clock = [1000.0]
    monkeypatch.setattr(h.time, "time", lambda: clock[0])
    lim = h.SlidingWindowLimiter(limit=2, window=60)
    assert lim.allow("a@example.com") and lim.allow("a@example.com")
    assert not lim.allow("a@example.com")
    lim.allow("b@example.com")
    clock[0] += 61
    assert lim.allow("c@example.com")           # triggers the sweep
    assert set(lim._hits) == {"c@example.com"}  # a and b are gone, not kept forever
    assert lim.allow("a@example.com")           # and a is allowed again
