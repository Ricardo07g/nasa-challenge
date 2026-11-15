"""JSON de GET /api/metodo: as regras da tela "Como a conta é feita" (tarefa 0049).

Só números do `regras.yaml`; as frases ficam no front (pt e en).
"""

from dataclasses import asdict

from pydantic import BaseModel, ConfigDict

from app.models.metodo import MetodoRegras


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class MetodoDeuCertoSchema(_Frozen):
    isna_grao_pct: int
    isna_cobertura_pct: int
    janela_grao_meia_dias: int
    janela_cobertura_dias: int
    calor_temp_c: float
    calor_min_dias: int


class MetodoPesosSchema(_Frozen):
    seguranca_pct: int
    futuro_pct: int
    solo_pct: int
    renda_pct: int


class MetodoRendaSchema(_Frozen):
    tipos_com_grao: list[str]
    nota_sem_grao: float


class MetodoAguaSchema(_Frozen):
    sede_pouca_ate_mm: float
    sede_muita_desde_mm: float
    percentil_seco: int


class MetodoRotacaoSchema(_Frozen):
    bonus_diversidade_2: float
    bonus_diversidade_3: float
    max_pousios: int
    culturas_supressoras_nematoide: list[str]


class MetodoPlanoBSchema(_Frozen):
    dias_antes_semeadura: int
    anos_falha_min: int
    sensibilidade_min_pct: float
    precisao_min_pct: float
    chance_max_pct: float


class MetodoAlertasSchema(_Frozen):
    geada_temp_c: float
    geada_inicio: str  # "MM-DD"
    geada_fim: str
    chuva_forte_mm: float
    chuva_forte_inicio: str
    chuva_forte_fim: str
    fogo_raio_km: float


class MetodoAvisosSchema(_Frozen):
    terra_seca_percentil_max: float
    dias_sem_chuva_min: int
    calor_dias_min: int
    calor_janela_dias: int
    vizinhos_dias: int
    raio_km: float


class MetodoSinalSchema(_Frozen):
    estacao_previsao: str
    fase_chance_min_pct: int
    anos_fase_min: int
    anos_ruins_seco_pct: int


class MetodoResponse(_Frozen):
    deu_certo: MetodoDeuCertoSchema
    pesos: MetodoPesosSchema
    renda: MetodoRendaSchema
    agua: MetodoAguaSchema
    rotacao: MetodoRotacaoSchema
    plano_b: MetodoPlanoBSchema
    alertas: MetodoAlertasSchema
    avisos: MetodoAvisosSchema
    sinal: MetodoSinalSchema

    @classmethod
    def from_model(cls, metodo: MetodoRegras) -> "MetodoResponse":
        return cls.model_validate(asdict(metodo))
