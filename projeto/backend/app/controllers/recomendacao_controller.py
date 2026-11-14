"""FastAPI controllers for GET /api/recomendacao and GET /api/exemplo."""

from typing import Annotated, Final, Literal

from fastapi import APIRouter, Depends, Header, Query, Response

from app.constants import EXAMPLE_FARM_HARVEST, EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON
from app.dependencies import get_recommendation_service, get_talhao_service
from app.schemas.recomendacao import ExemploResponse, RecomendacaoResponse
from app.schemas.talhao import TalhaoResponse
from app.services.recommendation_service import RecommendationService
from app.services.talhao_service import TalhaoService

router = APIRouter(tags=["recomendacao"])

# Plano técnico §8: a recomendação só muda quando o pipeline roda, então o navegador e a CDN podem
# guardar a resposta por um dia. Os textos dependem do idioma, por isso o Vary.
RECOMMENDATION_CACHE_CONTROL: Final[str] = "public, max-age=86400"
RECOMMENDATION_VARY: Final[str] = "Accept-Language"

RecService = Annotated[RecommendationService, Depends(get_recommendation_service)]
FieldService = Annotated[TalhaoService, Depends(get_talhao_service)]


Colheita = Literal["cedo", "meio", "tarde"]
Textura = Literal["arenoso", "medio", "argiloso"]
# ADR-0002: sim/true/1 = True, nao/false/0 = False; qualquer outro valor dá 422
SimNao = Literal["sim", "nao", "true", "false", "1", "0"]


def _sim_nao(value: SimNao | None) -> bool | None:
    return None if value is None else value in ("sim", "true", "1")


@router.get("/recomendacao", response_model=RecomendacaoResponse)
def get_recomendacao(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: RecService,
    response: Response,
    colheita: Annotated[Colheita, Query()] = "meio",
    solo: Annotated[Textura | None, Query()] = None,
    nematoide: Annotated[SimNao | None, Query()] = None,
    gado: Annotated[SimNao | None, Query()] = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> RecomendacaoResponse:
    rec = service.recommend(
        lat=lat,
        lon=lon,
        colheita=colheita,
        solo_override=solo,
        nematoide=_sim_nao(nematoide),
        gado=_sim_nao(gado),
        lang=accept_language,
    )
    # Só chega aqui com sucesso: erro de domínio ou de validação sai sem cache.
    response.headers["Cache-Control"] = RECOMMENDATION_CACHE_CONTROL
    response.headers["Vary"] = RECOMMENDATION_VARY
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
