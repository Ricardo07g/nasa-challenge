"""JSON de GET /api/recomendacao e GET /api/exemplo (plano técnico §3.2 e §3.3)."""

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, SerializerFunctionWrapHandler, model_serializer

from app.models.recomendacao import NotasOpcao, PlanoRotacao, Recomendacao, ResultadoOpcao
from app.models.sinal_outono import NivelSinal, SinalOutono
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


class DinheiroSchema(_Frozen):
    margem_ha: float
    rotulo: str
    texto: str
    # A1.2: margem do pior dos anos mais secos (a conta x hectares fica no front)
    pior_ano_seco_ha: float | None = None

    # Sem tipo de retorno de propósito: com ele, o OpenAPI (/docs) perde os campos do `dinheiro`.
    @model_serializer(mode="wrap")
    def _omit_missing_worst_dry_year(self, handler: SerializerFunctionWrapHandler):
        # Sem valor, a chave não vai: o front (`dinheiro.pior_ano_seco_ha?: number`) testa
        # `=== undefined`, e um null viraria R$ 0 na conta x hectares.
        data: dict[str, Any] = handler(self)
        if data.get("pior_ano_seco_ha") is None:
            data.pop("pior_ano_seco_ha", None)
        return data


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


class OpcaoSchema(_Frozen):
    id: str
    nome: str
    na_janela: bool
    data_limite: str | None
    chuva: ChuvaSchema
    futuro: FuturoSchema | None
    dinheiro: DinheiroSchema
    terra: TerraSchema
    notas: NotasSchema
    porque: list[str]
    como_fazer: list[str]

    @classmethod
    def from_model(cls, o: ResultadoOpcao) -> "OpcaoSchema":
        return cls(
            id=o.id,
            nome=o.nome,
            na_janela=o.na_janela,
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
            dinheiro=DinheiroSchema(
                margem_ha=o.margem_ha,
                rotulo=o.rotulo_dinheiro,
                texto=o.texto_dinheiro,
                pior_ano_seco_ha=o.pior_ano_seco_ha,
            ),
            terra=TerraSchema(nota=o.notas.solo, rotulo=o.rotulo_terra, texto=o.texto_terra),
            notas=NotasSchema.from_model(o.notas),
            porque=list(o.porque),
            como_fazer=list(o.como_fazer),
        )


class ForaDaJanelaSchema(_Frozen):
    id: str
    nome: str
    texto: str


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


class RegraDiaPlantarSchema(_Frozen):
    data_limite: date
    texto: str


class SinalSchema(_Frozen):
    """Sinal para o outono (RF-20): `SinalOutono` do front (`src/models/recomendacao.ts`)."""

    nivel: NivelSinal
    motivo: str
    fonte: list[str]
    data: date
    regra_dia_plantar: RegraDiaPlantarSchema

    @classmethod
    def from_model(cls, sinal: SinalOutono) -> "SinalSchema":
        return cls(
            nivel=sinal.nivel,
            motivo=sinal.motivo,
            fonte=list(sinal.fonte),
            data=sinal.data,
            regra_dia_plantar=RegraDiaPlantarSchema(
                data_limite=sinal.regra_dia_plantar.data_limite,
                texto=sinal.regra_dia_plantar.texto,
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
            opcoes=[OpcaoSchema.from_model(o) for o in rec.opcoes],
            fora_da_janela=[
                ForaDaJanelaSchema(id=f.id, nome=f.nome, texto=f.texto) for f in rec.fora_da_janela
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
        )


class ExemploResponse(_Frozen):
    """Resposta de /api/exemplo: talhão + recomendação da fazenda de exemplo (§3.3)."""

    talhao: TalhaoResponse
    recomendacao: RecomendacaoResponse
