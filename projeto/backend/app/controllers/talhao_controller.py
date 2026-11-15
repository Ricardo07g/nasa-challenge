"""FastAPI controller for field inspection (GET /api/talhao)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.controllers.confirmadas_param import ConfirmadasQuery, parse_confirmadas
from app.dependencies import get_talhao_service
from app.schemas.talhao import TalhaoResponse
from app.services.talhao_service import TalhaoService

router = APIRouter(prefix="/talhao", tags=["talhao"])

Service = Annotated[TalhaoService, Depends(get_talhao_service)]


@router.get("", response_model=TalhaoResponse)
def get_talhao(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: Service,
    confirmadas: ConfirmadasQuery = None,
) -> TalhaoResponse:
    talhao = service.inspect_talhao(lat=lat, lon=lon, confirmadas=parse_confirmadas(confirmadas))
    return TalhaoResponse.from_model(talhao)
