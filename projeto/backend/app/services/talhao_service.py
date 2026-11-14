"""Olhar o talhão: área com dados, solo, histórico pelo NDVI e fontes (plano técnico §3.1)."""

from typing import Any

from app.models.talhao import FonteDado, Talhao
from app.repositories.climate_repository import ClimateRepository
from app.repositories.ndvi_repository import NdviRepository
from app.repositories.soil_repository import SoilRepository
from app.services.cell_lookup import IngestionServiceProtocol, find_or_ingest_cell
from app.services.field_history_service import FieldHistoryService

CMIP6_PERIOD = "2041-2060"


class TalhaoService:
    """Junta solo, histórico do NDVI, colheita sugerida e as fontes de clima de um ponto."""

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
        """Returns complete field metadata for the given coordinates (US-01, US-02, US-07)."""
        cell_id = find_or_ingest_cell(self._climate_repo, self._ingestion_service, lat, lon)

        dentro_da_area = cell_id is not None
        solo = self._soil_repo.get_soil(lat, lon)

        ndvi_res: Any = self._ndvi_repo.get_ndvi_history(lat, lon)
        serie_ndvi = ndvi_res[0] if isinstance(ndvi_res, tuple) else ndvi_res

        historico = self._history_service.classify_entressafra(serie_ndvi) if serie_ndvi else None
        colheita_sugerida = self._history_service.suggest_harvest_band(serie_ndvi)

        dados_fontes: list[FonteDado] = []
        if dentro_da_area and cell_id is not None:
            dados_fontes.append(FonteDado(fonte="nasa_power", periodo="2005-2024"))
            deltas = (
                self._climate_repo.get_cmip6_deltas(cell_id)
                if hasattr(self._climate_repo, "get_cmip6_deltas")
                else []
            )
            if deltas:
                scenario = deltas[0].scenario
                model_count = len({d.model for d in deltas})
                dados_fontes.append(
                    FonteDado(
                        fonte="nex_gddp_cmip6",
                        periodo=CMIP6_PERIOD,
                        cenario=scenario,
                        modelos=model_count,
                    )
                )

        return Talhao(
            lat=lat,
            lon=lon,
            celula_id=cell_id,
            dentro_da_area=dentro_da_area,
            solo=solo,
            colheita_sugerida=colheita_sugerida,
            historico=historico,
            dados_fontes=tuple(dados_fontes),
        )

    def obter_talhao(self, lat: float, lon: float) -> Talhao:
        """Alias for inspect_talhao matching Task 0001 Sub-task 1.3 specification."""
        return self.inspect_talhao(lat=lat, lon=lon)
