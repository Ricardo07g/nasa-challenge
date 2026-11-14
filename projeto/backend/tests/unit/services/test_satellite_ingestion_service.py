"""Unit tests for SatelliteIngestionService (Sub-task 1.2 & 1.4 of Task 0001)."""

from datetime import date, timedelta

from app.models.climate import (
    ClimateSeason,
    Cmip6Delta,
    DailyWeatherRecord,
    PowerDailySeries,
    SmapSoilMoisture,
)
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import cell_id_for
from app.services.errors import DomainError
from app.services.satellite_ingestion_service import SatelliteIngestionService
from app.services.water_balance_calculator import WaterBalanceCalculator


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
    """Devolve uma série diária completa (valores fixos) para o período pedido."""

    def __init__(self, should_fail: bool = False, days_without_tmax: frozenset[date] = frozenset()):
        self.should_fail = should_fail
        self.days_without_tmax = days_without_tmax
        self.calls: list[tuple[float, float, date, date]] = []

    def fetch_daily(self, lat: float, lon: float, start: date, end: date) -> PowerDailySeries:
        self.calls.append((lat, lon, start, end))
        if self.should_fail:
            raise DomainError("NASA POWER timeout", code="NASA_POWER_UNAVAILABLE")
        days = tuple(
            DailyWeatherRecord(
                data=start + timedelta(days=i),
                prectotcorr=5.0,
                t2m_max=None if start + timedelta(days=i) in self.days_without_tmax else 30.0,
                t2m_min=19.0,
                rh2m=75.0,
                ws2m=1.5,
                allsky_sfc_sw_dwn=18.0,
            )
            for i in range((end - start).days + 1)
        )
        return PowerDailySeries(elevation_m=850.0, days=days)


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
        cid = cell_id_for(lat, lon)
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

    assert cell_id == "-178_-510"
    assert len(nasa_client.calls) == 1
    assert len(soil_client.calls) == 1
    assert "-178_-510" in climate_repo.saved_cells
    assert len(climate_repo.saved_cells["-178_-510"]) == 20
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

    assert cell_id == "-178_-510"
    assert "-178_-510" in climate_repo.saved_cells
    assert len(climate_repo.saved_cells["-178_-510"]) == 20
    assert all(s.cell_id == "-178_-510" for s in climate_repo.saved_cells["-178_-510"])


def test_should_use_the_same_floor_cell_id_as_the_repositories_when_ingesting() -> None:
    # R1.2: um id só. Para lat -18,92 o round dava -189 e o floor (plano técnico §5) dá -190.
    climate_repo = FakeClimateRepository()
    service = SatelliteIngestionService(
        nasa_client=FakeNasaPowerClient(),
        soil_client=FakeSoilGridsClient(),
        climate_repo=climate_repo,
        soil_repo=FakeSoilRepository(),
    )

    cell_id = service.ingest_area(lat=-18.92, lon=-48.27)

    assert cell_id == "-190_-483"
    assert cell_id == cell_id_for(-18.92, -48.27)
    assert "-190_-483" in climate_repo.saved_cells


def test_should_save_jan_jul_seasons_with_penman_monteith_eto_when_power_series_arrives() -> None:
    nasa_client = FakeNasaPowerClient()
    climate_repo = FakeClimateRepository()
    service = SatelliteIngestionService(
        nasa_client=nasa_client,
        soil_client=FakeSoilGridsClient(),
        climate_repo=climate_repo,
        soil_repo=FakeSoilRepository(),
    )

    cell_id = service.ingest_area(lat=-17.78, lon=-50.92)

    # Pede ao POWER de 1/jan/2005 ao fim da temporada de 2024 (bissexto: 212 dias até 30/jul)
    assert nasa_client.calls[0][2:] == (date(2005, 1, 1), date(2024, 7, 30))
    seasons = climate_repo.saved_cells[cell_id]
    assert [s.year for s in seasons] == list(range(2005, 2025))
    wb = WaterBalanceCalculator()
    ea = wb.actual_vapour_pressure_from_rh_mean(t_max=30.0, t_min=19.0, rh_mean_pct=75.0)
    for season in seasons:
        assert season.start_date == date(season.year, 1, 1)
        assert len(season.rain_mm) == len(season.eto_mm) == 212
        assert season.eto_mm[0] == wb.penman_monteith_eto(
            t_max=30.0,
            t_min=19.0,
            actual_vapour_pressure_kpa=ea,
            wind_2m_ms=1.5,
            solar_rad_mj=18.0,
            lat_deg=-17.78,
            day_of_year=1,
            elevation_m=850.0,
        )


def test_should_save_only_complete_years_when_power_has_days_without_data() -> None:
    # Tarefa 0005: ano com dia sem dado sai da série; nada de 30 °C inventados
    nasa_client = FakeNasaPowerClient(
        days_without_tmax=frozenset({date(2010, 2, 14), date(2017, 6, 1)})
    )
    climate_repo = FakeClimateRepository()
    service = SatelliteIngestionService(
        nasa_client=nasa_client,
        soil_client=FakeSoilGridsClient(),
        climate_repo=climate_repo,
        soil_repo=FakeSoilRepository(),
    )

    cell_id = service.ingest_area(lat=-17.78, lon=-50.92)

    years = [s.year for s in climate_repo.saved_cells[cell_id]]
    assert years == [y for y in range(2005, 2025) if y not in (2010, 2017)]
