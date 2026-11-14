"""Pydantic response schemas for GET /api/talhao."""

from pydantic import BaseModel, ConfigDict

from app.models.talhao import Talhao


class PontoSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    lat: float
    lon: float


class SoloSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    textura: str
    textura_solo: str
    argila_pct: float
    argila_percentual: float
    areia_pct: float
    areia_percentual: float
    cad_mm: float
    cad_capacidade_agua_mm: float
    fonte: str


class ColheitaSugeridaSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    faixa: str
    fonte: str
    anos_usados: int


class HistoricoAnoSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    ano: int
    situacao: str
    ndvi_max: float
    ndvi_medio_safrinha: float
    status_talhao: str


class HistoricoSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    anos: list[HistoricoAnoSchema]
    parado: int
    total: int
    fonte: str


class FonteDadoSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    fonte: str
    status: str


class TalhaoResponse(BaseModel):
    """HTTP JSON response schema for field inspection (/api/talhao)."""

    model_config = ConfigDict(frozen=True)

    ponto: PontoSchema
    celula_id: str | None
    dentro_da_area: bool
    solo: SoloSchema
    colheita_sugerida: ColheitaSugeridaSchema
    historico: HistoricoSchema | None
    dados: list[FonteDadoSchema]

    @classmethod
    def from_model(cls, talhao: Talhao) -> "TalhaoResponse":
        historico_schema = (
            HistoricoSchema(
                anos=[
                    HistoricoAnoSchema(
                        ano=a.ano,
                        situacao=a.situacao,
                        ndvi_max=a.ndvi_max,
                        ndvi_medio_safrinha=a.ndvi_medio_safrinha,
                        status_talhao=a.status_talhao,
                    )
                    for a in talhao.historico.anos
                ],
                parado=talhao.historico.parado,
                total=talhao.historico.total,
                fonte=talhao.historico.fonte,
            )
            if talhao.historico is not None
            else None
        )

        return cls(
            ponto=PontoSchema(lat=talhao.lat, lon=talhao.lon),
            celula_id=talhao.celula_id,
            dentro_da_area=talhao.dentro_da_area,
            solo=SoloSchema(
                textura=talhao.solo.textura_solo,
                textura_solo=talhao.solo.textura_solo,
                argila_pct=talhao.solo.argila_percentual,
                argila_percentual=talhao.solo.argila_percentual,
                areia_pct=talhao.solo.areia_percentual,
                areia_percentual=talhao.solo.areia_percentual,
                cad_mm=talhao.solo.cad_capacidade_agua_mm,
                cad_capacidade_agua_mm=talhao.solo.cad_capacidade_agua_mm,
                fonte=talhao.solo.fonte,
            ),
            colheita_sugerida=ColheitaSugeridaSchema(
                faixa=talhao.colheita_sugerida.faixa,
                fonte=talhao.colheita_sugerida.fonte,
                anos_usados=talhao.colheita_sugerida.anos_usados,
            ),
            historico=historico_schema,
            dados=[
                FonteDadoSchema(fonte=d["fonte"], status=d["status"]) for d in talhao.dados_fontes
            ],
        )
