"""Entidades do domínio para as séries de clima por célula e os deltas do CMIP6."""

from dataclasses import dataclass
from datetime import date
from typing import Final

from app.models.validation import require_between, require_finite, require_non_blank

# Limites do contrato (projeto/backend/AGENTS.md, "Contrato dos dados das fontes").
MIN_LATITUDE: Final[float] = -90.0
MAX_LATITUDE: Final[float] = 90.0
MIN_LONGITUDE: Final[float] = -180.0
MAX_LONGITUDE: Final[float] = 180.0
# Umidade volumétrica (m³/m³) e relativa (fração) ficam sempre entre 0 e 1.
MIN_SOIL_MOISTURE_FRACTION: Final[float] = 0.0
MAX_SOIL_MOISTURE_FRACTION: Final[float] = 1.0
FIRST_MONTH: Final[int] = 1
LAST_MONTH: Final[int] = 12
# A chuva pode cair no máximo 100% (chuva zero); abaixo disso a série ficaria negativa.
MIN_RAIN_CHANGE_PCT: Final[float] = -100.0


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
    """Umidade do solo do SMAP L4 (`SPL4SMGP`) num ponto e numa data (média do dia).

    O motor usa `sm_rootzone_wetness` (0 a 1) para encher o balde na semeadura (PRD 7.2).
    A camada de 0 a 5 cm (`sm_surface_m3_m3`) é opcional. A versão do produto (007 ou 008)
    fica no `DataRun` da carga, não em cada observação.
    """

    data: date
    latitude: float
    longitude: float
    sm_rootzone_m3_m3: float
    sm_rootzone_wetness: float
    fonte: str
    sm_surface_m3_m3: float | None = None

    def __post_init__(self) -> None:
        require_between("latitude", self.latitude, MIN_LATITUDE, MAX_LATITUDE)
        require_between("longitude", self.longitude, MIN_LONGITUDE, MAX_LONGITUDE)
        for name, value in (
            ("sm_rootzone_m3_m3", self.sm_rootzone_m3_m3),
            ("sm_rootzone_wetness", self.sm_rootzone_wetness),
            ("sm_surface_m3_m3", self.sm_surface_m3_m3),
        ):
            if value is not None:
                require_between(name, value, MIN_SOIL_MOISTURE_FRACTION, MAX_SOIL_MOISTURE_FRACTION)
        require_non_blank("fonte", self.fonte)


@dataclass(frozen=True)
class Cmip6Delta:
    """Delta mensal de um modelo do NEX-GDDP-CMIP6: 2041-2060 contra 1995-2014 (PRD 7.3).

    O motor aplica cada mês à série observada (método do delta): chuva x (1 + rain_pct / 100),
    máxima + tmax_c e, se houver, mínima + tmin_c. `tmin_c` é opcional: só vem quando o script de
    dados também baixa o `tasmin` (padrão adotado no R2.1, a revisar no roteiro, seção 5).
    """

    model: str
    scenario: str
    month: int
    rain_pct: float
    tmax_c: float
    tmin_c: float | None = None

    def __post_init__(self) -> None:
        require_non_blank("model", self.model)
        require_non_blank("scenario", self.scenario)
        if not FIRST_MONTH <= self.month <= LAST_MONTH:
            raise ValueError(f"month precisa estar entre 1 e 12, veio {self.month!r}")
        require_finite("rain_pct", self.rain_pct)
        if self.rain_pct < MIN_RAIN_CHANGE_PCT:
            raise ValueError(f"rain_pct não pode ser menor que -100, veio {self.rain_pct!r}")
        require_finite("tmax_c", self.tmax_c)
        if self.tmin_c is not None:
            require_finite("tmin_c", self.tmin_c)
