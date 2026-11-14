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
    """Histórico do talhão (PRD 7.8) e queda da soja para a colheita sugerida (PRD 7.9)."""

    plantou_acima: float
    parado_abaixo: float
    queda_colheita: float
    meses_entressafra: frozenset[int]


@dataclass(frozen=True)
class RegrasRotacao:
    """Plano de 3 anos (PRD 7.7)."""

    anos_secos: int
    meses_seco: frozenset[int]
    max_pousios: int
    bonus_diversidade_2: float
    bonus_diversidade_3: float
    penalidade_monocultura_milho: float
    culturas_supressoras_nematoide: frozenset[str]


@dataclass(frozen=True)
class FrasesPorque:
    """Modelos de frase do "Por quê?" em uma língua (PRD 7.6, plano técnico §4.8)."""

    seguranca: str
    fase_grao: str
    fase_cobertura: str
    futuro: str
    solo: str


@dataclass(frozen=True)
class Regras:
    """Todas as regras do motor, versão 0 (PRD 7)."""

    clima: RegrasClima
    nota_final: RegrasNotaFinal
    rotulos: RegrasRotulos
    solo: RegrasSolo
    ndvi: RegrasNdvi
    rotacao: RegrasRotacao
    frases: dict[str, FrasesPorque]  # "pt" e "en"
