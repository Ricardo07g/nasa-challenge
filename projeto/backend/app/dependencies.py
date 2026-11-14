"""Dependency injection wiring between controllers, services, and repositories."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.repositories.climate_repository import (
    ClimateRepository,
    DataOutputClimateRepository,
)
from app.repositories.crop_option_repository import (
    CropOptionRepository,
    InMemoryCropOptionRepository,
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
    CachedEarthEngineNdviRepository,
    NdviRepository,
)
from app.repositories.soil_repository import (
    CachedSoilGridsRepository,
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


def get_crop_option_repository() -> CropOptionRepository:
    return InMemoryCropOptionRepository()


def get_crop_option_service(
    repository: Annotated[CropOptionRepository, Depends(get_crop_option_repository)],
) -> CropOptionService:
    return CropOptionService(repository)


@lru_cache
def get_crop_params_repository() -> CropParamsRepository:
    return YamlCropParamsRepository()


@lru_cache
def get_climate_repository() -> ClimateRepository:
    return DataOutputClimateRepository()


@lru_cache
def get_soil_repository() -> SoilRepository:
    return CachedSoilGridsRepository()


@lru_cache
def get_ndvi_repository() -> NdviRepository:
    return CachedEarthEngineNdviRepository()


def get_nasa_power_client() -> NasaPowerClientProtocol:
    return NasaPowerClient()


def get_soilgrids_client() -> SoilGridsClientProtocol:
    return SoilGridsClient()


def get_satellite_ingestion_service(
    nasa_client: Annotated[NasaPowerClientProtocol, Depends(get_nasa_power_client)],
    soil_client: Annotated[SoilGridsClientProtocol, Depends(get_soilgrids_client)],
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
) -> SatelliteIngestionService:
    return SatelliteIngestionService(
        nasa_client=nasa_client,
        soil_client=soil_client,
        climate_repo=climate_repo,
        soil_repo=soil_repo,
    )


def get_field_history_service() -> FieldHistoryService:
    return FieldHistoryService()


def get_water_balance_calculator() -> WaterBalanceCalculator:
    return WaterBalanceCalculator()


def get_climate_risk_service(
    wb: Annotated[WaterBalanceCalculator, Depends(get_water_balance_calculator)],
) -> ClimateRiskService:
    return ClimateRiskService(wb)


def get_rotation_plan_service() -> RotationPlanService:
    return RotationPlanService()


def get_talhao_service(
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
    ndvi_repo: Annotated[NdviRepository, Depends(get_ndvi_repository)],
    history_service: Annotated[FieldHistoryService, Depends(get_field_history_service)],
    ingestion_service: Annotated[
        SatelliteIngestionService, Depends(get_satellite_ingestion_service)
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
) -> RecommendationService:
    return RecommendationService(
        crop_repo=crop_repo,
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        risk_service=risk_service,
        plan_service=plan_service,
    )
