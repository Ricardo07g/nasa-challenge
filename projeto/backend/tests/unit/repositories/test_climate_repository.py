"""Unit tests for DataOutputClimateRepository and PostgisClimateRepository."""

from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.models.climate import ClimateSeason
from app.repositories.climate_repository import (
    DataOutputClimateRepository,
    PostgisClimateRepository,
)


def test_should_return_cell_id_when_coordinates_are_inside_pilot_area() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    cell_id = repo.find_cell_id(-18.9186, -48.2772)

    assert cell_id == "-189_-483"


def test_should_return_none_when_coordinates_are_outside_pilot_area_and_not_ingested() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    assert repo.find_cell_id(-23.5505, -46.6333) is None


def test_should_return_ingested_cell_id_and_seasons_after_save_cell_seasons_called() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))
    custom_season = ClimateSeason(
        cell_id="-178_-509",
        year=2024,
        start_date=date(2024, 1, 1),
        rain_mm=(10.0, 5.0),
        rain_source="nasa_power",
        tmax_c=(31.0, 30.0),
        tmin_c=(19.0, 18.0),
        eto_mm=(4.1, 4.0),
        gwetroot=(0.7, 0.7),
    )

    repo.save_cell_seasons("-178_-509", lat=-17.78, lon=-50.92, seasons=[custom_season])

    assert repo.find_cell_id(-17.78, -50.92) == "-178_-509"
    assert repo.get_seasons("-178_-509") == [custom_season]


def test_should_return_twenty_seasons_from_2005_to_2024_when_get_seasons_called() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    seasons = repo.get_seasons("-189_-483")

    assert len(seasons) == 20
    assert [s.year for s in seasons] == list(range(2005, 2025))
    assert all(len(s.rain_mm) > 150 for s in seasons)
    assert all(len(s.eto_mm) == len(s.rain_mm) for s in seasons)


def test_should_return_cmip6_delta_and_smap_moisture_when_queried() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    delta = repo.get_cmip6_delta("-189_-483")
    smap = repo.get_latest_smap(-18.9186, -48.2772)

    assert delta.cenario == "SSP2-4.5"
    assert delta.variacao_chuva_safrinha_pct == -12.5
    assert delta.aumento_temperatura_media_c == 1.8
    assert smap is not None
    assert 0.0 < smap.sm_rootzone_wetness <= 1.0


def test_should_execute_idempotent_postgis_queries_when_postgis_repository_used(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    executed_queries: list[tuple[str, Any]] = []

    class FakeCursor:
        def __enter__(self) -> "FakeCursor":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def execute(self, query: str, params: Any = None) -> None:
            executed_queries.append((query, params))

        def fetchone(self) -> tuple[str] | None:
            return ("-178_-509",)

    class FakeConn:
        def __enter__(self) -> "FakeConn":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def cursor(self) -> FakeCursor:
            return FakeCursor()

        def commit(self) -> None:
            pass

    monkeypatch.setattr("psycopg.connect", lambda url: FakeConn())
    postgis_repo = PostgisClimateRepository("postgresql://fake:fake@localhost:5432/db")

    found_id = postgis_repo.find_cell_id(-17.78, -50.92)
    nearest_id = postgis_repo.find_nearest_cell_id(-17.78, -50.92)
    postgis_repo.save_cell_seasons(
        "-178_-509",
        lat=-17.78,
        lon=-50.92,
        seasons=[
            ClimateSeason(
                cell_id="-178_-509",
                year=2024,
                start_date=date(2024, 1, 1),
                rain_mm=(8.0,),
                rain_source="nasa_power",
                tmax_c=(30.0,),
                tmin_c=(18.0,),
                eto_mm=(4.0,),
                gwetroot=(0.6,),
            )
        ],
    )

    assert found_id == "-178_-509"
    assert nearest_id == "-178_-509"
    assert any("ST_Intersects" in q for q, _ in executed_queries)
    assert any("ST_ClosestPoint" in q for q, _ in executed_queries)
    assert any("ON CONFLICT (id) DO UPDATE" in q for q, _ in executed_queries)
    assert any("ON CONFLICT (cell_id, year) DO UPDATE" in q for q, _ in executed_queries)
