"""Integration tests for GET /api/talhao endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_should_return_200_and_field_inspection_when_coordinates_inside_area() -> None:
    response = client.get("/api/talhao", params={"lat": -18.9186, "lon": -48.2772})

    assert response.status_code == 200
    body = response.json()
    assert body["dentro_da_area"] is True
    assert body["celula_id"] == "-189_-483"
    assert body["ponto"] == {"lat": -18.9186, "lon": -48.2772}
    assert body["solo"]["textura"] == "argiloso"
    assert body["solo"]["cad_mm"] == 60.0
    assert body["colheita_sugerida"]["faixa"] in ("cedo", "meio", "tarde")
    assert body["historico"] is not None
    assert body["historico"]["total"] == 10
    assert body["historico"]["parado"] == 4
    assert body["historico"]["fonte"] == "modis_mod13q1"


def test_should_return_dentro_da_area_false_when_coordinates_outside_pilot_box() -> None:
    response = client.get("/api/talhao", params={"lat": -23.55, "lon": -46.63})

    assert response.status_code == 200
    body = response.json()
    assert body["dentro_da_area"] is False
    assert body["celula_id"] is None
