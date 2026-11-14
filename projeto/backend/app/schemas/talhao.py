"""JSON de GET /api/talhao (plano técnico §3.1; `historico` no formato do guia do NDVI)."""

from pydantic import BaseModel, ConfigDict

from app.models.talhao import HistoricoTalhao, SituacaoAno, Talhao


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class PontoSchema(_Frozen):
    lat: float
    lon: float


class SoloSchema(_Frozen):
    textura: str
    cad_mm: float
    fonte: str


class ColheitaSugeridaSchema(_Frozen):
    faixa: str
    fonte: str
    anos_usados: int


class HistoricoAnoSchema(_Frozen):
    ano: int
    situacao: SituacaoAno
    ndvi_max: float | None  # null quando o ano fica sem_dado
    n_obs: int


class HistoricoSchema(_Frozen):
    anos: list[HistoricoAnoSchema]
    parado: int
    plantou: int
    sem_certeza: int  # incerto + sem_dado
    total: int  # anos da janela
    fonte: str
    janela: str

    @classmethod
    def from_model(cls, historico: HistoricoTalhao) -> "HistoricoSchema":
        return cls(
            anos=[
                HistoricoAnoSchema(
                    ano=a.ano, situacao=a.situacao, ndvi_max=a.ndvi_max, n_obs=a.n_obs
                )
                for a in historico.anos
            ],
            parado=historico.parado,
            plantou=historico.plantou,
            sem_certeza=historico.sem_certeza,
            total=historico.total,
            fonte=historico.fonte,
            janela=historico.janela,
        )


class FonteDadoSchema(_Frozen):
    fonte: str
    periodo: str
    cenario: str | None = None
    modelos: int | None = None


class TalhaoResponse(_Frozen):
    """Resposta de /api/talhao."""

    ponto: PontoSchema
    celula_id: str | None
    dentro_da_area: bool
    solo: SoloSchema
    colheita_sugerida: ColheitaSugeridaSchema
    historico: HistoricoSchema | None
    dados: list[FonteDadoSchema]

    @classmethod
    def from_model(cls, talhao: Talhao) -> "TalhaoResponse":
        return cls(
            ponto=PontoSchema(lat=talhao.lat, lon=talhao.lon),
            celula_id=talhao.celula_id,
            dentro_da_area=talhao.dentro_da_area,
            solo=SoloSchema(
                textura=talhao.solo.textura_solo,
                cad_mm=talhao.solo.cad_capacidade_agua_mm,
                fonte=talhao.solo.fonte,
            ),
            colheita_sugerida=ColheitaSugeridaSchema(
                faixa=talhao.colheita_sugerida.faixa,
                fonte=talhao.colheita_sugerida.fonte,
                anos_usados=talhao.colheita_sugerida.anos_usados,
            ),
            historico=(
                HistoricoSchema.from_model(talhao.historico)
                if talhao.historico is not None
                else None
            ),
            dados=[
                FonteDadoSchema(
                    fonte=d.fonte, periodo=d.periodo, cenario=d.cenario, modelos=d.modelos
                )
                for d in talhao.dados_fontes
            ],
        )
