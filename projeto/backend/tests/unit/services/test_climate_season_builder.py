"""Testes do ClimateSeasonBuilder: temporadas de 1/jan a 31/jul e ETo FAO-56 (tarefa 0004)."""

from dataclasses import replace
from datetime import date, timedelta

import pytest

from app.models.climate import DailyWeatherRecord, PowerDailySeries
from app.services.climate_season_builder import ClimateSeasonBuilder
from app.services.water_balance_calculator import WaterBalanceCalculator

LAT = -18.95
CELL_ID = "-190_-482"
ELEVATION_M = 850.0
SEASON_DAYS = 212  # 1/jan a 31/jul (plano técnico §5); em ano bissexto vai até 30/jul


def _day(day: date, rh: float | None = 75.0) -> DailyWeatherRecord:
    return DailyWeatherRecord(
        data=day,
        prectotcorr=5.0,
        t2m_max=30.0,
        t2m_min=19.0,
        rh2m=rh,
        ws2m=1.5,
        allsky_sfc_sw_dwn=18.0,
    )


def _series(start: date, end: date, elevation_m: float | None = ELEVATION_M) -> PowerDailySeries:
    days = [_day(start + timedelta(days=i)) for i in range((end - start).days + 1)]
    return PowerDailySeries(elevation_m=elevation_m, days=tuple(days))


def _builder(start_year: int = 2023, end_year: int = 2024) -> ClimateSeasonBuilder:
    return ClimateSeasonBuilder(WaterBalanceCalculator(), start_year=start_year, end_year=end_year)


def test_should_request_from_first_january_to_the_last_day_of_the_last_season() -> None:
    # 2024 é bissexto: 212 dias a partir de 1/jan terminam em 30/jul (igual ao export da fixture)
    assert _builder(2023, 2024).request_window() == (date(2023, 1, 1), date(2024, 7, 30))
    assert _builder(2005, 2023).request_window() == (date(2005, 1, 1), date(2023, 7, 31))


def test_should_build_one_212_day_season_per_year_from_first_january() -> None:
    series = _series(date(2023, 1, 1), date(2024, 12, 31))

    seasons = _builder().build(series, cell_id=CELL_ID, lat=LAT)

    assert [s.year for s in seasons] == [2023, 2024]
    for season in seasons:
        assert season.start_date == date(season.year, 1, 1)
        assert season.cell_id == CELL_ID
        assert season.lat == LAT
        assert season.rain_source == "nasa_power"
        assert len(season.rain_mm) == SEASON_DAYS
        assert len(season.eto_mm) == SEASON_DAYS
        assert season.tmax_c[0] == 30.0 and season.tmin_c[0] == 19.0
        assert season.rh2m_pct[0] == 75.0
        assert season.ws2m_ms[0] == 1.5
        assert season.solar_rad_mj[0] == 18.0


def test_should_compute_penman_monteith_eto_when_all_inputs_are_present() -> None:
    wb = WaterBalanceCalculator()
    series = _series(date(2023, 1, 1), date(2023, 7, 31))

    season = _builder(2023, 2023).build(series, cell_id=CELL_ID, lat=LAT)[0]

    ea = wb.actual_vapour_pressure_from_rh_mean(t_max=30.0, t_min=19.0, rh_mean_pct=75.0)
    for idx, day_of_year in ((0, 1), (59, 60), (211, 212)):
        assert season.eto_mm[idx] == wb.penman_monteith_eto(
            t_max=30.0,
            t_min=19.0,
            actual_vapour_pressure_kpa=ea,
            wind_2m_ms=1.5,
            solar_rad_mj=18.0,
            lat_deg=LAT,
            day_of_year=day_of_year,
            elevation_m=ELEVATION_M,
        )


def test_should_use_hargreaves_for_the_whole_season_when_a_day_lacks_humidity() -> None:
    wb = WaterBalanceCalculator()
    series = _series(date(2023, 1, 1), date(2024, 7, 30))
    gap = date(2023, 3, 10)
    days = tuple(replace(d, rh2m=None) if d.data == gap else d for d in series.days)

    seasons = _builder().build(replace(series, days=days), cell_id=CELL_ID, lat=LAT)

    hargreaves_2023 = tuple(
        wb.hargreaves_eto(t_max=30.0, t_min=19.0, lat_deg=LAT, day_of_year=i + 1)
        for i in range(SEASON_DAYS)
    )
    assert seasons[0].eto_mm == hargreaves_2023
    # O outro ano tem tudo: continua no Penman-Monteith
    assert seasons[1].eto_mm[0] != pytest.approx(hargreaves_2023[0])


def test_should_use_hargreaves_when_power_gives_no_elevation() -> None:
    wb = WaterBalanceCalculator()
    series = _series(date(2023, 1, 1), date(2023, 7, 31), elevation_m=None)

    season = _builder(2023, 2023).build(series, cell_id=CELL_ID, lat=LAT)[0]

    assert season.eto_mm[0] == wb.hargreaves_eto(t_max=30.0, t_min=19.0, lat_deg=LAT, day_of_year=1)


def test_should_skip_year_when_season_window_is_not_complete() -> None:
    series = _series(date(2022, 1, 1), date(2024, 5, 31))
    missing = date(2022, 4, 15)
    days = tuple(d for d in series.days if d.data != missing)

    seasons = _builder(2022, 2024).build(replace(series, days=days), cell_id=CELL_ID, lat=LAT)

    # 2022 perdeu um dia da janela; 2024 termina antes de 30/jul
    assert [s.year for s in seasons] == [2023]
