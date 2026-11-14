"""NASA POWER daily agroclimatology client (Sub-task 1.1 of Task 0001)."""

from collections import defaultdict
from datetime import date
from typing import Any, Protocol

from app.constants import (
    DEFAULT_INITIAL_ARM_FRACTION,
    EXTERNAL_API_TIMEOUT_SECONDS,
    HISTORICAL_END_YEAR,
    HISTORICAL_START_YEAR,
    MIN_DAILY_ETO_MM,
    NASA_POWER_COMMUNITY,
    NASA_POWER_DAILY_POINT_URL,
    NASA_POWER_MISSING_SENTINEL,
    NASA_POWER_PARAMETERS,
    RH_DEFAULT_PCT,
    SOLAR_RAD_DEFAULT_MJ,
    WIND_SPEED_DEFAULT_MS,
)
from app.models.climate import ClimateSeason
from app.repositories.external.http_client import (
    HttpGetter,
    default_http_get,
    get_json_with_retries,
)
from app.services.errors import DomainError


class NasaPowerClientProtocol(Protocol):
    """Contract for fetching 20-year daily meteorological series from NASA POWER."""

    def fetch_seasons(
        self,
        lat: float,
        lon: float,
        cell_id: str,
        start_year: int = HISTORICAL_START_YEAR,
        end_year: int = HISTORICAL_END_YEAR,
    ) -> list[ClimateSeason]: ...


def _clean_val(raw: Any, fallback: float) -> float:
    if raw is None:
        return fallback
    val = float(raw)
    if val <= NASA_POWER_MISSING_SENTINEL:
        return fallback
    return val


class NasaPowerClient:
    """HTTP client for NASA POWER Agroclimatology Daily Point API."""

    def __init__(
        self,
        http_get: HttpGetter = default_http_get,
        timeout: float = EXTERNAL_API_TIMEOUT_SECONDS,
    ) -> None:
        self._http_get = http_get
        self._timeout = timeout

    def fetch_seasons(
        self,
        lat: float,
        lon: float,
        cell_id: str,
        start_year: int = HISTORICAL_START_YEAR,
        end_year: int = HISTORICAL_END_YEAR,
    ) -> list[ClimateSeason]:
        """Fetches and parses daily meteorological seasons from NASA POWER."""
        params: dict[str, Any] = {
            "parameters": NASA_POWER_PARAMETERS,
            "community": NASA_POWER_COMMUNITY,
            "longitude": lon,
            "latitude": lat,
            "start": f"{start_year}0101",
            "end": f"{end_year}1231",
            "format": "JSON",
        }

        try:
            payload = get_json_with_retries(
                http_get=self._http_get,
                url=NASA_POWER_DAILY_POINT_URL,
                params=params,
                timeout=self._timeout,
            )
        except Exception as exc:
            raise DomainError(
                f"Failed to fetch meteorological series from NASA POWER: {exc}",
                code="NASA_POWER_UNAVAILABLE",
            ) from exc

        param_block: dict[str, dict[str, Any]] = payload.get("properties", {}).get("parameter", {})
        prec_map = param_block.get("PRECTOTCORR", {})
        tmax_map = param_block.get("T2M_MAX", {})
        tmin_map = param_block.get("T2M_MIN", {})
        tmean_map = param_block.get("T2M", {})
        rh_map = param_block.get("RH2M", {})
        ws_map = param_block.get("WS2M", {})
        rad_map = param_block.get("ALLSKY_SFC_SW_DWN", {})
        gwet_map = param_block.get("GWETROOT", {})

        dates_by_year: dict[int, list[str]] = defaultdict(list)
        for day_key in sorted(prec_map.keys()):
            if len(day_key) == 8 and day_key.isdigit():
                yr = int(day_key[:4])
                if start_year <= yr <= end_year:
                    dates_by_year[yr].append(day_key)

        seasons: list[ClimateSeason] = []
        for yr in sorted(dates_by_year.keys()):
            day_keys = dates_by_year[yr]
            first_key = day_keys[0]
            start_dt = date(int(first_key[:4]), int(first_key[4:6]), int(first_key[6:8]))

            rain_l: list[float] = []
            tmax_l: list[float] = []
            tmin_l: list[float] = []
            tmean_l: list[float] = []
            rh_l: list[float] = []
            ws_l: list[float] = []
            rad_l: list[float] = []
            gwet_l: list[float] = []
            eto_l: list[float] = []

            for dk in day_keys:
                rain = max(0.0, _clean_val(prec_map.get(dk), 0.0))
                tmax = _clean_val(tmax_map.get(dk), 30.0)
                tmin = _clean_val(tmin_map.get(dk), 18.0)
                tmean = _clean_val(tmean_map.get(dk), (tmax + tmin) / 2.0)
                rh = _clean_val(rh_map.get(dk), RH_DEFAULT_PCT)
                ws = _clean_val(ws_map.get(dk), WIND_SPEED_DEFAULT_MS)
                rad = _clean_val(rad_map.get(dk), SOLAR_RAD_DEFAULT_MJ)
                gwet = _clean_val(gwet_map.get(dk), DEFAULT_INITIAL_ARM_FRACTION)

                temp_span = max(1.0, tmax - tmin)
                eto = max(
                    MIN_DAILY_ETO_MM,
                    round(0.0023 * (tmean + 17.8) * (temp_span**0.5) * (rad * 0.408), 3),
                )

                rain_l.append(rain)
                tmax_l.append(tmax)
                tmin_l.append(tmin)
                tmean_l.append(tmean)
                rh_l.append(rh)
                ws_l.append(ws)
                rad_l.append(rad)
                gwet_l.append(gwet)
                eto_l.append(eto)

            seasons.append(
                ClimateSeason(
                    cell_id=cell_id,
                    year=yr,
                    start_date=start_dt,
                    rain_mm=tuple(rain_l),
                    rain_source="nasa_power",
                    tmax_c=tuple(tmax_l),
                    tmin_c=tuple(tmin_l),
                    eto_mm=tuple(eto_l),
                    gwetroot=tuple(gwet_l),
                    tmean_c=tuple(tmean_l),
                    rh2m_pct=tuple(rh_l),
                    ws2m_ms=tuple(ws_l),
                    solar_rad_mj=tuple(rad_l),
                )
            )

        return seasons
