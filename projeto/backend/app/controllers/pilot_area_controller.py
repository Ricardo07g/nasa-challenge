from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_pilot_area_service
from app.schemas.pilot_area import PilotAreaResponse
from app.services.pilot_area_service import PilotAreaService

router = APIRouter(tags=["area-piloto"])

Service = Annotated[PilotAreaService, Depends(get_pilot_area_service)]


# Tela "Onde fica a lavoura" (tarefa 0041): o front desenha a caixa e bloqueia o ponto fora dela.
@router.get("/area-piloto", response_model=PilotAreaResponse)
def get_pilot_area(service: Service) -> PilotAreaResponse:
    return PilotAreaResponse.from_model(service.get())
