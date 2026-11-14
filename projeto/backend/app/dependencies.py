"""Dependency injection wiring between controllers, services, and repositories."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.config import get_settings
from app.models.regras import Regras
from app.repositories.climate_repository import (
    ClimateRepository,
    FixtureClimateRepository,
    PostgisClimateRepository,
)
from app.repositories.crop_option_repository import (
    CropOptionRepository,
    YamlCropOptionRepository,
)
from app.repositories.crop_params_repository import (
    CropParamsRepository,
    YamlCropParamsRepository,
)
from app.repositories.external.nasa_power_client import (
    NasaPowerClient,
    NasaPowerClientProtocol,
)
from app.repositories.external.soilgrids_client import (
    SoilGridsClient,
    SoilGridsClientProtocol,
)
from app.repositories.ndvi_repository import (
    CachedNdviRepository,
    NdviRepository,
)
from app.repositories.rules_repository import RulesRepository, YamlRulesRepository
from app.repositories.soil_repository import (
    CachedSoilGridsRepository,
    PostgisSoilRepository,
    SoilRepository,
)
from app.services.climate_risk_service import ClimateRiskService
from app.services.crop_option_service import CropOptionService
from app.services.field_history_service import FieldHistoryService
from app.services.recommendation_service import RecommendationService
from app.services.rotation_plan_service import RotationPlanService
from app.services.satellite_ingestion_service import SatelliteIngestionService
from app.services.talhao_service import TalhaoService
from app.services.water_balance_calculator import WaterBalanceCalculator


@lru_cache
def get_crop_option_repository() -> CropOptionRepository:
    return YamlCropOptionRepository(get_settings().culturas_path)


def get_crop_option_service(
    repository: Annotated[CropOptionRepository, Depends(get_crop_option_repository)],
) -> CropOptionService:
    return CropOptionService(repository)


@lru_cache
def get_crop_params_repository() -> CropParamsRepository:
    return YamlCropParamsRepository(get_settings().culturas_path)


# Com DATABASE_URL (não vazia: `DATABASE_URL=` do .env.example chega como ""), clima e solo vêm do
# PostGIS, com os arquivos como reserva, e a busca sob demanda fica ligada. Sem banco, só arquivos.


@lru_cache
def get_rules_repository() -> RulesRepository:
    return YamlRulesRepository(get_settings().regras_path)


def get_rules(repository: Annotated[RulesRepository, Depends(get_rules_repository)]) -> Regras:
    return repository.get_rules()


@lru_cache
def get_climate_repository() -> ClimateRepository:
    settings = get_settings()
    fixture = FixtureClimateRepository(settings.clima_path)
    if settings.database_url:
        return PostgisClimateRepository(settings.database_url, fallback_repo=fixture)
    return fixture


@lru_cache
def get_soil_repository() -> SoilRepository:
    settings = get_settings()
    cached = CachedSoilGridsRepository(settings.solo_cache_path)
    if settings.database_url:
        return PostgisSoilRepository(settings.database_url, fallback=cached)
    return cached


@lru_cache
def get_ndvi_repository() -> NdviRepository:
    return CachedNdviRepository(get_settings().ndvi_cache_path)


def get_nasa_power_client() -> NasaPowerClientProtocol:
    return NasaPowerClient()


def get_soilgrids_client() -> SoilGridsClientProtocol:
    return SoilGridsClient()


def get_satellite_ingestion_service(
    nasa_client: Annotated[NasaPowerClientProtocol, Depends(get_nasa_power_client)],
    soil_client: Annotated[SoilGridsClientProtocol, Depends(get_soilgrids_client)],
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
) -> SatelliteIngestionService | None:
    """Busca sob demanda só com banco: é nele que a célula nova fica gravada."""
    if not get_settings().database_url:
        return None
    if not isinstance(climate_repo, PostgisClimateRepository) or not isinstance(
        soil_repo, PostgisSoilRepository
    ):
        return None
    return SatelliteIngestionService(
        nasa_client=nasa_client,
        soil_client=soil_client,
        climate_repo=climate_repo,
        soil_repo=soil_repo,
    )


def get_field_history_service(rules: Annotated[Regras, Depends(get_rules)]) -> FieldHistoryService:
    return FieldHistoryService(rules)


def get_water_balance_calculator() -> WaterBalanceCalculator:
    return WaterBalanceCalculator()


def get_climate_risk_service(
    wb: Annotated[WaterBalanceCalculator, Depends(get_water_balance_calculator)],
    rules: Annotated[Regras, Depends(get_rules)],
) -> ClimateRiskService:
    return ClimateRiskService(wb, rules)


def get_rotation_plan_service(rules: Annotated[Regras, Depends(get_rules)]) -> RotationPlanService:
    return RotationPlanService(rules)


def get_talhao_service(
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
    ndvi_repo: Annotated[NdviRepository, Depends(get_ndvi_repository)],
    history_service: Annotated[FieldHistoryService, Depends(get_field_history_service)],
    ingestion_service: Annotated[
        SatelliteIngestionService | None, Depends(get_satellite_ingestion_service)
    ],
) -> TalhaoService:
    return TalhaoService(
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        ndvi_repo=ndvi_repo,
        history_service=history_service,
        ingestion_service=ingestion_service,
    )


def get_recommendation_service(
    crop_repo: Annotated[CropParamsRepository, Depends(get_crop_params_repository)],
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
    risk_service: Annotated[ClimateRiskService, Depends(get_climate_risk_service)],
    plan_service: Annotated[RotationPlanService, Depends(get_rotation_plan_service)],
    rules: Annotated[Regras, Depends(get_rules)],
    ingestion_service: Annotated[
        SatelliteIngestionService | None, Depends(get_satellite_ingestion_service)
    ],
) -> RecommendationService:
    return RecommendationService(
        crop_repo=crop_repo,
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        risk_service=risk_service,
        plan_service=plan_service,
        rules=rules,
        ingestion_service=ingestion_service,
    )
