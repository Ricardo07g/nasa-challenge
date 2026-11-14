"""Testes do cliente HTTP comum (urllib), sem rede: o `urlopen` é trocado por um falso."""

from typing import Any

import pytest

from app.repositories.external import http_client
from app.repositories.external.http_client import default_http_get_text, get_with_retries


class _FakeResponse:
    def __init__(self, body: bytes) -> None:
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *exc: object) -> None:
        return None


def test_should_return_text_body_with_query_string_and_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, Any] = {}

    def fake_urlopen(request: Any, timeout: float) -> _FakeResponse:
        seen["url"] = request.full_url
        seen["timeout"] = timeout
        return _FakeResponse(b"time,valor\n2000-01-01,1.0\n")

    monkeypatch.setattr(http_client.urllib.request, "urlopen", fake_urlopen)

    text = default_http_get_text(
        "https://exemplo.test/ncss", {"var": "pr", "latitude": -19.0}, timeout=30.0
    )

    assert text == "time,valor\n2000-01-01,1.0\n"
    assert seen == {"url": "https://exemplo.test/ncss?var=pr&latitude=-19.0", "timeout": 30.0}


def test_should_retry_any_getter_and_return_what_it_returns() -> None:
    calls: list[str] = []

    def flaky_getter(url: str, params: dict[str, Any], timeout: float) -> str:
        calls.append(url)
        if len(calls) == 1:
            raise TimeoutError("lento")
        return "texto"

    result = get_with_retries(
        flaky_getter, "https://exemplo.test", {}, timeout=1.0, max_retries=2, backoff_base=0.0
    )

    assert result == "texto"
    assert len(calls) == 2


def test_should_raise_last_error_after_all_retries() -> None:
    def broken_getter(url: str, params: dict[str, Any], timeout: float) -> str:
        raise ConnectionError("fora do ar")

    with pytest.raises(ConnectionError, match="fora do ar"):
        get_with_retries(
            broken_getter, "https://exemplo.test", {}, timeout=1.0, max_retries=1, backoff_base=0.0
        )
