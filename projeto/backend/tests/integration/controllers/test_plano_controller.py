"""Integration tests for GET /api/plano (aba "Plano de 3 anos", seção 5.6, tarefa 0045).

Clima, solo e culturas falsos do conftest (nada de arquivo, banco ou rede).
"""

import pytest
from fastapi.testclient import TestClient

from app.constants import PROBLEM_JSON_MEDIA_TYPE
from app.dependencies import get_enso_forecast_repository
from app.main import app
from tests.integration.controllers.test_recomendacao_controller import FakeEnsoForecastRepository

UFU = {"lat": -18.9543, "lon": -48.1993}
PLANO = "milho_braquiaria,sorgo,crotalaria"


def test_should_evaluate_any_three_year_plan(client: TestClient) -> None:
    response = client.get("/api/plano", params={**UFU, "colheita": "meio", "anos": PLANO})

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "colheita",
        "semeadura",
        "anos",
        "notas",
        "terra",
        "chuva",
        "plano_ab",
        "sinal",
    }
    assert body["sinal"] is None  # sem a previsão do ENSO no conftest, sem sinal
    assert (body["colheita"], body["semeadura"]) == ("meio", "2027-02-18")
    assert [a["cultura"] for a in body["anos"]] == PLANO.split(",")
    assert set(body["anos"][0]) == {
        "cultura",
        "nome",
        "na_janela",
        "anos_bons",
        "total_anos",
        "futuro_anos_bons",
        "sede",
        "cobre_terra",
        "deixa_nitrogenio",
        "quebra_nematoide",
        "usa_mm",
    }
    assert set(body["notas"]) == {"seguranca", "solo", "futuro"}
    assert set(body["terra"]) == {
        "anos_cobertos",
        "anos_nitrogenio",
        "anos_nematoide",
        "repetidas",
        "total",
        "bonus_diversidade",
    }
    assert set(body["chuva"]) == {"inicio", "fim", "chuva_mm", "usa_media_mm", "anos", "fonte"}
    assert {"cultura_a", "nome_a", "falhas_a", "total", "cultura_b", "nome_b"} <= set(
        body["plano_ab"]
    )


def test_should_give_the_same_numbers_as_the_recommendation(client: TestClient) -> None:
    # Nada é recalculado fora do motor: os anos bons de cada cultura são os do /recomendacao.
    plano = client.get("/api/plano", params={**UFU, "colheita": "meio", "anos": PLANO}).json()
    rec = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    opcoes = {o["id"]: o for o in rec["opcoes"]}
    for ano in plano["anos"]:
        opcao = opcoes[ano["cultura"]]
        assert (ano["anos_bons"], ano["total_anos"], ano["sede"]) == (
            opcao["chuva"]["anos_bons"],
            opcao["chuva"]["anos"],
            opcao["agua"]["sede"],
        )
        assert ano["nome"] == opcao["nome"]


def test_should_give_the_autumn_signal_of_the_plan_on_screen(client: TestClient) -> None:
    # S9 (tarefa 0049): com o plano editado, o sinal fala do Plano A que a tela mostra, e com o
    # plano sugerido, dá o mesmo veredito do /recomendacao (que vai para o aviso de El Niño).
    app.dependency_overrides[get_enso_forecast_repository] = FakeEnsoForecastRepository
    rec = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()
    sugerido = ",".join(rec["plano_3_anos"]["normal"]["anos"])

    mesmo = client.get("/api/plano", params={**UFU, "colheita": "meio", "anos": sugerido}).json()
    editado = client.get("/api/plano", params={**UFU, "colheita": "meio", "anos": PLANO}).json()

    assert mesmo["sinal"] == rec["sinal"]
    assert set(editado["sinal"]) == {"nivel", "motivo", "fonte", "data", "smap_agora"}
    assert "milho_braquiaria" in editado["sinal"]["motivo"]  # o nome da cultura do conftest


def test_should_take_the_language_from_accept_language(client: TestClient) -> None:
    response = client.get(
        "/api/plano",
        params={**UFU, "anos": "pousio,pousio,crotalaria"},
        headers={"Accept-Language": "en"},
    )

    assert response.status_code == 200
    assert response.json()["notas"]["seguranca"] is not None


@pytest.mark.parametrize(
    "anos", ["sorgo,sorgo", "sorgo,trigo,sorgo", "sorgo,sorgo,sorgo,sorgo", ",,"]
)
def test_should_refuse_a_plan_without_three_known_crops(client: TestClient, anos: str) -> None:
    response = client.get("/api/plano", params={**UFU, "anos": anos})

    assert response.status_code == 422
    assert response.headers["content-type"].startswith(PROBLEM_JSON_MEDIA_TYPE)
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_should_require_the_plan(client: TestClient) -> None:
    response = client.get("/api/plano", params=UFU)

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_REQUEST"


def test_should_refuse_an_unknown_harvest_band(client: TestClient) -> None:
    response = client.get("/api/plano", params={**UFU, "anos": PLANO, "colheita": "agosto"})

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_REQUEST"


def test_should_answer_outside_area_for_a_point_without_data(client: TestClient) -> None:
    response = client.get("/api/plano", params={"lat": -23.55, "lon": -46.63, "anos": PLANO})

    assert response.status_code == 404
    assert response.json()["code"] == "OUTSIDE_AREA"
