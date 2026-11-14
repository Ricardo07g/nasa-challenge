"""Pydantic response schemas for GET /api/recomendacao and GET /api/exemplo."""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.recomendacao import Recomendacao
from app.schemas.talhao import TalhaoResponse


class EntradaSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    lat: float
    lon: float
    celula_id: str
    colheita: str
    semeadura: date
    solo: str
    nematoide: bool | None
    gado: bool | None = None


class NotasSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    seguranca: float
    futuro: float
    solo: float
    renda: float
    final: float


class OpcaoSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    nome: str
    na_janela: bool
    data_limite: str | None
    anos_bons_chuva: int
    total_anos: int
    faixa_anos: list[bool]
    rotulo_chuva: str
    texto_chuva: str
    futuro_anos_bons_media: int
    futuro_anos_bons_min: int
    futuro_anos_bons_max: int
    margem_ha: float
    rotulo_dinheiro: str
    texto_dinheiro: str
    rotulo_terra: str
    texto_terra: str
    notas: NotasSchema
    porque: list[str]
    como_fazer: list[str]


class ForaDaJanelaSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    nome: str
    texto: str


class AlternativaSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    motivo: str
    opcao_id: str


class PousioSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    texto: str


class PlanoItemSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    anos: list[str]
    nota: float
    descricao: str


class Plano3AnosSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    normal: PlanoItemSchema
    seco: PlanoItemSchema
    hoje: PlanoItemSchema


class RecomendacaoResponse(BaseModel):
    """HTTP JSON response schema for agroclimatic recommendation (/api/recomendacao)."""

    model_config = ConfigDict(frozen=True)

    entrada: EntradaSchema
    melhor: str
    alternativas: list[AlternativaSchema]
    opcoes: list[OpcaoSchema]
    fora_da_janela: list[ForaDaJanelaSchema]
    pousio: PousioSchema
    plano_3_anos: Plano3AnosSchema
    versao_dados: str
    aviso: str

    @classmethod
    def from_model(cls, rec: Recomendacao) -> "RecomendacaoResponse":
        return cls(
            entrada=EntradaSchema(
                lat=rec.lat,
                lon=rec.lon,
                celula_id=rec.celula_id,
                colheita=rec.colheita,
                semeadura=rec.semeadura,
                solo=rec.solo,
                nematoide=rec.nematoide,
                gado=rec.gado,
            ),
            melhor=rec.melhor,
            alternativas=[
                AlternativaSchema(motivo=a.motivo, opcao_id=a.opcao_id) for a in rec.alternativas
            ],
            opcoes=[
                OpcaoSchema(
                    id=o.id,
                    nome=o.nome,
                    na_janela=o.na_janela,
                    data_limite=o.data_limite,
                    anos_bons_chuva=o.anos_bons_chuva,
                    total_anos=o.total_anos,
                    faixa_anos=list(o.faixa_anos),
                    rotulo_chuva=o.rotulo_chuva,
                    texto_chuva=o.texto_chuva,
                    futuro_anos_bons_media=o.futuro_anos_bons_media,
                    futuro_anos_bons_min=o.futuro_anos_bons_min,
                    futuro_anos_bons_max=o.futuro_anos_bons_max,
                    margem_ha=o.margem_ha,
                    rotulo_dinheiro=o.rotulo_dinheiro,
                    texto_dinheiro=o.texto_dinheiro,
                    rotulo_terra=o.rotulo_terra,
                    texto_terra=o.texto_terra,
                    notas=NotasSchema(
                        seguranca=o.notas.seguranca,
                        futuro=o.notas.futuro,
                        solo=o.notas.solo,
                        renda=o.notas.renda,
                        final=o.notas.final,
                    ),
                    porque=list(o.porque),
                    como_fazer=list(o.como_fazer),
                )
                for o in rec.opcoes
            ],
            fora_da_janela=[
                ForaDaJanelaSchema(id=f.id, nome=f.nome, texto=f.texto) for f in rec.fora_da_janela
            ],
            pousio=PousioSchema(texto=rec.texto_pousio),
            plano_3_anos=Plano3AnosSchema(
                normal=PlanoItemSchema(
                    anos=list(rec.plano_normal.anos),
                    nota=rec.plano_normal.nota,
                    descricao=rec.plano_normal.descricao,
                ),
                seco=PlanoItemSchema(
                    anos=list(rec.plano_seco.anos),
                    nota=rec.plano_seco.nota,
                    descricao=rec.plano_seco.descricao,
                ),
                hoje=PlanoItemSchema(
                    anos=list(rec.plano_hoje.anos),
                    nota=rec.plano_hoje.nota,
                    descricao=rec.plano_hoje.descricao,
                ),
            ),
            versao_dados=rec.versao_dados,
            aviso=rec.aviso,
        )


class ExemploResponse(BaseModel):
    """Consolidated response for GET /api/exemplo (ADR-0004)."""

    model_config = ConfigDict(frozen=True)

    talhao: TalhaoResponse
    recomendacao: RecomendacaoResponse
