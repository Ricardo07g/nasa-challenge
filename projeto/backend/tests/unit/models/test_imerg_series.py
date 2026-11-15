"""Contrato da chuva diária do GPM IMERG Final por célula de 0,1° (R2.4, tarefa 0026).

Valores claramente de teste (1.5, 2.25 etc.): nada aqui é dado real do IMERG.
"""

from dataclasses import fields
from datetime import date

import pytest

from app.constants import CLIMATE_SEASON_DAYS
from app.models.climate import ImergCellSeries, ImergSeason


def _rain(value: float | None = 1.5) -> tuple[float | None, ...]:
    return tuple(value for _ in range(CLIMATE_SEASON_DAYS))


def _season(**overrides: object) -> ImergSeason:
    values: dict[str, object] = {
        "year": 2010,
        "start_date": date(2010, 1, 1),
        "rain_mm": _rain(),
    }
    values.update(overrides)
    return ImergSeason(**values)  # type: ignore[arg-type]


def _series(**overrides: object) -> ImergCellSeries:
    values: dict[str, object] = {
        "cell_id": "-190_-482",
        "latitude": -18.95,
        "longitude": -48.15,
        "seasons": (_season(),),
    }
    values.update(overrides)
    return ImergCellSeries(**values)  # type: ignore[arg-type]


def test_season_should_carry_year_start_and_daily_rain() -> None:
    assert [f.name for f in fields(ImergSeason)] == ["year", "start_date", "rain_mm"]


def test_season_should_have_the_212_days_of_the_power_seasons() -> None:
    # Mesma janela do ClimateSeasonBuilder: 212 dias desde 1/jan (no bissexto, até 30/jul).
    assert len(_season().rain_mm) == 212


@pytest.mark.parametrize("days", [211, 213, 0])
def test_season_should_reject_other_lengths(days: int) -> None:
    with pytest.raises(ValueError, match="rain_mm"):
        _season(rain_mm=tuple(1.5 for _ in range(days)))


def test_season_should_start_on_january_first_of_its_year() -> None:
    with pytest.raises(ValueError, match="start_date"):
        _season(start_date=date(2010, 2, 1))
    with pytest.raises(ValueError, match="start_date"):
        _season(start_date=date(2011, 1, 1))


def test_season_should_keep_missing_days_as_none_never_zero() -> None:
    rain = (None, 2.25, *_rain(0.0)[2:])

    season = _season(rain_mm=rain)

    assert season.rain_mm[0] is None
    assert season.rain_mm[1] == 2.25
    assert season.rain_mm[2] == 0.0


@pytest.mark.parametrize("value", [-0.01, -9999.9, float("nan"), float("inf")])
def test_season_should_reject_negative_or_non_finite_rain(value: float) -> None:
    with pytest.raises(ValueError, match="rain_mm"):
        _season(rain_mm=(value, *_rain()[1:]))


def test_season_should_tell_whether_every_day_has_rain() -> None:
    assert _season().complete is True
    assert _season(rain_mm=(*_rain()[:-1], None)).complete is False
    assert _season(rain_mm=(*_rain()[:-1], None)).missing_days == 1


def test_series_should_carry_cell_center_and_seasons() -> None:
    assert [f.name for f in fields(ImergCellSeries)] == [
        "cell_id",
        "latitude",
        "longitude",
        "seasons",
    ]


@pytest.mark.parametrize("cell_id", ["", "abc", "-190", "-190_-482_1", "-19.0_-48.2"])
def test_series_should_reject_cell_id_outside_the_floor_format(cell_id: str) -> None:
    with pytest.raises(ValueError, match="cell_id"):
        _series(cell_id=cell_id)


def test_series_should_reject_coordinates_that_are_not_the_cell_center() -> None:
    # O centro da célula -190_-482 é (-18,95, -48,15): ((idx + 0,5) / 10).
    with pytest.raises(ValueError, match="centro"):
        _series(latitude=-18.9543, longitude=-48.1993)


@pytest.mark.parametrize(
    ("field_name", "value"), [("latitude", -90.5), ("longitude", 180.5), ("latitude", float("nan"))]
)
def test_series_should_reject_coordinates_outside_the_globe(field_name: str, value: float) -> None:
    with pytest.raises(ValueError, match=field_name):
        _series(**{field_name: value})


def test_series_should_reject_repeated_years() -> None:
    with pytest.raises(ValueError, match="2010"):
        _series(seasons=(_season(), _season()))


def test_series_should_accept_a_cell_in_the_southern_and_western_hemispheres() -> None:
    series = _series(
        cell_id="-199_-490",
        latitude=-19.85,
        longitude=-48.95,
        seasons=(_season(), _season(year=2012, start_date=date(2012, 1, 1))),
    )

    assert [s.year for s in series.seasons] == [2010, 2012]
