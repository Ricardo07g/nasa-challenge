"""FastAPI controller for GET /api/regiao (P3: a lavoura da região pelo satélite, ano a ano)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_region_service
from app.schemas.regiao import RegiaoResponse
from app.services.region_service import RegionService

router = APIRouter(tags=["regiao"])

Service = Annotated[RegionService, Depends(get_region_service)]


@router.get("/regiao", response_model=RegiaoResponse)
def get_regiao(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: Service,
) -> RegiaoResponse:
    return RegiaoResponse.from_model(service.get_region(lat=lat, lon=lon))
