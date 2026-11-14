"""Domain entities for historical weather series, SMAP soil moisture, and CMIP6 projections."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class DailyWeatherRecord:
    """Single day meteorological observation from NASA POWER."""

    data: date
    prectotcorr: float | None
    t2m_max: float | None
    t2m_min: float | None
    t2m: float | None
    rh2m: float | None
    ws2m: float | None
    allsky_sfc_sw_dwn: float | None
    gwetroot: float | None


@dataclass(frozen=True)
class ClimateSeason:
    """Seasonal meteorological arrays for a single year and spatial cell."""

    cell_id: str
    year: int
    start_date: date
    rain_mm: tuple[float, ...]
    rain_source: str
    tmax_c: tuple[float, ...]
    tmin_c: tuple[float, ...]
    eto_mm: tuple[float, ...]
    gwetroot: tuple[float, ...]
    tmean_c: tuple[float, ...] = ()
    rh2m_pct: tuple[float, ...] = ()
    ws2m_ms: tuple[float, ...] = ()
    solar_rad_mj: tuple[float, ...] = ()


@dataclass(frozen=True)
class AnnualClimateSummary:
    """Aggregated annual climate indicators for a season."""

    ano: int
    chuva_total_mm: float
    chuva_safrinha_fev_mai_mm: float
    dias_calor_extremo_ge_35c: int


@dataclass(frozen=True)
class SmapSoilMoisture:
    """NASA SMAP L4 rootzone and surface soil moisture observation."""

    data: date
    latitude: float
    longitude: float
    sm_surface_m3_m3: float
    sm_rootzone_m3_m3: float
    sm_rootzone_wetness: float
    fonte: str


@dataclass(frozen=True)
class Cmip6Delta:
    """NEX-GDDP-CMIP6 2041-2060 climate change delta for the off-season."""

    cell_id: str
    cenario: str
    modelos_referencia: tuple[str, ...]
    aumento_temperatura_media_c: float
    variacao_chuva_safrinha_pct: float
    aumento_dias_calor_extremo_ge_35c: float
