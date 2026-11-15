"""Dependency injection wiring between controllers, services, and repositories."""

import logging
import secrets
from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.config import get_settings
from app.models.regras import Regras
from app.repositories.area_queimada_repository import (
    AreaQueimadaRepository,
    FileAreaQueimadaRepository,
)
from app.repositories.climate_repository import (
    ClimateRepository,
    FixtureClimateRepository,
    PostgisClimateRepository,
    RegionRainRepository,
)
from app.repositories.cmip6_repository import FileCmip6Repository, PostgisCmip6Repository
from app.repositories.community_report_repository import (
    CommunityReportRepository,
    PostgisCommunityReportRepository,
)
from app.repositories.crop_option_repository import (
    CropOptionRepository,
    YamlCropOptionRepository,
)
from app.repositories.crop_params_repository import (
    CropParamsRepository,
    YamlCropParamsRepository,
)
from app.repositories.enso_forecast_repository import (
    EnsoForecastRepository,
    FileEnsoForecastRepository,
)
from app.repositories.enso_repository import EnsoRepository, FileEnsoRepository
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
from app.repositories.recent_rain_repository import FileRecentRainRepository
from app.repositories.recent_weather_repository import (
    PowerRecentWeatherRepository,
    RecentWeatherRepository,
)
from app.repositories.regiao_repository import FileRegionRepository, RegionRepository
from app.repositories.rules_repository import RulesRepository, YamlRulesRepository
from app.repositories.sinal_outono_repository import (
    FileRecentSoilMoistureRepository,
    NoAutumnSignalDataRepository,
    RecentRainRepository,
    RecentSoilMoistureRepository,
    SeasonalForecastRepository,
)
from app.repositories.smap_repository import (
    CellSmapRepository,
    FileSmapRepository,
    LayeredSmapRepository,
    PostgisSmapRepository,
)
from app.repositories.soil_repository import (
    CachedSoilGridsRepository,
    NearestSoilRepository,
    PostgisSoilRepository,
    SoilRepository,
)
from app.repositories.soja_recente_repository import (
    FileSojaRecenteRepository,
    SojaRecenteRepository,
)
from app.services.avisos_service import AvisosService
from app.services.burned_area_service import BurnedAreaService
from app.services.climate_risk_service import ClimateRiskService
from app.services.community_report_service import CommunityReportService
from app.services.crop_alert_service import CropAlertService
from app.services.crop_option_service import CropOptionService
from app.services.field_history_service import FieldHistoryService
from app.services.harvest_delay_service import HarvestDelayService
from app.services.method_service import MethodService
from app.services.monthly_rain_service import MonthlyRainService
from app.services.past_season_service import PastSeasonService
from app.services.pilot_area_service import PilotAreaService
from app.services.plan_evaluation_service import PlanEvaluationService
from app.services.rain_end_service import RainEndService
from app.services.raio_x_service import RaioXService
from app.services.recommendation_service import RecommendationService
from app.services.region_service import RegionService
from app.services.remaining_rain_service import RemainingRainService
from app.services.rotation_plan_service import RotationPlanService
from app.services.satellite_ingestion_service import SatelliteIngestionService
from app.services.sinal_outono_service import SinalOutonoService
from app.services.soja_recente_service import SojaRecenteService
from app.services.talhao_service import TalhaoService
from app.services.water_balance_calculator import WaterBalanceCalculator
from app.services.year_detail_service import YearDetailService

logger = logging.getLogger(__name__)


@lru_cache
def get_crop_option_repository() -> CropOptionRepository:
    return YamlCropOptionRepository(get_settings().culturas_path)


def get_crop_option_service(
    repository: Annotated[CropOptionRepository, Depends(get_crop_option_repository)],
) -> CropOptionService:
    return CropOptionService(repository)


def get_pilot_area_service() -> PilotAreaService:
    return PilotAreaService()


@lru_cache
def get_crop_params_repository() -> CropParamsRepository:
    return YamlCropParamsRepository(get_settings().culturas_path)


# Com DATABASE_URL (não vazia: `DATABASE_URL=` do .env.example chega como ""), clima e solo vêm do
# PostGIS, com os arquivos como reserva, e a busca sob demanda fica ligada. Sem banco, só arquivos.
# Deltas do CMIP6: tabela `cmip6_delta` (com banco), arquivo do CMIP6_PATH e a fixture, nessa ordem.
# SMAP do dia de plantar: tabela `smap_point` (com banco) e o arquivo do SMAP_PATH, nessa ordem.


@lru_cache
def get_rules_repository() -> RulesRepository:
    return YamlRulesRepository(get_settings().regras_path)


def get_rules(repository: Annotated[RulesRepository, Depends(get_rules_repository)]) -> Regras:
    return repository.get_rules()


def get_method_service(rules: Annotated[Regras, Depends(get_rules)]) -> MethodService:
    """Tela "Como a conta é feita" (tarefa 0049): os números das regras do regras.yaml."""
    return MethodService(rules)


@lru_cache
def get_climate_repository() -> ClimateRepository:
    settings = get_settings()
    cmip6_file = FileCmip6Repository(settings.cmip6_path)
    if settings.database_url:
        return PostgisClimateRepository(
            settings.database_url,
            fallback_repo=FixtureClimateRepository(settings.clima_path),
            cmip6_repo=PostgisCmip6Repository(settings.database_url),
            cmip6_file_repo=cmip6_file,
        )
    return FixtureClimateRepository(settings.clima_path, cmip6_file_repo=cmip6_file)


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


# Região pelo satélite (P3): com ou sem banco, vem do arquivo do REGIAO_PATH.
@lru_cache
def get_region_repository() -> RegionRepository:
    return FileRegionRepository(get_settings().regiao_path)


def get_region_service(
    repository: Annotated[RegionRepository, Depends(get_region_repository)],
) -> RegionService:
    return RegionService(repository)


# Soja na safra mais recente (RF-24): com ou sem banco, vem do arquivo do SOJA_RECENTE_PATH.
@lru_cache
def get_soja_recente_repository() -> SojaRecenteRepository:
    return FileSojaRecenteRepository(get_settings().soja_recente_path)


def get_soja_recente_service(
    repository: Annotated[SojaRecenteRepository, Depends(get_soja_recente_repository)],
    rules: Annotated[Regras, Depends(get_rules)],
) -> SojaRecenteService:
    return SojaRecenteService(repository, rules)


@lru_cache
def get_smap_repository() -> CellSmapRepository:
    """SMAP do dia de plantar (balde inicial, R3.3): tabela `smap_point`, depois o SMAP_PATH."""
    settings = get_settings()
    smap_file = FileSmapRepository(settings.smap_path)
    if settings.database_url:
        return LayeredSmapRepository(PostgisSmapRepository(settings.database_url), smap_file)
    return smap_file


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


# Sinal para o outono (RF-20): uma fonte por repository. A chuva recente (A2.3) vem do arquivo
# do IMERG_LATE_PATH e o SMAP recente (A2.2) do SMAP_RECENTE_PATH; o GEOS-S2S (A2.1, tarefa 0032)
# ainda não tem dado. O dado da terra só conta com SMAP e chuva juntos; sem dado nenhum, o `sinal`
# de /recomendacao sai nulo.
# Tarefa 0038 (decisão de 15/11/2026): o sinal agora usa a previsão do ENSO (ENSO_PREVISAO_PATH),
# o ONI de cada ano (ONI_PATH) e o SMAP recente (só informa); o service fica depois do
# get_enso_repository, abaixo. O GEOS-S2S e a chuva recente seguem aqui, sem uso no sinal.


@lru_cache
def get_seasonal_forecast_repository() -> SeasonalForecastRepository:
    return NoAutumnSignalDataRepository()


@lru_cache
def get_recent_soil_moisture_repository() -> RecentSoilMoistureRepository:
    return FileRecentSoilMoistureRepository(get_settings().smap_recente_path)


@lru_cache
def get_recent_rain_repository() -> RecentRainRepository:
    return FileRecentRainRepository(get_settings().imerg_late_path)


# Área queimada do MCD64A1 (alerta de fogo do raio-X, tarefa 0043; fonte do talhão, tarefa 0049):
# vem do arquivo do AREA_QUEIMADA_PATH; sem ele, nada de fogo.
@lru_cache
def get_area_queimada_repository() -> AreaQueimadaRepository:
    return FileAreaQueimadaRepository(get_settings().area_queimada_path)


def get_talhao_service(
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
    ndvi_repo: Annotated[NdviRepository, Depends(get_ndvi_repository)],
    history_service: Annotated[FieldHistoryService, Depends(get_field_history_service)],
    ingestion_service: Annotated[
        SatelliteIngestionService | None, Depends(get_satellite_ingestion_service)
    ],
    smap_repo: Annotated[CellSmapRepository, Depends(get_smap_repository)],
    soja_recente_service: Annotated[SojaRecenteService, Depends(get_soja_recente_service)],
    risk_service: Annotated[ClimateRiskService, Depends(get_climate_risk_service)],
    rules: Annotated[Regras, Depends(get_rules)],
    burned_area_repo: Annotated[AreaQueimadaRepository, Depends(get_area_queimada_repository)],
) -> TalhaoService:
    return TalhaoService(
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        ndvi_repo=ndvi_repo,
        history_service=history_service,
        ingestion_service=ingestion_service,
        # A ETo de cada mês é a mesma do balanço hídrico do motor (tarefa 0042)
        monthly_rain_service=MonthlyRainService(reference_eto=risk_service.reference_eto),
        smap_repo=smap_repo,
        soja_recente_service=soja_recente_service,
        remaining_rain_service=RemainingRainService(rules),
        rain_end_service=RainEndService(rules),
        burned_area_repo=burned_area_repo,
    )


@lru_cache
def get_enso_repository() -> EnsoRepository:
    """Fase do ENSO de cada safrinha (ONI da NOAA, P1). Sem ONI_PATH ou arquivo: `enso: null`."""
    return FileEnsoRepository(get_settings().oni_path)


@lru_cache
def get_enso_forecast_repository() -> EnsoForecastRepository:
    """Previsão do ENSO da NOAA CPC (tarefa 0038). Sem ENSO_PREVISAO_PATH ou arquivo: sem sinal."""
    return FileEnsoForecastRepository(get_settings().enso_previsao_path)


def get_sinal_outono_service(
    forecast_repo: Annotated[EnsoForecastRepository, Depends(get_enso_forecast_repository)],
    enso_repo: Annotated[EnsoRepository, Depends(get_enso_repository)],
    soil_moisture_repo: Annotated[
        RecentSoilMoistureRepository, Depends(get_recent_soil_moisture_repository)
    ],
    rules: Annotated[Regras, Depends(get_rules)],
) -> SinalOutonoService:
    return SinalOutonoService(forecast_repo, enso_repo, soil_moisture_repo, rules)


def get_year_detail_service(
    enso_repo: Annotated[EnsoRepository, Depends(get_enso_repository)],
    rules: Annotated[Regras, Depends(get_rules)],
) -> YearDetailService:
    return YearDetailService(
        alert_service=CropAlertService(rules), enso_repo=enso_repo, rules=rules
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
    sinal_service: Annotated[SinalOutonoService, Depends(get_sinal_outono_service)],
    ndvi_repo: Annotated[NdviRepository, Depends(get_ndvi_repository)],
    history_service: Annotated[FieldHistoryService, Depends(get_field_history_service)],
    year_detail_service: Annotated[YearDetailService, Depends(get_year_detail_service)],
    smap_repo: Annotated[CellSmapRepository, Depends(get_smap_repository)],
) -> RecommendationService:
    return RecommendationService(
        crop_repo=crop_repo,
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        risk_service=risk_service,
        plan_service=plan_service,
        rules=rules,
        ingestion_service=ingestion_service,
        sinal_service=sinal_service,
        ndvi_repo=ndvi_repo,
        history_service=history_service,
        year_detail_service=year_detail_service,
        smap_repo=smap_repo,
    )


def get_harvest_delay_service(
    recommender: Annotated[RecommendationService, Depends(get_recommendation_service)],
) -> HarvestDelayService:
    """Custo do atraso da colheita (tela 3, tarefa 0042): o motor do /recomendacao por faixa."""
    return HarvestDelayService(recommender)


def get_crop_alert_service(rules: Annotated[Regras, Depends(get_rules)]) -> CropAlertService:
    return CropAlertService(rules)


def get_past_season_service(
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    crop_repo: Annotated[CropParamsRepository, Depends(get_crop_params_repository)],
    recommender: Annotated[RecommendationService, Depends(get_recommendation_service)],
    alert_service: Annotated[CropAlertService, Depends(get_crop_alert_service)],
    ingestion_service: Annotated[
        SatelliteIngestionService | None, Depends(get_satellite_ingestion_service)
    ],
) -> PastSeasonService:
    return PastSeasonService(
        climate_repo=climate_repo,
        crop_repo=crop_repo,
        recommender=recommender,
        alert_service=alert_service,
        ingestion_service=ingestion_service,
    )


# Relatos da comunidade (tarefa 0047): só com banco (tabela `community_report`). Sem
# DATABASE_URL, o service responde 503 COMMUNITY_UNAVAILABLE e a tela não mostra os relatos.
@lru_cache
def get_community_report_repository() -> CommunityReportRepository | None:
    database_url = get_settings().database_url
    return PostgisCommunityReportRepository(database_url) if database_url else None


@lru_cache
def get_community_device_salt() -> str:
    """Sal do hash do aparelho (COMMUNITY_DEVICE_SALT). Vazio: um sal aleatório por processo."""
    salt = get_settings().community_device_salt
    if salt:
        return salt
    logger.warning(
        "COMMUNITY_DEVICE_SALT vazio: sal aleatório até a API reiniciar (o limite por dia e o "
        "'apagar o meu' dos relatos recomeçam a cada reinício)."
    )
    return secrets.token_hex(32)


def get_community_report_service(
    repository: Annotated[
        CommunityReportRepository | None, Depends(get_community_report_repository)
    ],
    crop_repo: Annotated[CropParamsRepository, Depends(get_crop_params_repository)],
    rules: Annotated[Regras, Depends(get_rules)],
) -> CommunityReportService:
    return CommunityReportService(
        repository=repository,
        crop_repo=crop_repo,
        rules=rules,
        salt=get_community_device_salt(),
    )


# Raio-X da sua terra (tela 4, remodelagem S4, tarefa 0043). A chuva da região e o solo da célula
# vizinha só existem com banco; a área queimada (get_area_queimada_repository, acima do talhão)
# vem do arquivo do AREA_QUEIMADA_PATH.


def get_burned_area_service(
    repository: Annotated[AreaQueimadaRepository, Depends(get_area_queimada_repository)],
    rules: Annotated[Regras, Depends(get_rules)],
) -> BurnedAreaService:
    return BurnedAreaService(repository, rules)


def get_region_rain_repository(
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
) -> RegionRainRepository | None:
    return climate_repo if isinstance(climate_repo, PostgisClimateRepository) else None


def get_nearest_soil_repository(
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
) -> NearestSoilRepository | None:
    return soil_repo if isinstance(soil_repo, PostgisSoilRepository) else None


def get_raio_x_service(
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
    ndvi_repo: Annotated[NdviRepository, Depends(get_ndvi_repository)],
    crop_repo: Annotated[CropParamsRepository, Depends(get_crop_params_repository)],
    recommender: Annotated[RecommendationService, Depends(get_recommendation_service)],
    risk_service: Annotated[ClimateRiskService, Depends(get_climate_risk_service)],
    recent_soil_moisture_repo: Annotated[
        RecentSoilMoistureRepository, Depends(get_recent_soil_moisture_repository)
    ],
    nearest_soil_repo: Annotated[
        NearestSoilRepository | None, Depends(get_nearest_soil_repository)
    ],
    soja_recente_service: Annotated[SojaRecenteService, Depends(get_soja_recente_service)],
    region_rain_repo: Annotated[RegionRainRepository | None, Depends(get_region_rain_repository)],
    burned_area_service: Annotated[BurnedAreaService, Depends(get_burned_area_service)],
    rules: Annotated[Regras, Depends(get_rules)],
) -> RaioXService:
    return RaioXService(
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        ndvi_repo=ndvi_repo,
        crop_repo=crop_repo,
        recommender=recommender,
        # A ETo é a do balanço hídrico do motor (a gravada, POWER, ou Hargreaves-Samani)
        reference_eto=risk_service.reference_eto,
        recent_soil_moisture_repo=recent_soil_moisture_repo,
        nearest_soil_repo=nearest_soil_repo,
        soja_recente_service=soja_recente_service,
        region_rain_repo=region_rain_repo,
        burned_area_service=burned_area_service,
        rules=rules,
    )


# Tela "Avisos" (remodelagem S6, tarefa 0046). O NASA POWER dos últimos dias é pedido pela API, com
# cache de 24 h por célula (um repository por processo); sem resposta, os avisos dele não aparecem.
# Os relatos dos vizinhos vêm do service da comunidade (sem banco, o grupo "Perto de você" some).
@lru_cache
def get_recent_weather_repository() -> RecentWeatherRepository:
    return PowerRecentWeatherRepository(NasaPowerClient())


def get_avisos_service(
    recommender: Annotated[RecommendationService, Depends(get_recommendation_service)],
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    crop_repo: Annotated[CropParamsRepository, Depends(get_crop_params_repository)],
    soil_repo: Annotated[SoilRepository, Depends(get_soil_repository)],
    risk_service: Annotated[ClimateRiskService, Depends(get_climate_risk_service)],
    recent_soil_moisture_repo: Annotated[
        RecentSoilMoistureRepository, Depends(get_recent_soil_moisture_repository)
    ],
    recent_weather_repo: Annotated[RecentWeatherRepository, Depends(get_recent_weather_repository)],
    forecast_repo: Annotated[EnsoForecastRepository, Depends(get_enso_forecast_repository)],
    enso_repo: Annotated[EnsoRepository, Depends(get_enso_repository)],
    community_service: Annotated[CommunityReportService, Depends(get_community_report_service)],
    smap_repo: Annotated[CellSmapRepository, Depends(get_smap_repository)],
    rules: Annotated[Regras, Depends(get_rules)],
) -> AvisosService:
    return AvisosService(
        recommender=recommender,
        climate_repo=climate_repo,
        crop_repo=crop_repo,
        soil_repo=soil_repo,
        risk_service=risk_service,
        recent_soil_moisture_repo=recent_soil_moisture_repo,
        recent_weather_repo=recent_weather_repo,
        forecast_repo=forecast_repo,
        enso_repo=enso_repo,
        community_service=community_service,
        smap_repo=smap_repo,
        rules=rules,
    )


def get_plan_evaluation_service(
    recommender: Annotated[RecommendationService, Depends(get_recommendation_service)],
    climate_repo: Annotated[ClimateRepository, Depends(get_climate_repository)],
    crop_repo: Annotated[CropParamsRepository, Depends(get_crop_params_repository)],
    plan_service: Annotated[RotationPlanService, Depends(get_rotation_plan_service)],
    rules: Annotated[Regras, Depends(get_rules)],
    sinal_service: Annotated[SinalOutonoService, Depends(get_sinal_outono_service)],
) -> PlanEvaluationService:
    """Plano de 3 anos qualquer (aba "Plano", tarefa 0045): a conta do motor de cada ano.

    O sinal do outono vai junto, com o Plano A e o Plano B da tela (tarefa 0049).
    """
    return PlanEvaluationService(
        recommender=recommender,
        climate_repo=climate_repo,
        crop_repo=crop_repo,
        plan_service=plan_service,
        rules=rules,
        sinal_service=sinal_service,
    )
