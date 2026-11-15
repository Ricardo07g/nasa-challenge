"""JSON de GET /api/avisos (tela "Avisos", remodelagem S6, tarefa 0046, RF-31).

Grupo `null` = sem dado para o ponto (o front não desenha o grupo); grupo com `avisos: []` = "Nada
fora do normal" com a `ultima_leitura`. Só números: as frases ficam no front, em pt e en.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.avisos import Aviso, Avisos, GrupoAvisos, PeriodoComparado, SafrinhaAviso
from app.schemas.talhao import PontoSchema


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class AvisoSchema(_Frozen):
    tipo: str
    nivel: Literal["atencao", "fique_de_olho"]
    fontes: list[str]
    data: date | None
    antiga: bool
    # Números da frase de cada tipo (lista no AGENTS.md do backend)
    valores: dict[str, bool | int | float | str | None]

    @classmethod
    def from_model(cls, aviso: Aviso) -> "AvisoSchema":
        return cls(
            tipo=aviso.tipo,
            nivel=aviso.nivel,
            fontes=list(aviso.fontes),
            data=aviso.data,
            antiga=aviso.antiga,
            valores=dict(aviso.valores),
        )


class GrupoAvisosSchema(_Frozen):
    avisos: list[AvisoSchema]
    ultima_leitura: date | None

    @classmethod
    def from_model(cls, group: GrupoAvisos | None) -> "GrupoAvisosSchema | None":
        if group is None:
            return None
        return cls(
            avisos=[AvisoSchema.from_model(a) for a in group.avisos],
            ultima_leitura=group.ultima_leitura,
        )


class PeriodoSchema(_Frozen):
    recente_inicio: int
    recente_fim: int
    antes_inicio: int
    antes_fim: int


class SafrinhaSchema(_Frozen):
    em_andamento: bool
    cultura: str | None
    nome: str | None
    semeadura: date | None
    colheita: date | None
    explorar_ano: int | None  # "Ver como teriam sido os avisos em <ano>"


class AvisosResponse(_Frozen):
    ponto: PontoSchema
    celula_id: str
    hoje: date
    contador: int  # avisos de "Agora" e de "Perto de você" (botão do cabeçalho)
    agora: GrupoAvisosSchema
    mudou: GrupoAvisosSchema | None
    periodo: PeriodoSchema | None
    recordes: GrupoAvisosSchema | None
    perto: GrupoAvisosSchema | None
    raio_km: float
    vizinhos_dias: int
    safrinha: SafrinhaSchema | None

    @classmethod
    def from_model(cls, avisos: Avisos) -> "AvisosResponse":
        agora = GrupoAvisosSchema.from_model(avisos.agora)
        assert agora is not None
        return cls(
            ponto=PontoSchema(lat=avisos.lat, lon=avisos.lon),
            celula_id=avisos.celula_id,
            hoje=avisos.hoje,
            contador=avisos.contador,
            agora=agora,
            mudou=GrupoAvisosSchema.from_model(avisos.mudou),
            periodo=_periodo(avisos.periodo),
            recordes=GrupoAvisosSchema.from_model(avisos.recordes),
            perto=GrupoAvisosSchema.from_model(avisos.perto),
            raio_km=avisos.raio_km,
            vizinhos_dias=avisos.vizinhos_dias,
            safrinha=_safrinha(avisos.safrinha),
        )


def _periodo(periodo: PeriodoComparado | None) -> PeriodoSchema | None:
    if periodo is None:
        return None
    return PeriodoSchema(
        recente_inicio=periodo.recente_inicio,
        recente_fim=periodo.recente_fim,
        antes_inicio=periodo.antes_inicio,
        antes_fim=periodo.antes_fim,
    )


def _safrinha(safrinha: SafrinhaAviso | None) -> SafrinhaSchema | None:
    if safrinha is None:
        return None
    return SafrinhaSchema(
        em_andamento=safrinha.em_andamento,
        cultura=safrinha.cultura,
        nome=safrinha.nome,
        semeadura=safrinha.semeadura,
        colheita=safrinha.colheita,
        explorar_ano=safrinha.explorar_ano,
    )
