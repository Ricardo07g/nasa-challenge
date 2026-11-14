"""Unit tests for TalhaoService including Cache-Aside on-demand ingestion (Sub-task 1.3)."""

from typing import Any

from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.talhao import HistoricoAno, SoloInfo
from app.services.field_history_service import FieldHistoryService
from app.services.talhao_service import TalhaoService


class FakeClimateRepository:
    def __init__(self) -> None:
        self.cells: set[str] = {"-189_-483"}

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        cid = f"{round(lat * 10)}_{round(lon * 10)}"
        return cid if cid in self.cells else None

    def find_nearest_cell_id(self, lat: float, lon: float) -> str | None:
        return "-189_-483"

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None:
        self.cells.add(cell_id)

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return []

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta:
        raise NotImplementedError

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        return None


class FakeSoilRepository:
    def __init__(self) -> None:
        self.soils: dict[tuple[float, float], SoloInfo] = {}

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        self.soils[(round(lat, 3), round(lon, 3))] = soil

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return self.soils.get(
            (round(lat, 3), round(lon, 3)),
            SoloInfo(
                argila_percentual=42.5,
                areia_percentual=38.0,
                textura_solo="argiloso",
                cad_capacidade_agua_mm=60.0,
                fonte="soilgrids",
            ),
        )


class FakeNdviRepository:
    def get_ndvi_history(
        self, lat: float, lon: float
    ) -> tuple[list[dict[str, Any]], list[HistoricoAno]]:
        records = []
        for year in range(2019, 2025):
            records.extend(
                [
                    {"date": f"{year}-01-17", "year": year, "month": 1, "ndvi": 0.82},
                    {"date": f"{year}-02-18", "year": year, "month": 2, "ndvi": 0.36},
                    {"date": f"{year}-04-15", "year": year, "month": 4, "ndvi": 0.70},
                ]
            )
        return records, []


class FakeIngestionService:
    def __init__(self, climate_repo: FakeClimateRepository, soil_repo: FakeSoilRepository) -> None:
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self.ingested_coords: list[tuple[float, float]] = []

    def ingest_area(self, lat: float, lon: float) -> str:
        self.ingested_coords.append((lat, lon))
        cid = f"{round(lat * 10)}_{round(lon * 10)}"
        self._climate_repo.cells.add(cid)
        self._soil_repo.save_soil(
            lat,
            lon,
            SoloInfo(
                argila_percentual=16.0,
                areia_percentual=74.0,
                textura_solo="arenoso",
                cad_capacidade_agua_mm=40.0,
                fonte="soilgrids",
            ),
        )
        return cid


def test_should_return_cached_talhao_without_ingestion_when_cell_already_exists() -> None:
    climate_repo = FakeClimateRepository()
    soil_repo = FakeSoilRepository()
    ingestion_svc = FakeIngestionService(climate_repo, soil_repo)
    service = TalhaoService(
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        ndvi_repo=FakeNdviRepository(),
        history_service=FieldHistoryService(),
        ingestion_service=ingestion_svc,
    )

    talhao = service.inspect_talhao(lat=-18.92, lon=-48.28)

    assert talhao.dentro_da_area is True
    assert talhao.celula_id == "-189_-483"
    assert len(ingestion_svc.ingested_coords) == 0


def test_should_trigger_on_demand_ingestion_and_reload_soil_when_cell_is_missing() -> None:
    climate_repo = FakeClimateRepository()
    soil_repo = FakeSoilRepository()
    ingestion_svc = FakeIngestionService(climate_repo, soil_repo)
    service = TalhaoService(
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        ndvi_repo=FakeNdviRepository(),
        history_service=FieldHistoryService(),
        ingestion_service=ingestion_svc,
    )

    # First call: Cache Miss for Rio Verde/GO (-17.78, -50.92) -> triggers ingestion
    talhao = service.obter_talhao(lat=-17.78, lon=-50.92)

    assert len(ingestion_svc.ingested_coords) == 1
    assert talhao.celula_id == "-178_-509"
    assert talhao.dentro_da_area is True
    assert talhao.solo.textura_solo == "arenoso"
    assert talhao.solo.cad_capacidade_agua_mm == 40.0

    # Second call: Cache Hit -> does not trigger ingestion again
    talhao_second = service.inspect_talhao(lat=-17.78, lon=-50.92)
    assert len(ingestion_svc.ingested_coords) == 1
    assert talhao_second.celula_id == "-178_-509"


def test_should_return_within_area_false_when_cell_missing_and_no_ingestion_configured() -> None:
    service = TalhaoService(
        climate_repo=FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        ndvi_repo=FakeNdviRepository(),
        history_service=FieldHistoryService(),
        ingestion_service=None,
    )

    talhao = service.inspect_talhao(lat=-15.79, lon=-47.88)

    assert talhao.dentro_da_area is False
    assert talhao.celula_id is None
