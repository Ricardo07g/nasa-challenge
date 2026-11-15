"""Regras de negócio do motor de pontuação (PRD 7), lidas do `regras.yaml`.

Os nomes seguem as chaves do arquivo, que a agrônoma edita (por isso em português).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class RegrasClima:
    """Aperto de água e calor por ano (PRD 7.2) e perda de produtividade pelo ISNA (PRD 7.5)."""

    isna_grao: float
    isna_cobertura: float
    janela_grao_meia_dias: int
    janela_cobertura_dias: int
    calor_temp_c: float
    calor_min_dias: int
    perda_isna_sem_perda: float
    perda_isna_alta_abaixo: float
    perda_fator_media: float
    perda_fator_alta: float


@dataclass(frozen=True)
class RegrasNotaFinal:
    """Pesos da nota final (PRD 7.6) e bônus da pecuária (ADR-0004)."""

    peso_seguranca: float
    peso_solo: float
    peso_renda: float
    peso_futuro: float
    bonus_gado_milho_braquiaria: float


@dataclass(frozen=True)
class RegrasRotulos:
    """Limiares dos rótulos Bom / Médio / Fraco que o produtor vê (PRD 7.6)."""

    chuva_bom_pct: float
    chuva_medio_pct: float
    terra_bom: float
    terra_medio: float
    dinheiro_bom: float
    dinheiro_medio: float


@dataclass(frozen=True)
class RegrasSolo:
    """Máximos da nota de solo e peso das pragas com nematoide (PRD 7.4)."""

    palhada_max: float
    nitrogenio_max: float
    pragas_max: float
    peso_pragas_nematoide: float


@dataclass(frozen=True)
class RegrasNdvi:
    """Queda da soja para a colheita sugerida (PRD 7.9). O histórico fica em RegrasHistoricoNdvi."""

    queda_colheita: float


@dataclass(frozen=True)
class RegrasHistoricoNdvi:
    """Histórico do talhão pelo NDVI do MODIS (PRD 7.8 e guia do histórico NDVI).

    `janela_inicio` e `janela_fim` são "MM-DD" (a entressafra de cada ano); os anos vão de
    `ano_inicio` a `ano_fim`, inclusive.
    """

    janela_inicio: str
    janela_fim: str
    limite_plantou: float
    limite_parado: float
    min_observacoes: int
    ano_inicio: int
    ano_fim: int


@dataclass(frozen=True)
class RegrasRotacao:
    """Plano de 3 anos (PRD 7.7)."""

    anos_secos: int
    meses_seco: frozenset[int]
    max_pousios: int
    bonus_diversidade_2: float
    bonus_diversidade_3: float
    culturas_supressoras_nematoide: frozenset[str]
    # Funções de cada cultura para o bônus de diversidade: grao, cobertura_graminea,
    # cobertura_leguminosa (PRD 5 e 7.7). Cultura sem função (pousio) fica com o conjunto vazio.
    funcoes: dict[str, frozenset[str]]


@dataclass(frozen=True)
class RegrasSinalOutono:
    """Sinal para o outono (PRD 7.10, RF-20): limiares da previsão sazonal e da terra seca."""

    chance_seco_min: float  # chance (0 a 1) de chuva abaixo do normal que já é sinal de seco
    chance_normal_max: float  # abaixo disso (e com a terra sem falta de água) é sinal de normal
    smap_percentil_seco: float  # terra seca: percentil do SMAP abaixo disso...
    chuva_fracao_seco: float  # ...e chuva recente abaixo desta fração da média


@dataclass(frozen=True)
class RegrasAvisos:
    """Avisos de veranico e calor da safra (plano de evolução 4.4: replay P4 e acompanhamento P6).

    A janela crítica e a temperatura do calor são as mesmas da conta do aperto (`RegrasClima`).
    """

    dia_seco_abaixo_mm: float
    veranico_min_dias: int
    calor_dias_seguidos: int
    max_avisos: int
    janela_limite_dias: int


@dataclass(frozen=True)
class FrasesSafra:
    """Textos dos eventos da linha do tempo da safra em uma língua (P4 e P6)."""

    semeadura: str
    sem_chuva: str
    aviso_veranico: str
    fase_critica_grao: str
    fase_critica_cobertura: str
    voltou_chuva: str
    aviso_calor: str
    colheita_grao: str
    colheita_consorcio: str
    colheita_cobertura: str


@dataclass(frozen=True)
class RegrasEnso:
    """Marca de El Niño / La Niña de cada safrinha pelo ONI da NOAA (P1, plano de evolução 4.1).

    Só informa: não entra na conta. O `pipeline/fetch_oni.py` usa estes números ao gravar a fase
    de cada ano no arquivo do ONI; a API lê a fase pronta.
    """

    el_nino_oni_min: float  # média do ONI nas estações a partir da qual o ano é de El Niño
    la_nina_oni_max: float  # média do ONI nas estações até a qual o ano é de La Niña
    estacoes: tuple[str, ...]  # estações do ONI (ex.: DJF) do ano da safrinha que entram na média


@dataclass(frozen=True)
class FrasesAno:
    """Textos do detalhe de cada ano da faixa de chuva em uma língua (P1)."""

    fase_grao: str
    fase_cobertura: str
    nenhum_dia_sem_chuva: str
    um_dia_sem_chuva: str
    varios_dias_sem_chuva: str
    deu_certo: str
    faltou_agua: str
    calor: str
    el_nino: str
    la_nina: str


@dataclass(frozen=True)
class FrasesPorque:
    """Modelos de frase do "Por quê?" em uma língua (PRD 7.6, plano técnico §4.8)."""

    seguranca: str
    fase_grao: str
    fase_cobertura: str
    futuro: str
    solo: str
    historico: str
    balde_smap: str


@dataclass(frozen=True)
class Regras:
    """Todas as regras do motor, versão 0 (PRD 7)."""

    clima: RegrasClima
    nota_final: RegrasNotaFinal
    rotulos: RegrasRotulos
    solo: RegrasSolo
    ndvi: RegrasNdvi
    historico_ndvi: RegrasHistoricoNdvi
    rotacao: RegrasRotacao
    sinal_outono: RegrasSinalOutono
    frases: dict[str, FrasesPorque]  # "pt" e "en"
    avisos: RegrasAvisos
    frases_safra: dict[str, FrasesSafra]  # "pt" e "en"
    enso: RegrasEnso
    frases_ano: dict[str, FrasesAno]  # "pt" e "en"
