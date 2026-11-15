"""Rotas dos relatos da comunidade (tarefa 0047), com o service ligado a um repository falso."""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_community_report_service
from app.main import app
from app.repositories.rules_repository import load_default_rules
from app.services.community_report_service import CommunityReportService
from tests.community_fakes import FakeCropRepository, FakeReportRepository

NOW = datetime(2026, 11, 15, 15, 0, tzinfo=UTC)
DEVICE = "a1b2c3d4-e5f6-4789-8abc-def012345678"
OTHER_DEVICE = "ffffffff-e5f6-4789-8abc-def012345678"
PATH = "/api/comunidade/relatos"
RAIN = {
    "tipo": "chuva",
    "subtipo": None,
    "valores": {"mm": 32.46},
    "lat": -18.9543,
    "lon": -48.1993,
    "data_fato": "2026-11-15",
}
RESPONSE_FIELDS = {"id", "tipo", "subtipo", "valores", "celula", "lat", "lon", "data_fato", "meu"}


def _service(repository: FakeReportRepository | None) -> CommunityReportService:
    return CommunityReportService(
        repository=repository,
        crop_repo=FakeCropRepository(),
        rules=load_default_rules(),
        salt="sal-de-teste",
        now=lambda: NOW,
    )


@pytest.fixture
def repository() -> FakeReportRepository:
    return FakeReportRepository()


@pytest.fixture
def client(repository: FakeReportRepository) -> Iterator[TestClient]:
    app.dependency_overrides[get_community_report_service] = lambda: _service(repository)
    yield TestClient(app)
    app.dependency_overrides.clear()


def _problem(response: Any, status: int, code: str) -> dict[str, Any]:
    assert response.status_code == status
    assert response.headers["content-type"] == "application/problem+json"
    body: dict[str, Any] = response.json()
    assert body["status"] == status
    assert body["code"] == code
    assert body["detail"]
    return body


def test_post_keeps_the_cell_and_answers_as_the_neighbors_see_it(
    client: TestClient, repository: FakeReportRepository
) -> None:
    response = client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE})

    assert response.status_code == 201
    body = response.json()
    assert body == {
        "id": repository.reports[0].id,
        "tipo": "chuva",
        "subtipo": None,
        "valores": {"mm": 32.5},
        "celula": "-190_-482",
        "lat": -18.95,
        "lon": -48.15,
        "data_fato": "2026-11-15",
        "meu": True,
    }
    assert "-18.9543" not in response.text
    assert DEVICE not in response.text


def test_post_without_the_device_id_is_an_invalid_request(client: TestClient) -> None:
    body = _problem(client.post(PATH, json=RAIN), 422, "INVALID_REQUEST")

    assert any("aparelho" in str(p["name"]).lower() for p in body["invalid_params"])


def test_post_refuses_extra_fields_such_as_a_name(client: TestClient) -> None:
    payload = {**RAIN, "nome": "José da Silva"}

    _problem(
        client.post(PATH, json=payload, headers={"X-Aparelho": DEVICE}), 422, "INVALID_REQUEST"
    )


def test_post_with_a_value_out_of_the_rules_is_a_validation_error(client: TestClient) -> None:
    payload = {**RAIN, "valores": {"mm": 301}}

    body = _problem(
        client.post(PATH, json=payload, headers={"X-Aparelho": DEVICE}), 422, "VALIDATION_ERROR"
    )
    assert "300 mm" in str(body["detail"])


def test_post_over_the_daily_limit_is_too_many_requests(client: TestClient) -> None:
    for _ in range(10):
        assert client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE}).status_code == 201

    _problem(client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE}), 429, "TOO_MANY_REPORTS")


def test_get_lists_the_nearby_reports_and_marks_mine(client: TestClient) -> None:
    client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE})
    client.post(PATH, json=RAIN, headers={"X-Aparelho": OTHER_DEVICE})

    response = client.get(
        PATH, params={"lat": -18.9543, "lon": -48.1993}, headers={"X-Aparelho": DEVICE}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["raio_km"] == 30.0
    assert body["anos_safra"] == [2024, 2025, 2026]
    assert sorted(item["meu"] for item in body["relatos"]) == [False, True]
    # Só os campos do vizinho: nada do aparelho nem da hora do envio.
    assert {key for item in body["relatos"] for key in item} == RESPONSE_FIELDS


def test_get_without_device_id_marks_nothing_as_mine(client: TestClient) -> None:
    client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE})

    body = client.get(PATH, params={"lat": -18.9543, "lon": -48.1993}).json()

    assert [item["meu"] for item in body["relatos"]] == [False]


def test_get_with_a_radius_over_the_maximum_is_a_validation_error(client: TestClient) -> None:
    response = client.get(PATH, params={"lat": -18.9543, "lon": -48.1993, "raio_km": 60})

    _problem(response, 422, "VALIDATION_ERROR")


def test_get_with_an_invalid_point_is_an_invalid_request(client: TestClient) -> None:
    _problem(client.get(PATH, params={"lat": -95, "lon": -48.2}), 422, "INVALID_REQUEST")


def test_delete_my_own_report(client: TestClient, repository: FakeReportRepository) -> None:
    report_id = client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE}).json()["id"]

    response = client.delete(f"{PATH}/{report_id}", headers={"X-Aparelho": DEVICE})

    assert response.status_code == 204
    assert response.content == b""
    assert repository.reports == []


def test_delete_a_report_from_another_device_is_not_found(client: TestClient) -> None:
    report_id = client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE}).json()["id"]

    response = client.delete(f"{PATH}/{report_id}", headers={"X-Aparelho": OTHER_DEVICE})

    _problem(response, 404, "NOT_FOUND")


def test_delete_with_an_id_that_is_not_a_uuid_is_an_invalid_request(client: TestClient) -> None:
    response = client.delete(f"{PATH}/123", headers={"X-Aparelho": DEVICE})

    _problem(response, 422, "INVALID_REQUEST")


def test_without_a_database_the_routes_answer_service_unavailable() -> None:
    app.dependency_overrides[get_community_report_service] = lambda: _service(None)
    client = TestClient(app)
    try:
        post = client.post(PATH, json=RAIN, headers={"X-Aparelho": DEVICE})
        get = client.get(PATH, params={"lat": -18.9543, "lon": -48.1993})
        delete = client.delete(
            f"{PATH}/a1b2c3d4-e5f6-4789-8abc-def012345678", headers={"X-Aparelho": DEVICE}
        )
    finally:
        app.dependency_overrides.clear()

    for response in (post, get, delete):
        _problem(response, 503, "COMMUNITY_UNAVAILABLE")
