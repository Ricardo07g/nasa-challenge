"""Repositories das tabelas da migração R1.6 (tarefa 0013) contra o banco de teste.

Cada tabela aceita e devolve um registro do seu contrato ("Contrato dos dados das fontes", no
AGENTS.md do backend). Os valores são de teste, não dado real.
"""

from datetime import UTC, date, datetime

import psycopg
import pytest

from app.models.climate import Cmip6Delta, SmapSoilMoisture
from app.models.data_run import DataRun
from app.models.talhao import NdviRecord
from app.repositories.climate_repository import cell_center_wkt, cell_polygon_wkt
from app.repositories.cmip6_repository import PostgisCmip6Repository
from app.repositories.data_run_repository import PostgisDataRunRepository
from app.repositories.ndvi_repository import PostgisNdviRepository
from app.repositories.point_cache import point_key
from app.repositories.smap_repository import PostgisSmapRepository

pytestmark = pytest.mark.db

CELL_ID = "-190_-482"
# Fazenda do Glória (UFU), a fazenda de exemplo
LAT, LON = -18.9543, -48.1993


def _insert_cell(db_url: str, cell_id: str) -> None:
    with psycopg.connect(db_url) as conn:
        conn.execute(
            "INSERT INTO grid_cell (id, geom, center) "
            "VALUES (%s, ST_GeomFromText(%s, 4326), ST_GeomFromText(%s, 4326));",
            (cell_id, cell_polygon_wkt(cell_id), cell_center_wkt(cell_id)),
        )


def test_should_save_and_read_monthly_cmip6_deltas_per_model(db_url: str) -> None:
    _insert_cell(db_url, CELL_ID)
    repo = PostgisCmip6Repository(db_url)
    with_tmin = Cmip6Delta("ACCESS-CM2", "ssp245", 3, rain_pct=-8.5, tmax_c=1.6, tmin_c=1.2)
    without_tmin = Cmip6Delta("MRI-ESM2-0", "ssp245", 2, rain_pct=4.0, tmax_c=1.1)

    repo.save_cmip6_deltas(CELL_ID, [with_tmin, without_tmin])
    deltas = repo.get_cmip6_deltas(CELL_ID)

    assert [(d.model, d.scenario, d.month) for d in deltas] == [
        ("ACCESS-CM2", "ssp245", 3),
        ("MRI-ESM2-0", "ssp245", 2),
    ]
    assert (deltas[0].rain_pct, deltas[0].tmax_c, deltas[0].tmin_c) == pytest.approx(
        (-8.5, 1.6, 1.2)
    )
    assert deltas[1].tmin_c is None
    assert repo.get_cmip6_deltas("-178_-510") == []


def test_should_replace_the_delta_of_the_same_model_scenario_and_month(db_url: str) -> None:
    _insert_cell(db_url, CELL_ID)
    repo = PostgisCmip6Repository(db_url)
    repo.save_cmip6_deltas(CELL_ID, [Cmip6Delta("ACCESS-CM2", "ssp245", 3, -8.5, 1.6)])

    repo.save_cmip6_deltas(CELL_ID, [Cmip6Delta("ACCESS-CM2", "ssp245", 3, -2.0, 0.9)])

    [delta] = repo.get_cmip6_deltas(CELL_ID)
    assert (delta.rain_pct, delta.tmax_c) == pytest.approx((-2.0, 0.9))


def test_should_refuse_cmip6_deltas_of_a_cell_that_is_not_in_the_grid(db_url: str) -> None:
    repo = PostgisCmip6Repository(db_url)

    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        repo.save_cmip6_deltas(CELL_ID, [Cmip6Delta("ACCESS-CM2", "ssp245", 3, -8.5, 1.6)])


def test_should_save_and_read_the_ndvi_series_of_a_point_with_product_and_quality(
    db_url: str,
) -> None:
    repo = PostgisNdviRepository(db_url)
    terra = NdviRecord(data=date(2016, 4, 6), ndvi=0.71, qualidade=0, produto="MOD13Q1")
    aqua_same_day = NdviRecord(data=date(2016, 4, 6), ndvi=0.69, qualidade=1, produto="MYD13Q1")
    later = NdviRecord(data=date(2016, 4, 22), ndvi=0.64, qualidade=0, produto="MOD13Q1")

    repo.save_ndvi_history(LAT, LON, [later, terra, aqua_same_day])
    series = repo.get_ndvi_history(LAT, LON)

    assert [(r.data, r.produto, r.qualidade) for r in series] == [
        (date(2016, 4, 6), "MOD13Q1", 0),
        (date(2016, 4, 6), "MYD13Q1", 1),
        (date(2016, 4, 22), "MOD13Q1", 0),
    ]
    assert [r.ndvi for r in series] == pytest.approx([0.71, 0.69, 0.64])
    assert repo.get_ndvi_history(-17.78, -50.92) == []


def test_should_key_the_ndvi_point_by_the_cache_key_and_keep_its_geometry(db_url: str) -> None:
    PostgisNdviRepository(db_url).save_ndvi_history(
        LAT, LON, [NdviRecord(data=date(2016, 4, 6), ndvi=0.71, qualidade=0, produto="MOD13Q1")]
    )

    with psycopg.connect(db_url) as conn:
        row = conn.execute("SELECT key, ST_X(geom), ST_Y(geom), ST_SRID(geom) FROM ndvi_point;")
        saved = row.fetchone()

    assert saved is not None
    assert saved[0] == point_key(LAT, LON)
    assert saved[1:] == pytest.approx((LON, LAT, 4326))


def test_should_replace_the_ndvi_of_the_same_date_and_product(db_url: str) -> None:
    repo = PostgisNdviRepository(db_url)
    repo.save_ndvi_history(
        LAT, LON, [NdviRecord(data=date(2016, 4, 6), ndvi=0.71, qualidade=1, produto="MOD13Q1")]
    )

    repo.save_ndvi_history(
        LAT, LON, [NdviRecord(data=date(2016, 4, 6), ndvi=0.73, qualidade=0, produto="MOD13Q1")]
    )

    [record] = repo.get_ndvi_history(LAT, LON)
    assert (record.ndvi, record.qualidade) == (pytest.approx(0.73), 0)


def _smap(day: date, wetness: float, surface: float | None = None) -> SmapSoilMoisture:
    return SmapSoilMoisture(
        data=day,
        latitude=LAT,
        longitude=LON,
        sm_rootzone_m3_m3=0.31,
        sm_rootzone_wetness=wetness,
        fonte="smap",
        sm_surface_m3_m3=surface,
    )


def test_should_save_and_read_the_daily_smap_series_of_a_point(db_url: str) -> None:
    repo = PostgisSmapRepository(db_url)

    repo.save_smap_series([_smap(date(2024, 2, 19), 0.58), _smap(date(2024, 2, 18), 0.62, 0.27)])
    series = repo.get_smap_series(LAT, LON)

    assert [s.data for s in series] == [date(2024, 2, 18), date(2024, 2, 19)]
    first = series[0]
    assert (first.sm_rootzone_wetness, first.sm_rootzone_m3_m3, first.sm_surface_m3_m3) == (
        pytest.approx((0.62, 0.31, 0.27))
    )
    assert (first.latitude, first.longitude) == pytest.approx((LAT, LON))
    assert first.fonte == "smap"
    assert series[1].sm_surface_m3_m3 is None
    assert repo.get_smap_series(-17.78, -50.92) == []


def test_should_read_the_smap_series_of_a_cell_from_its_center(db_url: str) -> None:
    repo = PostgisSmapRepository(db_url)
    center = SmapSoilMoisture(date(2016, 2, 18), -18.95, -48.15, 0.31, 0.61, "smap")
    other = SmapSoilMoisture(date(2016, 2, 18), -18.9543, -48.1993, 0.29, 0.55, "smap")
    repo.save_smap_series([center, other])

    [record] = repo.get_cell_smap_series("-190_-482")

    assert (record.latitude, record.longitude, record.sm_rootzone_wetness) == (-18.95, -48.15, 0.61)
    assert repo.get_cell_smap_series("-200_-500") == []


def test_should_key_the_smap_point_by_the_cache_key_and_replace_the_same_day(
    db_url: str,
) -> None:
    repo = PostgisSmapRepository(db_url)
    repo.save_smap_series([_smap(date(2024, 2, 18), 0.62)])

    repo.save_smap_series([_smap(date(2024, 2, 18), 0.55)])

    [record] = repo.get_smap_series(LAT, LON)
    assert record.sm_rootzone_wetness == pytest.approx(0.55)
    with psycopg.connect(db_url) as conn:
        row = conn.execute("SELECT key, ST_SRID(geom) FROM smap_point;").fetchone()
    assert row == (point_key(LAT, LON), 4326)


def _run(source: str, finished_at: datetime, version: str) -> DataRun:
    return DataRun(
        source=source,
        params={"cenario": "ssp245", "modelos": ["ACCESS-CM2", "MRI-ESM2-0"]},
        finished_at=finished_at,
        version=version,
    )


def test_should_save_a_data_run_and_read_it_back_with_its_version(db_url: str) -> None:
    repo = PostgisDataRunRepository(db_url)
    finished_at = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)
    run = _run("nex_gddp_cmip6", finished_at, "2026.11-nex-gddp-cmip6")

    repo.save_run(run)

    assert repo.get_latest_run("nex_gddp_cmip6") == run
    assert repo.get_latest_run("smap") is None


def test_should_read_the_latest_run_of_the_source(db_url: str) -> None:
    repo = PostgisDataRunRepository(db_url)
    newer = _run("nex_gddp_cmip6", datetime(2026, 11, 14, 13, 0, tzinfo=UTC), "2026.11-b")
    older = _run("nex_gddp_cmip6", datetime(2026, 11, 1, 9, 0, tzinfo=UTC), "2026.11-a")

    repo.save_run(newer)
    repo.save_run(older)

    latest = repo.get_latest_run("nex_gddp_cmip6")
    assert latest is not None
    assert latest.version == "2026.11-b"
