from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])

AppSettings = Annotated[Settings, Depends(get_settings)]


# Endpoint de infraestrutura: sem regra de negócio, então não passa por service.
# O commit é o que está no ar (COMMIT_SHA, gravado pelo deploy do CI): o smoke test confere.
@router.get("/health", response_model=HealthResponse)
def health(settings: AppSettings) -> HealthResponse:
    return HealthResponse(status="ok", commit=settings.commit_sha)
