"""JSON de GET /api/talhao (plano técnico §3.1; `historico` no formato do guia do NDVI).

`chuva_mensal` é o gráfico "Chuva de cada mês na região" da tela 3 (tarefa 0028);
`soja_recente` é a checagem da soja no começo do fluxo (RF-24, tarefa 0037).
"""

from pydantic import BaseModel, ConfigDict

from app.models.soja_recente import SojaRecente
from app.models.talhao import ChuvaMensal, FonteAno, HistoricoTalhao, SituacaoAno, Talhao


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
    ndvi_max: float | None  # null quando o ano fica sem_dado ou sem_soja
    n_obs: int
    # "produtor" no ano que ele confirmou (a situação é a dele; o NDVI, o do satélite)
    fonte_ano: FonteAno = "satelite"


class HistoricoSchema(_Frozen):
    anos: list[HistoricoAnoSchema]
    parado: int
    plantou: int
    sem_certeza: int  # incerto + sem_dado
    total: int  # anos da janela (parado + plantou + sem_certeza + sem_soja)
    fonte: str
    janela: str
    sem_soja: int = 0  # anos sem a soja e a colheita no verão (tarefa 0039)

    @classmethod
    def from_model(cls, historico: HistoricoTalhao) -> "HistoricoSchema":
        return cls(
            anos=[
                HistoricoAnoSchema(
                    ano=a.ano,
                    situacao=a.situacao,
                    ndvi_max=a.ndvi_max,
                    n_obs=a.n_obs,
                    fonte_ano=a.fonte_ano,
                )
                for a in historico.anos
            ],
            parado=historico.parado,
            plantou=historico.plantou,
            sem_certeza=historico.sem_certeza,
            total=historico.total,
            fonte=historico.fonte,
            janela=historico.janela,
            sem_soja=historico.sem_soja,
        )


class ChuvaMesSchema(_Frozen):
    mes: int  # 1 = janeiro
    media_mm: float  # média, entre os anos, da chuva total do mês


class ChuvaMensalSchema(_Frozen):
    meses: list[ChuvaMesSchema]  # janeiro a junho
    anos: list[int]  # anos que entraram na média, em ordem
    fonte: str  # rain_source das temporadas (ex.: nasa_power); mais de uma, separadas por "+"

    @classmethod
    def from_model(cls, chuva: ChuvaMensal) -> "ChuvaMensalSchema":
        return cls(
            meses=[ChuvaMesSchema(mes=m.mes, media_mm=m.media_mm) for m in chuva.meses],
            anos=list(chuva.anos),
            fonte=chuva.fonte,
        )


class SojaRecenteSchema(_Frozen):
    safra: str  # ex.: "2025/26" (soja colhida em fevereiro de 2026)
    vista: bool | None  # null = pixel sem observações boas suficientes (o front não avisa)
    ndvi_pico: float | None  # maior NDVI da janela, em centésimos; null junto com vista
    fonte: str  # produtos do MODIS (ex.: "MODIS MOD13Q1 + MYD13Q1")

    @classmethod
    def from_model(cls, soja: SojaRecente) -> "SojaRecenteSchema":
        return cls(safra=soja.safra, vista=soja.vista, ndvi_pico=soja.ndvi_pico, fonte=soja.fonte)


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
    chuva_mensal: ChuvaMensalSchema | None  # null fora da área ou sem temporada completa
    soja_recente: SojaRecenteSchema | None  # null sem o arquivo ou com o ponto fora da grade
    # Entressafras que o produtor pode confirmar na tela 4 (as 3 últimas, tarefa 0039)
    anos_confirmaveis: list[int]

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
            chuva_mensal=(
                ChuvaMensalSchema.from_model(talhao.chuva_mensal)
                if talhao.chuva_mensal is not None
                else None
            ),
            soja_recente=(
                SojaRecenteSchema.from_model(talhao.soja_recente)
                if talhao.soja_recente is not None
                else None
            ),
            anos_confirmaveis=list(talhao.anos_confirmaveis),
        )
