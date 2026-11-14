"""Testes do pedido HTTP genérico (POST, cabeçalhos e download), sem rede real."""

import io
import json
import urllib.error
import urllib.request
from typing import Any

from app.repositories.external.http_client import HttpRequest, default_http_request


class FakeUrlopen:
    """Guarda o `Request` montado e devolve uma resposta pronta (ou levanta o erro dado)."""

    def __init__(self, body: bytes = b"", error: Exception | None = None) -> None:
        self._body = body
        self._error = error
        self.requests: list[urllib.request.Request] = []
        self.timeouts: list[float] = []

    def __call__(self, req: urllib.request.Request, timeout: float) -> Any:
        self.requests.append(req)
        self.timeouts.append(timeout)
        if self._error is not None:
            raise self._error
        return _FakeResponse(self._body)


class _FakeResponse(io.BytesIO):
    status = 200
    headers: dict[str, str] = {"Content-Type": "application/json"}

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


def test_should_send_json_body_and_keep_authorization_out_of_redirects() -> None:
    # O download do AppEEARS redireciona para o S3: o token não pode seguir no redirecionamento.
    opener = FakeUrlopen(body=b'{"task_id": "tarefa-de-teste"}')
    request = HttpRequest(
        method="POST",
        url="https://exemplo.test/api/task",
        json_body={"task_type": "point"},
        authorization="Bearer valor-de-teste",
    )

    response = default_http_request(request, timeout=5.0, opener=opener)

    sent = opener.requests[0]
    assert sent.get_method() == "POST"
    assert json.loads(sent.data or b"") == {"task_type": "point"}
    assert sent.get_header("Content-type") == "application/json"
    assert sent.unredirected_hdrs["Authorization"] == "Bearer valor-de-teste"
    assert "Authorization" not in sent.headers
    assert opener.timeouts == [5.0]
    assert response.status == 200
    assert response.json() == {"task_id": "tarefa-de-teste"}


def test_should_return_the_status_of_an_http_error_instead_of_raising() -> None:
    error = urllib.error.HTTPError(
        "https://exemplo.test/api/task",
        403,
        "Forbidden",
        hdrs=None,  # type: ignore[arg-type]
        fp=io.BytesIO(b'{"message": "sem permissao"}'),
    )
    opener = FakeUrlopen(error=error)

    response = default_http_request(
        HttpRequest(method="GET", url="https://exemplo.test/api/task"), timeout=5.0, opener=opener
    )

    assert response.status == 403
    assert response.json() == {"message": "sem permissao"}


def test_should_send_query_params_on_get() -> None:
    opener = FakeUrlopen(body=b"[]")

    default_http_request(
        HttpRequest(method="GET", url="https://exemplo.test/api/task", params={"limit": 1}),
        timeout=5.0,
        opener=opener,
    )

    assert opener.requests[0].full_url == "https://exemplo.test/api/task?limit=1"
    assert opener.requests[0].data is None
