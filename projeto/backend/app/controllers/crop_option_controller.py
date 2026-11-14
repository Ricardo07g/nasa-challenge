from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_crop_option_service
from app.schemas.crop_option import CropOptionResponse
from app.services.crop_option_service import CropOptionService

router = APIRouter(prefix="/crop-options", tags=["crop-options"])

Service = Annotated[CropOptionService, Depends(get_crop_option_service)]


# Controller fino: recebe a requisição, chama o service e converte para o schema de resposta.
@router.get("", response_model=list[CropOptionResponse])
def list_crop_options(service: Service) -> list[CropOptionResponse]:
    return [CropOptionResponse.from_model(option) for option in service.list_options()]


@router.get("/{option_id}", response_model=CropOptionResponse)
def get_crop_option(option_id: str, service: Service) -> CropOptionResponse:
    return CropOptionResponse.from_model(service.get_option(option_id))
