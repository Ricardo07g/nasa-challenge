"""Leituras do PostGIS que o raio-X usa (tela 4, remodelagem S4, tarefa 0043).

- a chuva somada de cada célula da caixa numa janela de dias (bloco "Sua área e a região");
- o solo gravado mais perto do ponto, mesmo de outra célula (ponto em célula sem solo).

Valores de teste redondos (não são do IMERG nem do SoilGrids): a fonte da chuva é `teste`.
"""

from datetime import date

import pytest

from app.models.climate import ClimateSeason
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import PostgisClimateRepository
from app.repositories.soil_repository import PostgisSoilRepository
from tests.integration.db.support import Api

pytestmark = pytest.mark.db

DAYS = 212
BOX = (-19.0, -18.8, -48.2, -48.0)  # lat_min, lat_max, lon_min, lon_max


def _season(cell: str, year: int, rain: float) -> ClimateSeason:
    return ClimateSeason(
        cell_id=cell,
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple([rain] * DAYS),
        rain_source="teste",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
        eto_mm=tuple([4.0] * DAYS),
    )


def test_should_sum_the_rain_of_each_cell_and_year_inside_the_window(db_url: str) -> None:
    repo = PostgisClimateRepository(db_url)
    repo.save_cell_seasons("-190_-482", -18.95, -48.15, [_season("-190_-482", 2023, 2.0)])
    repo.save_cell_seasons("-189_-481", -18.85, -48.05, [_season("-189_-481", 2024, 1.0)])

    totals = repo.rain_totals_in_window("03-01", "05-31", BOX)

    by_cell = {(t.cell_id, t.year): t for t in totals}
    assert set(by_cell) == {("-190_-482", 2023), ("-189_-481", 2024)}
    # 1º/mar a 31/mai = 92 dias, no ano comum e no bissexto.
    assert (by_cell[("-190_-482", 2023)].total_mm, by_cell[("-190_-482", 2023)].dias) == (
        pytest.approx(184.0),
        92,
    )
    assert by_cell[("-189_-481", 2024)].total_mm == pytest.approx(92.0)
    assert by_cell[("-189_-481", 2024)].rain_source == "teste"


def test_should_leave_out_cells_whose_center_is_outside_the_box(db_url: str) -> None:
    repo = PostgisClimateRepository(db_url)
    repo.save_cell_seasons("-190_-482", -18.95, -48.15, [_season("-190_-482", 2023, 2.0)])
    repo.save_cell_seasons("-200_-490", -19.95, -48.95, [_season("-200_-490", 2023, 2.0)])

    totals = repo.rain_totals_in_window("03-01", "05-31", BOX)

    assert {t.cell_id for t in totals} == {"-190_-482"}


ARGILOSO = SoloInfo(
    argila_percentual=46.0,
    areia_percentual=32.0,
    textura_solo="argiloso",
    cad_capacidade_agua_mm=60.0,
    fonte="soilgrids",
)


def test_should_find_the_nearest_soil_even_in_a_neighbor_cell(db_url: str) -> None:
    repo = PostgisSoilRepository(db_url)
    repo.save_soil(-18.85, -48.15, ARGILOSO)  # centro da célula -189_-482

    near = repo.get_nearest_soil(-18.92, -48.18)  # célula -190_-482, sem solo

    assert near is not None
    assert near.soil == ARGILOSO
    # ~8,3 km (0,07° de latitude e 0,03° de longitude)
    assert near.distancia_km == pytest.approx(8.4, abs=0.3)


def test_should_find_no_nearest_soil_in_an_empty_table(db_url: str) -> None:
    assert PostgisSoilRepository(db_url).get_nearest_soil(-18.92, -48.18) is None


def test_should_answer_the_x_ray_with_the_region_and_the_neighbor_soil(
    api: Api, db_url: str
) -> None:
    # 12 células da caixa piloto com 20 anos cada; a do ponto chove menos que as outras e não tem
    # solo, mas a célula vizinha tem (a ~8 km).
    climate = PostgisClimateRepository(db_url)
    cells = [f"-190_-48{i}" for i in range(2, 4)] + [f"-189_-48{i}" for i in range(0, 10)]
    for cell in cells:
        lat_idx, lon_idx = (int(part) for part in cell.split("_"))
        rain = 2.0 if cell == "-190_-482" else 6.0
        climate.save_cell_seasons(
            cell,
            (lat_idx + 0.5) / 10,
            (lon_idx + 0.5) / 10,
            [_season(cell, year, rain) for year in range(2005, 2025)],
        )
    PostgisSoilRepository(db_url).save_soil(-18.85, -48.15, ARGILOSO)

    response = api.client.get(
        "/api/raio-x", params={"lat": -18.92, "lon": -48.18, "colheita": "meio"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["regiao"]["celulas"] == 12
    assert body["regiao"]["pct_mais_seca"] == 100
    assert body["solo"]["textura"] == "argiloso"
    assert body["solo"]["vizinho_km"] == pytest.approx(8.4, abs=0.3)
