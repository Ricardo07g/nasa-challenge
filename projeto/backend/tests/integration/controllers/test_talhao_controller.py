"""Integration tests for GET /api/talhao (plano técnico §3.1 e guia do histórico NDVI)."""

import json
from dataclasses import replace
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import dependencies
from app.config import Settings
from app.constants import PROBLEM_JSON_MEDIA_TYPE
from app.dependencies import (
    get_climate_repository,
    get_ndvi_repository,
    get_rules_repository,
    get_soja_recente_repository,
)
from app.main import app
from app.models.climate import ClimateSeason
from app.models.regras import Regras
from app.models.soja_recente import MODIS_250M_PIXEL_M
from app.repositories.ndvi_repository import CachedNdviRepository
from app.repositories.rules_repository import load_default_rules
from app.repositories.soja_recente_repository import FileSojaRecenteRepository
from tests.integration.controllers.conftest import FakeClimateRepository
from tests.ndvi_grid_fakes import FakeTile, write_ndvi_grid

UFU = {"lat": -18.9543, "lon": -48.1993}
SITUACOES = {"plantou", "parado", "incerto", "sem_dado", "sem_soja"}


def test_should_return_field_inspection_in_the_contract_shape(client: TestClient) -> None:
    response = client.get("/api/talhao", params=UFU)

    assert response.status_code == 200
    body = response.json()
    assert body["ponto"] == UFU
    assert body["celula_id"] == "-190_-482"
    assert body["dentro_da_area"] is True
    assert body["solo"] == {"textura": "argiloso", "cad_mm": 60.0, "fonte": "soilgrids"}
    # Tarefa 0042: o dia em que a soja costuma secar (NDVI falso: 18/fev) e a faixa desse dia.
    assert body["colheita_sugerida"] == {
        "faixa": "meio",
        "fonte": "ndvi_modis",
        "anos_usados": 10,
        "dia": "02-18",
    }
    assert body["dados"] == [
        {"fonte": "nasa_power", "periodo": "2005-2024", "cenario": None, "modelos": None}
    ]


def test_should_return_the_full_ndvi_history_contract(client: TestClient) -> None:
    # Formato completo do guia NDVI (decisão do time no R3.2), anos de 2017 a 2026
    historico = client.get("/api/talhao", params=UFU).json()["historico"]

    assert {k: v for k, v in historico.items() if k != "anos"} == {
        "parado": 3,
        "plantou": 5,
        "sem_certeza": 2,
        "sem_soja": 0,
        "total": 10,
        "fonte": "MODIS MOD13Q1 + MYD13Q1",
        "janela": "04-01 a 07-31",
    }
    assert len(historico["anos"]) == 10
    keys = {"ano", "situacao", "ndvi_max", "n_obs", "fonte_ano"}
    assert all(set(a) == keys for a in historico["anos"])
    assert all(a["situacao"] in SITUACOES for a in historico["anos"])
    satelite = {"fonte_ano": "satelite"}
    assert historico["anos"][:5] == [
        {"ano": 2017, "situacao": "plantou", "ndvi_max": 0.71, "n_obs": 3, **satelite},
        {"ano": 2018, "situacao": "sem_dado", "ndvi_max": None, "n_obs": 1, **satelite},
        {"ano": 2019, "situacao": "plantou", "ndvi_max": 0.71, "n_obs": 3, **satelite},
        {"ano": 2020, "situacao": "incerto", "ndvi_max": 0.52, "n_obs": 3, **satelite},
        {"ano": 2021, "situacao": "plantou", "ndvi_max": 0.71, "n_obs": 3, **satelite},
    ]


def test_should_apply_the_seasons_the_producer_confirmed_to_the_history(
    client: TestClient,
) -> None:
    # Tarefa 0039: no NDVI de teste, 2024 é "parado" e 2025 "plantou"; o produtor diz o contrário.
    params = {**UFU, "confirmadas": "2024:plantou,2025:parado"}

    body = client.get("/api/talhao", params=params).json()

    anos = {a["ano"]: a for a in body["historico"]["anos"]}
    assert anos[2024] == {
        "ano": 2024,
        "situacao": "plantou",
        "ndvi_max": 0.3,
        "n_obs": 3,
        "fonte_ano": "produtor",
    }
    assert (anos[2025]["situacao"], anos[2025]["fonte_ano"]) == ("parado", "produtor")
    assert anos[2023]["fonte_ano"] == "satelite"
    assert body["anos_confirmaveis"] == [2024, 2025, 2026]


def test_should_list_the_confirmable_seasons_without_confirmations(client: TestClient) -> None:
    body = client.get("/api/talhao", params=UFU).json()

    assert body["anos_confirmaveis"] == [2024, 2025, 2026]
    assert {a["fonte_ano"] for a in body["historico"]["anos"]} == {"satelite"}


def test_should_refuse_a_confirmed_season_out_of_the_last_three_years(client: TestClient) -> None:
    response = client.get("/api/talhao", params={**UFU, "confirmadas": "2020:plantou"})

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM_JSON_MEDIA_TYPE
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_should_refuse_confirmed_seasons_in_another_format(client: TestClient) -> None:
    response = client.get("/api/talhao", params={**UFU, "confirmadas": "2024=plantou"})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "INVALID_REQUEST"
    assert [p["name"] for p in body["invalid_params"]] == ["confirmadas"]


def test_should_return_dentro_da_area_false_when_point_has_no_data(client: TestClient) -> None:
    response = client.get("/api/talhao", params={"lat": -23.55, "lon": -46.63})

    assert response.status_code == 200
    body = response.json()
    assert body["dentro_da_area"] is False
    assert body["celula_id"] is None
    assert body["dados"] == []
    assert body["chuva_mensal"] is None


def test_should_return_the_rain_of_each_month_from_january_to_june(client: TestClient) -> None:
    # Clima falso do conftest: 8 mm/dia, sem chuva de fevereiro a junho em 2007 e 2014.
    # Fevereiro = (13 anos x 224 + 5 bissextos x 232 + 2 secos x 0) / 20 = 203,6
    body = client.get("/api/talhao", params=UFU).json()
    chuva = body["chuva_mensal"]

    assert [(m["mes"], m["media_mm"]) for m in chuva["meses"]] == [
        (1, 248.0),
        (2, 203.6),
        (3, 223.2),
        (4, 216.0),
        (5, 223.2),
        (6, 216.0),
    ]
    assert chuva["anos"] == list(range(2005, 2025))
    assert chuva["fonte"] == "nasa_power"


def test_should_send_the_evapotranspiration_of_each_month_with_the_rain(
    client: TestClient,
) -> None:
    # Tarefa 0042: a ETo do motor. O clima falso não traz ETo: vale a Hargreaves-Samani do
    # ClimateRiskService, como no balanço hídrico. Com 8 mm/dia, a chuva nunca fica abaixo dela.
    chuva = client.get("/api/talhao", params=UFU).json()["chuva_mensal"]

    assert all(0 < m["eto_media_mm"] < m["media_mm"] for m in chuva["meses"])
    assert chuva["fonte_eto"] == "nasa_power"
    assert chuva["mes_chuva_abaixo_eto"] is None


def test_should_send_the_rain_left_after_each_harvest_day(client: TestClient) -> None:
    # Clima falso: 8 mm/dia, 2007 e 2014 sem chuva de fevereiro a junho. De 31/mar a 30/jun,
    # 92 x 8 = 736 mm em 18 anos e 0 nos 2 secos: mediana e percentil 20 (posição 3,8) = 736.
    sobra = client.get("/api/talhao", params=UFU).json()["chuva_que_sobra"]

    assert (sobra["fim"], sobra["percentil_seco"], sobra["fonte"]) == ("06-30", 20, "nasa_power")
    assert sobra["anos"] == list(range(2005, 2025))
    assert sobra["dias"][0]["dia"] == "01-15"
    assert sobra["dias"][-1] == {"dia": "03-31", "mediana_mm": 736.0, "seco_mm": 736.0}
    assert len(sobra["dias"]) == 76


def test_should_leave_the_end_of_rains_null_when_a_year_never_dries(client: TestClient) -> None:
    # Clima falso: chove 8 mm todo dia até 31/jul nos anos normais (nunca 20 dias com < 10 mm).
    assert client.get("/api/talhao", params=UFU).json()["fim_das_chuvas"] is None


class RainUntilMarchClimate(FakeClimateRepository):
    """Clima de teste em que chove 8 mm por dia até 31/mar e nada depois, em todos os anos."""

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        seasons = super().get_seasons(cell_id)
        return [
            replace(
                season,
                rain_mm=tuple(
                    8.0 if season.start_date + timedelta(days=i) <= date(season.year, 3, 31) else 0
                    for i in range(len(season.rain_mm))
                ),
            )
            for season in seasons
        ]


def test_should_send_the_end_of_rains_of_the_cell(client: TestClient) -> None:
    app.dependency_overrides[get_climate_repository] = RainUntilMarchClimate

    fim = client.get("/api/talhao", params=UFU).json()["fim_das_chuvas"]

    assert fim == {
        "mediana": "03-31",
        "mais_cedo": {"dia": "03-31", "ano": 2005},
        "mais_tarde": {"dia": "03-31", "ano": 2024},
        "anos": list(range(2005, 2025)),
        "fonte": "nasa_power",
        "inicio": "03-01",
        "dias": 20,
        "chuva_max_mm": 10.0,
    }


class FakeRulesRepository:
    def __init__(self, regras: Regras) -> None:
        self._regras = regras

    def get_rules(self) -> Regras:
        return self._regras


def test_should_classify_history_with_rules_from_the_injected_repository(
    client: TestClient,
) -> None:
    base = load_default_rules()
    regras = replace(base, historico_ndvi=replace(base.historico_ndvi, limite_plantou=0.80))
    app.dependency_overrides[get_rules_repository] = lambda: FakeRulesRepository(regras)

    response = client.get("/api/talhao", params=UFU)

    assert response.status_code == 200
    assert response.json()["historico"]["anos"][0]["situacao"] == "incerto"  # 0,71 < 0,80


# Arquivo no formato do contrato do NDVI (AGENTS.md do backend) com valores de teste: o
# `versao_dados` não usa a chave `modis_mod13q1`, porque não é dado do MODIS.
TEST_RUN = {"fonte": "teste", "parametros": {}, "fim": "2026-11-14T13:00:00Z", "versao": "teste"}


def _obs(day: str, ndvi: float, qualidade: int = 0, produto: str = "MOD13Q1") -> dict[str, Any]:
    return {"data": day, "ndvi": ndvi, "qualidade": qualidade, "produto": produto}


def _ndvi_file(tmp_path: Path) -> Path:
    """Soja seca em 10/fev (Aqua); entressafra parada nos anos pares e plantada nos ímpares.

    Os anos pares têm uma imagem com nuvem (qualidade 3) e NDVI alto, que não pode contar.
    """
    serie: list[dict[str, Any]] = []
    for year in range(2017, 2027):
        peak = 0.74 if year % 2 else 0.31
        serie += [
            _obs(f"{year}-01-17", 0.84),
            _obs(f"{year}-02-02", 0.70),
            _obs(f"{year}-02-10", 0.38, produto="MYD13Q1"),
            _obs(f"{year}-04-07", 0.26),
            _obs(f"{year}-04-15", 0.24, qualidade=1, produto="MYD13Q1"),
            _obs(f"{year}-05-09", peak),
        ]
        if year % 2 == 0:
            serie.append(_obs(f"{year}-06-10", 0.88, qualidade=3, produto="MYD13Q1"))
    payload = {
        "versao_dados": TEST_RUN,
        "pontos": [{"lat": UFU["lat"], "lon": UFU["lon"], "serie": serie}],
    }
    path = tmp_path / "ndvi.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_history_and_harvest_band_from_the_ndvi_file(
    client: TestClient, tmp_path: Path
) -> None:
    path = _ndvi_file(tmp_path)
    app.dependency_overrides[get_ndvi_repository] = lambda: CachedNdviRepository(path)

    body = client.get("/api/talhao", params=UFU).json()

    historico = body["historico"]
    assert (historico["parado"], historico["plantou"], historico["sem_certeza"]) == (5, 5, 0)
    assert historico["total"] == 10
    assert historico["fonte"] == "MODIS MOD13Q1 + MYD13Q1"
    assert historico["anos"][:2] == [
        {"ano": 2017, "situacao": "plantou", "ndvi_max": 0.74, "n_obs": 3, "fonte_ano": "satelite"},
        {"ano": 2018, "situacao": "parado", "ndvi_max": 0.31, "n_obs": 3, "fonte_ano": "satelite"},
    ]
    # Mesma série, de janeiro a março: a soja seca no dia 41 (10/fev) -> colheita "cedo"
    assert body["colheita_sugerida"] == {
        "faixa": "cedo",
        "fonte": "ndvi_modis",
        "anos_usados": 10,
        "dia": "02-10",
    }


def test_should_say_sem_soja_when_the_point_never_shows_soybean(
    client: TestClient, tmp_path: Path
) -> None:
    # Valores de teste de um ponto que nunca passa de 0,30 (cidade, pasto seco): sem soja.
    serie = [
        _obs(f"{year}-{month_day}", 0.30)
        for year in range(2017, 2027)
        for month_day in ("01-17", "02-18", "04-07", "05-09", "06-10")
    ]
    path = tmp_path / "ndvi.json"
    path.write_text(
        json.dumps(
            {
                "versao_dados": TEST_RUN,
                "pontos": [{"lat": UFU["lat"], "lon": UFU["lon"], "serie": serie}],
            }
        ),
        encoding="utf-8",
    )
    app.dependency_overrides[get_ndvi_repository] = lambda: CachedNdviRepository(path)

    historico = client.get("/api/talhao", params=UFU).json()["historico"]

    assert (historico["parado"], historico["plantou"], historico["sem_certeza"]) == (0, 0, 0)
    assert (historico["sem_soja"], historico["total"]) == (10, 10)
    assert historico["anos"][0] == {
        "ano": 2017,
        "situacao": "sem_soja",
        "ndvi_max": None,
        "n_obs": 0,
        "fonte_ano": "satelite",
    }


def test_should_return_null_history_when_the_ndvi_file_has_no_point_near_the_field(
    client: TestClient, tmp_path: Path
) -> None:
    path = _ndvi_file(tmp_path)
    app.dependency_overrides[get_ndvi_repository] = lambda: CachedNdviRepository(path)

    # ~1,1 km ao sul do ponto do arquivo, ainda dentro da área com clima: não usa o vizinho.
    body = client.get("/api/talhao", params={"lat": -18.9643, "lon": -48.1993}).json()

    assert body["dentro_da_area"] is True
    assert body["historico"] is None
    assert body["colheita_sugerida"] == {
        "faixa": "meio",
        "fonte": "padrao",
        "anos_usados": 0,
        "dia": None,
    }


# --- NDVI por área (RF-34, tarefa 0050) ---------------------------------------------------------

# A mesma série do `_ndvi_file`, em ladrilho: soja seca em 10/fev (Aqua) e a entressafra parada
# nos anos pares e plantada nos ímpares. A nuvem não entra no ladrilho (o script tira na
# compactação). Datas e valores de teste.
GRID_DAYS = [("01-17", "MOD13Q1"), ("02-02", "MOD13Q1"), ("02-10", "MYD13Q1"),
             ("04-07", "MOD13Q1"), ("04-15", "MYD13Q1"), ("05-09", "MOD13Q1")]  # fmt: skip
GRID_DATES = [
    (date.fromisoformat(f"{year}-{day}"), product)
    for year in range(2017, 2027)
    for day, product in GRID_DAYS
]


def _grid_value(row: int, col: int, index: int) -> tuple[int, int]:
    day, _ = GRID_DATES[index]
    raw = {"01-17": 8400, "02-02": 7000, "02-10": 3800, "04-07": 2600, "04-15": 2400}.get(
        f"{day:%m-%d}", 7400 if day.year % 2 else 3100
    )
    return raw, 1 if f"{day:%m-%d}" == "04-15" else 0


@pytest.fixture
def ndvi_settings(monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    """Usa a ligação real do `get_ndvi_repository` com os arquivos dados (sem o NDVI falso)."""

    def _apply(ndvi_cache_path: Path | None, ndvi_area_path: Path | None) -> None:
        settings = Settings(
            _env_file=None, ndvi_cache_path=ndvi_cache_path, ndvi_area_path=ndvi_area_path
        )
        monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
        dependencies.get_ndvi_repository.cache_clear()
        app.dependency_overrides.pop(get_ndvi_repository, None)

    yield _apply
    dependencies.get_ndvi_repository.cache_clear()


def test_should_read_the_history_of_a_point_covered_only_by_the_area_grid(
    client: TestClient, tmp_path: Path, ndvi_settings
) -> None:  # type: ignore[no-untyped-def]
    points_file = tmp_path / "ndvi.json"  # só um ponto a ~80 km: não cobre a fazenda
    serie = [_obs("2017-04-07", 0.26)]
    points_file.write_text(
        json.dumps({"versao_dados": TEST_RUN,
                    "pontos": [{"lat": -19.55, "lon": -48.75, "serie": serie}]}),
        encoding="utf-8",
    )  # fmt: skip
    # 5 × 5 pixels em volta da fazenda de exemplo (pixel global 52298, 64518).
    tile = FakeTile(row=52296, col=64516, nrows=5, ncols=5)
    index = write_ndvi_grid(tmp_path / "area", [tile], GRID_DATES, _grid_value)
    ndvi_settings(points_file, index)

    body = client.get("/api/talhao", params=UFU).json()

    historico = body["historico"]
    assert (historico["parado"], historico["plantou"], historico["sem_certeza"]) == (5, 5, 0)
    assert historico["fonte"] == "MODIS MOD13Q1 + MYD13Q1"
    assert historico["anos"][:2] == [
        {"ano": 2017, "situacao": "plantou", "ndvi_max": 0.74, "n_obs": 3, "fonte_ano": "satelite"},
        {"ano": 2018, "situacao": "parado", "ndvi_max": 0.31, "n_obs": 3, "fonte_ano": "satelite"},
    ]
    assert body["colheita_sugerida"] == {
        "faixa": "cedo",
        "fonte": "ndvi_modis",
        "anos_usados": 10,
        "dia": "02-10",
    }


def test_should_keep_the_null_history_outside_the_area_grid(
    client: TestClient, tmp_path: Path, ndvi_settings
) -> None:  # type: ignore[no-untyped-def]
    # Ladrilho a ~1 km a oeste da fazenda: ela fica fora, e a resposta é a de hoje (sem NDVI).
    tile = FakeTile(row=52296, col=64500, nrows=5, ncols=5)
    ndvi_settings(None, write_ndvi_grid(tmp_path / "area", [tile], GRID_DATES, _grid_value))

    body = client.get("/api/talhao", params=UFU).json()

    assert body["historico"] is None
    assert body["colheita_sugerida"]["fonte"] == "padrao"


# --- soja na safra mais recente (RF-24, tarefa 0037) ------------------------------------------


def _soja_file(tmp_path: Path, centro: int | None = 86, name: str = "soja_recente.json") -> Path:
    """Arquivo da soja recente com picos de teste (não são do MODIS) numa grade de 9 × 9 pixels
    em volta da fazenda de exemplo (posição de um recorte real da ORNL; o ponto é o do meio)."""
    picos: list[list[int | None]] = [[41] * 9 for _ in range(9)]
    picos[4][4] = centro
    payload = {
        "versao_dados": TEST_RUN,
        "safra": "2025/26",
        "fonte": "teste",
        "grade": {"projecao": "sinusoidal_modis", "raio_m": 6371007.181,
                  "x_oeste_m": -5070031.09, "y_norte_m": -2108767.79 + 9 * MODIS_250M_PIXEL_M,
                  "pixel_m": MODIS_250M_PIXEL_M, "linhas": 9, "colunas": 9},
        "pico_centesimos": picos,
    }  # fmt: skip
    path = tmp_path / name
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _use_soja_file(path: Path) -> None:
    app.dependency_overrides[get_soja_recente_repository] = lambda: FileSojaRecenteRepository(path)


def test_should_have_no_recent_soybean_without_the_file(client: TestClient) -> None:
    assert client.get("/api/talhao", params=UFU).json()["soja_recente"] is None


def test_should_say_whether_the_satellite_saw_soybean_at_the_point(
    client: TestClient, tmp_path: Path
) -> None:
    _use_soja_file(_soja_file(tmp_path))

    body = client.get("/api/talhao", params=UFU).json()

    assert body["soja_recente"] == {"safra": "2025/26", "vista": True, "ndvi_pico": 0.86,
                                    "fonte": "teste"}  # fmt: skip


def test_should_say_soybean_was_not_seen_below_the_limit_and_nothing_without_data(
    client: TestClient, tmp_path: Path
) -> None:
    _use_soja_file(_soja_file(tmp_path, centro=41, name="nao_vista.json"))
    not_seen = client.get("/api/talhao", params=UFU).json()["soja_recente"]
    _use_soja_file(_soja_file(tmp_path, centro=None, name="sem_dado.json"))
    no_data = client.get("/api/talhao", params=UFU).json()["soja_recente"]

    assert not_seen == {"safra": "2025/26", "vista": False, "ndvi_pico": 0.41, "fonte": "teste"}
    assert no_data == {"safra": "2025/26", "vista": None, "ndvi_pico": None, "fonte": "teste"}


def test_should_have_no_recent_soybean_outside_the_grid(client: TestClient, tmp_path: Path) -> None:
    _use_soja_file(_soja_file(tmp_path))

    # ~2,9 km ao sul: ainda tem clima, mas fica fora da grade de 9 × 9 pixels.
    body = client.get("/api/talhao", params={"lat": -18.98, "lon": -48.1993}).json()

    assert body["dentro_da_area"] is True
    assert body["soja_recente"] is None


def test_should_send_the_recent_soybean_in_the_example_farm_too(
    client: TestClient, tmp_path: Path
) -> None:
    _use_soja_file(_soja_file(tmp_path))

    talhao = client.get("/api/exemplo").json()["talhao"]

    assert talhao["soja_recente"]["vista"] is True
