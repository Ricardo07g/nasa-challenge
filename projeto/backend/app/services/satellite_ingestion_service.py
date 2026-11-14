"""On-demand satellite and soil ingestion service (Sub-task 1.2 & 1.4 of Task 0001)."""

import logging
from concurrent.futures import ThreadPoolExecutor, wait

from app.constants import (
    INGESTION_TOTAL_TIMEOUT_SECONDS,
    INGESTION_WORKERS_COUNT,
)
from app.models.climate import ClimateSeason
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import WritableClimateRepository, cell_id_for
from app.repositories.external.nasa_power_client import NasaPowerClientProtocol
from app.repositories.external.soilgrids_client import SoilGridsClientProtocol
from app.repositories.soil_repository import DEFAULT_SOIL, WritableSoilRepository
from app.services.climate_season_builder import ClimateSeasonBuilder
from app.services.water_balance_calculator import WaterBalanceCalculator

logger = logging.getLogger(__name__)

# Só o solo que veio do SoilGrids é gravado: o soil_point não tem coluna de fonte e tudo o que
# está nele é lido de volta como "soilgrids".
SOILGRIDS_SOURCE = "soilgrids"


class SatelliteIngestionService:
    """Orchestrates parallel ingestion from NASA POWER and SoilGrids with spatial cache-aside."""

    def __init__(
        self,
        nasa_client: NasaPowerClientProtocol,
        soil_client: SoilGridsClientProtocol,
        climate_repo: WritableClimateRepository,
        soil_repo: WritableSoilRepository,
        timeout_seconds: float = INGESTION_TOTAL_TIMEOUT_SECONDS,
        season_builder: ClimateSeasonBuilder | None = None,
    ) -> None:
        self._nasa_client = nasa_client
        self._soil_client = soil_client
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._timeout = timeout_seconds
        self._season_builder = season_builder or ClimateSeasonBuilder(WaterBalanceCalculator())

    def ingest_area(self, lat: float, lon: float) -> str | None:
        """Busca clima e solo em paralelo para um ponto novo e grava a célula no banco.

        As duas chamadas externas têm, juntas, no máximo `timeout_seconds`. Sem resposta do
        NASA POWER no limite, usa a célula vizinha já gravada; sem resposta do SoilGrids, não
        grava solo (o ponto fica com o solo padrão). Devolve o id da célula gravada, ou None
        quando não há clima nenhum para gravar.
        """
        cell_id = cell_id_for(lat, lon)
        start, end = self._season_builder.request_window()

        # Sem `with`: ele espera as threads ao sair, e o limite total deixaria de valer.
        executor = ThreadPoolExecutor(max_workers=INGESTION_WORKERS_COUNT)
        try:
            nasa_future = executor.submit(
                self._nasa_client.fetch_daily,
                lat,
                lon,
                start,
                end,
            )
            soil_future = executor.submit(
                self._soil_client.fetch_soil,
                lat,
                lon,
            )
            wait([nasa_future, soil_future], timeout=self._timeout)
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        try:
            soil_info: SoloInfo = soil_future.result(timeout=0)
        except Exception as exc:
            logger.warning(
                "SoilGrids ingestion failed for (%s, %s); keeping default soil: %s",
                lat,
                lon,
                exc,
            )
            soil_info = DEFAULT_SOIL
        if soil_info.fonte == SOILGRIDS_SOURCE:
            self._soil_repo.save_soil(lat, lon, soil_info)

        try:
            series = nasa_future.result(timeout=0)
        except Exception as exc:
            logger.warning(
                "NASA POWER ingestion failed for cell %s (%s, %s); "
                "falling back to nearest spatial cell: %s",
                cell_id,
                lat,
                lon,
                exc,
            )
            seasons = self._load_nearest_neighbor_seasons(cell_id, lat, lon)
        else:
            # Fora do try: erro de cálculo não pode cair escondido no fallback da célula vizinha.
            seasons = self._season_builder.build(series, cell_id=cell_id, lat=lat)

        if not seasons:
            logger.warning("No climate data for cell %s (%s, %s); nothing saved", cell_id, lat, lon)
            return None

        self._climate_repo.save_cell_seasons(
            cell_id=cell_id,
            lat=lat,
            lon=lon,
            seasons=seasons,
        )
        return cell_id

    def _load_nearest_neighbor_seasons(
        self, target_cell_id: str, lat: float, lon: float
    ) -> list[ClimateSeason]:
        nearest_id = self._climate_repo.find_nearest_cell_id(lat, lon)
        if nearest_id is None:
            return []

        source_seasons = self._climate_repo.get_seasons(nearest_id)
        return [
            ClimateSeason(
                cell_id=target_cell_id,
                year=s.year,
                start_date=s.start_date,
                rain_mm=s.rain_mm,
                rain_source=s.rain_source,
                tmax_c=s.tmax_c,
                tmin_c=s.tmin_c,
                eto_mm=s.eto_mm,
                gwetroot=s.gwetroot,
                tmean_c=s.tmean_c,
                rh2m_pct=s.rh2m_pct,
                ws2m_ms=s.ws2m_ms,
                solar_rad_mj=s.solar_rad_mj,
            )
            for s in source_seasons
        ]
