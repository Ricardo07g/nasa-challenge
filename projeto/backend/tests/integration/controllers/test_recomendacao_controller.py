"""Integration tests for GET /api/recomendacao and GET /api/exemplo endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_should_return_complete_recommendation_when_valid_parameters_passed() -> None:
    response = client.get(
        "/api/recomendacao",
        params={"lat": -18.9186, "lon": -48.2772, "colheita": "meio"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["entrada"]["colheita"] == "meio"
    assert body["entrada"]["semeadura"] == "2027-02-18"
    assert body["entrada"]["nematoide"] is None
    assert len(body["opcoes"]) == 5
    assert body["fora_da_janela"] == []
    assert body["melhor"] in {o["id"] for o in body["opcoes"]}
    assert all(o["data_limite"] is not None for o in body["opcoes"])
    assert "normal" in body["plano_3_anos"]
    assert "seco" in body["plano_3_anos"]
    assert "hoje" in body["plano_3_anos"]


def test_should_filter_out_of_window_crops_and_parse_nematoide_boolean_when_harvest_is_tarde() -> (
    None
):
    response = client.get(
        "/api/recomendacao",
        params={
            "lat": -18.9186,
            "lon": -48.2772,
            "colheita": "tarde",
            "solo": "arenoso",
            "nematoide": "sim",
            "gado": "sim",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["entrada"]["colheita"] == "tarde"
    assert body["entrada"]["solo"] == "arenoso"
    assert body["entrada"]["nematoide"] is True
    assert body["entrada"]["gado"] is True

    in_window_ids = {o["id"] for o in body["opcoes"]}
    out_window_ids = {o["id"] for o in body["fora_da_janela"]}
    assert in_window_ids == {"sorgo", "milheto"}
    assert out_window_ids == {"milho_safrinha", "milho_braquiaria", "crotalaria"}


def test_should_return_422_problem_details_when_invalid_colheita_passed() -> None:
    response = client.get(
        "/api/recomendacao",
        params={"lat": -18.9186, "lon": -48.2772, "colheita": "invalida"},
    )

    assert response.status_code == 422
    assert "detail" in response.json()


def test_should_return_example_farm_payload_when_get_exemplo_called() -> None:
    response = client.get("/api/exemplo", headers={"Accept-Language": "en"})

    assert response.status_code == 200
    body = response.json()
    assert "talhao" in body
    assert "recomendacao" in body
    assert body["talhao"]["dentro_da_area"] is True
    assert body["recomendacao"]["entrada"]["colheita"] == "meio"
    assert len(body["recomendacao"]["opcoes"]) == 5
