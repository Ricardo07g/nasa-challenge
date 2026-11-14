"""Ligação das dependências: com DATABASE_URL, PostGIS com a fixture de reserva; sem, só arquivos.

Nenhum teste aqui conecta no banco: os repositories do PostGIS só abrem conexão quando consultados.
"""

from collections.abc import Callable, Iterator

import pytest

from app import dependencies
from app.config import Settings
from app.models.climate import ClimateSeason
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import (
    FixtureClimateRepository,
    PostgisClimateRepository,
)
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
def use_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[[str | None], None]]:
    def _apply(database_url: str | None) -> None:
        settings = Settings(_env_file=None, database_url=database_url)
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
