"""Domain entities for field inspection (Talhao), SoilGrids texture, and MODIS NDVI history."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class SoloInfo:
    """Soil texture and available water capacity (CAD) derived from SoilGrids 250m."""

    argila_percentual: float
    areia_percentual: float
    textura_solo: str
    cad_capacidade_agua_mm: float
    fonte: str


@dataclass(frozen=True)
class NdviRecord:
    """Single 16-day MODIS MOD13Q1 NDVI observation."""

    data: date
    year: int
    month: int
    ndvi: float


@dataclass(frozen=True)
class HistoricoAno:
    """Annual classification of off-season land use from MODIS NDVI."""

    ano: int
    situacao: str
    ndvi_max: float
    ndvi_medio_safrinha: float = 0.0
    status_talhao: str = ""


@dataclass(frozen=True)
class HistoricoTalhao:
    """10-year historical summary of off-season field usage."""

    anos: tuple[HistoricoAno, ...]
    parado: int
    total: int
    fonte: str


@dataclass(frozen=True)
class ColheitaSugerida:
    """Satellite-derived suggested soybean harvest window."""

    faixa: str
    fonte: str
    anos_usados: int


@dataclass(frozen=True)
class Talhao:
    """Consolidated spatial, soil, and satellite history inspection for a field coordinate."""

    lat: float
    lon: float
    celula_id: str | None
    dentro_da_area: bool
    solo: SoloInfo
    colheita_sugerida: ColheitaSugerida
    historico: HistoricoTalhao | None
    dados_fontes: tuple[dict[str, str], ...]
