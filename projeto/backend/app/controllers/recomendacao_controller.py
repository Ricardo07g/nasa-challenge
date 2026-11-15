"""FastAPI controllers for GET /api/recomendacao and GET /api/exemplo."""

from typing import Annotated, Final, Literal

from fastapi import APIRouter, Depends, Header, Query, Response

from app.constants import EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON
from app.controllers.http_cache import revalidated_json_response
from app.dependencies import get_recommendation_service, get_talhao_service
from app.schemas.recomendacao import ExemploResponse, RecomendacaoResponse
from app.schemas.talhao import TalhaoResponse
from app.services.recommendation_service import RecommendationService
from app.services.talhao_service import TalhaoService

router = APIRouter(tags=["recomendacao"])

# Tarefa 0025 (ajusta o plano técnico §8): o navegador guarda a resposta, mas revalida pelo ETag
# (`http_cache.py`). Os textos dependem do idioma, por isso o Vary.
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
    colheita: Annotated[Colheita, Query()] = "meio",
    solo: Annotated[Textura | None, Query()] = None,
    nematoide: Annotated[SimNao | None, Query()] = None,
    gado: Annotated[SimNao | None, Query()] = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
    if_none_match: Annotated[str | None, Header(alias="If-None-Match")] = None,
) -> Response:
    rec = service.recommend(
        lat=lat,
        lon=lon,
        colheita=colheita,
        solo_override=solo,
        nematoide=_sim_nao(nematoide),
        gado=_sim_nao(gado),
        lang=accept_language,
    )
    # Só chega aqui com sucesso: erro de domínio ou de validação sai sem cache nem ETag.
    body = RecomendacaoResponse.from_model(rec).model_dump_json(by_alias=True).encode()
    return revalidated_json_response(body, if_none_match=if_none_match, vary=RECOMMENDATION_VARY)


@router.get("/exemplo", response_model=ExemploResponse)
def get_exemplo(
    rec_service: RecService,
    talhao_service: FieldService,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> ExemploResponse:
    talhao = talhao_service.inspect_talhao(lat=EXAMPLE_FARM_LAT, lon=EXAMPLE_FARM_LON)
    # A faixa que a pergunta 2 já traz marcada (PRD 7.9): sem NDVI suficiente, o talhão diz "meio".
    rec = rec_service.recommend(
        lat=EXAMPLE_FARM_LAT,
        lon=EXAMPLE_FARM_LON,
        colheita=talhao.colheita_sugerida.faixa,
        lang=accept_language,
    )
    return ExemploResponse(
        talhao=TalhaoResponse.from_model(talhao),
        recomendacao=RecomendacaoResponse.from_model(rec),
    )
