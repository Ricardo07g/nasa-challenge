from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_method_service
from app.schemas.metodo import MetodoResponse
from app.services.method_service import MethodService

router = APIRouter(tags=["metodo"])

Service = Annotated[MethodService, Depends(get_method_service)]


# Tela "Como a conta é feita" (tarefa 0049): os números das regras, para a tela não repetir número.
@router.get("/metodo", response_model=MetodoResponse)
def get_method_rules(service: Service) -> MetodoResponse:
    return MetodoResponse.from_model(service.rules())
