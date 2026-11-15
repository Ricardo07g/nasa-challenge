"""JSON dos relatos da comunidade (tarefa 0047; contrato do front em `src/models/community.ts`).

Entrada (`POST /api/comunidade/relatos`): o relato e o ponto marcado; campo a mais é recusado (nada
de nome, telefone ou texto livre). Saída: o relato como os vizinhos veem, com a célula e o centro
dela, nunca o ponto exato nem o aparelho; `meu` diz se foi este aparelho que enviou.
"""

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.community_report import NearbyReport, NearbyReports


class RelatoEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo: str = Field(max_length=32)
    subtipo: str | None = Field(default=None, max_length=32)
    valores: dict[str, Any] = Field(default_factory=dict, max_length=4)
    lat: float = Field(ge=-90.0, le=90.0)
    lon: float = Field(ge=-180.0, le=180.0)
    data_fato: date | None = None


class RelatoSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    tipo: str
    subtipo: str | None
    valores: dict[str, Any]
    celula: str
    # Centro da célula de 0,1° (nunca o ponto marcado).
    lat: float
    lon: float
    data_fato: date | None
    meu: bool

    @classmethod
    def from_model(cls, report: NearbyReport) -> "RelatoSchema":
        return cls(
            id=report.id,
            tipo=report.tipo,
            subtipo=report.subtipo,
            valores=dict(report.valores),
            celula=report.celula,
            lat=report.lat,
            lon=report.lon,
            data_fato=report.data_fato,
            meu=report.meu,
        )


class RelatosResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    raio_km: float
    # As últimas safras aceitas no relato de plantio (as da tela 4).
    anos_safra: list[int]
    relatos: list[RelatoSchema]

    @classmethod
    def from_model(cls, nearby: NearbyReports) -> "RelatosResponse":
        return cls(
            raio_km=nearby.raio_km,
            anos_safra=list(nearby.anos_safra),
            relatos=[RelatoSchema.from_model(report) for report in nearby.relatos],
        )
