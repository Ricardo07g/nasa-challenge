"""Domain entities for agroclimatic recommendations, scoring, and 3-year crop rotation plans."""

from dataclasses import dataclass
from datetime import date

from app.models.sinal_outono import SinalOutono


@dataclass(frozen=True)
class ResultadoAno:
    """Simulation outcome for a single historical season."""

    ano: int
    aperto: bool
    isna: float
    dias_calor: int
    fator_perda: float


@dataclass(frozen=True)
class FuturoResultado:
    """Anos sem aperto no clima de 2041-2060: média, mínimo e máximo entre os modelos do CMIP6."""

    anos_bons_media: int
    anos_bons_min: int
    anos_bons_max: int
    modelos: int
    cenario: str


@dataclass(frozen=True)
class NotasOpcao:
    """Normalized 0-100 multi-objective scores for a crop option."""

    seguranca: float
    futuro: float | None  # None quando não há deltas do CMIP6
    solo: float
    renda: float
    final: float


@dataclass(frozen=True)
class ResultadoOpcao:
    """Detailed evaluation of a viable off-season crop option."""

    id: str
    nome: str
    na_janela: bool
    data_limite: str | None
    anos_bons_chuva: int
    total_anos: int
    faixa_anos: tuple[bool, ...]
    rotulo_chuva: str
    texto_chuva: str
    futuro: FuturoResultado | None
    margem_ha: float
    rotulo_dinheiro: str
    texto_dinheiro: str
    rotulo_terra: str
    texto_terra: str
    notas: NotasOpcao
    # Mesmas notas usando só os 4 anos mais secos (cenário "seco" do plano de 3 anos)
    notas_seco: NotasOpcao
    porque: tuple[str, ...]
    como_fazer: tuple[str, ...]
    # Margem por hectare no pior dos anos mais secos (A1.2, PRD 7.11); None sem ano seco na série
    pior_ano_seco_ha: float | None = None


@dataclass(frozen=True)
class ForaDaJanelaOpcao:
    """Summary of a crop option excluded due to ZARC sowing deadline (ADR-0002)."""

    id: str
    nome: str
    texto: str


@dataclass(frozen=True)
class Alternativa:
    """Alternative crop recommendation prioritized by a single dimension."""

    motivo: str
    opcao: str


@dataclass(frozen=True)
class PlanoRotacao:
    """3-year off-season crop sequence evaluation."""

    anos: tuple[str, ...]
    nota: float
    descricao: str


@dataclass(frozen=True)
class Recomendacao:
    """Complete recommendation response entity for a field and harvest band."""

    lat: float
    lon: float
    celula_id: str
    colheita: str
    semeadura: date
    solo: str
    nematoide: bool | None
    gado: bool | None
    melhor: str
    alternativas: tuple[Alternativa, ...]
    opcoes: tuple[ResultadoOpcao, ...]
    fora_da_janela: tuple[ForaDaJanelaOpcao, ...]
    texto_pousio: str
    plano_normal: PlanoRotacao
    plano_seco: PlanoRotacao
    plano_hoje: PlanoRotacao
    versao_dados: str
    aviso: str
    # Sinal para o outono (PRD 7.10, RF-20); None sem previsão nem dado da terra
    sinal: SinalOutono | None = None
