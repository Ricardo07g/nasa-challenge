"""Reusable HTTP JSON getter with timeout and exponential backoff."""

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


def default_http_get(
    url: str, params: dict[str, Any], timeout: float = EXTERNAL_API_TIMEOUT_SECONDS
) -> dict[str, Any]:
    """Performs a GET request returning parsed JSON with a strict timeout."""
    query_pairs: list[tuple[str, str]] = []
    for key, val in params.items():
        if isinstance(val, (list, tuple)):
            for item in val:
                query_pairs.append((key, str(item)))
        else:
            query_pairs.append((key, str(val)))

    query_string = urllib.parse.urlencode(query_pairs)
    full_url = f"{url}?{query_string}" if query_string else url
    req = urllib.request.Request(
        full_url,
        headers={"Accept": "application/json", "User-Agent": "RaizOrbital/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw_bytes = response.read()
        result: dict[str, Any] = json.loads(raw_bytes.decode("utf-8"))
        return result


def get_json_with_retries(
    http_get: HttpGetter,
    url: str,
    params: dict[str, Any],
    timeout: float = EXTERNAL_API_TIMEOUT_SECONDS,
    max_retries: int = EXTERNAL_API_MAX_RETRIES,
    backoff_base: float = EXTERNAL_API_BACKOFF_BASE_SECONDS,
) -> dict[str, Any]:
    """Executes http_get with exponential backoff retries on failure."""
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
