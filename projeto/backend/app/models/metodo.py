"""As regras que a tela "Como a conta é feita" explica (S9 da remodelagem, tarefa 0049).

Cada número vem do `regras.yaml` (grupos `clima`, `nota_final`, `renda`, `agua`, `rotacao`,
`plano_b`, `alertas_area`, `avisos_tela`, `comunidade` e `sinal_enso`): a tela não repete número
fixo, então mudar uma regra no YAML muda a explicação junto.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DeuCertoRegra:
    """ "Deu certo" (PRD 7.2): água na fase crítica (ISNA em %) e calor de 35 °C em poucos dias."""

    isna_grao_pct: int
    isna_cobertura_pct: int
    janela_grao_meia_dias: int  # floração ± estes dias
    janela_cobertura_dias: int  # os primeiros dias da cobertura
    calor_temp_c: float
    calor_min_dias: int


@dataclass(frozen=True)
class PesosRegra:
    """Pesos da nota final (PRD 7.6), em %."""

    seguranca_pct: int
    futuro_pct: int
    solo_pct: int
    renda_pct: int


@dataclass(frozen=True)
class RendaRegra:
    """Renda sem preço nem custo (tarefa 0040)."""

    tipos_com_grao: tuple[str, ...]
    nota_sem_grao: float


@dataclass(frozen=True)
class AguaRegra:
    """Sede da cultura e ano seco da linha "Água" (tarefa 0044)."""

    sede_pouca_ate_mm: float
    sede_muita_desde_mm: float
    percentil_seco: int


@dataclass(frozen=True)
class RotacaoRegra:
    """Nota da rotação (PRD 7.7): bônus de diversidade e as culturas que quebram o nematoide."""

    bonus_diversidade_2: float
    bonus_diversidade_3: float
    max_pousios: int
    culturas_supressoras_nematoide: tuple[str, ...]


@dataclass(frozen=True)
class PlanoBRegra:
    """Quando "secar" vira número no Plano B (tarefa 0045)."""

    dias_antes_semeadura: int
    anos_falha_min: int
    sensibilidade_min_pct: float
    precisao_min_pct: float
    chance_max_pct: float


@dataclass(frozen=True)
class AlertasRegra:
    """Alertas do raio-X (tarefa 0043): geada, chuva forte e fogo."""

    geada_temp_c: float
    geada_inicio: str
    geada_fim: str
    chuva_forte_mm: float
    chuva_forte_inicio: str
    chuva_forte_fim: str
    fogo_raio_km: float


@dataclass(frozen=True)
class AvisosRegra:
    """Grupo "Agora" e "Perto de você" da tela "Avisos" (tarefa 0046)."""

    terra_seca_percentil_max: float
    dias_sem_chuva_min: int
    calor_dias_min: int
    calor_janela_dias: int
    vizinhos_dias: int
    raio_km: float


@dataclass(frozen=True)
class SinalRegra:
    """Sinal do outono pela previsão do El Niño / La Niña (tarefa 0038)."""

    estacao_previsao: str
    fase_chance_min_pct: int
    anos_fase_min: int
    anos_ruins_seco_pct: int


@dataclass(frozen=True)
class MetodoRegras:
    deu_certo: DeuCertoRegra
    pesos: PesosRegra
    renda: RendaRegra
    agua: AguaRegra
    rotacao: RotacaoRegra
    plano_b: PlanoBRegra
    alertas: AlertasRegra
    avisos: AvisosRegra
    sinal: SinalRegra
