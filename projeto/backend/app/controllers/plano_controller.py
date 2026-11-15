"""FastAPI controller for GET /api/plano (aba "Plano de 3 anos", tarefa 0045)."""

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
        anos=[crop.strip() for crop in anos.split(",") if crop.strip()],
        colheita=colheita,
        solo_override=solo,
        lang=accept_language,
    )
    return PlanoResponse.from_model(plano)
