"""Olhar o talhão: área com dados, solo, histórico pelo NDVI, chuva de cada mês, soja e fontes.

Plano técnico §3.1; a chuva de cada mês é o gráfico da tela 3 (tarefa 0028); a soja da safra
mais recente é a checagem do começo do fluxo (RF-24, tarefa 0037).
"""

from collections.abc import Iterable
from typing import Any

from app.constants import IMERG_RAIN_SOURCE
from app.models.talhao import FonteDado, Talhao
from app.repositories.climate_repository import ClimateRepository
from app.repositories.ndvi_repository import NdviRepository
from app.repositories.smap_repository import SMAP_SOURCE, CellSmapRepository
from app.repositories.soil_repository import SoilRepository
from app.services.cell_lookup import IngestionServiceProtocol, find_or_ingest_cell
from app.services.field_history_service import FieldHistoryService
from app.services.monthly_rain_service import MonthlyRainService
from app.services.soja_recente_service import SojaRecenteService

CMIP6_PERIOD = "2041-2060"
CLIMATE_PERIOD = "2005-2024"  # janela das temporadas de chuva (ADR-0003), POWER ou IMERG


class TalhaoService:
    """Junta solo, histórico do NDVI, colheita sugerida, chuva de cada mês e fontes de um ponto."""

    def __init__(
        self,
        climate_repo: ClimateRepository,
        soil_repo: SoilRepository,
        ndvi_repo: NdviRepository,
        history_service: FieldHistoryService,
        ingestion_service: IngestionServiceProtocol | None = None,
        monthly_rain_service: MonthlyRainService | None = None,
        smap_repo: CellSmapRepository | None = None,
        soja_recente_service: SojaRecenteService | None = None,
    ) -> None:
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._ndvi_repo = ndvi_repo
        self._history_service = history_service
        self._ingestion_service = ingestion_service
        self._monthly_rain_service = monthly_rain_service or MonthlyRainService()
        self._smap_repo = smap_repo
        self._soja_recente_service = soja_recente_service

    def inspect_talhao(
        self, lat: float, lon: float, confirmadas: Iterable[tuple[int, str]] = ()
    ) -> Talhao:
        """Returns complete field metadata for the given coordinates (US-01, US-02, US-07).

        `confirmadas`: as últimas safras que o produtor confirmou (ano, "plantou" ou "parado"),
        que valem no lugar do satélite no histórico (tarefa 0039). Sem série de NDVI e sem
        confirmação, `historico` fica None.
        """
        confirmadas_por_ano = self._history_service.check_confirmations(confirmadas)
        cell_id = find_or_ingest_cell(self._climate_repo, self._ingestion_service, lat, lon)

        dentro_da_area = cell_id is not None
        solo = self._soil_repo.get_soil(lat, lon)

        ndvi_res: Any = self._ndvi_repo.get_ndvi_history(lat, lon)
        serie_ndvi = ndvi_res[0] if isinstance(ndvi_res, tuple) else ndvi_res

        historico = (
            self._history_service.classify_entressafra(serie_ndvi, confirmadas_por_ano)
            if serie_ndvi or confirmadas_por_ano
            else None
        )
        colheita_sugerida = self._history_service.suggest_harvest_band(serie_ndvi)

        chuva_mensal = (
            self._monthly_rain_service.summarize(self._climate_repo.get_seasons(cell_id))
            if cell_id is not None
            else None
        )

        # Independe da célula do clima: é o pixel de 250 m do ponto no arquivo da soja recente.
        soja_recente = (
            self._soja_recente_service.check(lat, lon) if self._soja_recente_service else None
        )

        dados_fontes: list[FonteDado] = []
        if dentro_da_area and cell_id is not None:
            dados_fontes.append(FonteDado(fonte="nasa_power", periodo=CLIMATE_PERIOD))
            # Chuva do IMERG (tarefa 0027): os anos completos trocaram a do POWER na célula.
            if any(
                season.rain_source == IMERG_RAIN_SOURCE
                for season in self._climate_repo.get_seasons(cell_id)
            ):
                dados_fontes.append(FonteDado(fonte=IMERG_RAIN_SOURCE, periodo=CLIMATE_PERIOD))
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
            smap = self._smap_repo.get_cell_smap_series(cell_id) if self._smap_repo else []
            if smap:
                years = [record.data.year for record in smap]
                dados_fontes.append(
                    FonteDado(fonte=SMAP_SOURCE, periodo=f"{min(years)}-{max(years)}")
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
            chuva_mensal=chuva_mensal,
            soja_recente=soja_recente,
            anos_confirmaveis=self._history_service.confirmable_years(),
        )

    def obter_talhao(self, lat: float, lon: float) -> Talhao:
        """Alias for inspect_talhao matching Task 0001 Sub-task 1.3 specification."""
        return self.inspect_talhao(lat=lat, lon=lon)
