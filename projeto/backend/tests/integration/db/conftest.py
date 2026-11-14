"""PostGIS de teste para os testes marcados `db`.

Rodam só com `TEST_DATABASE_URL` (um banco só para teste, com PostGIS); sem ela, são pulados.
As migrações são aplicadas uma vez por sessão (`alembic upgrade head` apontando para o banco de
teste) e as tabelas são esvaziadas antes e depois de cada teste. POWER e SoilGrids são sempre
falsos: nada de rede real.
"""

import os
from collections.abc import Iterator

import psycopg
import pytest
from fastapi.testclient import TestClient

from app import dependencies
from app.config import Settings
from app.main import app
from tests.integration.db.support import (
    TABLES,
    Api,
    FakeNasaPowerClient,
    FakeSoilGridsClient,
    run_alembic,
)

DATA_ENV_VARS = ("CULTURAS_PATH", "CLIMA_PATH", "SOLO_CACHE_PATH", "NDVI_CACHE_PATH", "CMIP6_PATH")


@pytest.fixture(scope="session")
def migrated_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL não definida: testes com banco pulados")
    result = run_alembic(url, "upgrade", "head")
    if result.returncode != 0:
        pytest.fail(f"alembic upgrade head falhou no banco de teste:\n{result.stderr}")
    return url


def _truncate(url: str) -> None:
    with psycopg.connect(url) as conn:
        conn.execute(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE;")


@pytest.fixture
def db_url(migrated_database_url: str) -> Iterator[str]:
    _truncate(migrated_database_url)
    yield migrated_database_url
    _truncate(migrated_database_url)


def _clear_dependency_caches() -> None:
    dependencies.get_climate_repository.cache_clear()
    dependencies.get_soil_repository.cache_clear()
    dependencies.get_crop_params_repository.cache_clear()
    dependencies.get_ndvi_repository.cache_clear()


@pytest.fixture
def api(db_url: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[Api]:
    """A API montada pelo dependencies.py de verdade, com DATABASE_URL = banco de teste."""
    for name in DATA_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None, database_url=db_url)
    monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
    _clear_dependency_caches()
    fakes = Api(client=TestClient(app), nasa=FakeNasaPowerClient(), soil=FakeSoilGridsClient())
    app.dependency_overrides[dependencies.get_nasa_power_client] = lambda: fakes.nasa
    app.dependency_overrides[dependencies.get_soilgrids_client] = lambda: fakes.soil
    yield fakes
    app.dependency_overrides.clear()
    _clear_dependency_caches()
