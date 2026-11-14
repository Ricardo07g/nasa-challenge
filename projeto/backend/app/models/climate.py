"""Entidades do domínio para as séries de clima por célula e os deltas do CMIP6."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class ClimateSeason:
    """Séries diárias de uma célula num ano, a partir de `start_date` (em geral 1/jan a 31/jul)."""

    cell_id: str
    year: int
    start_date: date
    lat: float
    rain_mm: tuple[float, ...]
    rain_source: str
    tmax_c: tuple[float, ...]
    tmin_c: tuple[float, ...]
    # ETo diária (mm). Vazia quando a fonte não traz: o service calcula por Hargreaves-Samani.
    eto_mm: tuple[float, ...] = ()


@dataclass(frozen=True)
class Cmip6Delta:
    """Mudança mensal de um modelo do NEX-GDDP-CMIP6 (2041-2060 contra 1995-2014)."""

    model: str
    scenario: str
    month: int
    rain_pct: float
    tmax_c: float
