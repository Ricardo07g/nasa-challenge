"""Unit tests do pipeline que gera o arquivo de clima da fazenda de exemplo."""

import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from pipeline.export_climate_fixture import build_climate_fixture, power_cell_bounds

LAT, LON = -18.9543, -48.1993
FIXTURE_PATH = (
    Path(__file__).resolve().parents[3] / "app" / "fixtures" / "clima_fazenda_exemplo.json"
)


def _daily(year: int, days: int, rain: float = 1.0) -> list[dict]:
    start = date(year, 1, 1)
    return [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "PRECTOTCORR": rain,
            "T2M_MAX": 30.004,
            "T2M_MIN": 18.0,
            "T2M": 24.0,
            "ALLSKY_SFC_SW_DWN": 20.0,
        }
        for i in range(days)
    ]


def test_should_bound_the_nasa_power_cell_that_contains_the_point() -> None:
    # MERRA-2 (POWER): grade de 0,5° de latitude por 0,625° de longitude
    assert power_cell_bounds(LAT, LON) == {
        "lat_min": -19.25,
        "lat_max": -18.75,
        "lon_min": -48.4375,
        "lon_max": -47.8125,
    }


def test_should_build_one_season_per_year_from_january_to_july() -> None:
    fixture = build_climate_fixture(_daily(2005, 365) + _daily(2006, 365), lat=LAT, lon=LON)

    temporadas = fixture["temporadas"]
    assert [t["ano"] for t in temporadas] == [2005, 2006]
    assert temporadas[0]["inicio"] == "2005-01-01"
    assert len(temporadas[0]["chuva_mm"]) == 212
    assert temporadas[0]["tmax_c"][0] == 30.0  # arredondado em 2 casas
    assert fixture["fonte"] == "nasa_power"
    assert fixture["ponto"] == {"lat": LAT, "lon": LON}
    assert fixture["cobertura"] == power_cell_bounds(LAT, LON)


def test_should_describe_the_demo_field_like_the_fixture_shipped_with_the_api() -> None:
    # O ponto fica perto da Fazenda do Glória, mas não garantidamente dentro dela: a descrição usa
    # o nome da lavoura de demonstração, igual à do arquivo que vai junto com a API.
    fixture = build_climate_fixture(_daily(2005, 365), lat=LAT, lon=LON)
    shipped = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    assert "lavoura de demonstração, perto de Uberlândia (MG)" in fixture["descricao"]
    assert fixture["descricao"] == shipped["descricao"]


def test_should_skip_year_without_full_january_to_july_window() -> None:
    fixture = build_climate_fixture(_daily(2005, 365) + _daily(2006, 100), lat=LAT, lon=LON)

    assert [t["ano"] for t in fixture["temporadas"]] == [2005]


@pytest.mark.parametrize("missing", [-999.0, None])
def test_should_fail_loudly_when_nasa_value_is_missing(missing: float | None) -> None:
    # PRD 6.1: no POWER, -999 é dado ausente. Não pode virar 0 mm de chuva sem ninguém ver.
    records = _daily(2005, 365)
    records[40]["PRECTOTCORR"] = missing

    with pytest.raises(ValueError, match="2005-02-10"):
        build_climate_fixture(records, lat=LAT, lon=LON)


def test_should_keep_zero_rain_as_zero() -> None:
    fixture = build_climate_fixture(_daily(2005, 365, rain=0.0), lat=LAT, lon=LON)

    assert set(fixture["temporadas"][0]["chuva_mm"]) == {0.0}
