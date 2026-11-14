"""On-demand satellite and soil ingestion service (Sub-task 1.2 & 1.4 of Task 0001)."""

import logging
from concurrent.futures import ThreadPoolExecutor

from app.constants import (
    INGESTION_TOTAL_TIMEOUT_SECONDS,
    INGESTION_WORKERS_COUNT,
)
from app.models.climate import ClimateSeason
from app.repositories.climate_repository import ClimateRepository, compute_grid_cell_id
from app.repositories.external.nasa_power_client import NasaPowerClientProtocol
from app.repositories.external.soilgrids_client import SoilGridsClientProtocol
from app.repositories.soil_repository import SoilRepository

logger = logging.getLogger(__name__)


class SatelliteIngestionService:
    """Orchestrates parallel ingestion from NASA POWER and SoilGrids with spatial cache-aside."""

    def __init__(
        self,
        nasa_client: NasaPowerClientProtocol,
        soil_client: SoilGridsClientProtocol,
        climate_repo: ClimateRepository,
        soil_repo: SoilRepository,
        timeout_seconds: float = INGESTION_TOTAL_TIMEOUT_SECONDS,
    ) -> None:
        self._nasa_client = nasa_client
        self._soil_client = soil_client
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._timeout = timeout_seconds

    def ingest_area(self, lat: float, lon: float) -> str:
        """Fetches climate and soil data in parallel for a new coordinate and persists to cache/DB.

        If NASA POWER is unavailable or times out, falls back to the nearest existing spatial cell.
        """
        cell_id = compute_grid_cell_id(lat, lon)

        with ThreadPoolExecutor(max_workers=INGESTION_WORKERS_COUNT) as executor:
            nasa_future = executor.submit(
                self._nasa_client.fetch_seasons,
                lat,
                lon,
                cell_id,
            )
            soil_future = executor.submit(
                self._soil_client.fetch_soil,
                lat,
                lon,
            )

            soil_info = soil_future.result(timeout=self._timeout)
            self._soil_repo.save_soil(lat, lon, soil_info)

            try:
                seasons = nasa_future.result(timeout=self._timeout)
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
