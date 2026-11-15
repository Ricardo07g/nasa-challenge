"""A fazenda de exemplo com os arquivos que vão junto com a API (culturas.yaml e clima).

Não usa rede, banco nem variáveis da máquina: os repositórios são montados com os caminhos
padrão do Settings. É o teste que pegaria o HTTP 500 de arquivo em formato errado.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.dependencies import (
    get_climate_repository,
    get_crop_params_repository,
    get_enso_repository,
    get_ndvi_repository,
    get_satellite_ingestion_service,
    get_smap_repository,
    get_soil_repository,
)
from app.main import app
from app.repositories.climate_repository import FixtureClimateRepository
from app.repositories.crop_params_repository import YamlCropParamsRepository
from app.repositories.enso_repository import FileEnsoRepository
from app.repositories.ndvi_repository import CachedNdviRepository
from app.repositories.smap_repository import FileSmapRepository
from app.repositories.soil_repository import CachedSoilGridsRepository


@pytest.fixture
def real_data_client() -> Iterator[TestClient]:
    # Caminhos padrão (os arquivos do repositório), sem ler variável de ambiente.
    clima = Settings.model_fields["clima_path"].default
    culturas = Settings.model_fields["culturas_path"].default
    app.dependency_overrides[get_crop_params_repository] = lambda: YamlCropParamsRepository(
        culturas
    )
    app.dependency_overrides[get_climate_repository] = lambda: FixtureClimateRepository(clima)
    app.dependency_overrides[get_soil_repository] = lambda: CachedSoilGridsRepository(None)
    app.dependency_overrides[get_ndvi_repository] = lambda: CachedNdviRepository(None)
    app.dependency_overrides[get_enso_repository] = lambda: FileEnsoRepository(None)
    app.dependency_overrides[get_smap_repository] = lambda: FileSmapRepository(None)
    app.dependency_overrides[get_satellite_ingestion_service] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_should_answer_example_farm_with_twenty_years_of_nasa_power(
    real_data_client: TestClient,
) -> None:
    response = real_data_client.get("/api/exemplo")

    assert response.status_code == 200
    body = response.json()
    assert body["talhao"]["dados"][0] == {
        "fonte": "nasa_power",
        "periodo": "2005-2024",
        "cenario": None,
        "modelos": None,
    }
    rec = body["recomendacao"]
    assert len(rec["opcoes"]) == 5
    assert all(o["chuva"]["anos"] == 20 for o in rec["opcoes"])
    assert rec["melhor"] != "pousio"


# Nomes das culturas como a interface mostra (front: src/i18n/messages.pt.ts e messages.en.ts).
NAMES_PT = {
    "milho_braquiaria": "Milho com braquiária",
    "milho_safrinha": "Milho sozinho",
    "sorgo": "Sorgo",
    "milheto": "Milheto",
    "crotalaria": "Crotalária",
}
NAMES_EN = {
    "milho_braquiaria": "Corn with brachiaria",
    "milho_safrinha": "Corn alone",
    "sorgo": "Sorghum",
    "milheto": "Pearl millet",
    "crotalaria": "Crotalaria",
}


def _names(rec: dict) -> dict[str, str]:
    return {o["id"]: o["nome"] for o in rec["opcoes"] + rec["fora_da_janela"]}


def test_should_answer_crop_names_and_how_to_steps_in_the_requested_language(
    real_data_client: TestClient,
) -> None:
    pt = real_data_client.get("/api/exemplo", headers={"Accept-Language": "pt-BR"}).json()
    en = real_data_client.get("/api/exemplo", headers={"Accept-Language": "en-US,en;q=0.9"}).json()

    assert _names(pt["recomendacao"]) == NAMES_PT
    assert _names(en["recomendacao"]) == NAMES_EN
    steps_pt = {o["id"]: o["como_fazer"] for o in pt["recomendacao"]["opcoes"]}
    steps_en = {o["id"]: o["como_fazer"] for o in en["recomendacao"]["opcoes"]}
    assert all(3 <= len(steps) <= 5 for steps in steps_pt.values())
    for crop_id, steps in steps_pt.items():
        assert len(steps_en[crop_id]) == len(steps)
        assert steps_en[crop_id] != steps


AXIS_BY_MOTIVO = {"menos_risco": "seguranca", "mais_dinheiro": "renda", "cuidar_da_terra": "solo"}


def test_should_only_offer_alternatives_better_than_the_best_on_their_axis(
    real_data_client: TestClient,
) -> None:
    # Fazenda de exemplo (colheita meio): o milho safrinha tem a maior renda (100). Antes, "mais
    # dinheiro" era o sorgo, com renda 18, e a crotalária aparecia em dois eixos.
    rec = real_data_client.get("/api/exemplo").json()["recomendacao"]
    notas = {o["id"]: o["notas"] for o in rec["opcoes"]}
    melhor = notas[rec["melhor"]]
    alternativas = rec["alternativas"]

    assert rec["melhor"] == "milho_safrinha"
    assert melhor["renda"] == 100.0
    assert "mais_dinheiro" not in {a["motivo"] for a in alternativas}
    assert alternativas  # coberturas superam o milho em risco e em terra
    assert len({a["opcao"] for a in alternativas}) == len(alternativas)
    for alt in alternativas:
        axis = AXIS_BY_MOTIVO[alt["motivo"]]
        assert notas[alt["opcao"]][axis] > melhor[axis]


def test_should_replay_the_dry_2024_and_the_good_2023_of_the_example_farm(
    real_data_client: TestClient,
) -> None:
    # P4 com a chuva real do NASA POWER: em 2024 parou de chover em 19/abr, logo depois da
    # floração do milho (18/abr), e o aviso sai no 10º dia seco; 2023 passa sem aviso.
    farm = {"lat": -18.9543, "lon": -48.1993}
    dry = real_data_client.get("/api/safra-passada", params={**farm, "ano": 2024}).json()
    good = real_data_client.get("/api/safra-passada", params={**farm, "ano": 2023}).json()

    assert dry["opcao"] == "milho_safrinha"
    assert [(e["data"], e["tipo"]) for e in dry["eventos"]] == [
        ("2024-02-18", "semeadura"),
        ("2024-04-18", "fase_critica"),
        ("2024-04-19", "sem_chuva"),
        ("2024-04-28", "aviso_veranico"),
        ("2024-06-17", "colheita"),
    ]
    assert [e["tipo"] for e in good["eventos"]] == ["semeadura", "fase_critica", "colheita"]


def test_should_show_the_rain_of_each_month_of_the_example_farm(
    real_data_client: TestClient,
) -> None:
    # Gráfico da tela 3 com a chuva real do NASA POWER (fixture, 2005 a 2024): a chuva vai
    # acabando depois de março, que é o que o texto "Por que perguntamos isso?" diz.
    chuva = real_data_client.get("/api/exemplo").json()["talhao"]["chuva_mensal"]

    assert chuva["fonte"] == "nasa_power"
    assert chuva["anos"] == list(range(2005, 2025))
    assert [(m["mes"], m["media_mm"]) for m in chuva["meses"]] == [
        (1, 212.7),
        (2, 161.0),
        (3, 156.8),
        (4, 74.7),
        (5, 31.3),
        (6, 12.6),
    ]


def test_should_detail_each_year_of_the_example_farm_like_the_replay(
    real_data_client: TestClient,
) -> None:
    # P1 com a chuva real do NASA POWER: o detalhe de 2024 bate com o replay acima (sem chuva
    # desde 19/abr, logo depois da floração em 18/abr). A fase crítica vai de 3/abr a 2/mai, então
    # a seca conta 14 dias nela. Sem o arquivo do ONI, nenhum ano tem marca de El Niño/La Niña.
    rec = real_data_client.get("/api/exemplo").json()["recomendacao"]

    for opcao in rec["opcoes"]:
        assert [d["ano"] for d in opcao["anos_detalhe"]] == list(range(2005, 2025))
        assert [d["bom"] for d in opcao["anos_detalhe"]] == opcao["chuva"]["faixa"]
        assert {d["enso"] for d in opcao["anos_detalhe"]} == {None}
    milho = next(o for o in rec["opcoes"] if o["id"] == "milho_safrinha")
    detalhes = {d["ano"]: d for d in milho["anos_detalhe"]}
    assert detalhes[2024] == {
        "ano": 2024,
        "bom": False,
        "fase_critica": "2024-04-18",
        "dias_sem_chuva": 14,
        "enso": None,
        "texto": (
            "Em 2024, plantando em 18 de fevereiro, a planta chegou na fase que mais precisa de "
            "água por volta de 18 de abril e ficou 14 dias sem chuva. Faltou água nessa fase."
        ),
    }
    assert detalhes[2023]["bom"] is True
