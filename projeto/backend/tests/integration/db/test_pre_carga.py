"""Pré-carga de ponta a ponta no PostGIS de teste (R1.5).

POWER e SoilGrids são falsos; repositories, banco e API são os de verdade. O objetivo da
pré-carga: o primeiro clique em qualquer ponto de uma célula carregada sai do banco, sem busca.
"""

import psycopg
import pytest

from app.repositories.climate_repository import PostgisClimateRepository
from app.repositories.data_run_repository import PostgisDataRunRepository
from app.repositories.soil_repository import PostgisSoilRepository
from pipeline.preload_pilot_box import PilotBoxPreloader, pilot_box_cells
from tests.integration.db.support import Api, FakeNasaPowerClient, FakeSoilGridsClient, count_rows

pytestmark = pytest.mark.db

FARM_CELL_ID = "-190_-482"
# Na célula da fazenda, longe do centro (-18,95 / -48,15) e do ponto da fazenda.
CLICK = {"lat": -18.92, "lon": -48.11}


def _preloader(
    db_url: str, nasa: FakeNasaPowerClient, soil: FakeSoilGridsClient
) -> PilotBoxPreloader:
    return PilotBoxPreloader(
        nasa_client=nasa,
        soil_client=soil,
        climate_repo=PostgisClimateRepository(db_url),
        soil_repo=PostgisSoilRepository(db_url),
        run_repo=PostgisDataRunRepository(db_url),
        soil_pause_seconds=0.0,
        sleep=lambda _seconds: None,
    )


def test_should_answer_a_click_anywhere_in_a_preloaded_cell_without_fetching(
    api: Api, db_url: str
) -> None:
    preloader = _preloader(db_url, FakeNasaPowerClient(), FakeSoilGridsClient())
    preloader.run(preloader.plan(pilot_box_cells(), limit=1))  # a célula da fazenda

    talhao = api.client.get("/api/talhao", params=CLICK)
    rec = api.client.get("/api/recomendacao", params=CLICK)

    assert talhao.status_code == 200
    body = talhao.json()
    assert body["celula_id"] == FARM_CELL_ID
    assert body["solo"]["fonte"] == "soilgrids"  # o solo da célula, não o padrão
    assert rec.status_code == 200
    assert api.nasa.calls == []
    assert api.soil.calls == []
    assert count_rows(db_url, "climate_season") == 20
    assert count_rows(db_url, "soil_point") == 2  # centro da célula + ponto da fazenda
    with psycopg.connect(db_url) as conn:
        runs = conn.execute("SELECT source, version FROM data_run ORDER BY source;").fetchall()
    assert [source for source, _ in runs] == ["nasa_power", "soilgrids"]
    assert all(version.endswith("-preload-pilot-box") for _, version in runs)


def test_should_not_fetch_again_what_a_previous_run_saved(db_url: str) -> None:
    farm_cell = pilot_box_cells()[:1]
    first = _preloader(db_url, FakeNasaPowerClient(), FakeSoilGridsClient())
    first.run(first.plan(farm_cell))
    nasa, soil = FakeNasaPowerClient(), FakeSoilGridsClient()
    second = _preloader(db_url, nasa, soil)

    plan = second.plan(farm_cell)
    second.run(plan)

    assert plan.cells_already_loaded == 1
    assert (plan.power_calls, plan.soilgrids_calls) == (0, 0)
    assert nasa.calls == soil.calls == []
    assert count_rows(db_url, "data_run") == 2  # só a primeira execução chamou as fontes


def test_should_not_save_the_default_soil_when_soilgrids_fails(db_url: str) -> None:
    soil = FakeSoilGridsClient()
    soil.should_fail = True
    preloader = _preloader(db_url, FakeNasaPowerClient(), soil)

    report = preloader.run(preloader.plan(pilot_box_cells()[:1]))

    assert (report.soil_saved, report.soil_failures) == (0, 2)
    assert count_rows(db_url, "soil_point") == 0
    assert count_rows(db_url, "grid_cell") == 1  # o clima entra mesmo sem o solo
