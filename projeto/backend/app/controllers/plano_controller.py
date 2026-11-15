"""FastAPI controller for GET /api/plano (tarefa 0045) e GET /api/plano/sugestao (tarefa 0056)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_plan_evaluation_service
from app.schemas.plano import PlanoResponse
from app.services.plan_evaluation_service import PlanEvaluationService

router = APIRouter(tags=["plano"])

Service = Annotated[PlanEvaluationService, Depends(get_plan_evaluation_service)]

Colheita = Literal["cedo", "meio", "tarde"]
Textura = Literal["arenoso", "medio", "argiloso"]


@router.get("/plano", response_model=PlanoResponse)
def get_plano(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    anos: Annotated[str, Query(max_length=200)],
    service: Service,
    colheita: Annotated[Colheita, Query()] = "meio",
    solo: Annotated[Textura | None, Query()] = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> PlanoResponse:
    """`anos`: as 3 culturas do plano, separadas por vírgula (ex.: sorgo,milheto,pousio)."""
    plano = service.evaluate(
        lat=lat,
        lon=lon,
        anos=_crops(anos),
        colheita=colheita,
        solo_override=solo,
        lang=accept_language,
    )
    return PlanoResponse.from_model(plano)


@router.get("/plano/sugestao", response_model=PlanoResponse)
def get_plano_sugestao(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    fixos: Annotated[str, Query(max_length=200)],
    service: Service,
    colheita: Annotated[Colheita, Query()] = "meio",
    solo: Annotated[Textura | None, Query()] = None,
    accept_language: Annotated[str, Header(alias="Accept-Language")] = "pt-BR",
) -> PlanoResponse:
    """`fixos`: o 1º ano, ou o 1º e o 2º (ex.: sorgo,pousio). O motor sugere os outros, com o
    porquê, e avalia o plano inteiro (o mesmo JSON do /plano)."""
    plano = service.suggest(
        lat=lat,
        lon=lon,
        fixos=_crops(fixos),
        colheita=colheita,
        solo_override=solo,
        lang=accept_language,
    )
    return PlanoResponse.from_model(plano)


def _crops(text: str) -> list[str]:
    return [crop.strip() for crop in text.split(",") if crop.strip()]
