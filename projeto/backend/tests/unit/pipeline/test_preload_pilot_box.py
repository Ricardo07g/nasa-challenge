"""Unit tests da pré-carga da caixa piloto (R1.5), com clientes e repositories falsos."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.config import Settings
from app.constants import (
    EXAMPLE_FARM_LAT,
    EXAMPLE_FARM_LON,
    PILOT_MAX_LAT,
    PILOT_MAX_LON,
    PILOT_MIN_LAT,
    PILOT_MIN_LON,
)
from app.models.climate import ClimateSeason, DailyWeatherRecord, PowerDailySeries
from app.models.data_run import DataRun
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import cell_center, cell_id_for
from app.repositories.point_cache import point_key
from app.services.climate_season_builder import ClimateSeasonBuilder
from app.services.water_balance_calculator import WaterBalanceCalculator
from pipeline import preload_pilot_box
from pipeline.preload_pilot_box import (
    PilotBoxPreloader,
    PreloadCell,
    group_by_power_region,
    pilot_box_cells,
    power_region_bounds,
    power_region_key,
)

FARM_CELL_ID = "-190_-482"
ARGILOSO = SoloInfo(
    argila_percentual=46.0,
    areia_percentual=32.0,
    textura_solo="argiloso",
    cad_capacidade_agua_mm=60.0,
    fonte="soilgrids",
)
PADRAO = SoloInfo(
    argila_percentual=28.0,
    areia_percentual=45.0,
    textura_solo="medio",
    cad_capacidade_agua_mm=50.0,
    fonte="padrao",
)
FINISHED = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)


class FakePowerClient:
    """Faz o papel do POWER (valores de teste, não é dado real) e conta as chamadas."""

    def __init__(self, fail_on_calls: frozenset[int] = frozenset()) -> None:
        self.fail_on_calls = fail_on_calls
        self.calls: list[tuple[float, float, date, date]] = []

    def fetch_daily(self, lat: float, lon: float, start: date, end: date) -> PowerDailySeries:
        self.calls.append((lat, lon, start, end))
        if len(self.calls) in self.fail_on_calls:
            raise RuntimeError("POWER fora do ar (teste)")
        days = tuple(
            DailyWeatherRecord(
                data=start + timedelta(days=i),
                prectotcorr=6.0,
                t2m_max=30.0,
                t2m_min=18.0,
                rh2m=70.0,
                ws2m=2.0,
                allsky_sfc_sw_dwn=18.0,
            )
            for i in range((end - start).days + 1)
        )
        return PowerDailySeries(elevation_m=850.0, days=days)


class FakeSoilGridsClient:
    """Responde o solo padrão (como o cliente real quando falha) nos pontos de `default_at`."""

    def __init__(self, default_at: frozenset[tuple[float, float]] = frozenset()) -> None:
        self.default_at = default_at
        self.calls: list[tuple[float, float]] = []

    def fetch_soil(self, lat: float, lon: float) -> SoloInfo:
        self.calls.append((lat, lon))
        return PADRAO if (lat, lon) in self.default_at else ARGILOSO


class FakeClimateRepository:
    def __init__(self, existing: frozenset[str] = frozenset()) -> None:
        self.existing = set(existing)
        self.saved: dict[str, tuple[float, float, list[ClimateSeason]]] = {}

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        cell_id = cell_id_for(lat, lon)
        return cell_id if cell_id in self.existing or cell_id in self.saved else None

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None:
        self.saved[cell_id] = (lat, lon, seasons)


class FakeSoilRepository:
    def __init__(self, existing: tuple[tuple[float, float], ...] = ()) -> None:
        self.existing = {point_key(lat, lon) for lat, lon in existing}
        self.saved: dict[str, SoloInfo] = {}

    def has_point(self, lat: float, lon: float) -> bool:
        key = point_key(lat, lon)
        return key in self.existing or key in self.saved

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        self.saved[point_key(lat, lon)] = soil


class FakeDataRunRepository:
    """Mesmo contrato do `PostgisDataRunRepository` (R1.6): `save_run`."""

    def __init__(self) -> None:
        self.runs: list[DataRun] = []

    def save_run(self, run: DataRun) -> None:
        self.runs.append(run)


class Harness:
    def __init__(
        self,
        power: FakePowerClient | None = None,
        soilgrids: FakeSoilGridsClient | None = None,
        climate: FakeClimateRepository | None = None,
        soil: FakeSoilRepository | None = None,
        soil_pause_seconds: float = 12.0,
    ) -> None:
        self.power = power or FakePowerClient()
        self.soilgrids = soilgrids or FakeSoilGridsClient()
        self.climate = climate or FakeClimateRepository()
        self.soil = soil or FakeSoilRepository()
        self.runs = FakeDataRunRepository()
        self.sleeps: list[float] = []
        self.preloader = PilotBoxPreloader(
            nasa_client=self.power,
            soil_client=self.soilgrids,
            climate_repo=self.climate,
            soil_repo=self.soil,
            run_repo=self.runs,
            # Uma temporada só: o teste fica rápido e a regra é a mesma.
            season_builder=ClimateSeasonBuilder(
                WaterBalanceCalculator(), start_year=2005, end_year=2005
            ),
            soil_pause_seconds=soil_pause_seconds,
            sleep=self.sleeps.append,
            clock=lambda: FINISHED,
        )


def _cell(lat: float, lon: float) -> PreloadCell:
    cell_id = cell_id_for(lat, lon)
    center_lat, center_lon = cell_center(cell_id)
    return PreloadCell(
        cell_id=cell_id, lat=center_lat, lon=center_lon, soil_points=((center_lat, center_lon),)
    )


# --- células da caixa ---------------------------------------------------------------------


def test_should_list_the_225_cells_of_the_pilot_box_with_the_example_farm_first() -> None:
    cells = pilot_box_cells()

    assert len(cells) == 225
    assert len({c.cell_id for c in cells}) == 225
    assert all(
        PILOT_MIN_LAT < c.lat < PILOT_MAX_LAT and PILOT_MIN_LON < c.lon < PILOT_MAX_LON
        for c in cells
    )
    assert all((c.lat, c.lon) == pytest.approx(cell_center(c.cell_id)) for c in cells)
    assert cells[0].cell_id == FARM_CELL_ID == cell_id_for(EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON)


def test_should_load_the_soil_of_every_cell_center_and_of_the_example_farm_point() -> None:
    cells = pilot_box_cells()

    assert cells[0].soil_points == (
        (cells[0].lat, cells[0].lon),
        (EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON),
    )
    assert all(c.soil_points == ((c.lat, c.lon),) for c in cells[1:])


# --- células do NASA POWER ----------------------------------------------------------------


def test_should_bound_the_power_region_by_the_weather_and_the_radiation_grids() -> None:
    # Meteorologia: 0,5° × 0,625° (a `cobertura` da fixture); radiação: 1° com bordas inteiras.
    key = power_region_key(EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON)

    assert power_region_bounds(key) == pytest.approx((-19.0, -18.75, -48.4375, -48.0))


def test_should_put_a_point_on_the_weather_border_in_the_region_above_like_power_does() -> None:
    # Conferido no POWER: -18,75 devolve o mesmo que -18,74, e não o mesmo que -18,76.
    assert power_region_key(-18.75, -47.9) == power_region_key(-18.74, -47.9)
    assert power_region_key(-18.75, -47.9) != power_region_key(-18.76, -47.9)


def test_should_split_a_weather_cell_where_the_radiation_grid_changes() -> None:
    # Mesma célula de meteorologia, radiação diferente (borda de -19°): conferido no POWER.
    assert power_region_key(-19.1, -48.2) != power_region_key(-18.9, -48.2)
    assert power_region_key(-18.65, -48.2) == power_region_key(-18.45, -48.2)


def test_should_group_the_225_cells_into_20_power_regions() -> None:
    groups = group_by_power_region(pilot_box_cells())

    assert len(groups) == 20
    assert sum(len(g.cells) for g in groups) == 225
    for group in groups:
        region = power_region_key(group.request_lat, group.request_lon)
        assert all(power_region_key(c.lat, c.lon) == region for c in group.cells)
    assert groups[0].cells[0].cell_id == FARM_CELL_ID


# --- clima --------------------------------------------------------------------------------


def test_should_call_power_once_per_region_and_save_each_cell_with_its_own_latitude() -> None:
    h = Harness()
    cells = [_cell(-18.65, -48.2), _cell(-18.45, -48.2), _cell(-19.15, -48.2)]

    report = h.preloader.run(h.preloader.plan(cells))

    assert len(h.power.calls) == 2  # as duas primeiras dividem a região do POWER
    assert (report.power_calls, report.climate_saved) == (2, 3)
    for cell in cells:
        lat, lon, seasons = h.climate.saved[cell.cell_id]
        assert (lat, lon) == (cell.lat, cell.lon)
        assert [s.year for s in seasons] == [2005]
        assert seasons[0].cell_id == cell.cell_id
        assert seasons[0].lat == cell.lat  # a ETo depende da latitude da célula
    first, second = (h.climate.saved[c.cell_id][2][0] for c in cells[:2])
    assert first.eto_mm != second.eto_mm  # mesma série do POWER, latitudes diferentes
    assert h.power.calls[0][2:] == (date(2005, 1, 1), date(2005, 7, 31))


def test_should_keep_going_when_power_fails_for_one_region_without_copying_a_neighbor() -> None:
    h = Harness(power=FakePowerClient(fail_on_calls=frozenset({1})))
    failed, ok = _cell(-18.65, -48.2), _cell(-19.15, -48.2)

    report = h.preloader.run(h.preloader.plan([failed, ok]))

    assert set(h.climate.saved) == {ok.cell_id}
    assert (report.power_calls, report.power_failures, report.climate_saved) == (2, 1, 1)


# --- solo ---------------------------------------------------------------------------------


def test_should_pause_between_soilgrids_requests() -> None:
    h = Harness(soil_pause_seconds=7.5)
    cells = [_cell(-18.65, -48.2), _cell(-18.45, -48.2), _cell(-19.15, -48.2)]

    h.preloader.run(h.preloader.plan(cells))

    assert len(h.soilgrids.calls) == 3
    assert h.sleeps == [7.5, 7.5]  # entre os pedidos: nem antes do primeiro, nem depois do último


def test_should_not_save_the_default_soil() -> None:
    bad, good = _cell(-18.65, -48.2), _cell(-19.15, -48.2)
    h = Harness(soilgrids=FakeSoilGridsClient(default_at=frozenset({(bad.lat, bad.lon)})))

    report = h.preloader.run(h.preloader.plan([bad, good]))

    assert set(h.soil.saved) == {point_key(good.lat, good.lon)}
    assert (report.soil_calls, report.soil_saved, report.soil_failures) == (2, 1, 1)


# --- idempotência e limite ----------------------------------------------------------------


def test_should_skip_what_is_already_in_the_database() -> None:
    loaded, half, new = _cell(-18.65, -48.2), _cell(-18.45, -48.2), _cell(-19.15, -48.2)
    h = Harness(
        climate=FakeClimateRepository(existing=frozenset({loaded.cell_id, half.cell_id})),
        soil=FakeSoilRepository(existing=((loaded.lat, loaded.lon),)),
    )

    plan = h.preloader.plan([loaded, half, new])
    h.preloader.run(plan)

    assert plan.cells_already_loaded == 1
    assert [c.cell_id for g in plan.climate_groups for c in g.cells] == [new.cell_id]
    assert plan.soil_points == ((half.lat, half.lon), (new.lat, new.lon))
    assert set(h.climate.saved) == {new.cell_id}
    assert len(h.power.calls) == 1


def test_should_fetch_everything_again_when_forced() -> None:
    loaded = _cell(-18.65, -48.2)
    h = Harness(
        climate=FakeClimateRepository(existing=frozenset({loaded.cell_id})),
        soil=FakeSoilRepository(existing=((loaded.lat, loaded.lon),)),
    )

    plan = h.preloader.plan([loaded], force=True)

    assert plan.cells_already_loaded == 0
    assert (plan.power_calls, plan.soilgrids_calls) == (1, 1)


def test_should_stop_after_the_limit_of_cells_that_still_need_data() -> None:
    loaded, first_new, second_new = _cell(-18.65, -48.2), _cell(-18.45, -48.2), _cell(-19.15, -48.2)
    h = Harness(
        climate=FakeClimateRepository(existing=frozenset({loaded.cell_id})),
        soil=FakeSoilRepository(existing=((loaded.lat, loaded.lon),)),
    )

    plan = h.preloader.plan([loaded, first_new, second_new], limit=1)

    assert [c.cell_id for g in plan.climate_groups for c in g.cells] == [first_new.cell_id]
    assert plan.soil_points == ((first_new.lat, first_new.lon),)


# --- data_run -----------------------------------------------------------------------------


def test_should_record_one_data_run_per_source_it_called() -> None:
    h = Harness()
    cells = [_cell(-18.65, -48.2), _cell(-19.15, -48.2)]

    h.preloader.run(h.preloader.plan(cells))

    power_run, soil_run = h.runs.runs
    assert (power_run.source, soil_run.source) == ("nasa_power", "soilgrids")
    assert power_run.finished_at == soil_run.finished_at == FINISHED
    assert power_run.version == soil_run.version == "2026.11-preload-pilot-box"
    assert power_run.params["chamadas"] == 2
    assert power_run.params["celulas_gravadas"] == 2
    assert power_run.params["periodo"] == ["2005-01-01", "2005-07-31"]
    assert soil_run.params["pontos_gravados"] == 2
    assert soil_run.params["pausa_s"] == 12.0


class _BrokenSoilRepository(FakeSoilRepository):
    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        raise RuntimeError("banco fora do ar (teste)")


def test_should_record_the_power_run_before_the_long_soil_phase() -> None:
    # Se o solo (a parte de ~1 h) parar no meio, a carga do clima já ficou registrada: a próxima
    # execução pula o clima e não teria como registrá-la.
    h = Harness(soil=_BrokenSoilRepository())

    with pytest.raises(RuntimeError, match="banco fora do ar"):
        h.preloader.run(h.preloader.plan([_cell(-18.65, -48.2)]))

    assert [run.source for run in h.runs.runs] == ["nasa_power"]


def test_should_record_no_data_run_when_there_is_nothing_to_load() -> None:
    loaded = _cell(-18.65, -48.2)
    h = Harness(
        climate=FakeClimateRepository(existing=frozenset({loaded.cell_id})),
        soil=FakeSoilRepository(existing=((loaded.lat, loaded.lon),)),
    )

    h.preloader.run(h.preloader.plan([loaded]))

    assert h.runs.runs == []
    assert h.power.calls == h.soilgrids.calls == []


# --- linha de comando ---------------------------------------------------------------------


class _ExplodingClient:
    def __init__(self, *_: object, **__: object) -> None:
        return None

    def fetch_daily(self, *_: object) -> PowerDailySeries:
        raise AssertionError("o --dry-run não pode chamar o POWER")

    def fetch_soil(self, *_: object) -> SoloInfo:
        raise AssertionError("o --dry-run não pode chamar o SoilGrids")


def test_dry_run_without_database_plans_the_whole_box_without_calling_anything(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        preload_pilot_box, "get_settings", lambda: Settings(_env_file=None, database_url=None)
    )
    monkeypatch.setattr(preload_pilot_box, "NasaPowerClient", _ExplodingClient)
    monkeypatch.setattr(preload_pilot_box, "SoilGridsClient", _ExplodingClient)

    exit_code = preload_pilot_box.main(["--dry-run"])

    out = capsys.readouterr().out
    assert exit_code == 0
    assert "225 células" in out
    assert "20 pedidos ao NASA POWER" in out
    assert "226 pedidos ao SoilGrids" in out


def test_should_refuse_to_load_without_database(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        preload_pilot_box, "get_settings", lambda: Settings(_env_file=None, database_url="")
    )

    exit_code = preload_pilot_box.main(["--limite", "1"])

    assert exit_code == 2
    assert "DATABASE_URL" in capsys.readouterr().err
