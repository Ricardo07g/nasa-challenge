"""Integration tests for GET /api/talhao (contrato do plano técnico §3.1)."""

from fastapi.testclient import TestClient


def test_should_return_field_inspection_in_the_contract_shape(client: TestClient) -> None:
    response = client.get("/api/talhao", params={"lat": -18.9543, "lon": -48.1993})

    assert response.status_code == 200
    body = response.json()
    assert body["ponto"] == {"lat": -18.9543, "lon": -48.1993}
    assert body["celula_id"] == "-190_-482"
    assert body["dentro_da_area"] is True
    assert body["solo"] == {"textura": "argiloso", "cad_mm": 60.0, "fonte": "soilgrids"}
    assert body["colheita_sugerida"] == {"faixa": "meio", "fonte": "ndvi_modis", "anos_usados": 10}
    assert body["historico"]["total"] == 10
    assert body["historico"]["parado"] == 5
    assert body["historico"]["fonte"] == "modis_mod13q1"
    assert body["historico"]["anos"][0] == {"ano": 2015, "situacao": "plantou", "ndvi_max": 0.71}
    assert body["dados"] == [
        {"fonte": "nasa_power", "periodo": "2005-2024", "cenario": None, "modelos": None}
    ]


def test_should_return_dentro_da_area_false_when_point_has_no_data(client: TestClient) -> None:
    response = client.get("/api/talhao", params={"lat": -23.55, "lon": -46.63})

    assert response.status_code == 200
    body = response.json()
    assert body["dentro_da_area"] is False
    assert body["celula_id"] is None
    assert body["dados"] == []
