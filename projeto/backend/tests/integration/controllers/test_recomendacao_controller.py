"""Integration tests for GET /api/recomendacao and GET /api/exemplo (contrato do plano §3.2)."""

from dataclasses import replace
from datetime import date
from hashlib import sha256

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.constants import PROBLEM_BASE_URI, PROBLEM_JSON_MEDIA_TYPE
from app.dependencies import (
    get_ndvi_repository,
    get_rules_repository,
    get_seasonal_forecast_repository,
    get_soil_repository,
)
from app.main import app
from app.models.regras import Regras
from app.models.sinal_outono import SeasonalForecast
from app.models.talhao import NdviRecord, SoloInfo
from app.repositories.rules_repository import load_default_rules
from app.repositories.soil_repository import DEFAULT_SOIL

UFU = {"lat": -18.9543, "lon": -48.1993}
# Tarefa 0025 (ajusta o plano técnico §8): o navegador pode guardar a resposta, mas pergunta à API
# toda vez se ela mudou (ETag). Com o max-age de um dia, o dado carregado depois no banco ficava
# velho no navegador.
ALWAYS_REVALIDATE = "public, no-cache"


def _vary(response: httpx2.Response) -> set[str]:
    return {token.strip() for token in response.headers["vary"].split(",")}


class FakeRulesRepository:
    def __init__(self, regras: Regras) -> None:
        self._regras = regras

    def get_rules(self) -> Regras:
        return self._regras


def test_should_return_recommendation_in_the_contract_shape_used_by_the_front(
    client: TestClient,
) -> None:
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    assert body["entrada"] == {
        "celula_id": "-190_-482",
        "colheita": "meio",
        "semeadura": "2027-02-18",
        "solo": "argiloso",
        "nematoide": None,
        "gado": None,
    }
    assert len(body["opcoes"]) == 5
    assert body["melhor"] in {o["id"] for o in body["opcoes"]}
    # Só os eixos em que alguma opção supera a melhor (R4.2): aqui todas têm 18 anos bons e o milho
    # tem a maior renda, então sobra só "cuidar da terra".
    assert body["alternativas"] == [{"motivo": "cuidar_da_terra", "opcao": "crotalaria"}]

    milho = next(o for o in body["opcoes"] if o["id"] == "milho_safrinha")
    assert milho["chuva"] == {
        "anos_bons": 18,
        "anos": 20,
        "faixa": [year not in (2007, 2014) for year in range(2005, 2025)],
        "rotulo": "bom",
        "texto": "Deu certo em 18 de 20 anos",
    }
    assert milho["futuro"] is None
    # A1.2: `pior_ano_seco_ha` (contrato do front, `dinheiro.pior_ano_seco_ha?: number`) entrou no
    # `dinheiro`. 2007 e 2014 ficam sem chuva: o milho perde 60% (80 x 0,4 x 62 - 3500).
    assert set(milho["dinheiro"]) == {"margem_ha", "rotulo", "texto", "pior_ano_seco_ha"}
    assert milho["dinheiro"]["pior_ano_seco_ha"] == pytest.approx(80 * 0.4 * 62 - 3500)
    assert "custo_semente_ha" not in milho  # espera o valor da agrônoma (A1.1)
    assert milho["terra"] == {
        "nota": 20.0,
        "rotulo": "medio",
        "texto": "Deixa palhada média e nenhum nitrogênio; não quebra o ciclo do nematoide.",
    }
    assert set(milho["notas"]) == {"seguranca", "futuro", "solo", "renda", "final"}
    assert milho["porque"] and milho["como_fazer"] == ["Passo 1"]
    assert set(body["plano_3_anos"]) == {"normal", "seco", "hoje"}
    assert {"anos", "nota"} <= set(body["plano_3_anos"]["normal"])
    assert {"descricao", "nota"} <= set(body["plano_3_anos"]["hoje"])
    assert body["pousio"]["texto"]
    assert body["aviso"]


def test_should_explain_the_field_history_from_the_ndvi_repository(client: TestClient) -> None:
    # PRD 7.6: o NDVI de teste do conftest tem 3 anos parados e 5 plantados em 2016-2025
    body = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert {o["porque"][-1] for o in body["opcoes"]} == {
        "Seu talhão ficou em pousio em 3 de 8 entressafras vistas pelo satélite "
        "de 2016 a 2025 (NDVI do MODIS)."
    }


def test_should_move_crops_out_of_window_and_parse_nematoide_when_harvest_is_tarde(
    client: TestClient,
) -> None:
    params = {**UFU, "colheita": "tarde", "solo": "arenoso", "nematoide": "sim", "gado": "nao"}
    response = client.get("/api/recomendacao", params=params)

    assert response.status_code == 200
    body = response.json()
    assert body["entrada"]["solo"] == "arenoso"
    assert body["entrada"]["nematoide"] is True
    assert body["entrada"]["gado"] is False
    assert {o["id"] for o in body["opcoes"]} == {"sorgo", "milheto"}
    assert {o["id"] for o in body["fora_da_janela"]} == {
        "milho_safrinha",
        "milho_braquiaria",
        "crotalaria",
    }


def test_should_return_404_outside_area_instead_of_another_region_answer(
    client: TestClient,
) -> None:
    response = client.get("/api/recomendacao", params={"lat": -23.55, "lon": -46.63})

    assert response.status_code == 404
    assert response.json()["code"] == "OUTSIDE_AREA"


def test_should_return_422_when_invalid_colheita_passed(client: TestClient) -> None:
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "invalida"})

    assert response.status_code == 422


def test_should_return_422_instead_of_ignoring_invalid_nematoide(client: TestClient) -> None:
    response = client.get("/api/recomendacao", params={**UFU, "nematoide": "talvez"})

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("params", "invalid_field"),
    [
        ({**UFU, "colheita": "invalida"}, "colheita"),
        ({"lat": -91.0, "lon": UFU["lon"]}, "lat"),
        ({**UFU, "nematoide": "talvez"}, "nematoide"),
    ],
)
def test_should_answer_invalid_request_as_problem_json_with_the_invalid_field(
    client: TestClient, params: dict[str, object], invalid_field: str
) -> None:
    response = client.get("/api/recomendacao", params=params)

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM_JSON_MEDIA_TYPE
    body = response.json()
    assert body["type"] == f"{PROBLEM_BASE_URI}/INVALID_REQUEST"
    assert body["title"] == "Unprocessable Entity"
    assert body["status"] == 422
    assert body["code"] == "INVALID_REQUEST"
    assert body["detail"] == f"Parâmetro inválido: {invalid_field}"
    assert [(p["name"], p["in"]) for p in body["invalid_params"]] == [(invalid_field, "query")]
    assert all(p["reason"] for p in body["invalid_params"])


def test_should_list_every_invalid_field_in_the_problem_json(client: TestClient) -> None:
    params = {"lat": 100.0, "lon": UFU["lon"], "colheita": "invalida"}

    response = client.get("/api/recomendacao", params=params)

    body = response.json()
    assert {p["name"] for p in body["invalid_params"]} == {"lat", "colheita"}
    assert body["detail"].startswith("Parâmetros inválidos: ")


def test_should_let_the_browser_store_the_recommendation_but_always_revalidate(
    client: TestClient,
) -> None:
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    assert response.headers["cache-control"] == ALWAYS_REVALIDATE
    # ETag forte: SHA-256 do corpo JSON, 32 primeiros dígitos hexadecimais, entre aspas.
    assert response.headers["etag"] == f'"{sha256(response.content).hexdigest()[:32]}"'
    # Os textos mudam com o idioma: um cache público não pode servir pt a quem pediu en.
    assert "Accept-Language" in _vary(response)


def test_should_answer_304_without_body_when_the_browser_already_has_the_current_version(
    client: TestClient,
) -> None:
    params = {**UFU, "colheita": "meio"}
    first = client.get("/api/recomendacao", params=params)

    again = client.get(
        "/api/recomendacao", params=params, headers={"If-None-Match": first.headers["etag"]}
    )

    assert again.status_code == 304
    assert again.content == b""
    assert again.headers["etag"] == first.headers["etag"]
    assert again.headers["cache-control"] == ALWAYS_REVALIDATE
    # RFC 9110 §15.4.5: o 304 leva o mesmo Vary que o 200 levaria (com o Accept-Encoding do GZip).
    assert _vary(again) == _vary(first)


@pytest.mark.parametrize("if_none_match", ["W/{etag}", '"outra-versao", {etag}', "*"])
def test_should_compare_if_none_match_the_way_browsers_and_proxies_send_it(
    client: TestClient, if_none_match: str
) -> None:
    # RFC 9110 §13.1.2: comparação fraca (um proxy que comprime pode trocar por W/), lista e "*".
    params = {**UFU, "colheita": "meio"}
    etag = client.get("/api/recomendacao", params=params).headers["etag"]

    again = client.get(
        "/api/recomendacao",
        params=params,
        headers={"If-None-Match": if_none_match.format(etag=etag)},
    )

    assert again.status_code == 304


class StaleSoilRepository:
    """Solo antes de o time carregar o SoilGrids: textura média padrão."""

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return DEFAULT_SOIL


def test_should_send_the_new_body_when_the_data_changed_after_the_browser_stored_it(
    client: TestClient,
) -> None:
    # O caso real: o navegador guardou a resposta com o solo padrão e depois o solo entrou no banco.
    params = {**UFU, "colheita": "meio"}
    loaded_soil = app.dependency_overrides[get_soil_repository]
    app.dependency_overrides[get_soil_repository] = StaleSoilRepository
    stale = client.get("/api/recomendacao", params=params)
    app.dependency_overrides[get_soil_repository] = loaded_soil

    fresh = client.get(
        "/api/recomendacao", params=params, headers={"If-None-Match": stale.headers["etag"]}
    )

    assert stale.json()["entrada"]["solo"] == "medio"
    assert fresh.status_code == 200
    assert fresh.json()["entrada"]["solo"] == "argiloso"
    assert fresh.headers["etag"] != stale.headers["etag"]


def test_should_send_a_different_etag_for_each_language(client: TestClient) -> None:
    params = {**UFU, "colheita": "meio"}
    pt = client.get("/api/recomendacao", params=params, headers={"Accept-Language": "pt-BR"})

    en = client.get(
        "/api/recomendacao",
        params=params,
        headers={"Accept-Language": "en", "If-None-Match": pt.headers["etag"]},
    )

    assert pt.status_code == 200
    # A versão em português não serve a quem pediu inglês: vem o corpo em inglês.
    assert en.status_code == 200
    assert en.headers["etag"] != pt.headers["etag"]


def test_should_not_cache_errors(client: TestClient) -> None:
    # Nem com If-None-Match o erro vira 304.
    revalidate = {"If-None-Match": "*"}
    outside = client.get(
        "/api/recomendacao", params={"lat": -23.55, "lon": -46.63}, headers=revalidate
    )
    invalid = client.get(
        "/api/recomendacao", params={**UFU, "colheita": "invalida"}, headers=revalidate
    )

    assert outside.status_code == 404
    assert invalid.status_code == 422
    for response in (outside, invalid):
        assert "cache-control" not in response.headers
        assert "etag" not in response.headers


def test_should_return_example_farm_at_ufu_point_when_get_exemplo_called(
    client: TestClient,
) -> None:
    response = client.get("/api/exemplo", headers={"Accept-Language": "en"})

    assert response.status_code == 200
    body = response.json()
    assert body["talhao"]["ponto"] == UFU
    assert body["talhao"]["dentro_da_area"] is True
    assert body["recomendacao"]["entrada"]["colheita"] == "meio"
    assert body["recomendacao"]["opcoes"][0]["chuva"]["texto"].startswith("Worked in")


class FakeForecastRepository:
    """GEOS-S2S com 60% de chance de chuva abaixo do normal de março a maio."""

    def get_seasonal_forecast(self, lat: float, lon: float) -> SeasonalForecast | None:
        return SeasonalForecast(chance_abaixo_normal=0.6, data=date(2027, 2, 1))


def test_should_send_null_autumn_signal_until_the_signal_data_arrives(client: TestClient) -> None:
    # RF-20: sem GEOS-S2S, SMAP e chuva recente (tarefas A2.1 a A2.3), nada de previsão inventada.
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    assert "sinal" in body
    assert body["sinal"] is None


def test_should_send_autumn_signal_in_the_front_contract_when_a_repository_has_data(
    client: TestClient,
) -> None:
    # Contrato do front: SinalOutono em projeto/frontend/src/models/recomendacao.ts
    app.dependency_overrides[get_seasonal_forecast_repository] = FakeForecastRepository

    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    sinal = body["sinal"]
    assert set(sinal) == {"nivel", "motivo", "fonte", "data", "regra_dia_plantar"}
    assert sinal["nivel"] == "seco"
    assert "60%" in sinal["motivo"]
    assert sinal["fonte"] == ["GEOS-S2S"]
    assert sinal["data"] == "2027-02-01"
    primeira_a = next(
        o for o in body["opcoes"] if o["id"] == body["plano_3_anos"]["normal"]["anos"][0]
    )
    assert sinal["regra_dia_plantar"]["data_limite"] == primeira_a["data_limite"]
    assert sinal["regra_dia_plantar"]["texto"].startswith("No dia de plantar")


class EarlyHarvestNdviRepository:
    """NDVI de teste: a soja seca em 2/fev (dia 33) em todos os anos -> colheita "cedo"."""

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        return [
            NdviRecord(data=date(year, month, day), ndvi=ndvi, qualidade=0, produto="MOD13Q1")
            for year in range(2016, 2026)
            for month, day, ndvi in ((1, 17, 0.84), (2, 2, 0.35))
        ]


def test_should_answer_example_farm_with_the_harvest_band_suggested_by_ndvi(
    client: TestClient,
) -> None:
    # Roteiro R3.2: /exemplo usa a colheita sugerida do talhão, não "meio" fixo
    app.dependency_overrides[get_ndvi_repository] = EarlyHarvestNdviRepository

    body = client.get("/api/exemplo").json()

    assert body["talhao"]["colheita_sugerida"]["faixa"] == "cedo"
    assert body["recomendacao"]["entrada"]["colheita"] == "cedo"
    assert body["recomendacao"]["entrada"]["semeadura"] == "2027-02-08"


def test_should_use_rules_from_the_injected_rules_repository(client: TestClient) -> None:
    # dependencies.py entrega as regras do repository a todos os services do motor
    base = load_default_rules()
    regras = replace(
        base,
        clima=replace(base.clima, calor_temp_c=29.0),
        rotulos=replace(base.rotulos, dinheiro_bom=101.0),
        rotacao=replace(base.rotacao, anos_secos=2),
    )
    app.dependency_overrides[get_rules_repository] = lambda: FakeRulesRepository(regras)

    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    milho = next(o for o in body["opcoes"] if o["id"] == "milho_safrinha")
    assert milho["chuva"]["anos_bons"] == 0  # máxima de 30 °C já é calor com o limiar de 29 °C
    assert milho["dinheiro"]["rotulo"] == "medio"  # renda 100 abaixo do "bom" de 101
    assert "(2007, 2014)" in body["plano_3_anos"]["seco"]["descricao"]
