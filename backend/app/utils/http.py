"""Shared outbound HTTP helpers: timeouts, tiny TTL cache and token-bucket rate limiting."""
import logging
import threading
import time
from collections import OrderedDict, defaultdict, deque

import httpx

from app.config import get_settings

log = logging.getLogger("fitai.http")


class TTLCache:
    def __init__(self, maxsize: int = 256, ttl: float = 3600):
        self.maxsize, self.ttl = maxsize, ttl
        self._d: OrderedDict = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            item = self._d.get(key)
            if not item:
                return None
            value, ts = item
            if time.time() - ts > self.ttl:
                self._d.pop(key, None)
                return None
            return value

    def set(self, key, value):
        with self._lock:
            self._d[key] = (value, time.time())
            self._d.move_to_end(key)
            while len(self._d) > self.maxsize:
                self._d.popitem(last=False)


class SlidingWindowLimiter:
    """Allows `limit` calls per `window` seconds per key."""

    def __init__(self, limit: int, window: float = 60.0):
        self.limit, self.window = limit, window
        self._hits: dict = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key="global") -> bool:
        now = time.time()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True


def http_get_json(url: str, params: dict | None = None, headers: dict | None = None) -> dict:
    s = get_settings()
    with httpx.Client(timeout=s.external_timeout_seconds, follow_redirects=True) as client:
        r = client.get(url, params=params, headers=headers or {})
        r.raise_for_status()
        return r.json()
