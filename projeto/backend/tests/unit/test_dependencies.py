"""Ligação das dependências: com DATABASE_URL, PostGIS com a fixture de reserva; sem, só arquivos.

Nenhum teste aqui conecta no banco: os repositories do PostGIS só abrem conexão quando consultados.
"""

import json
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

from app import dependencies
from app.config import Settings
from app.models.climate import ClimateSeason
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import (
    FixtureClimateRepository,
    PostgisClimateRepository,
)
from app.repositories.cmip6_repository import FileCmip6Repository, PostgisCmip6Repository
from app.repositories.soil_repository import CachedSoilGridsRepository, PostgisSoilRepository
from app.services.satellite_ingestion_service import SatelliteIngestionService

# Endereço que não resolve (.invalid) e sem credencial: nada aqui abre conexão.
DATABASE_URL = "postgresql://db.invalid/raiz_orbital"


class FakeNasaPowerClient:
    def fetch_seasons(
        self, lat: float, lon: float, cell_id: str, start_year: int = 2005, end_year: int = 2024
    ) -> list[ClimateSeason]:
        raise AssertionError("o teste não deve chamar o POWER")


class FakeSoilGridsClient:
    def fetch_soil(self, lat: float, lon: float) -> SoloInfo:
        raise AssertionError("o teste não deve chamar o SoilGrids")


def _clear_caches() -> None:
    dependencies.get_climate_repository.cache_clear()
    dependencies.get_soil_repository.cache_clear()


@pytest.fixture
def use_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[..., None]]:
    def _apply(database_url: str | None, cmip6_path: Path | None = None) -> None:
        settings = Settings(_env_file=None, database_url=database_url, cmip6_path=cmip6_path)
        monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
        _clear_caches()

    yield _apply
    _clear_caches()


def _ingestion() -> SatelliteIngestionService | None:
    return dependencies.get_satellite_ingestion_service(
        nasa_client=FakeNasaPowerClient(),
        soil_client=FakeSoilGridsClient(),
        climate_repo=dependencies.get_climate_repository(),
        soil_repo=dependencies.get_soil_repository(),
    )


def test_should_use_postgis_with_file_fallbacks_when_database_url_is_set(
    use_settings: Callable[[str | None], None],
) -> None:
    use_settings(DATABASE_URL)

    climate = dependencies.get_climate_repository()
    soil = dependencies.get_soil_repository()

    assert isinstance(climate, PostgisClimateRepository)
    assert isinstance(climate._fallback, FixtureClimateRepository)
    assert isinstance(soil, PostgisSoilRepository)
    assert isinstance(soil._fallback, CachedSoilGridsRepository)


def test_should_turn_on_demand_ingestion_on_when_database_url_is_set(
    use_settings: Callable[[str | None], None],
) -> None:
    use_settings(DATABASE_URL)

    assert isinstance(_ingestion(), SatelliteIngestionService)


def test_should_not_build_ingestion_when_repositories_cannot_save_even_with_database(
    use_settings: Callable[[str | None], None],
) -> None:
    # Testes das rotas trocam os repositories por arquivos/falsos: nada de rede real, mesmo
    # com DATABASE_URL no ambiente (como no container do compose).
    use_settings(DATABASE_URL)

    ingestion = dependencies.get_satellite_ingestion_service(
        nasa_client=FakeNasaPowerClient(),
        soil_client=FakeSoilGridsClient(),
        climate_repo=FixtureClimateRepository(Settings(_env_file=None).clima_path),
        soil_repo=CachedSoilGridsRepository(None),
    )

    assert ingestion is None


@pytest.mark.parametrize("database_url", [None, ""])
def test_should_keep_file_repositories_and_no_ingestion_without_database(
    use_settings: Callable[[str | None], None], database_url: str | None
) -> None:
    # O .env.example traz `DATABASE_URL=` vazio, que chega como "": vale como "sem banco".
    use_settings(database_url)

    assert isinstance(dependencies.get_climate_repository(), FixtureClimateRepository)
    assert isinstance(dependencies.get_soil_repository(), CachedSoilGridsRepository)
    assert _ingestion() is None


def _write_cmip6_file(path: Path) -> Path:
    # Arquivo do contrato CMIP6 com valores de teste (não é dado real), célula do POWER da UFU.
    payload = {
        "versao_dados": {"fonte": "nex_gddp_cmip6", "parametros": {}, "fim": "2026-11-14T13:00:00Z",
                         "versao": "2026.11-teste"},
        "pontos": [{
            "lat": -19.0, "lon": -48.125,
            "cobertura": {"lat_min": -19.25, "lat_max": -18.75,
                          "lon_min": -48.4375, "lon_max": -47.8125},
            "cmip6": [{"modelo": "MODELO-TESTE", "cenario": "ssp245", "mes": 2,
                       "chuva_pct": -10.0, "tmax_c": 2.0, "tmin_c": 1.0}],
        }],
    }  # fmt: skip
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_cmip6_from_table_then_file_when_database_url_is_set(
    use_settings: Callable[..., None], tmp_path: Path
) -> None:
    use_settings(DATABASE_URL, cmip6_path=tmp_path / "cmip6.json")

    climate = dependencies.get_climate_repository()

    assert isinstance(climate, PostgisClimateRepository)
    assert isinstance(climate._cmip6_repo, PostgisCmip6Repository)
    assert isinstance(climate._cmip6_file_repo, FileCmip6Repository)
    assert climate._cmip6_file_repo._path == tmp_path / "cmip6.json"


def test_should_read_cmip6_from_the_file_of_cmip6_path_without_database(
    use_settings: Callable[..., None], tmp_path: Path
) -> None:
    use_settings(None, cmip6_path=_write_cmip6_file(tmp_path / "cmip6.json"))

    deltas = dependencies.get_climate_repository().get_cmip6_deltas("-190_-482")

    assert [(d.model, d.month, d.tmin_c) for d in deltas] == [("MODELO-TESTE", 2, 1.0)]


def test_should_read_the_enso_phase_of_each_year_from_the_file_of_oni_path(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Valores de teste no formato do contrato do ONI (não são da NOAA)
    path = tmp_path / "oni.json"
    versao = {"fonte": "noaa_oni", "parametros": {}, "fim": "2026-11-14T13:00:00Z", "versao": "x"}
    anos = [{"ano": 2016, "oni": 2.13, "fase": "el_nino"}]
    path.write_text(json.dumps({"versao_dados": versao, "anos": anos}), encoding="utf-8")
    settings = Settings(_env_file=None, oni_path=path)
    monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
    dependencies.get_enso_repository.cache_clear()

    try:
        years = dependencies.get_enso_repository().get_oni_years()
    finally:
        dependencies.get_enso_repository.cache_clear()

    assert [(y.ano, y.fase) for y in years] == [(2016, "el_nino")]
