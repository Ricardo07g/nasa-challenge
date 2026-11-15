"""JSON de GET /api/talhao (plano técnico §3.1; `historico` no formato do guia do NDVI).

`chuva_mensal` é o gráfico "Chuva de cada mês na região" da tela 3 (tarefa 0028), com a ETo de
cada mês desde a tarefa 0042; `soja_recente` é a checagem da soja no começo do fluxo (RF-24,
tarefa 0037); `chuva_que_sobra` e `fim_das_chuvas` são a tela 3 nova (tarefa 0042).
"""

from pydantic import BaseModel, ConfigDict

from app.models.soja_recente import SojaRecente
from app.models.talhao import (
    ChuvaMensal,
    ChuvaQueSobra,
    FimDasChuvas,
    FonteAno,
    HistoricoTalhao,
    SituacaoAno,
    Talhao,
)


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
    # "MM-DD" em que a soja costuma secar pelo NDVI (tarefa 0042); null sem NDVI (fonte padrao)
    dia: str | None = None


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
    eto_media_mm: float | None = None  # média da ETo do mês (tarefa 0042); null sem ETo


class ChuvaMensalSchema(_Frozen):
    meses: list[ChuvaMesSchema]  # janeiro a junho
    anos: list[int]  # anos que entraram na média, em ordem
    fonte: str  # rain_source das temporadas (ex.: nasa_power); mais de uma, separadas por "+"
    fonte_eto: str | None = None  # nasa_power (a ETo é calculada com o clima do POWER)
    mes_chuva_abaixo_eto: int | None = None  # 1º mês com chuva média menor que a ETo média

    @classmethod
    def from_model(cls, chuva: ChuvaMensal) -> "ChuvaMensalSchema":
        return cls(
            meses=[
                ChuvaMesSchema(mes=m.mes, media_mm=m.media_mm, eto_media_mm=m.eto_media_mm)
                for m in chuva.meses
            ],
            anos=list(chuva.anos),
            fonte=chuva.fonte,
            fonte_eto=chuva.fonte_eto,
            mes_chuva_abaixo_eto=chuva.mes_chuva_abaixo_eto,
        )


class ChuvaQueSobraDiaSchema(_Frozen):
    dia: str  # "MM-DD" do dia da colheita
    mediana_mm: float  # chuva do dia até `fim`: mediana dos anos
    seco_mm: float  # a mesma, num ano seco (percentil `percentil_seco`)


class ChuvaQueSobraSchema(_Frozen):
    """Chuva que sobra depois da colheita (tela 3, tarefa 0042)."""

    fim: str  # "MM-DD", inclusive (06-30)
    percentil_seco: int  # 20
    dias: list[ChuvaQueSobraDiaSchema]  # um por dia da época da colheita (15/jan a 31/mar)
    anos: list[int]
    fonte: str  # rain_source dos anos (gpm_imerg; mais de uma, separadas por "+")

    @classmethod
    def from_model(cls, sobra: ChuvaQueSobra) -> "ChuvaQueSobraSchema":
        return cls(
            fim=sobra.fim,
            percentil_seco=sobra.percentil_seco,
            dias=[
                ChuvaQueSobraDiaSchema(dia=d.dia, mediana_mm=d.mediana_mm, seco_mm=d.seco_mm)
                for d in sobra.dias
            ],
            anos=list(sobra.anos),
            fonte=sobra.fonte,
        )


class DiaDoAnoSchema(_Frozen):
    dia: str  # "MM-DD"
    ano: int


class FimDasChuvasSchema(_Frozen):
    """Fim das chuvas na célula (tela 3, tarefa 0042)."""

    mediana: str  # em metade dos anos, a chuva acabou até esse dia ("MM-DD")
    mais_cedo: DiaDoAnoSchema
    mais_tarde: DiaDoAnoSchema
    anos: list[int]
    fonte: str
    inicio: str  # a regra do regras.yaml: a partir deste dia ("MM-DD")...
    dias: int  # ...este número de dias seguidos...
    chuva_max_mm: float  # ...com menos que estes mm somados

    @classmethod
    def from_model(cls, fim: FimDasChuvas) -> "FimDasChuvasSchema":
        return cls(
            mediana=fim.mediana,
            mais_cedo=DiaDoAnoSchema(dia=fim.mais_cedo.dia, ano=fim.mais_cedo.ano),
            mais_tarde=DiaDoAnoSchema(dia=fim.mais_tarde.dia, ano=fim.mais_tarde.ano),
            anos=list(fim.anos),
            fonte=fim.fonte,
            inicio=fim.inicio,
            dias=fim.dias,
            chuva_max_mm=fim.chuva_max_mm,
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
    # Tela 3 (tarefa 0042): null fora da área, sem temporada completa ou (fim) com ano sem fim
    chuva_que_sobra: ChuvaQueSobraSchema | None = None
    fim_das_chuvas: FimDasChuvasSchema | None = None

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
                dia=talhao.colheita_sugerida.dia,
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
            chuva_que_sobra=(
                ChuvaQueSobraSchema.from_model(talhao.chuva_que_sobra)
                if talhao.chuva_que_sobra is not None
                else None
            ),
            fim_das_chuvas=(
                FimDasChuvasSchema.from_model(talhao.fim_das_chuvas)
                if talhao.fim_das_chuvas is not None
                else None
            ),
        )
