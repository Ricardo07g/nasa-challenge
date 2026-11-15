"""Integration tests for GET /api/custo-atraso (tela 3, tarefa 0042).

Clima, solo e culturas falsos do conftest (nada de arquivo, banco ou rede).
"""

from fastapi.testclient import TestClient

from app.constants import PROBLEM_JSON_MEDIA_TYPE

UFU = {"lat": -18.9543, "lon": -48.1993}


def test_should_give_the_best_option_of_each_harvest_band(client: TestClient) -> None:
    response = client.get("/api/custo-atraso", params=UFU)

    assert response.status_code == 200
    body = response.json()
    assert [f["colheita"] for f in body["faixas"]] == ["cedo", "meio", "tarde"]
    assert [f["semeadura"] for f in body["faixas"]] == ["2027-02-08", "2027-02-18", "2027-03-03"]
    assert set(body["faixas"][0]) == {
        "colheita",
        "semeadura",
        "melhor",
        "nome",
        "anos_bons",
        "total_anos",
    }
    assert isinstance(body["mesma_cultura"], bool)


def test_should_give_the_same_numbers_as_the_recommendation_of_each_band(
    client: TestClient,
) -> None:
    # Os números vêm do motor: a melhor opção e os anos bons dela, iguais aos do /recomendacao.
    faixas = client.get("/api/custo-atraso", params={**UFU, "solo": "arenoso"}).json()["faixas"]

    for faixa in faixas:
        rec = client.get(
            "/api/recomendacao", params={**UFU, "colheita": faixa["colheita"], "solo": "arenoso"}
        ).json()
        melhor = next(o for o in rec["opcoes"] if o["id"] == rec["melhor"])
        assert (faixa["melhor"], faixa["nome"]) == (melhor["id"], melhor["nome"])
        assert (faixa["anos_bons"], faixa["total_anos"]) == (
            melhor["chuva"]["anos_bons"],
            melhor["chuva"]["anos"],
        )


def test_should_accept_the_seasons_the_producer_confirmed(client: TestClient) -> None:
    response = client.get("/api/custo-atraso", params={**UFU, "confirmadas": "2025:parado"})

    assert response.status_code == 200


def test_should_answer_outside_area_for_a_point_without_data(client: TestClient) -> None:
    response = client.get("/api/custo-atraso", params={"lat": -23.55, "lon": -46.63})

    assert response.status_code == 404
    assert response.headers["content-type"].startswith(PROBLEM_JSON_MEDIA_TYPE)
    assert response.json()["code"] == "OUTSIDE_AREA"


def test_should_refuse_an_unknown_soil(client: TestClient) -> None:
    response = client.get("/api/custo-atraso", params={**UFU, "solo": "pedregoso"})

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_REQUEST"
