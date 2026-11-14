"""Reusable HTTP getters (JSON and text) with retries, and a generic request (POST, download)."""

import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
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


@dataclass(frozen=True)
class HttpRequest:
    """Pedido HTTP genérico (GET, POST, download).

    `authorization` vai como cabeçalho que **não** segue redirecionamento: o download do AppEEARS
    redireciona para uma URL assinada do S3, que recusa um segundo meio de autenticação.
    """

    method: str
    url: str
    params: Mapping[str, Any] = field(default_factory=dict)
    json_body: Any = None
    authorization: str | None = None
    headers: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class HttpResponse:
    """Resposta crua: o status volta mesmo em 4xx/5xx, para quem chamou decidir o que fazer."""

    status: int
    body: bytes

    def json(self) -> Any:
        return json.loads(self.body.decode("utf-8")) if self.body else None

    def text(self) -> str:
        return self.body.decode("utf-8-sig")


HttpTransport = Callable[[HttpRequest, float], HttpResponse]


def _build_url(url: str, params: Mapping[str, Any]) -> str:
    return _url_with_query(url, dict(params))


def default_http_request(
    request: HttpRequest,
    timeout: float = EXTERNAL_API_TIMEOUT_SECONDS,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> HttpResponse:
    """Faz o pedido e devolve status + corpo. Erro HTTP vira `HttpResponse`; erro de rede sobe."""
    data: bytes | None = None
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT, **request.headers}
    if request.json_body is not None:
        data = json.dumps(request.json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        _build_url(request.url, request.params),
        data=data,
        headers=headers,
        method=request.method,
    )
    if request.authorization is not None:
        req.add_unredirected_header("Authorization", request.authorization)
    try:
        with opener(req, timeout=timeout) as response:
            return HttpResponse(status=int(response.status), body=response.read())
    except urllib.error.HTTPError as exc:
        return HttpResponse(status=exc.code, body=exc.read() if exc.fp is not None else b"")


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
