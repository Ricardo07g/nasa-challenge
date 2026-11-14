"""Monta as temporadas de clima (1/jan a 31/jul) a partir da série diária bruta do NASA POWER.

Nenhum valor é inventado (tarefa 0005):

- ano com algum dia sem chuva, máxima ou mínima (ou sem o dia) fica fora da série, como no
  `pipeline/export_climate_fixture.py`; a contagem de anos da resposta cai junto;
- ETo diária pelo FAO-56 Penman-Monteith. Se faltar UR, vento ou radiação em algum dia da
  temporada (ou a altitude), a temporada inteira usa Hargreaves-Samani (FAO-56 eq. 52), que só
  precisa da máxima, da mínima e da latitude; a série que tinha o buraco não é gravada.
"""

import logging
from collections.abc import Sequence
from datetime import date, timedelta
from typing import Final

from app.constants import CLIMATE_SEASON_DAYS, HISTORICAL_END_YEAR, HISTORICAL_START_YEAR
from app.models.climate import ClimateSeason, PowerDailySeries
from app.services.water_balance_calculator import WaterBalanceCalculator

logger = logging.getLogger(__name__)

SEASON_START_MONTH: Final[int] = 1
SEASON_START_DAY: Final[int] = 1
POWER_RAIN_SOURCE: Final[str] = "nasa_power"


def _season_window(year: int) -> list[date]:
    start = date(year, SEASON_START_MONTH, SEASON_START_DAY)
    return [start + timedelta(days=offset) for offset in range(CLIMATE_SEASON_DAYS)]


def _complete(values: Sequence[float | None]) -> tuple[float, ...] | None:
    """A série inteira, ou None se algum dia estiver sem dado."""
    present = tuple(v for v in values if v is not None)
    return present if len(present) == len(values) else None


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
        """Uma temporada por ano completo; ano com dia faltando (chuva ou temperatura) fica de fora.

        Args:
            series: Série diária bruta do NASA POWER (None = sem dado).
            cell_id: Id da célula de 0,1° que recebe as temporadas.
            lat: Latitude do ponto (graus decimais), usada na radiação extraterrestre.

        Returns:
            Temporadas em ordem de ano.
        """
        by_date = {record.data: record for record in series.days}
        seasons: list[ClimateSeason] = []
        for year in range(self._start_year, self._end_year + 1):
            window = _season_window(year)
            records = [by_date[day] for day in window if day in by_date]
            rain = _complete([r.prectotcorr for r in records])
            tmax = _complete([r.t2m_max for r in records])
            tmin = _complete([r.t2m_min for r in records])
            if len(records) < len(window) or rain is None or tmax is None or tmin is None:
                logger.info("NASA POWER sem dado em %s na temporada de %d: ano fora", cell_id, year)
                continue
            rh = _complete([r.rh2m for r in records])
            wind = _complete([r.ws2m for r in records])
            radiation = _complete([r.allsky_sfc_sw_dwn for r in records])
            seasons.append(
                ClimateSeason(
                    cell_id=cell_id,
                    year=year,
                    start_date=window[0],
                    lat=lat,
                    rain_mm=rain,
                    rain_source=POWER_RAIN_SOURCE,
                    tmax_c=tmax,
                    tmin_c=tmin,
                    eto_mm=self._reference_eto(
                        window, tmax, tmin, rh, wind, radiation, lat, series.elevation_m
                    ),
                    rh2m_pct=rh or (),
                    ws2m_ms=wind or (),
                    solar_rad_mj=radiation or (),
                )
            )
        return seasons

    def _reference_eto(
        self,
        window: Sequence[date],
        tmax: Sequence[float],
        tmin: Sequence[float],
        rh: Sequence[float] | None,
        wind: Sequence[float] | None,
        radiation: Sequence[float] | None,
        lat: float,
        elevation_m: float | None,
    ) -> tuple[float, ...]:
        days_of_year = [day.timetuple().tm_yday for day in window]
        if rh is None or wind is None or radiation is None or elevation_m is None:
            return tuple(
                self._wb.hargreaves_eto(
                    t_max=tmax[idx], t_min=tmin[idx], lat_deg=lat, day_of_year=doy
                )
                for idx, doy in enumerate(days_of_year)
            )
        return tuple(
            self._wb.penman_monteith_eto(
                t_max=tmax[idx],
                t_min=tmin[idx],
                actual_vapour_pressure_kpa=self._wb.actual_vapour_pressure_from_rh_mean(
                    t_max=tmax[idx], t_min=tmin[idx], rh_mean_pct=rh[idx]
                ),
                wind_2m_ms=wind[idx],
                solar_rad_mj=radiation[idx],
                lat_deg=lat,
                day_of_year=doy,
                elevation_m=elevation_m,
            )
            for idx, doy in enumerate(days_of_year)
        )
