"""JSON de GET /api/raio-x (tela 4 "O que o satélite viu", remodelagem S4, tarefa 0043).

Cada bloco é `null` sem dado para o ponto (o front não desenha). Só números: as frases são do
front, em pt e en.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.raio_x import RaioX
from app.schemas.talhao import FimDasChuvasSchema, PontoSchema

ETO_SOURCE = "nasa_power"


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class SoloRaioXSchema(_Frozen):
    textura: str
    argila_pct: float
    areia_pct: float
    cad_mm: float
    vizinho_km: float | None  # solo do ponto gravado mais perto, de outra célula


class AguaSchema(_Frozen):
    cad_mm: float
    dias: int | None  # CAD ÷ (ETo na floração × Kc); null sem cultura (pousio)
    cultura: str | None
    nome: str | None
    floracao: str | None  # "MM-DD"
    eto_mm_dia: float | None
    kc: float | None
    consumo_mm_dia: float | None
    fonte_eto: str = ETO_SOURCE


class UmidadeSchema(_Frozen):
    percentil: float
    data: date


class VerdeSchema(_Frozen):
    ultimo_ndvi: float | None
    ultimo_data: date | None
    pico_ndvi: float | None
    pico_data: date | None
    safra: str | None
    fonte: str
    soja_vista: bool | None  # o satélite viu a soja no verão do pico (tarefa 0049)


class ChuvaTipicaSchema(_Frozen):
    media_mm: float
    anos: list[int]
    fonte: str
    fim_das_chuvas: FimDasChuvasSchema | None


class VeranicoSchema(_Frozen):
    dias: int
    ano: int
    inicio: str
    total_anos: int
    fonte: str


class CalorSchema(_Frozen):
    anos_com_calor: int
    total_anos: int
    temp_c: float
    anos: list[int]
    fonte: str


class RegiaoChuvaSchema(_Frozen):
    chuva_mm: float
    mediana_regiao_mm: float
    celulas: int
    pct_mais_seca: int
    pct_mais_chuvosa: int
    fonte: str


class FaixaNdviAnoSchema(_Frozen):
    ano: int
    valores: list[float | None]


class FaixaNdviSchema(_Frozen):
    colunas: list[str]
    anos: list[FaixaNdviAnoSchema]
    fonte: str
    colheita_dia: str | None


class AlertaGeadaSchema(_Frozen):
    anos: list[int]
    total_anos: int
    temp_c: float
    menor_temp_c: float
    fonte: str


class AlertaChuvaForteSchema(_Frozen):
    media_dias_ano: float
    dias: int
    total_anos: int
    limite_mm: float
    fonte: str


class AlertaFogoSchema(_Frozen):
    anos: list[int]
    total_anos: int
    raio_km: float
    fonte: str


class AlertasSchema(_Frozen):
    geada: AlertaGeadaSchema | None
    chuva_forte: AlertaChuvaForteSchema | None
    fogo: AlertaFogoSchema | None


class ChuvaVinteAnosSchema(_Frozen):
    cultura: str
    nome: str
    anos_bons: int
    total_anos: int


class ClimaFuturoSchema(_Frozen):
    chuva_pct: float
    tmax_c: float
    modelos: int
    modelos_menos_chuva: int
    modelos_mais_chuva: int
    modelos_mais_quente: int
    cenario: str
    periodo: str


class CartoesSchema(_Frozen):
    chuva_20_anos: ChuvaVinteAnosSchema | None
    clima_futuro: ClimaFuturoSchema | None


def _dump(value: object) -> dict[str, object] | None:
    """Dataclass → dicionário raso (os campos de tupla viram lista no Pydantic)."""
    if value is None:
        return None
    return {key: getattr(value, key) for key in value.__dataclass_fields__}  # type: ignore[attr-defined]


class RaioXResponse(_Frozen):
    ponto: PontoSchema
    celula_id: str
    leitura_recente: date | None
    altitude_m: float | None
    solo: SoloRaioXSchema | None
    agua: AguaSchema | None
    umidade: UmidadeSchema | None
    verde: VerdeSchema | None
    chuva: ChuvaTipicaSchema | None
    veranico: VeranicoSchema | None
    calor: CalorSchema | None
    regiao: RegiaoChuvaSchema | None
    historico_ndvi: FaixaNdviSchema | None
    alertas: AlertasSchema
    cartoes: CartoesSchema

    @classmethod
    def from_model(cls, raio: RaioX) -> "RaioXResponse":
        chuva = None
        if raio.chuva is not None:
            fim = raio.chuva.fim_das_chuvas
            chuva = ChuvaTipicaSchema(
                media_mm=raio.chuva.media_mm,
                anos=list(raio.chuva.anos),
                fonte=raio.chuva.fonte,
                fim_das_chuvas=None if fim is None else FimDasChuvasSchema.from_model(fim),
            )
        faixa = None
        if raio.historico_ndvi is not None:
            faixa = FaixaNdviSchema(
                colunas=list(raio.historico_ndvi.colunas),
                anos=[
                    FaixaNdviAnoSchema(ano=row.ano, valores=list(row.valores))
                    for row in raio.historico_ndvi.anos
                ],
                fonte=raio.historico_ndvi.fonte,
                colheita_dia=raio.historico_ndvi.colheita_dia,
            )
        return cls(
            ponto=PontoSchema(lat=raio.lat, lon=raio.lon),
            celula_id=raio.celula_id,
            leitura_recente=raio.leitura_recente,
            altitude_m=raio.altitude_m,
            solo=_dump(raio.solo),  # type: ignore[arg-type]
            agua=_dump(raio.agua),  # type: ignore[arg-type]
            umidade=_dump(raio.umidade),  # type: ignore[arg-type]
            verde=_dump(raio.verde),  # type: ignore[arg-type]
            chuva=chuva,
            veranico=_dump(raio.veranico),  # type: ignore[arg-type]
            calor=_dump(raio.calor),  # type: ignore[arg-type]
            regiao=_dump(raio.regiao),  # type: ignore[arg-type]
            historico_ndvi=faixa,
            alertas=AlertasSchema(
                geada=_dump(raio.alertas.geada),  # type: ignore[arg-type]
                chuva_forte=_dump(raio.alertas.chuva_forte),  # type: ignore[arg-type]
                fogo=_dump(raio.alertas.fogo),  # type: ignore[arg-type]
            ),
            cartoes=CartoesSchema(
                chuva_20_anos=_dump(raio.cartoes.chuva_20_anos),  # type: ignore[arg-type]
                clima_futuro=_dump(raio.cartoes.clima_futuro),  # type: ignore[arg-type]
            ),
        )
