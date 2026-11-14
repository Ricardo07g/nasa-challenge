"""Service for field inspection (Talhao): bounding box, soil texture, and MODIS NDVI history."""

from typing import Protocol

from app.models.talhao import Talhao
from app.repositories.climate_repository import ClimateRepository
from app.repositories.ndvi_repository import NdviRepository
from app.repositories.soil_repository import SoilRepository
from app.services.field_history_service import FieldHistoryService


class IngestionServiceProtocol(Protocol):
    """Contract for triggering on-demand satellite ingestion on spatial cache miss."""

    def ingest_area(self, lat: float, lon: float) -> str: ...


class TalhaoService:
    """Inspects a field coordinate combining spatial grid, SoilGrids, and MODIS NDVI history."""

    def __init__(
        self,
        climate_repo: ClimateRepository,
        soil_repo: SoilRepository,
        ndvi_repo: NdviRepository,
        history_service: FieldHistoryService,
        ingestion_service: IngestionServiceProtocol | None = None,
    ) -> None:
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._ndvi_repo = ndvi_repo
        self._history_service = history_service
        self._ingestion_service = ingestion_service

    def inspect_talhao(self, lat: float, lon: float) -> Talhao:
        """Returns complete field metadata for the given coordinates with Cache-Aside ingestion."""
        cell_id = self._climate_repo.find_cell_id(lat, lon)
        if cell_id is None and self._ingestion_service is not None:
            cell_id = self._ingestion_service.ingest_area(lat, lon)

        dentro_da_area = cell_id is not None

        solo = self._soil_repo.get_soil(lat, lon)
        serie_ndvi, _ = self._ndvi_repo.get_ndvi_history(lat, lon)

        historico = self._history_service.classify_entressafra(serie_ndvi) if serie_ndvi else None
        colheita_sugerida = self._history_service.suggest_harvest_band(serie_ndvi)

        dados_fontes = (
            {"fonte": "NASA POWER (2005-2024)", "status": "ok"},
            {"fonte": "NASA SMAP L4 (SPL4SMGP)", "status": "ok"},
            {
                "fonte": "SoilGrids ISRIC 250m",
                "status": "ok" if solo.fonte == "soilgrids" else "fallback",
            },
            {
                "fonte": "MODIS MOD13Q1 (NDVI 10a)",
                "status": "ok" if historico else "indisponivel",
            },
            {"fonte": "NEX-GDDP-CMIP6 (SSP2-4.5)", "status": "ok"},
        )

        return Talhao(
            lat=lat,
            lon=lon,
            celula_id=cell_id,
            dentro_da_area=dentro_da_area,
            solo=solo,
            colheita_sugerida=colheita_sugerida,
            historico=historico,
            dados_fontes=dados_fontes,
        )

    def obter_talhao(self, lat: float, lon: float) -> Talhao:
        """Alias for inspect_talhao matching Task 0001 Sub-task 1.3 specification."""
        return self.inspect_talhao(lat=lat, lon=lon)
