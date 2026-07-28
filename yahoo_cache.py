"""
In-memory TTL cache + retry/backoff for Yahoo Finance (yfinance) calls.

Option A: cache successful responses so repeat FETCH/DCF hit memory, not Yahoo.
Option D: on rate-limit errors, wait and retry with exponential backoff.
Also serves slightly stale cache if Yahoo is still rate-limiting.
"""

from __future__ import annotations

import time
import threading
from typing import Any, Callable, Optional, TypeVar

T = TypeVar("T")

# Defaults tuned for free-tier demos (phone + friends)
DEFAULT_TTL_SECONDS = 15 * 60  # 15 minutes fresh cache
STALE_TTL_SECONDS = 6 * 60 * 60  # serve up to 6h stale if Yahoo is blocked
MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 1.5

_lock = threading.Lock()
# key -> (expires_at, hard_expires_at, value)
_store: dict[str, tuple[float, float, Any]] = {}


def _is_rate_limit_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    markers = (
        "too many requests",
        "rate limit",
        "rate limited",
        "429",
        "temporarily blocked",
        "try after a while",
    )
    return any(m in msg for m in markers)


def cache_get(key: str) -> Optional[Any]:
    """Return fresh cache value, or None if missing/expired."""
    now = time.time()
    with _lock:
        item = _store.get(key)
        if not item:
            return None
        expires_at, _hard, value = item
        if now <= expires_at:
            return value
    return None


def cache_get_stale(key: str) -> Optional[Any]:
    """Return value even if soft-expired, until hard expiry."""
    now = time.time()
    with _lock:
        item = _store.get(key)
        if not item:
            return None
        _expires_at, hard_expires_at, value = item
        if now <= hard_expires_at:
            return value
        # fully expired
        _store.pop(key, None)
    return None


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL_SECONDS) -> None:
    now = time.time()
    with _lock:
        _store[key] = (now + ttl, now + STALE_TTL_SECONDS, value)


def with_cache_and_retry(
    key: str,
    producer: Callable[[], T],
    ttl: int = DEFAULT_TTL_SECONDS,
    max_retries: int = MAX_RETRIES,
) -> T:
    """
    1) Return fresh cache if present.
    2) Else call producer() with retries/backoff on rate limits.
    3) On success, store cache.
    4) If all retries fail with rate limit, return stale cache if available.
    5) Otherwise re-raise / return producer's last error via exception.
    """
    cached = cache_get(key)
    if cached is not None:
        # Mark as served from cache for API consumers (dicts only)
        if isinstance(cached, dict) and "error" not in cached:
            out = dict(cached)
            out["_cached"] = True
            out["_cache_source"] = "fresh"
            return out  # type: ignore[return-value]
        return cached

    last_exc: Optional[BaseException] = None
    for attempt in range(max_retries):
        try:
            value = producer()
            # Don't cache pure error payloads as "success" forever —
            # but do short-cache rate-limit style errors to avoid stampede.
            if isinstance(value, dict) and value.get("error"):
                err = str(value.get("error", "")).lower()
                if any(m in err for m in ("too many", "rate limit", "429")):
                    # Prefer stale good data over a rate-limit error
                    stale = cache_get_stale(key)
                    if isinstance(stale, dict) and "error" not in stale:
                        out = dict(stale)
                        out["_cached"] = True
                        out["_cache_source"] = "stale"
                        out["_note"] = "Yahoo rate-limited; showing recent cached data."
                        return out  # type: ignore[return-value]
                    cache_set(key, value, ttl=30)  # brief negative cache
                    return value
                # other errors: don't pollute long cache
                return value

            cache_set(key, value, ttl=ttl)
            if isinstance(value, dict):
                out = dict(value)
                out["_cached"] = False
                out["_cache_source"] = "live"
                return out  # type: ignore[return-value]
            return value
        except Exception as exc:  # noqa: BLE001 — yfinance raises varied types
            last_exc = exc
            if _is_rate_limit_error(exc) and attempt < max_retries - 1:
                time.sleep(BASE_BACKOFF_SECONDS * (2 ** attempt))
                continue
            if _is_rate_limit_error(exc):
                stale = cache_get_stale(key)
                if stale is not None:
                    if isinstance(stale, dict):
                        out = dict(stale)
                        out["_cached"] = True
                        out["_cache_source"] = "stale"
                        out["_note"] = "Yahoo rate-limited; showing recent cached data."
                        return out  # type: ignore[return-value]
                    return stale
            raise

    if last_exc:
        raise last_exc
    raise RuntimeError("with_cache_and_retry failed without result")


def get_ticker_info_cached(symbol: str):
    """Shared stock.info cache so FETCH + DCF don't double-hit Yahoo."""
    import yfinance as yf

    key = f"info:{symbol.upper()}"

    def _load():
        stock = yf.Ticker(symbol)
        info = stock.info or {}
        if not info:
            raise RuntimeError("Empty Yahoo info payload (possible rate limit)")
        return info

    return with_cache_and_retry(key, _load, ttl=DEFAULT_TTL_SECONDS)
