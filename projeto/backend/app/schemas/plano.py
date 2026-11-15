"""JSON de GET /api/plano (aba "Plano de 3 anos", seção 5.6 da remodelagem, tarefa 0045)."""

from dataclasses import asdict
from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.plano import PlanoAvaliado


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class AnoPlanoSchema(_Frozen):
    cultura: str  # id do culturas.yaml (com o pousio)
    nome: str
    na_janela: bool  # fora da janela de plantio, os números do motor são null
    anos_bons: int | None  # anos sem aperto (deu certo); null no pousio e fora da janela
    total_anos: int | None
    futuro_anos_bons: int | None  # 2041-2060, média dos modelos (null sem CMIP6)
    sede: str | None  # pouca, media ou muita
    cobre_terra: bool
    deixa_nitrogenio: bool
    quebra_nematoide: bool
    usa_mm: int | None  # mediana da ETr no ciclo (o que a planta usou da água)


class NotasPlanoSchema(_Frozen):
    seguranca: float | None  # 0 a 100, média dos anos com lavoura na janela
    solo: float  # saúde da terra: média da nota de solo + bônus de diversidade (até 100)
    futuro: float | None  # 2041-2060; null sem CMIP6


class TerraPlanoSchema(_Frozen):
    anos_cobertos: int
    anos_nitrogenio: int
    anos_nematoide: int
    repetidas: list[str]
    total: int
    bonus_diversidade: float


class ChuvaAproveitadaSchema(_Frozen):
    inicio: date  # a semeadura (ano de referência)
    fim: str  # "MM-DD"
    chuva_mm: int  # mediana da chuva da semeadura ao fim de julho
    usa_media_mm: int | None  # média do que o plano usa por ano (pousio = 0)
    anos: int
    fonte: str  # rain_source da série (ex.: gpm_imerg, ou gpm_imerg+nasa_power)


class LimiteChuvaSchema(_Frozen):
    dias: int
    chuva_mm: int
    anos_marcados: int
    falhas_marcadas: int
    falhas: int
    total: int
    chance_pct: float
    separa: bool  # só com true o número vai para a tela
    motivo: str | None  # poucas_falhas ou nao_separa


class PlanoABSchema(_Frozen):
    cultura_a: str
    nome_a: str
    falhas_a: int
    total: int
    cultura_b: str | None
    nome_b: str | None
    b_bons_nas_falhas: int | None
    limite: LimiteChuvaSchema | None
    motivo: str | None  # pousio, nunca_falhou ou nenhuma_melhor (sem Plano B)


class PlanoResponse(_Frozen):
    colheita: str
    semeadura: date
    anos: list[AnoPlanoSchema]
    notas: NotasPlanoSchema
    terra: TerraPlanoSchema
    chuva: ChuvaAproveitadaSchema | None
    plano_ab: PlanoABSchema | None

    @classmethod
    def from_model(cls, plano: PlanoAvaliado) -> "PlanoResponse":
        return cls.model_validate(asdict(plano))
