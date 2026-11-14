"""Monta as temporadas de clima (1/jan a 31/jul) a partir da série diária bruta do NASA POWER.

Calcula a ETo de cada dia pelo FAO-56 Penman-Monteith. Quando falta alguma entrada do
Penman-Monteith na temporada (UR, vento, radiação ou a altitude), a temporada inteira usa
Hargreaves-Samani (FAO-56 eq. 52), que só precisa da máxima, da mínima e da latitude.
"""

from collections.abc import Sequence
from datetime import date, timedelta
from typing import Final

from app.constants import CLIMATE_SEASON_DAYS, HISTORICAL_END_YEAR, HISTORICAL_START_YEAR
from app.models.climate import ClimateSeason, DailyWeatherRecord, PowerDailySeries
from app.services.water_balance_calculator import WaterBalanceCalculator

SEASON_START_MONTH: Final[int] = 1
SEASON_START_DAY: Final[int] = 1
POWER_RAIN_SOURCE: Final[str] = "nasa_power"


def _season_window(year: int) -> list[date]:
    start = date(year, SEASON_START_MONTH, SEASON_START_DAY)
    return [start + timedelta(days=offset) for offset in range(CLIMATE_SEASON_DAYS)]


class ClimateSeasonBuilder:
    """Agrupa a série diária em temporadas por ano e calcula a ETo de referência."""

    def __init__(
        self,
        wb_calculator: WaterBalanceCalculator,
        start_year: int = HISTORICAL_START_YEAR,
        end_year: int = HISTORICAL_END_YEAR,
    ) -> None:
        self._wb = wb_calculator
        self._start_year = start_year
        self._end_year = end_year

    def request_window(self) -> tuple[date, date]:
        """Período a pedir ao POWER: do 1º dia da 1ª temporada ao último dia da última."""
        return _season_window(self._start_year)[0], _season_window(self._end_year)[-1]

    def build(self, series: PowerDailySeries, cell_id: str, lat: float) -> list[ClimateSeason]:
        """Uma temporada por ano com a janela completa; o ano sem algum dia da janela fica de fora.

        Args:
            series: Série diária bruta do NASA POWER.
            cell_id: Id da célula de 0,1° que recebe as temporadas.
            lat: Latitude do ponto (graus decimais), usada na radiação extraterrestre.

        Returns:
            Temporadas em ordem de ano.
        """
        by_date = {record.data: record for record in series.days}
        seasons: list[ClimateSeason] = []
        for year in range(self._start_year, self._end_year + 1):
            window = _season_window(year)
            if any(day not in by_date for day in window):
                continue
            records = [by_date[day] for day in window]
            seasons.append(
                ClimateSeason(
                    cell_id=cell_id,
                    year=year,
                    start_date=window[0],
                    lat=lat,
                    rain_mm=tuple(r.prectotcorr for r in records),
                    rain_source=POWER_RAIN_SOURCE,
                    tmax_c=tuple(r.t2m_max for r in records),
                    tmin_c=tuple(r.t2m_min for r in records),
                    eto_mm=self._reference_eto(records, lat, series.elevation_m),
                    rh2m_pct=tuple(r.rh2m for r in records),
                    ws2m_ms=tuple(r.ws2m for r in records),
                    solar_rad_mj=tuple(r.allsky_sfc_sw_dwn for r in records),
                )
            )
        return seasons

    def _reference_eto(
        self, records: Sequence[DailyWeatherRecord], lat: float, elevation_m: float | None
    ) -> tuple[float, ...]:
        has_penman_inputs = elevation_m is not None and all(
            r.rh2m is not None and r.ws2m is not None and r.allsky_sfc_sw_dwn is not None
            for r in records
        )
        if not has_penman_inputs:
            return tuple(
                self._wb.hargreaves_eto(
                    t_max=r.t2m_max,
                    t_min=r.t2m_min,
                    lat_deg=lat,
                    day_of_year=r.data.timetuple().tm_yday,
                )
                for r in records
            )
        return tuple(
            self._wb.penman_monteith_eto(
                t_max=r.t2m_max,
                t_min=r.t2m_min,
                actual_vapour_pressure_kpa=self._wb.actual_vapour_pressure_from_rh_mean(
                    t_max=r.t2m_max, t_min=r.t2m_min, rh_mean_pct=r.rh2m
                ),
                wind_2m_ms=r.ws2m,
                solar_rad_mj=r.allsky_sfc_sw_dwn,
                lat_deg=lat,
                day_of_year=r.data.timetuple().tm_yday,
                elevation_m=elevation_m,
            )
            for r in records
        )
