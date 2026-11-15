"""Domain entities for agroclimatic recommendations, scoring, and 3-year crop rotation plans."""

from collections.abc import Mapping
from dataclasses import dataclass, field
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
    # Somas no ciclo (tarefa 0044, linha "Água"): consumo da cultura (ETc = ETo x Kc), o que ela
    # usou (ETr, limitado pela água do balde) e a chuva, em mm. Falta de água = etc_mm - etr_mm.
    etc_mm: float = 0.0
    etr_mm: float = 0.0
    chuva_mm: float = 0.0


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
    # Explorador ano a ano da aba Sugestão (tarefa 0044): a água na fase crítica em fração do que
    # a planta precisa (o ISNA do motor, 0 a 1), os dias de calor nessa fase, o porquê do aperto,
    # o dia de plantar e a umidade da terra no dia de plantar pelo SMAP (0 a 1; só de 2016 em
    # diante, quando o balde começou pelo SMAP).
    isna: float = 1.0
    dias_calor: int = 0
    falta_agua: bool = False
    calor: bool = False
    semeadura: date | None = None
    umidade_inicial: float | None = None


@dataclass(frozen=True)
class EnsoAcerto:
    """Taxa de acerto de uma opção nos anos de uma fase do ENSO e nos outros anos (tarefa 0044).

    `clara` diz se a diferença passa do critério do `regras.yaml` (grupo `enso_acerto`): só
    então a tela mostra a frase "em anos de La Niña, deu certo em X de Y".
    """

    fase: FaseEnso
    anos: int
    bons: int
    anos_outros: int
    bons_outros: int
    clara: bool


@dataclass(frozen=True)
class ObservarOpcao:
    """O que observar na safra, tirado dos anos simulados (tarefa 0044, "Como fazer").

    `veranico_dias`: em metade dos anos, a planta ficou esse número de dias ou mais sem chuva na
    fase crítica (mediana, para baixo). `anos_calor`: anos com calor na fase crítica (o mesmo
    critério do aperto: `clima.calor_min_dias` dias de `clima.calor_temp_c` °C ou mais).
    """

    veranico_dias: int
    anos_calor: int
    total: int


@dataclass(frozen=True)
class CriterioDeuCerto:
    """O critério real do motor para "deu certo" (PRD 7.2), para a tela explicar sem repetir número.

    `fase` = `floracao` (grão e consórcio: `janela_dias` antes e depois da floração) ou
    `pegamento` (cobertura: os primeiros `janela_dias` dias).
    """

    isna_min: float
    calor_temp_c: float
    calor_min_dias: int
    fase: str
    janela_dias: int


@dataclass(frozen=True)
class CicloOpcao:
    """Quanto tempo a cultura leva (culturas.yaml): ciclo e dias até a floração."""

    dias: int
    floracao_dias: int


@dataclass(frozen=True)
class ClimaFuturoCelula:
    """Clima de 2041-2060 na célula (tarefa 0044; a seção 4 faz o mesmo no raio-X, unificar na S9).

    Média simples dos `meses` de cada modelo do CMIP6 e a média entre os modelos: chuva em % e
    máxima em °C. `concordam_*` = modelos que vão no mesmo sentido da média.
    """

    chuva_pct: float
    tmax_c: float
    modelos: int
    concordam_chuva: int
    concordam_tmax: int
    meses: tuple[int, ...]
    cenario: str


@dataclass(frozen=True)
class GeadaCelula:
    """Anos com alguma noite de `tmin_max_c` °C ou menos nos `meses` (NASA POWER, tarefa 0044)."""

    anos: int
    total: int
    tmin_max_c: float
    meses: tuple[int, ...]


@dataclass(frozen=True)
class AguaFuturo:
    """Falta de água no clima de 2041-2060 (tarefa 0044): mediana dos anos de cada modelo.

    `falta_normal_mm` é a média dos modelos; `falta_min_mm` e `falta_max_mm`, a faixa entre eles;
    `mudanca_mm`, a diferença para a falta de hoje em ano normal (positiva = falta mais água).
    """

    falta_normal_mm: int
    falta_min_mm: int
    falta_max_mm: int
    mudanca_mm: int
    modelos: int


@dataclass(frozen=True)
class AguaOpcao:
    """Linha "Água" de uma opção para a data de plantio escolhida (seção 5.3, tarefa 0044).

    Medianas dos anos simulados, em mm, nos dias do ciclo: `precisa_mm` (consumo da cultura,
    ETc = ETo x Kc), `chove_mm` (chuva) e `falta_normal_mm` (ETc - ETr). `falta_seco_mm` é a falta
    do ano seco (só 20% dos anos com falta maior). `sede` = pouca, media ou muita (cortes do
    `regras.yaml`). `cad_mm` é a água que a terra guarda na conta.
    """

    precisa_mm: int
    chove_mm: int
    falta_normal_mm: int
    falta_seco_mm: int
    sede: str
    cad_mm: int
    anos: int
    futuro: AguaFuturo | None = None


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
    # Aba Sugestão (tarefa 0044): linha "Água" e sede, o critério de "deu certo", o ciclo, o que
    # observar e a taxa de acerto nos anos de El Niño / La Niña
    agua: AguaOpcao | None = None
    criterio: CriterioDeuCerto | None = None
    ciclo: CicloOpcao | None = None
    observar: ObservarOpcao | None = None
    enso_acerto: tuple[EnsoAcerto, ...] = ()


@dataclass(frozen=True)
class ForaDaJanelaOpcao:
    """Summary of a crop option excluded due to ZARC sowing deadline (ADR-0002)."""

    id: str
    nome: str
    texto: str
    # Data limite do ZARC (AAAA-MM-DD no ano de referência), para o aviso único da colheita tarde
    data_limite: str | None = None


@dataclass(frozen=True)
class ObjetivoResultado:
    """Ordem das opções e plano sugerido para um objetivo do produtor (seção 5.1, tarefa 0044).

    `ordem`: as opções na janela, da melhor para a pior no objetivo. `plano`: os 3 anos, começando
    pela 1ª da ordem (`RotationPlanService.best_plan_starting_with`). `nota_plano`: a nota do plano
    pela regra do PRD 7.7 (média das notas finais + diversidade), comparável entre os objetivos.
    """

    ordem: tuple[str, ...]
    plano: tuple[str, ...]
    nota_plano: float


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
    # Aba Sugestão (tarefa 0044): ordem e plano por objetivo ("equilibrio", "seguranca", "renda",
    # "terra"), clima de 2041-2060 e geada na célula (None sem CMIP6 / sem série)
    objetivos: Mapping[str, ObjetivoResultado] = field(default_factory=dict)
    clima_futuro: ClimaFuturoCelula | None = None
    geada: GeadaCelula | None = None
