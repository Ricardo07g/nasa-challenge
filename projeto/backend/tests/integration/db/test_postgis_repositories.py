"""Repositories do PostGIS contra o banco de teste: id floor, polígono, latitude e solo."""

from datetime import date

import psycopg
import pytest

from app.models.climate import ClimateSeason
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import PostgisClimateRepository
from app.repositories.soil_repository import PostgisSoilRepository

pytestmark = pytest.mark.db


def _season(cell_id: str, year: int) -> ClimateSeason:
    return ClimateSeason(
        cell_id=cell_id,
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=(1.0, 2.0),
        rain_source="teste",
        tmax_c=(30.0, 31.0),
        tmin_c=(18.0, 19.0),
        eto_mm=(4.0, 4.1),
    )


def test_should_find_saved_cell_for_points_inside_and_on_the_lower_edges(db_url: str) -> None:
    repo = PostgisClimateRepository(db_url)
    repo.save_cell_seasons(
        "-190_-483", lat=-18.92, lon=-48.27, seasons=[_season("-190_-483", 2005)]
    )

    assert repo.find_cell_id(-18.92, -48.27) == "-190_-483"
    assert repo.find_cell_id(-19.0, -48.3) == "-190_-483"  # canto de baixo: é desta célula
    assert repo.find_cell_id(-18.9, -48.27) is None  # borda de cima: já é a célula -189


def test_should_save_cell_polygon_with_edges_on_the_tenths_and_center_inside(db_url: str) -> None:
    PostgisClimateRepository(db_url).save_cell_seasons(
        "-190_-483", lat=-18.92, lon=-48.27, seasons=[_season("-190_-483", 2005)]
    )

    with psycopg.connect(db_url) as conn:
        row = conn.execute(
            "SELECT ST_XMin(geom), ST_YMin(geom), ST_XMax(geom), ST_YMax(geom), "
            "ST_X(center), ST_Y(center), ST_SRID(geom) FROM grid_cell WHERE id = '-190_-483';"
        ).fetchone()

    assert row is not None
    assert row[:6] == pytest.approx((-48.3, -19.0, -48.2, -18.9, -48.25, -18.95))
    assert row[6] == 4326


def test_should_read_seasons_back_with_the_cell_center_latitude(db_url: str) -> None:
    repo = PostgisClimateRepository(db_url)
    repo.save_cell_seasons(
        "-178_-510",
        lat=-17.78,
        lon=-50.92,
        seasons=[_season("-178_-510", 2005), _season("-178_-510", 2006)],
    )

    seasons = repo.get_seasons("-178_-510")

    assert [s.year for s in seasons] == [2005, 2006]
    assert all(s.lat == pytest.approx(-17.75) for s in seasons)
    assert seasons[0].rain_mm == (1.0, 2.0)


def test_should_round_trip_soilgrids_soil_and_fall_back_to_default_elsewhere(db_url: str) -> None:
    repo = PostgisSoilRepository(db_url)
    repo.save_soil(
        -17.78,
        -50.92,
        SoloInfo(
            argila_percentual=46.0,
            areia_percentual=32.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        ),
    )

    saved = repo.get_soil(-17.78, -50.92)
    elsewhere = repo.get_soil(-17.50, -50.50)

    assert (saved.textura_solo, saved.fonte) == ("argiloso", "soilgrids")
    assert (elsewhere.textura_solo, elsewhere.fonte) == ("medio", "padrao")
