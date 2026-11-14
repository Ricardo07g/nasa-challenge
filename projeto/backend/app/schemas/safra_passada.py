"""JSON de GET /api/safra-passada (P4; contrato do front em `src/models/pastSeason.ts`)."""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.safra_passada import EventType, PastSeason


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class SeasonEventSchema(_Frozen):
    data: date
    tipo: EventType
    texto: str


class SafraPassadaResponse(_Frozen):
    ano: int
    opcao: str
    eventos: list[SeasonEventSchema]

    @classmethod
    def from_model(cls, season: PastSeason) -> "SafraPassadaResponse":
        return cls(
            ano=season.ano,
            opcao=season.opcao,
            eventos=[
                SeasonEventSchema(data=e.data, tipo=e.tipo, texto=e.texto) for e in season.eventos
            ],
        )
