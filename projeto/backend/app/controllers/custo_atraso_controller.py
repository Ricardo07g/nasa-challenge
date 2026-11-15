"""FastAPI controller for GET /api/custo-atraso (tela 3: custo do atraso, tarefa 0042)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Query

from app.controllers.confirmadas_param import ConfirmadasQuery, parse_confirmadas
from app.dependencies import get_harvest_delay_service
from app.schemas.custo_atraso import CustoAtrasoResponse
from app.services.harvest_delay_service import HarvestDelayService

router = APIRouter(tags=["custo-atraso"])

Service = Annotated[HarvestDelayService, Depends(get_harvest_delay_service)]

Textura = Literal["arenoso", "medio", "argiloso"]


@router.get("/custo-atraso", response_model=CustoAtrasoResponse)
def get_custo_atraso(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: Service,
    solo: Annotated[Textura | None, Query()] = None,
    confirmadas: ConfirmadasQuery = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> CustoAtrasoResponse:
    custo = service.delay_cost(
        lat=lat,
        lon=lon,
        solo_override=solo,
        confirmadas=parse_confirmadas(confirmadas),
        lang=accept_language,
    )
    return CustoAtrasoResponse.from_model(custo)
