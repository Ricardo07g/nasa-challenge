"""Entidades do domínio para as séries de clima por célula e os deltas do CMIP6."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class DailyWeatherRecord:
    """Um dia do NASA POWER, com o valor de cada parâmetro como veio da API (sem cálculo)."""

    data: date
    prectotcorr: float | None  # chuva corrigida (mm/dia)
    t2m_max: float | None  # máxima a 2 m (°C)
    t2m_min: float | None  # mínima a 2 m (°C)
    rh2m: float | None  # umidade relativa média a 2 m (%)
    ws2m: float | None  # vento a 2 m (m/s)
    allsky_sfc_sw_dwn: float | None  # radiação solar na superfície (MJ/m²/dia)


@dataclass(frozen=True)
class PowerDailySeries:
    """Série diária bruta do NASA POWER num ponto e a altitude da célula do POWER."""

    elevation_m: float | None
    days: tuple[DailyWeatherRecord, ...]


@dataclass(frozen=True)
class ClimateSeason:
    """Séries diárias de uma célula num ano, a partir de `start_date` (em geral 1/jan a 31/jul)."""

    cell_id: str
    year: int
    start_date: date
    rain_mm: tuple[float, ...]
    rain_source: str
    tmax_c: tuple[float, ...]
    tmin_c: tuple[float, ...]
    # ETo diária (mm). Vazia quando a fonte não traz:
    # o service calcula por Hargreaves-Samani / FAO-56.
    eto_mm: tuple[float, ...] = ()
    lat: float = 0.0
    gwetroot: tuple[float, ...] = ()
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
    """Mudança do NEX-GDDP-CMIP6 (2041-2060 contra 1995-2014) mensal ou sazonal agregada."""

    model: str = ""
    scenario: str = "SSP2-4.5"
    month: int = 0
    rain_pct: float = 0.0
    tmax_c: float = 0.0
    cell_id: str = ""
    cenario: str = "SSP2-4.5"
    modelos_referencia: tuple[str, ...] = ()
    aumento_temperatura_media_c: float = 0.0
    variacao_chuva_safrinha_pct: float = 0.0
    aumento_dias_calor_extremo_ge_35c: float = 0.0
