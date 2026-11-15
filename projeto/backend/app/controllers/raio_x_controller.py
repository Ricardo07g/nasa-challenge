"""FastAPI controller for GET /api/raio-x (tela 4 "O que o satélite viu", tarefa 0043)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Query

from app.controllers.confirmadas_param import ConfirmadasQuery, parse_confirmadas
from app.dependencies import get_raio_x_service
from app.schemas.raio_x import RaioXResponse
from app.services.raio_x_service import RaioXService

router = APIRouter(tags=["raio-x"])

Service = Annotated[RaioXService, Depends(get_raio_x_service)]

Colheita = Literal["cedo", "meio", "tarde"]
Textura = Literal["arenoso", "medio", "argiloso"]


@router.get("/raio-x", response_model=RaioXResponse)
def get_raio_x(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: Service,
    colheita: Annotated[Colheita, Query()] = "meio",
    solo: Annotated[Textura | None, Query()] = None,
    confirmadas: ConfirmadasQuery = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> RaioXResponse:
    raio = service.raio_x(
        lat=lat,
        lon=lon,
        colheita=colheita,
        solo_override=solo,
        confirmadas=parse_confirmadas(confirmadas),
        lang=accept_language,
    )
    return RaioXResponse.from_model(raio)
