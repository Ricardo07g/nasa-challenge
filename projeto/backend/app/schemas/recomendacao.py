"""JSON de GET /api/recomendacao e GET /api/exemplo (plano técnico §3.2 e §3.3)."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models.enso import FaseEnso
from app.models.recomendacao import (
    AguaOpcao,
    AnoDetalhe,
    NotasOpcao,
    PlanoRotacao,
    Recomendacao,
    ResultadoOpcao,
)
from app.models.sinal_outono import NivelSinal, SinalOutono
from app.schemas.raio_x import AlertaGeadaSchema, ClimaFuturoSchema, _dump
from app.schemas.talhao import TalhaoResponse


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class EntradaSchema(_Frozen):
    celula_id: str
    colheita: str
    semeadura: date
    solo: str
    nematoide: bool | None
    gado: bool | None = None


class ChuvaSchema(_Frozen):
    anos_bons: int
    anos: int
    faixa: list[bool]
    rotulo: str
    texto: str


class FuturoSchema(_Frozen):
    anos_bons_media: int
    anos_bons_min: int
    anos_bons_max: int
    modelos: int
    cenario: str


class RendaSchema(_Frozen):
    """Renda só com fatos (tarefa 0040, antes `dinheiro`): nenhum valor em reais."""

    da_grao: bool
    # Anos com aperto do motor (falta de água ou calor na fase crítica); o total é `chuva.anos`
    anos_aperto: int
    rotulo: str
    # "Dá grão para vender" ou "Não dá grão: é investimento na terra"
    texto: str
    # "Risco de perder a lavoura: faltou água ou fez calor em N de 20 anos."
    risco: str


class TerraSchema(_Frozen):
    nota: float
    rotulo: str
    texto: str


class NotasSchema(_Frozen):
    seguranca: float
    futuro: float | None
    solo: float
    renda: float
    final: float

    @classmethod
    def from_model(cls, notas: NotasOpcao) -> "NotasSchema":
        return cls(
            seguranca=notas.seguranca,
            futuro=notas.futuro,
            solo=notas.solo,
            renda=notas.renda,
            final=notas.final,
        )


class AnoDetalheSchema(_Frozen):
    """O que aconteceu num ano da faixa de chuva (P1): `AnoDetalhe` do front."""

    ano: int
    bom: bool
    fase_critica: date
    dias_sem_chuva: int
    enso: FaseEnso | None
    texto: str
    # Explorador ano a ano (tarefa 0044): ISNA (0 a 1), calor, porquê, semeadura e SMAP inicial
    isna: float = 1.0
    dias_calor: int = 0
    falta_agua: bool = False
    calor: bool = False
    semeadura: date | None = None
    umidade_inicial: float | None = None

    @classmethod
    def from_model(cls, detalhe: AnoDetalhe) -> "AnoDetalheSchema":
        return cls(
            ano=detalhe.ano,
            bom=detalhe.bom,
            fase_critica=detalhe.fase_critica,
            dias_sem_chuva=detalhe.dias_sem_chuva,
            enso=detalhe.enso,
            texto=detalhe.texto,
            isna=detalhe.isna,
            dias_calor=detalhe.dias_calor,
            falta_agua=detalhe.falta_agua,
            calor=detalhe.calor,
            semeadura=detalhe.semeadura,
            umidade_inicial=detalhe.umidade_inicial,
        )


class AguaFuturoSchema(_Frozen):
    falta_normal_mm: int
    falta_min_mm: int
    falta_max_mm: int
    mudanca_mm: int
    modelos: int


class AguaSchema(_Frozen):
    """Linha "Água" e sede da cultura (tarefa 0044): medianas do balanço hídrico no ciclo, em mm."""

    precisa_mm: int
    chove_mm: int
    falta_normal_mm: int
    falta_seco_mm: int
    sede: str
    cad_mm: int
    anos: int
    futuro: AguaFuturoSchema | None = None

    @classmethod
    def from_model(cls, agua: AguaOpcao) -> "AguaSchema":
        futuro = agua.futuro
        return cls(
            precisa_mm=agua.precisa_mm,
            chove_mm=agua.chove_mm,
            falta_normal_mm=agua.falta_normal_mm,
            falta_seco_mm=agua.falta_seco_mm,
            sede=agua.sede,
            cad_mm=agua.cad_mm,
            anos=agua.anos,
            futuro=(
                AguaFuturoSchema(
                    falta_normal_mm=futuro.falta_normal_mm,
                    falta_min_mm=futuro.falta_min_mm,
                    falta_max_mm=futuro.falta_max_mm,
                    mudanca_mm=futuro.mudanca_mm,
                    modelos=futuro.modelos,
                )
                if futuro is not None
                else None
            ),
        )


class CriterioSchema(_Frozen):
    """O critério real de "deu certo" do motor (PRD 7.2) para a cultura."""

    isna_min: float
    calor_temp_c: float
    calor_min_dias: int
    fase: str
    janela_dias: int


class CicloSchema(_Frozen):
    dias: int
    floracao_dias: int


class ObservarSchema(_Frozen):
    veranico_dias: int
    anos_calor: int
    total: int


class EnsoAcertoSchema(_Frozen):
    fase: FaseEnso
    anos: int
    bons: int
    anos_outros: int
    bons_outros: int
    clara: bool


class OpcaoSchema(_Frozen):
    id: str
    nome: str
    na_janela: bool
    # Prazo do ZARC no ano de referência (AAAA-MM-DD, ex.: "2027-02-28"); null no pousio
    data_limite: str | None
    chuva: ChuvaSchema
    futuro: FuturoSchema | None
    renda: RendaSchema
    terra: TerraSchema
    notas: NotasSchema
    porque: list[str]
    como_fazer: list[str]
    # P1: um item por ano da faixa de chuva, na mesma ordem (opcional no contrato do front)
    anos_detalhe: list[AnoDetalheSchema] = Field(default_factory=list)
    # Aba Sugestão (tarefa 0044); opcionais no contrato do front
    agua: AguaSchema | None = None
    criterio: CriterioSchema | None = None
    ciclo: CicloSchema | None = None
    observar: ObservarSchema | None = None
    enso_acerto: list[EnsoAcertoSchema] = Field(default_factory=list)
    # Tarefa 0056 (tela 5): passou do prazo do ZARC desta colheita (= not na_janela). A cultura
    # vem com a conta do motor, mas fica fora da sugestão, das alternativas e dos planos.
    fora_do_prazo: bool = False

    @classmethod
    def from_model(cls, o: ResultadoOpcao) -> "OpcaoSchema":
        return cls(
            id=o.id,
            nome=o.nome,
            na_janela=o.na_janela,
            fora_do_prazo=not o.na_janela,
            data_limite=o.data_limite,
            chuva=ChuvaSchema(
                anos_bons=o.anos_bons_chuva,
                anos=o.total_anos,
                faixa=list(o.faixa_anos),
                rotulo=o.rotulo_chuva,
                texto=o.texto_chuva,
            ),
            futuro=(
                FuturoSchema(
                    anos_bons_media=o.futuro.anos_bons_media,
                    anos_bons_min=o.futuro.anos_bons_min,
                    anos_bons_max=o.futuro.anos_bons_max,
                    modelos=o.futuro.modelos,
                    cenario=o.futuro.cenario,
                )
                if o.futuro is not None
                else None
            ),
            renda=RendaSchema(
                da_grao=o.da_grao,
                anos_aperto=o.total_anos - o.anos_bons_chuva,
                rotulo=o.rotulo_renda,
                texto=o.texto_renda,
                risco=o.texto_risco,
            ),
            terra=TerraSchema(nota=o.notas.solo, rotulo=o.rotulo_terra, texto=o.texto_terra),
            notas=NotasSchema.from_model(o.notas),
            porque=list(o.porque),
            como_fazer=list(o.como_fazer),
            anos_detalhe=[AnoDetalheSchema.from_model(d) for d in o.anos_detalhe],
            agua=AguaSchema.from_model(o.agua) if o.agua is not None else None,
            criterio=(
                CriterioSchema(
                    isna_min=o.criterio.isna_min,
                    calor_temp_c=o.criterio.calor_temp_c,
                    calor_min_dias=o.criterio.calor_min_dias,
                    fase=o.criterio.fase,
                    janela_dias=o.criterio.janela_dias,
                )
                if o.criterio is not None
                else None
            ),
            ciclo=(
                CicloSchema(dias=o.ciclo.dias, floracao_dias=o.ciclo.floracao_dias)
                if o.ciclo is not None
                else None
            ),
            observar=(
                ObservarSchema(
                    veranico_dias=o.observar.veranico_dias,
                    anos_calor=o.observar.anos_calor,
                    total=o.observar.total,
                )
                if o.observar is not None
                else None
            ),
            enso_acerto=[
                EnsoAcertoSchema(
                    fase=e.fase,
                    anos=e.anos,
                    bons=e.bons,
                    anos_outros=e.anos_outros,
                    bons_outros=e.bons_outros,
                    clara=e.clara,
                )
                for e in o.enso_acerto
            ],
        )


class ForaDaJanelaSchema(_Frozen):
    id: str
    nome: str
    texto: str
    # Data limite do ZARC (tarefa 0044): o aviso único da colheita tarde junta as culturas por data
    data_limite: date | None = None


class ObjetivoSchema(_Frozen):
    """Ordem das opções e plano sugerido para um objetivo do produtor (tarefa 0044)."""

    ordem: list[str]
    plano: list[str]
    nota_plano: float


class AlternativaSchema(_Frozen):
    motivo: str
    opcao: str


class PousioSchema(_Frozen):
    texto: str


class PlanoSchema(_Frozen):
    anos: list[str]
    nota: float
    descricao: str

    @classmethod
    def from_model(cls, plano: PlanoRotacao) -> "PlanoSchema":
        return cls(anos=list(plano.anos), nota=plano.nota, descricao=plano.descricao)


class Plano3AnosSchema(_Frozen):
    normal: PlanoSchema
    seco: PlanoSchema
    hoje: PlanoSchema


class SmapAgoraSchema(_Frozen):
    """O SMAP de agora (tarefa 0038): só informa, não decide o plano."""

    percentil: int
    data: date
    texto: str


class SinalSchema(_Frozen):
    """Sinal para o outono (RF-20): `SinalOutono` do front (`src/models/recomendacao.ts`)."""

    nivel: NivelSinal
    motivo: str
    fonte: list[str]
    data: date
    # Campo opcional da tarefa 0038 (nulo sem o SMAP recente)
    smap_agora: SmapAgoraSchema | None = None

    @classmethod
    def from_model(cls, sinal: SinalOutono) -> "SinalSchema":
        smap = sinal.smap_agora
        return cls(
            nivel=sinal.nivel,
            motivo=sinal.motivo,
            fonte=list(sinal.fonte),
            data=sinal.data,
            smap_agora=(
                SmapAgoraSchema(percentil=smap.percentil, data=smap.data, texto=smap.texto)
                if smap is not None
                else None
            ),
        )


class RecomendacaoResponse(_Frozen):
    """Resposta de /api/recomendacao."""

    entrada: EntradaSchema
    melhor: str
    alternativas: list[AlternativaSchema]
    opcoes: list[OpcaoSchema]
    fora_da_janela: list[ForaDaJanelaSchema]
    pousio: PousioSchema
    plano_3_anos: Plano3AnosSchema
    versao_dados: str
    aviso: str
    # Nulo enquanto não houver previsão nem dado da terra (nada de previsão inventada)
    sinal: SinalSchema | None = None
    # Aba Sugestão (tarefa 0044): ordem e plano por objetivo, clima de 2041-2060 e geada na célula
    objetivos: dict[str, ObjetivoSchema] = Field(default_factory=dict)
    clima_futuro: ClimaFuturoSchema | None = None
    geada: AlertaGeadaSchema | None = None

    @classmethod
    def from_model(cls, rec: Recomendacao) -> "RecomendacaoResponse":
        return cls(
            entrada=EntradaSchema(
                celula_id=rec.celula_id,
                colheita=rec.colheita,
                semeadura=rec.semeadura,
                solo=rec.solo,
                nematoide=rec.nematoide,
                gado=rec.gado,
            ),
            melhor=rec.melhor,
            alternativas=[
                AlternativaSchema(motivo=a.motivo, opcao=a.opcao) for a in rec.alternativas
            ],
            # As no prazo primeiro (a ordem do motor), depois as fora do prazo (tarefa 0056)
            opcoes=[OpcaoSchema.from_model(o) for o in (*rec.opcoes, *rec.opcoes_fora_do_prazo)],
            fora_da_janela=[
                ForaDaJanelaSchema(id=f.id, nome=f.nome, texto=f.texto, data_limite=f.data_limite)
                for f in rec.fora_da_janela
            ],
            pousio=PousioSchema(texto=rec.texto_pousio),
            plano_3_anos=Plano3AnosSchema(
                normal=PlanoSchema.from_model(rec.plano_normal),
                seco=PlanoSchema.from_model(rec.plano_seco),
                hoje=PlanoSchema.from_model(rec.plano_hoje),
            ),
            versao_dados=rec.versao_dados,
            aviso=rec.aviso,
            sinal=SinalSchema.from_model(rec.sinal) if rec.sinal is not None else None,
            objetivos={
                chave: ObjetivoSchema(
                    ordem=list(o.ordem), plano=list(o.plano), nota_plano=o.nota_plano
                )
                for chave, o in rec.objetivos.items()
            },
            clima_futuro=_dump(rec.clima_futuro),  # type: ignore[arg-type]
            geada=_dump(rec.geada),  # type: ignore[arg-type]
        )


class ExemploResponse(_Frozen):
    """Resposta de /api/exemplo: talhão + recomendação da fazenda de exemplo (§3.3)."""

    talhao: TalhaoResponse
    recomendacao: RecomendacaoResponse
