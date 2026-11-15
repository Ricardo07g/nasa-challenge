"""FastAPI controller for GET /api/avisos (tela "Avisos", remodelagem S6, tarefa 0046)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Query

from app.controllers.confirmadas_param import ConfirmadasQuery, parse_confirmadas
from app.dependencies import get_avisos_service
from app.schemas.avisos import AvisosResponse
from app.services.avisos_service import AvisosService

router = APIRouter(tags=["avisos"])

Service = Annotated[AvisosService, Depends(get_avisos_service)]

Colheita = Literal["cedo", "meio", "tarde"]
Textura = Literal["arenoso", "medio", "argiloso"]


@router.get("/avisos", response_model=AvisosResponse)
def get_avisos(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: Service,
    colheita: Annotated[Colheita, Query()] = "meio",
    solo: Annotated[Textura | None, Query()] = None,
    confirmadas: ConfirmadasQuery = None,
    cultura: Annotated[str | None, Query(max_length=40)] = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> AvisosResponse:
    """`cultura` (tarefa 0065): o 1º ano do plano, para a falta de água e o "deu certo"."""
    avisos = service.avisos(
        lat=lat,
        lon=lon,
        colheita=colheita,
        solo_override=solo,
        confirmadas=parse_confirmadas(confirmadas),
        lang=accept_language,
        cultura=cultura,
    )
    return AvisosResponse.from_model(avisos)
