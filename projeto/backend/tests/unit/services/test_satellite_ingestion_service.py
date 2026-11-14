"""Unit tests for SatelliteIngestionService (Sub-task 1.2 & 1.4 of Task 0001)."""

from datetime import date

from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.talhao import SoloInfo
from app.services.errors import DomainError
from app.services.satellite_ingestion_service import SatelliteIngestionService


def _make_season(cell_id: str, year: int) -> ClimateSeason:
    return ClimateSeason(
        cell_id=cell_id,
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=(5.0, 6.0),
        rain_source="nasa_power",
        tmax_c=(30.0, 31.0),
        tmin_c=(18.0, 19.0),
        eto_mm=(4.0, 4.2),
        gwetroot=(0.65, 0.65),
    )


class FakeNasaPowerClient:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail
        self.calls: list[tuple[float, float, str]] = []

    def fetch_seasons(
        self,
        lat: float,
        lon: float,
        cell_id: str,
        start_year: int = 2005,
        end_year: int = 2024,
    ) -> list[ClimateSeason]:
        self.calls.append((lat, lon, cell_id))
        if self.should_fail:
            raise DomainError("NASA POWER timeout", code="NASA_POWER_UNAVAILABLE")
        return [_make_season(cell_id, yr) for yr in range(2005, 2025)]


class FakeSoilGridsClient:
    def __init__(self) -> None:
        self.calls: list[tuple[float, float]] = []

    def fetch_soil(self, lat: float, lon: float) -> SoloInfo:
        self.calls.append((lat, lon))
        return SoloInfo(
            argila_percentual=46.0,
            areia_percentual=32.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


class FakeClimateRepository:
    def __init__(self) -> None:
        self.saved_cells: dict[str, list[ClimateSeason]] = {
            "-189_-483": [_make_season("-189_-483", yr) for yr in range(2005, 2025)]
        }

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        cid = f"{round(lat * 10)}_{round(lon * 10)}"
        return cid if cid in self.saved_cells else None

    def find_nearest_cell_id(self, lat: float, lon: float) -> str | None:
        return "-189_-483"

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None:
        self.saved_cells[cell_id] = list(seasons)

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return list(self.saved_cells.get(cell_id, []))

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta:
        raise NotImplementedError

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        return None


class FakeSoilRepository:
    def __init__(self) -> None:
        self.saved_soils: dict[tuple[float, float], SoloInfo] = {}

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return self.saved_soils[(round(lat, 3), round(lon, 3))]

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        self.saved_soils[(round(lat, 3), round(lon, 3))] = soil


def test_should_ingest_climate_and_soil_in_parallel_and_persist_when_area_is_new() -> None:
    nasa_client = FakeNasaPowerClient()
    soil_client = FakeSoilGridsClient()
    climate_repo = FakeClimateRepository()
    soil_repo = FakeSoilRepository()

    service = SatelliteIngestionService(
        nasa_client=nasa_client,
        soil_client=soil_client,
        climate_repo=climate_repo,
        soil_repo=soil_repo,
    )

    # Rio Verde / GO coordinates
    cell_id = service.ingest_area(lat=-17.78, lon=-50.92)

    assert cell_id == "-178_-509"
    assert len(nasa_client.calls) == 1
    assert len(soil_client.calls) == 1
    assert "-178_-509" in climate_repo.saved_cells
    assert len(climate_repo.saved_cells["-178_-509"]) == 20
    assert soil_repo.get_soil(-17.78, -50.92).textura_solo == "argiloso"


def test_should_fallback_to_nearest_neighbor_cell_when_nasa_power_api_is_unavailable() -> None:
    nasa_client = FakeNasaPowerClient(should_fail=True)
    soil_client = FakeSoilGridsClient()
    climate_repo = FakeClimateRepository()
    soil_repo = FakeSoilRepository()

    service = SatelliteIngestionService(
        nasa_client=nasa_client,
        soil_client=soil_client,
        climate_repo=climate_repo,
        soil_repo=soil_repo,
    )

    cell_id = service.ingest_area(lat=-17.78, lon=-50.92)

    assert cell_id == "-178_-509"
    assert "-178_-509" in climate_repo.saved_cells
    assert len(climate_repo.saved_cells["-178_-509"]) == 20
    assert all(s.cell_id == "-178_-509" for s in climate_repo.saved_cells["-178_-509"])
