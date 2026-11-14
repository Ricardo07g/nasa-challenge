"""Domain entities for field inspection (Talhao), SoilGrids texture, and MODIS NDVI history."""

from dataclasses import dataclass
from datetime import date
from typing import Final, Literal

from app.models.validation import require_between

# Contrato do NDVI (projeto/backend/AGENTS.md, "Contrato dos dados das fontes").
# Faixa válida do MOD13Q1 bruto (-2000 a 10000); o NDVI físico (-0,2 a 1) cabe dentro dela.
# O valor de preenchimento (-3000, pixel sem dado) fica de fora.
NDVI_VALID_MIN: Final[float] = -2000.0
NDVI_VALID_MAX: Final[float] = 10000.0
# pixel_reliability (ORNL/AppEEARS) ou SummaryQA (Earth Engine): 0 = bom, 1 = aceitável.
# 2 (neve) e 3 (nuvem) são descartados no script de dados e nunca chegam ao model.
NDVI_BEST_QUALITY: Final[int] = 0
NDVI_WORST_ACCEPTED_QUALITY: Final[int] = 1
# Terra (MOD13Q1) e Aqua (MYD13Q1), coleção 061, defasados em 8 dias.
NDVI_PRODUCTS: Final[frozenset[str]] = frozenset({"MOD13Q1", "MYD13Q1"})


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
    """Uma observação de 16 dias do MODIS no ponto, com a qualidade já filtrada (PRD 7.8).

    `ndvi` aceita o valor bruto (inteiro com fator 0,0001) ou o físico; os arquivos e a tabela
    novos gravam o físico. `qualidade` e `produto` são opcionais só porque o cache antigo traz
    apenas `data` e `ndvi`.
    """

    data: date
    ndvi: float
    qualidade: int | None = None
    produto: str | None = None

    def __post_init__(self) -> None:
        require_between("ndvi", self.ndvi, NDVI_VALID_MIN, NDVI_VALID_MAX)
        if self.qualidade is not None and not (
            NDVI_BEST_QUALITY <= self.qualidade <= NDVI_WORST_ACCEPTED_QUALITY
        ):
            raise ValueError(f"qualidade precisa ser 0 ou 1, veio {self.qualidade!r}")
        if self.produto is not None and self.produto not in NDVI_PRODUCTS:
            raise ValueError(f"produto precisa ser MOD13Q1 ou MYD13Q1, veio {self.produto!r}")


# Situação da entressafra de um ano (guia do histórico NDVI): a tela mostra plantou (verde),
# parado (laranja) e "sem certeza" (cinza, juntando incerto e sem_dado).
SituacaoAno = Literal["plantou", "parado", "incerto", "sem_dado"]


@dataclass(frozen=True)
class HistoricoAno:
    """Uso da entressafra de um ano pelo NDVI do MODIS (PRD 7.8).

    `n_obs` = observações boas na janela; `ndvi_max` é None quando o ano fica `sem_dado`.
    """

    ano: int
    situacao: SituacaoAno
    ndvi_max: float | None
    n_obs: int


@dataclass(frozen=True)
class HistoricoTalhao:
    """Resumo das entressafras da janela de anos (guia do histórico NDVI, "Contrato da API").

    `sem_certeza` = incerto + sem_dado; `total` = anos da janela; `janela` = "MM-DD a MM-DD".
    """

    anos: tuple[HistoricoAno, ...]
    parado: int
    plantou: int
    sem_certeza: int
    total: int
    fonte: str
    janela: str


@dataclass(frozen=True)
class ColheitaSugerida:
    """Satellite-derived suggested soybean harvest window."""

    faixa: str
    fonte: str
    anos_usados: int


@dataclass(frozen=True)
class FonteDado:
    """Uma fonte de dado usada na conta, com o período (plano técnico §3.1, campo `dados`)."""

    fonte: str
    periodo: str
    cenario: str | None = None
    modelos: int | None = None


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
    dados_fontes: tuple[FonteDado, ...]
