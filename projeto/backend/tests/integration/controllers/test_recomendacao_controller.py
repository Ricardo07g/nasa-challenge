"""Integration tests for GET /api/recomendacao and GET /api/exemplo (contrato do plano §3.2)."""

from dataclasses import replace
from datetime import date
from hashlib import sha256

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.constants import PROBLEM_BASE_URI, PROBLEM_JSON_MEDIA_TYPE
from app.dependencies import (
    get_enso_forecast_repository,
    get_enso_repository,
    get_ndvi_repository,
    get_rules_repository,
    get_soil_repository,
)
from app.main import app
from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast
from app.models.regras import Regras
from app.models.talhao import NdviRecord, SoloInfo
from app.repositories.enso_repository import FileEnsoRepository
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
    # Só os eixos em que alguma opção supera a melhor (R4.2): aqui todas têm 18 anos bons e os grãos
    # empatam na renda (a segurança, tarefa 0040), então sobra só "cuidar da terra".
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
    # Tarefa 0040: a renda só com fatos (dá grão ou não e os anos com aperto do motor), sem reais
    assert milho["renda"] == {
        "da_grao": True,
        "anos_aperto": 2,
        "rotulo": "bom",
        "texto": "Dá grão para vender",
        "risco": "Risco de perder a lavoura: faltou água ou fez calor em 2 de 20 anos.",
    }
    crotalaria = next(o for o in body["opcoes"] if o["id"] == "crotalaria")
    assert crotalaria["renda"]["da_grao"] is False
    assert crotalaria["renda"]["texto"] == "Não dá grão: é investimento na terra"
    assert "dinheiro" not in milho
    assert "custo_semente_ha" not in milho
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
    # PRD 7.6: o NDVI de teste do conftest tem 3 anos parados e 5 plantados em 2017-2026
    body = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert {o["porque"][-1] for o in body["opcoes"]} == {
        "Seu talhão ficou em pousio em 3 de 8 entressafras vistas pelo satélite "
        "de 2017 a 2026 (NDVI do MODIS)."
    }


def test_should_explain_the_history_with_the_seasons_the_producer_confirmed(
    client: TestClient,
) -> None:
    # Tarefa 0039: no NDVI de teste, 2025 é "plantou"; o produtor diz que deixou parado.
    params = {**UFU, "colheita": "meio", "confirmadas": "2025:parado"}

    body = client.get("/api/recomendacao", params=params).json()

    assert {o["porque"][-1] for o in body["opcoes"]} == {
        "Seu talhão ficou em pousio em 4 de 8 entressafras de 2017 a 2026 "
        "(você confirmou 1; o satélite viu 7, pelo NDVI do MODIS)."
    }


@pytest.mark.parametrize("confirmadas", ["2023:parado", "2025:talvez", "2025:parado,2025:plantou"])
def test_should_refuse_confirmed_seasons_out_of_the_last_three_years_or_values(
    client: TestClient, confirmadas: str
) -> None:
    params = {**UFU, "colheita": "meio", "confirmadas": confirmadas}

    response = client.get("/api/recomendacao", params=params)

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM_JSON_MEDIA_TYPE
    assert response.json()["code"] == "VALIDATION_ERROR"


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
    assert response.json()["detail"].endswith("Veja a lavoura de demonstração.")


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
        ({**UFU, "confirmadas": "2025-parado"}, "confirmadas"),
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
    assert body["talhao"]["chuva_mensal"]["anos"] == list(range(2005, 2025))
    assert body["recomendacao"]["entrada"]["colheita"] == "meio"
    assert body["recomendacao"]["opcoes"][0]["chuva"]["texto"].startswith("Worked in")
    assert body["recomendacao"]["opcoes"][0]["renda"]["risco"].startswith("Risk of losing")


@pytest.mark.parametrize(
    ("path", "params"),
    [("/api/recomendacao", {**UFU, "colheita": "meio"}), ("/api/exemplo", {})],
)
@pytest.mark.parametrize("lang", ["pt-BR", "en"])
def test_should_send_no_money_value_anywhere_in_the_answer(
    client: TestClient, path: str, params: dict, lang: str
) -> None:
    # Seção 1 da remodelagem (tarefa 0040): nenhum valor em reais na API
    response = client.get(path, params=params, headers={"Accept-Language": lang})

    assert response.status_code == 200
    assert "R$" not in response.text
    for campo in ("dinheiro", "margem_ha", "pior_ano_seco_ha", "custo_semente_ha", "mais_dinheiro"):
        assert campo not in response.text


class FakeEnsoForecastRepository:
    """Previsão de teste do ENSO (não é da NOAA): 70% de El Niño em FMA do próximo ano."""

    def get_enso_forecast(self) -> EnsoForecast | None:
        season = EnsoSeasonForecast("FMA", date.today().year + 1, la_nina=10, neutro=20, el_nino=70)
        return EnsoForecast(
            emitida_em=date(2026, 11, 14), fonte="Fonte de teste", estacoes=(season,)
        )


def test_should_send_null_autumn_signal_until_the_signal_data_arrives(client: TestClient) -> None:
    # RF-20 (tarefa 0038): sem a previsão do ENSO, nada de previsão inventada.
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    assert "sinal" in body
    assert body["sinal"] is None


def test_should_send_autumn_signal_in_the_front_contract_when_the_forecast_exists(
    client: TestClient,
) -> None:
    # Contrato do front: SinalOutono em projeto/frontend/src/models/recomendacao.ts; `smap_agora`
    # entra como campo opcional (tarefa 0038). A regra antiga da data saiu na S9 (tarefa 0049).
    app.dependency_overrides[get_enso_forecast_repository] = FakeEnsoForecastRepository

    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    sinal = body["sinal"]
    assert set(sinal) == {"nivel", "motivo", "fonte", "data", "smap_agora"}
    assert sinal["nivel"] in {"normal", "seco", "incerto"}
    assert "El Niño (70%, Fonte de teste)" in sinal["motivo"]
    assert sinal["fonte"] == ["Fonte de teste", "NASA POWER"]
    assert sinal["data"] == "2026-11-14"
    assert sinal["smap_agora"] is None


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
        rotulos=replace(base.rotulos, renda_medio=-1.0),
        rotacao=replace(base.rotacao, anos_secos=2),
    )
    app.dependency_overrides[get_rules_repository] = lambda: FakeRulesRepository(regras)

    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    milho = next(o for o in body["opcoes"] if o["id"] == "milho_safrinha")
    assert milho["chuva"]["anos_bons"] == 0  # máxima de 30 °C já é calor com o limiar de 29 °C
    assert milho["renda"]["rotulo"] == "medio"  # renda 0 (nenhum ano bom) acima do "médio" de -1
    assert "(2007, 2014)" in body["plano_3_anos"]["seco"]["descricao"]


# --- detalhe de cada ano (P1) ------------------------------------------------------------------


def _milho(body: dict) -> dict:
    return next(o for o in body["opcoes"] if o["id"] == "milho_safrinha")


def test_should_detail_each_year_of_the_rain_strip_in_every_option(client: TestClient) -> None:
    # Contrato do front: `opcoes[].anos_detalhe[]` com {ano, bom, fase_critica, dias_sem_chuva,
    # enso, texto}. A faixa sai de anos_detalhe[].bom: um item por ano, na mesma ordem.
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    for opcao in body["opcoes"]:
        assert [d["ano"] for d in opcao["anos_detalhe"]] == list(range(2005, 2025))
        assert [d["bom"] for d in opcao["anos_detalhe"]] == opcao["chuva"]["faixa"]
    detalhes = {d["ano"]: d for d in _milho(body)["anos_detalhe"]}
    # 2007 fica sem chuva de fevereiro a junho; floração no dia 60 (18/fev + 60 = 19/abr). Os
    # campos do explorador da tarefa 0044 têm teste próprio (abaixo).
    explorador = {"isna", "dias_calor", "falta_agua", "calor", "semeadura", "umidade_inicial"}
    detalhes = {
        ano: {k: v for k, v in d.items() if k not in explorador} for ano, d in detalhes.items()
    }
    assert detalhes[2007] == {
        "ano": 2007,
        "bom": False,
        "fase_critica": "2007-04-19",
        "dias_sem_chuva": 30,
        "enso": "el_nino",
        "texto": (
            "Em 2007, plantando em 18 de fevereiro, a planta chegou na fase que mais precisa de "
            "água por volta de 19 de abril e ficou 30 dias sem chuva. Faltou água nessa fase. "
            "Ano de El Niño."
        ),
    }
    assert detalhes[2010] == {
        "ano": 2010,
        "bom": True,
        "fase_critica": "2010-04-19",
        "dias_sem_chuva": 0,
        "enso": None,
        "texto": (
            "Em 2010, plantando em 18 de fevereiro, a planta chegou na fase que mais precisa de "
            "água por volta de 19 de abril e não ficou nenhum dia sem chuva. Deu certo."
        ),
    }


def test_should_write_the_year_detail_in_english(client: TestClient) -> None:
    response = client.get(
        "/api/recomendacao",
        params={**UFU, "colheita": "meio"},
        headers={"Accept-Language": "en"},
    )

    detalhe = next(d for d in _milho(response.json())["anos_detalhe"] if d["ano"] == 2014)
    assert (detalhe["enso"], detalhe["dias_sem_chuva"]) == ("la_nina", 30)
    assert detalhe["texto"] == (
        "In 2014, sowing on February 18, the crop reached the stage that needs water most around "
        "April 19 and went 30 days without rain. The crop ran short of water in this stage. "
        "La Niña year."
    )


def test_should_send_the_year_detail_without_enso_when_there_is_no_oni_file(
    client: TestClient,
) -> None:
    app.dependency_overrides[get_enso_repository] = lambda: FileEnsoRepository(None)

    body = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert {d["enso"] for o in body["opcoes"] for d in o["anos_detalhe"]} == {None}
    assert all("Niño" not in d["texto"] for d in _milho(body)["anos_detalhe"])


def test_should_send_the_suggestion_blocks_of_each_option_in_the_front_contract(
    client: TestClient,
) -> None:
    # Tarefa 0044: linha "Água" (sede incluída), critério de "deu certo", ciclo, o que observar e
    # a taxa de acerto por fase do ENSO; o ISNA e o porquê de cada ano para o explorador.
    body = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()
    milho = _milho(body)

    assert set(milho["agua"]) == {
        "precisa_mm",
        "chove_mm",
        "falta_normal_mm",
        "falta_seco_mm",
        "sede",
        "cad_mm",
        "anos",
        "futuro",
    }
    assert milho["agua"]["sede"] in {"pouca", "media", "muita"}
    assert milho["agua"]["futuro"] is None  # sem CMIP6 no conftest
    assert milho["criterio"] == {
        "isna_min": 0.55,
        "calor_temp_c": 35.0,
        "calor_min_dias": 3,
        "fase": "floracao",
        "janela_dias": 15,
    }
    assert milho["ciclo"] == {"dias": 100, "floracao_dias": 60}
    assert milho["observar"] == {"veranico_dias": 0, "anos_calor": 0, "total": 20}
    fases = {item["fase"]: item for item in milho["enso_acerto"]}
    assert set(fases["el_nino"]) == {"fase", "anos", "bons", "anos_outros", "bons_outros", "clara"}
    seca = next(d for d in milho["anos_detalhe"] if d["ano"] == 2007)
    assert seca["isna"] < 0.55
    assert (seca["falta_agua"], seca["calor"], seca["dias_calor"]) == (True, False, 0)
    assert (seca["semeadura"], seca["umidade_inicial"]) == ("2007-02-18", None)


def test_should_send_objectives_future_climate_frost_and_planting_deadlines(
    client: TestClient,
) -> None:
    body = client.get("/api/recomendacao", params={**UFU, "colheita": "tarde"}).json()

    assert set(body["objetivos"]) == {"equilibrio", "seguranca", "renda", "terra"}
    equilibrio = body["objetivos"]["equilibrio"]
    assert equilibrio["ordem"] == [o["id"] for o in body["opcoes"]]
    assert equilibrio["plano"][0] == body["melhor"] == body["plano_3_anos"]["normal"]["anos"][0]
    assert set(equilibrio) == {"ordem", "plano", "nota_plano"}
    assert body["clima_futuro"] is None  # sem CMIP6 no conftest
    assert body["geada"] is None  # nenhuma noite de 3 °C ou menos: sem risco, o alerta não vem
    assert {f["id"]: f["data_limite"] for f in body["fora_da_janela"]} == {
        "milho_safrinha": "2027-02-28",
        "milho_braquiaria": "2027-02-28",
        "crotalaria": "2027-02-28",
    }
