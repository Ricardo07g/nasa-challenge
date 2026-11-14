"""Ligação entre as camadas (injeção de dependências do FastAPI).

Os controllers pedem services via `Depends`; os services recebem repositories.
Nos testes, troque qualquer peça com `app.dependency_overrides[...]`.
"""

from typing import Annotated

from fastapi import Depends

from app.repositories.crop_option_repository import (
    CropOptionRepository,
    InMemoryCropOptionRepository,
)
from app.services.crop_option_service import CropOptionService


def get_crop_option_repository() -> CropOptionRepository:
    return InMemoryCropOptionRepository()


def get_crop_option_service(
    repository: Annotated[CropOptionRepository, Depends(get_crop_option_repository)],
) -> CropOptionService:
    return CropOptionService(repository)
