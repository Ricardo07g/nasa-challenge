"""Integration tests for GET /api/safra-passada (P4, contrato do front em models/pastSeason.ts).

Usa os repositories falsos do conftest.py: dados só perto de Uberlândia, 2007 e 2014 sem chuva de
fevereiro a junho, e nenhum dia de calor.
"""

import pytest
from fastapi.testclient import TestClient

from app.constants import PROBLEM_BASE_URI, PROBLEM_JSON_MEDIA_TYPE

UFU = {"lat": -18.9543, "lon": -48.1993}
EVENT_TYPES = {
    "semeadura",
    "sem_chuva",
    "aviso_veranico",
    "fase_critica",
    "voltou_chuva",
    "aviso_calor",
    "colheita",
}


def test_should_return_the_past_season_in_the_contract_shape_used_by_the_front(
    client: TestClient,
) -> None:
    response = client.get("/api/safra-passada", params={**UFU, "ano": 2007})

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"ano", "opcao", "eventos"}
    assert body["ano"] == 2007
    # A opção do replay é a melhor do /recomendacao para o mesmo ponto e a mesma colheita.
    melhor = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()["melhor"]
    assert body["opcao"] == melhor
    assert all(set(e) == {"data", "tipo", "texto"} for e in body["eventos"])
    assert {e["tipo"] for e in body["eventos"]} <= EVENT_TYPES
    assert body["eventos"][0]["data"] == "2007-02-18"
    assert body["eventos"][0]["tipo"] == "semeadura"
    assert body["eventos"][0]["texto"].startswith("Semeadura: ")
    assert "aviso_veranico" in {e["tipo"] for e in body["eventos"]}
    # Ciclo de 100 dias nos falsos: colheita em 29/mai.
    assert body["eventos"][-1]["data"] == "2007-05-29"
    assert body["eventos"][-1]["tipo"] == "colheita"


def test_should_answer_a_good_year_without_warnings(client: TestClient) -> None:
    response = client.get("/api/safra-passada", params={**UFU, "ano": 2010})

    assert response.status_code == 200
    assert [e["tipo"] for e in response.json()["eventos"]] == [
        "semeadura",
        "fase_critica",
        "colheita",
    ]


def test_should_sow_on_the_date_of_the_harvest_band(client: TestClient) -> None:
    response = client.get("/api/safra-passada", params={**UFU, "ano": 2010, "colheita": "tarde"})

    assert response.status_code == 200
    assert response.json()["eventos"][0]["data"] == "2010-03-03"


def test_should_write_the_texts_in_english_when_asked(client: TestClient) -> None:
    response = client.get(
        "/api/safra-passada", params={**UFU, "ano": 2007}, headers={"Accept-Language": "en"}
    )

    texts = {e["tipo"]: e["texto"] for e in response.json()["eventos"]}
    assert texts["semeadura"].startswith("Sowing: ")
    assert texts["aviso_veranico"].startswith("Warning: ")


def test_should_return_404_problem_json_for_a_year_without_data(client: TestClient) -> None:
    response = client.get("/api/safra-passada", params={**UFU, "ano": 1990})

    assert response.status_code == 404
    assert response.headers["content-type"] == PROBLEM_JSON_MEDIA_TYPE
    body = response.json()
    assert body["code"] == "NOT_FOUND"
    assert body["type"] == f"{PROBLEM_BASE_URI}/NOT_FOUND"
    assert "1990" in body["detail"]


def test_should_return_404_outside_area_for_a_point_without_data(client: TestClient) -> None:
    response = client.get("/api/safra-passada", params={"lat": -23.55, "lon": -46.63, "ano": 2024})

    assert response.status_code == 404
    assert response.headers["content-type"] == PROBLEM_JSON_MEDIA_TYPE
    assert response.json()["code"] == "OUTSIDE_AREA"


@pytest.mark.parametrize(
    ("params", "invalid_field"),
    [
        ({**UFU, "ano": "dois mil"}, "ano"),
        (UFU, "ano"),
        ({"lat": -91.0, "lon": UFU["lon"], "ano": 2024}, "lat"),
        ({**UFU, "ano": 2024, "colheita": "invalida"}, "colheita"),
    ],
)
def test_should_answer_invalid_request_as_problem_json_with_the_invalid_field(
    client: TestClient, params: dict[str, object], invalid_field: str
) -> None:
    response = client.get("/api/safra-passada", params=params)

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM_JSON_MEDIA_TYPE
    body = response.json()
    assert body["code"] == "INVALID_REQUEST"
    assert body["detail"] == f"Parâmetro inválido: {invalid_field}"
    assert [(p["name"], p["in"]) for p in body["invalid_params"]] == [(invalid_field, "query")]
