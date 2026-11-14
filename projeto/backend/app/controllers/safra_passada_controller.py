"""FastAPI controller for GET /api/safra-passada (P4: replay de uma safrinha passada)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query

from app.controllers.recomendacao_controller import Colheita
from app.dependencies import get_past_season_service
from app.schemas.safra_passada import SafraPassadaResponse
from app.services.past_season_service import PastSeasonService

router = APIRouter(tags=["safra-passada"])

PastService = Annotated[PastSeasonService, Depends(get_past_season_service)]


@router.get("/safra-passada", response_model=SafraPassadaResponse)
def get_safra_passada(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    ano: Annotated[int, Query()],
    service: PastService,
    colheita: Annotated[Colheita, Query()] = "meio",
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> SafraPassadaResponse:
    season = service.replay(lat=lat, lon=lon, ano=ano, colheita=colheita, lang=accept_language)
    return SafraPassadaResponse.from_model(season)
