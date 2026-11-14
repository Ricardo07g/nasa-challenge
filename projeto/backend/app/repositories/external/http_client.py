"""Reusable HTTP getters (JSON and text) with timeout and exponential backoff."""

import json
import logging
import time
import urllib.parse
import urllib.request
from collections.abc import Callable
from typing import Any

from app.constants import (
    EXTERNAL_API_BACKOFF_BASE_SECONDS,
    EXTERNAL_API_MAX_RETRIES,
    EXTERNAL_API_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)

HttpGetter = Callable[[str, dict[str, Any], float], dict[str, Any]]
TextHttpGetter = Callable[[str, dict[str, Any], float], str]
USER_AGENT = "RaizOrbital/1.0"


def _url_with_query(url: str, params: dict[str, Any]) -> str:
    query_pairs: list[tuple[str, str]] = []
    for key, val in params.items():
        if isinstance(val, (list, tuple)):
            for item in val:
                query_pairs.append((key, str(item)))
        else:
            query_pairs.append((key, str(val)))

    query_string = urllib.parse.urlencode(query_pairs)
    return f"{url}?{query_string}" if query_string else url


def _get_bytes(url: str, params: dict[str, Any], timeout: float, accept: str) -> bytes:
    req = urllib.request.Request(
        _url_with_query(url, params),
        headers={"Accept": accept, "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def default_http_get(
    url: str, params: dict[str, Any], timeout: float = EXTERNAL_API_TIMEOUT_SECONDS
) -> dict[str, Any]:
    """Performs a GET request returning parsed JSON with a strict timeout."""
    raw_bytes = _get_bytes(url, params, timeout, accept="application/json")
    result: dict[str, Any] = json.loads(raw_bytes.decode("utf-8"))
    return result


def default_http_get_text(
    url: str, params: dict[str, Any], timeout: float = EXTERNAL_API_TIMEOUT_SECONDS
) -> str:
    """Performs a GET request returning the body as UTF-8 text (ex.: CSV do THREDDS)."""
    return _get_bytes(url, params, timeout, accept="text/csv, text/plain, */*").decode("utf-8")


def get_with_retries[T](
    http_get: Callable[[str, dict[str, Any], float], T],
    url: str,
    params: dict[str, Any],
    timeout: float = EXTERNAL_API_TIMEOUT_SECONDS,
    max_retries: int = EXTERNAL_API_MAX_RETRIES,
    backoff_base: float = EXTERNAL_API_BACKOFF_BASE_SECONDS,
) -> T:
    """Executes any http_get (JSON or text) with exponential backoff retries on failure."""
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return http_get(url, params, timeout)
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "External HTTP request to %s failed on attempt %d/%d: %s",
                url,
                attempt + 1,
                max_retries + 1,
                exc,
            )
            if attempt < max_retries:
                time.sleep(backoff_base * (2**attempt))

    assert last_exc is not None
    raise last_exc


def get_json_with_retries(
    http_get: HttpGetter,
    url: str,
    params: dict[str, Any],
    timeout: float = EXTERNAL_API_TIMEOUT_SECONDS,
    max_retries: int = EXTERNAL_API_MAX_RETRIES,
    backoff_base: float = EXTERNAL_API_BACKOFF_BASE_SECONDS,
) -> dict[str, Any]:
    """Executes a JSON http_get with exponential backoff retries on failure."""
    return get_with_retries(http_get, url, params, timeout, max_retries, backoff_base)
