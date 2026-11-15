"""Domain entities for agroclimatic recommendations, scoring, and 3-year crop rotation plans."""

from dataclasses import dataclass
from datetime import date

from app.models.enso import FaseEnso
from app.models.sinal_outono import SinalOutono


@dataclass(frozen=True)
class ResultadoAno:
    """Simulation outcome for a single historical season."""

    ano: int
    aperto: bool
    isna: float
    dias_calor: int
    # Por que o ano apertou (PRD 7.2): ISNA abaixo do limiar e/ou calor na janela crítica.
    # aperto = falta_agua or calor
    falta_agua: bool = False
    calor: bool = False


@dataclass(frozen=True)
class AnoDetalhe:
    """O que aconteceu num ano da faixa de chuva (P1): `AnoDetalhe` do front.

    `bom` é o mesmo da faixa (ano sem aperto). `fase_critica` é a data em que a planta chega na
    fase que mais precisa de água (floração estimada; na cobertura, a semeadura).
    `dias_sem_chuva` é a maior sequência de dias secos nessa fase. `enso` vem do ONI da NOAA.
    """

    ano: int
    bom: bool
    fase_critica: date
    dias_sem_chuva: int
    enso: FaseEnso | None
    texto: str


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
    # Renda só com fatos (tarefa 0040): dá grão para vender ou não, o rótulo da nota de renda e as
    # frases "Dá grão..." e "Risco de perder a lavoura... em N de 20 anos". Nenhum valor em reais.
    da_grao: bool
    rotulo_renda: str
    texto_renda: str
    texto_risco: str
    rotulo_terra: str
    texto_terra: str
    notas: NotasOpcao
    # Mesmas notas usando só os 4 anos mais secos (cenário "seco" do plano de 3 anos)
    notas_seco: NotasOpcao
    porque: tuple[str, ...]
    como_fazer: tuple[str, ...]
    # O que aconteceu em cada ano da faixa de chuva, na mesma ordem (P1)
    anos_detalhe: tuple[AnoDetalhe, ...] = ()


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
