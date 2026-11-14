"""Olhar o talhão: área com dados, solo, histórico pelo NDVI e fontes (plano técnico §3.1)."""

from app.models.talhao import FonteDado, Talhao
from app.repositories.climate_repository import ClimateRepository
from app.repositories.ndvi_repository import NdviRepository
from app.repositories.soil_repository import SoilRepository
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
    ) -> None:
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._ndvi_repo = ndvi_repo
        self._history_service = history_service

    def inspect_talhao(self, lat: float, lon: float) -> Talhao:
        cell_id = self._climate_repo.find_cell_id(lat, lon)
        serie_ndvi = self._ndvi_repo.get_ndvi_history(lat, lon)

        return Talhao(
            lat=lat,
            lon=lon,
            celula_id=cell_id,
            dentro_da_area=cell_id is not None,
            solo=self._soil_repo.get_soil(lat, lon),
            colheita_sugerida=self._history_service.suggest_harvest_band(serie_ndvi),
            historico=(
                self._history_service.classify_entressafra(serie_ndvi) if serie_ndvi else None
            ),
            dados_fontes=self._climate_sources(cell_id) if cell_id is not None else (),
        )

    def _climate_sources(self, cell_id: str) -> tuple[FonteDado, ...]:
        """Só as fontes que existem para a célula, com o período real da série."""
        fontes: list[FonteDado] = []
        seasons = self._climate_repo.get_seasons(cell_id)
        if seasons:
            anos = [s.year for s in seasons]
            fontes.append(
                FonteDado(fonte=seasons[0].rain_source, periodo=f"{min(anos)}-{max(anos)}")
            )
        deltas = self._climate_repo.get_cmip6_deltas(cell_id)
        if deltas:
            fontes.append(
                FonteDado(
                    fonte="nex_gddp_cmip6",
                    periodo=CMIP6_PERIOD,
                    cenario=deltas[0].scenario,
                    modelos=len({d.model for d in deltas}),
                )
            )
        return tuple(fontes)
