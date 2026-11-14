"""FastAPI controllers for GET /api/recomendacao and GET /api/exemplo."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query

from app.constants import EXAMPLE_FARM_HARVEST, EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON
from app.dependencies import get_recommendation_service, get_talhao_service
from app.schemas.recomendacao import ExemploResponse, RecomendacaoResponse
from app.schemas.talhao import TalhaoResponse
from app.services.recommendation_service import RecommendationService
from app.services.talhao_service import TalhaoService

router = APIRouter(tags=["recomendacao"])

RecService = Annotated[RecommendationService, Depends(get_recommendation_service)]
FieldService = Annotated[TalhaoService, Depends(get_talhao_service)]


def _parse_optional_bool(raw: str | None) -> bool | None:
    if raw is None:
        return None
    normalized = raw.strip().lower()
    if normalized in ("sim", "true", "1", "yes"):
        return True
    if normalized in ("nao", "não", "false", "0", "no"):
        return False
    return None


@router.get("/recomendacao", response_model=RecomendacaoResponse)
def get_recomendacao(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: RecService,
    colheita: Annotated[str, Query()] = "meio",
    solo: Annotated[str | None, Query()] = None,
    nematoide: Annotated[str | None, Query()] = None,
    gado: Annotated[str | None, Query()] = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> RecomendacaoResponse:
    rec = service.recommend(
        lat=lat,
        lon=lon,
        colheita=colheita,
        solo_override=solo,
        nematoide=_parse_optional_bool(nematoide),
        gado=_parse_optional_bool(gado),
        lang=accept_language,
    )
    return RecomendacaoResponse.from_model(rec)


@router.get("/exemplo", response_model=ExemploResponse)
def get_exemplo(
    rec_service: RecService,
    talhao_service: FieldService,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> ExemploResponse:
    talhao = talhao_service.inspect_talhao(lat=EXAMPLE_FARM_LAT, lon=EXAMPLE_FARM_LON)
    rec = rec_service.recommend(
        lat=EXAMPLE_FARM_LAT,
        lon=EXAMPLE_FARM_LON,
        colheita=EXAMPLE_FARM_HARVEST,
        lang=accept_language,
    )
    return ExemploResponse(
        talhao=TalhaoResponse.from_model(talhao),
        recomendacao=RecomendacaoResponse.from_model(rec),
    )
