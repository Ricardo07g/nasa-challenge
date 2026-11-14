"""Cliente do NASA POWER diário (Agroclimatology): só traz os dados, sem cálculo (tarefa 0004)."""

from datetime import date
from typing import Any, Final, Protocol

from app.constants import (
    EXTERNAL_API_TIMEOUT_SECONDS,
    NASA_POWER_COMMUNITY,
    NASA_POWER_DAILY_POINT_URL,
    NASA_POWER_MISSING_SENTINEL,
    NASA_POWER_PARAMETERS,
    RH_DEFAULT_PCT,
    SOLAR_RAD_DEFAULT_MJ,
    WIND_SPEED_DEFAULT_MS,
)
from app.models.climate import DailyWeatherRecord, PowerDailySeries
from app.repositories.external.http_client import (
    HttpGetter,
    default_http_get,
    get_json_with_retries,
)
from app.services.errors import DomainError

POWER_DATE_FORMAT: Final[str] = "%Y%m%d"
POWER_DATE_KEY_LENGTH: Final[int] = 8
ELEVATION_COORDINATE_INDEX: Final[int] = 2  # geometry.coordinates = [lon, lat, altitude em m]


class NasaPowerClientProtocol(Protocol):
    """Contrato para buscar a série diária bruta do NASA POWER num ponto."""

    def fetch_daily(self, lat: float, lon: float, start: date, end: date) -> PowerDailySeries: ...


def _clean_val(raw: Any, fallback: float) -> float:
    if raw is None:
        return fallback
    val = float(raw)
    if val <= NASA_POWER_MISSING_SENTINEL:
        return fallback
    return val


def _elevation(payload: dict[str, Any]) -> float | None:
    coordinates = payload.get("geometry", {}).get("coordinates", [])
    if len(coordinates) <= ELEVATION_COORDINATE_INDEX:
        return None
    raw = coordinates[ELEVATION_COORDINATE_INDEX]
    if raw is None or float(raw) <= NASA_POWER_MISSING_SENTINEL:
        return None
    return float(raw)


class NasaPowerClient:
    """Cliente HTTP da API diária por ponto do NASA POWER (comunidade AG)."""

    def __init__(
        self,
        http_get: HttpGetter = default_http_get,
        timeout: float = EXTERNAL_API_TIMEOUT_SECONDS,
    ) -> None:
        self._http_get = http_get
        self._timeout = timeout

    def fetch_daily(self, lat: float, lon: float, start: date, end: date) -> PowerDailySeries:
        """Busca a série diária de `start` a `end` (inclusive) e a altitude da célula do POWER."""
        params: dict[str, Any] = {
            "parameters": NASA_POWER_PARAMETERS,
            "community": NASA_POWER_COMMUNITY,
            "longitude": lon,
            "latitude": lat,
            "start": start.strftime(POWER_DATE_FORMAT),
            "end": end.strftime(POWER_DATE_FORMAT),
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
        rh_map = param_block.get("RH2M", {})
        ws_map = param_block.get("WS2M", {})
        rad_map = param_block.get("ALLSKY_SFC_SW_DWN", {})

        day_keys = sorted(
            {
                key
                for values in param_block.values()
                for key in values
                if len(key) == POWER_DATE_KEY_LENGTH and key.isdigit()
            }
        )
        days: list[DailyWeatherRecord] = []
        for key in day_keys:
            day = date(int(key[:4]), int(key[4:6]), int(key[6:8]))
            if not start <= day <= end:
                continue
            days.append(
                DailyWeatherRecord(
                    data=day,
                    prectotcorr=max(0.0, _clean_val(prec_map.get(key), 0.0)),
                    t2m_max=_clean_val(tmax_map.get(key), 30.0),
                    t2m_min=_clean_val(tmin_map.get(key), 18.0),
                    rh2m=_clean_val(rh_map.get(key), RH_DEFAULT_PCT),
                    ws2m=_clean_val(ws_map.get(key), WIND_SPEED_DEFAULT_MS),
                    allsky_sfc_sw_dwn=_clean_val(rad_map.get(key), SOLAR_RAD_DEFAULT_MJ),
                )
            )

        return PowerDailySeries(elevation_m=_elevation(payload), days=tuple(days))
