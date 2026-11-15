"""Integration tests for GET /api/raio-x (tela 4 "O que o satélite viu", tarefa 0043).

Clima, solo, NDVI e culturas falsos do conftest (nada de arquivo, banco ou rede).
"""

from fastapi.testclient import TestClient

from app.constants import PROBLEM_JSON_MEDIA_TYPE

UFU = {"lat": -18.9543, "lon": -48.1993, "colheita": "meio"}

BLOCKS = {"solo", "agua", "umidade", "verde", "chuva", "veranico", "calor", "regiao"}


def test_should_answer_the_x_ray_of_the_point(client: TestClient) -> None:
    response = client.get("/api/raio-x", params=UFU)

    assert response.status_code == 200
    body = response.json()
    assert body["ponto"] == {"lat": -18.9543, "lon": -48.1993}
    assert body["celula_id"] == "-190_-482"
    assert set(body) >= BLOCKS
    assert set(body["alertas"]) == {"geada", "chuva_forte", "fogo"}
    assert set(body["cartoes"]) == {"chuva_20_anos", "clima_futuro"}
    assert body["altitude_m"] is None


def test_should_bring_the_soil_the_water_and_the_ndvi_strip(client: TestClient) -> None:
    body = client.get("/api/raio-x", params=UFU).json()

    assert body["solo"] == {
        "textura": "argiloso",
        "argila_pct": 42.5,
        "areia_pct": 38.0,
        "cad_mm": 60.0,
        "vizinho_km": None,
    }
    assert body["agua"]["cad_mm"] == 60.0
    assert body["agua"]["cultura"] == body["cartoes"]["chuva_20_anos"]["cultura"]
    assert body["agua"]["fonte_eto"] == "nasa_power"
    strip = body["historico_ndvi"]
    assert len(strip["colunas"]) == 14
    assert [row["ano"] for row in strip["anos"]] == list(range(2017, 2027))
    assert strip["colheita_dia"] == "02-18"
    assert body["verde"]["ultimo_data"] == "2026-06-10"


def test_should_give_the_same_best_option_as_the_recommendation(client: TestClient) -> None:
    card = client.get("/api/raio-x", params={**UFU, "solo": "arenoso"}).json()["cartoes"]
    rec = client.get("/api/recomendacao", params={**UFU, "solo": "arenoso"}).json()

    melhor = next(o for o in rec["opcoes"] if o["id"] == rec["melhor"])
    assert card["chuva_20_anos"] == {
        "cultura": melhor["id"],
        "nome": melhor["nome"],
        "anos_bons": melhor["chuva"]["anos_bons"],
        "total_anos": melhor["chuva"]["anos"],
    }


def test_should_bring_the_heavy_rain_alert_from_the_cell_series(client: TestClient) -> None:
    # A célula falsa chove 8 mm por dia: nenhum dia de 50 mm, sem alerta de chuva forte; com a
    # mínima de 18 °C, sem geada.
    alertas = client.get("/api/raio-x", params=UFU).json()["alertas"]

    assert alertas == {"geada": None, "chuva_forte": None, "fogo": None}


def test_should_accept_the_seasons_the_producer_confirmed(client: TestClient) -> None:
    response = client.get("/api/raio-x", params={**UFU, "confirmadas": "2025:parado"})

    assert response.status_code == 200


def test_should_refuse_an_invalid_harvest_band(client: TestClient) -> None:
    response = client.get("/api/raio-x", params={**UFU, "colheita": "agosto"})

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_REQUEST"


def test_should_answer_outside_area_for_a_point_without_data(client: TestClient) -> None:
    response = client.get("/api/raio-x", params={"lat": -23.55, "lon": -46.63, "colheita": "meio"})

    assert response.status_code == 404
    assert response.headers["content-type"].startswith(PROBLEM_JSON_MEDIA_TYPE)
    assert response.json()["code"] == "OUTSIDE_AREA"
