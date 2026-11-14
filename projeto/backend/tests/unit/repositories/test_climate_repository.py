"""Unit tests for FixtureClimateRepository (arquivo de clima por temporada) e o id da célula."""

import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.config import Settings
from app.models.climate import ClimateSeason, Cmip6Delta
from app.repositories import climate_repository
from app.repositories.climate_repository import (
    FixtureClimateRepository,
    PostgisClimateRepository,
    cell_bounds,
    cell_center,
    cell_id_for,
    cell_polygon_wkt,
)


def _write_fixture(path: Path, cmip6: list[dict] | None = None) -> Path:
    payload: dict = {
        "fonte": "nasa_power",
        "ponto": {"lat": -18.9543, "lon": -48.1993},
        "cobertura": {
            "lat_min": -19.25,
            "lat_max": -18.75,
            "lon_min": -48.4375,
            "lon_max": -47.8125,
        },
        "temporadas": [
            {
                "ano": 2005,
                "inicio": "2005-01-01",
                "chuva_mm": [1.0, 2.0, 0.0],
                "tmax_c": [30.0, 31.0, 29.5],
                "tmin_c": [18.0, 19.0, 17.5],
            },
            {
                "ano": 2006,
                "inicio": "2006-01-01",
                "chuva_mm": [0.0, 0.0, 5.0],
                "tmax_c": [32.0, 33.0, 28.0],
                "tmin_c": [20.0, 21.0, 16.0],
            },
        ],
    }
    if cmip6 is not None:
        payload["cmip6"] = cmip6
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


@pytest.mark.parametrize(
    ("lat", "lon", "expected"),
    [(-18.9543, -48.1993, "-190_-482"), (-18.91, -48.27, "-190_-483"), (-18.9, -48.2, "-189_-482")],
)
def test_should_build_cell_id_with_floor_of_tenth_degree(
    lat: float, lon: float, expected: str
) -> None:
    # Plano técnico §5: id = "<floor(lat*10)>_<floor(lon*10)>"
    assert cell_id_for(lat, lon) == expected


def test_should_place_cell_center_in_the_middle_of_the_tenth_degree_square() -> None:
    lat, lon = cell_center("-190_-483")

    assert lat == pytest.approx(-18.95)
    assert lon == pytest.approx(-48.25)


def test_should_build_cell_polygon_with_edges_on_the_tenths() -> None:
    # Célula floor "-190_-483": lat -19,0 a -18,9 e lon -48,3 a -48,2 (WKT em lon lat)
    assert cell_polygon_wkt("-190_-483") == (
        "POLYGON((-48.3 -19.0, -48.2 -19.0, -48.2 -18.9, -48.3 -18.9, -48.3 -19.0))"
    )


def test_should_give_cell_bounds_on_the_tenths() -> None:
    # (lat_min, lat_max, lon_min, lon_max): o mesmo quadrado do polígono, para filtrar no banco
    assert cell_bounds("-190_-483") == pytest.approx((-19.0, -18.9, -48.3, -48.2))


@pytest.mark.parametrize(
    ("lat", "lon"),
    [(-18.92, -48.27), (-18.9543, -48.1993), (-17.78, -50.92), (-18.9, -48.2), (-19.0, -48.3)],
)
def test_should_keep_point_inside_its_own_cell_polygon(lat: float, lon: float) -> None:
    # Id, centro e polígono seguem a mesma regra: o ponto cai no quadrado da sua célula.
    cell_id = cell_id_for(lat, lon)
    lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))

    assert lat_idx / 10 <= lat < (lat_idx + 1) / 10
    assert lon_idx / 10 <= lon < (lon_idx + 1) / 10
    assert cell_id_for(*cell_center(cell_id)) == cell_id


def test_should_return_cell_id_when_point_is_covered_by_the_data(tmp_path: Path) -> None:
    repo = FixtureClimateRepository(_write_fixture(tmp_path / "clima.json"))

    assert repo.find_cell_id(-18.9543, -48.1993) == "-190_-482"


def test_should_return_none_when_point_is_outside_the_data(tmp_path: Path) -> None:
    repo = FixtureClimateRepository(_write_fixture(tmp_path / "clima.json"))

    assert repo.find_cell_id(-23.5505, -46.6333) is None  # São Paulo
    assert repo.find_cell_id(-19.75, -47.93) is None  # Uberaba, fora da célula do POWER


def test_should_read_seasons_with_latitude_and_arrays_when_cell_is_covered(tmp_path: Path) -> None:
    repo = FixtureClimateRepository(_write_fixture(tmp_path / "clima.json"))

    seasons = repo.get_seasons("-190_-482")

    assert [s.year for s in seasons] == [2005, 2006]
    first = seasons[0]
    assert first.cell_id == "-190_-482"
    assert first.lat == -18.9543
    assert first.rain_mm == (1.0, 2.0, 0.0)
    assert first.tmax_c == (30.0, 31.0, 29.5)
    assert first.tmin_c == (18.0, 19.0, 17.5)
    assert first.rain_source == "nasa_power"
    assert first.eto_mm == ()


def test_should_return_no_seasons_when_cell_is_not_covered(tmp_path: Path) -> None:
    repo = FixtureClimateRepository(_write_fixture(tmp_path / "clima.json"))

    assert repo.get_seasons("-236_-467") == []


def test_should_return_no_cmip6_deltas_when_data_has_none(tmp_path: Path) -> None:
    repo = FixtureClimateRepository(_write_fixture(tmp_path / "clima.json"))

    assert repo.get_cmip6_deltas("-190_-482") == []


def test_should_read_monthly_cmip6_deltas_per_model_when_present(tmp_path: Path) -> None:
    cmip6 = [
        {"modelo": "ACCESS-CM2", "cenario": "ssp245", "mes": 3, "chuva_pct": -8.5, "tmax_c": 1.6},
        {"modelo": "MIROC6", "cenario": "ssp245", "mes": 3, "chuva_pct": 2.0, "tmax_c": 1.1},
    ]
    repo = FixtureClimateRepository(_write_fixture(tmp_path / "clima.json", cmip6=cmip6))

    deltas = repo.get_cmip6_deltas("-190_-482")

    assert [(d.model, d.month, d.rain_pct, d.tmax_c) for d in deltas] == [
        ("ACCESS-CM2", 3, -8.5, 1.6),
        ("MIROC6", 3, 2.0, 1.1),
    ]
    assert all(d.scenario == "ssp245" for d in deltas)


def test_should_read_tmin_delta_from_the_fixture_cmip6_list_when_present(tmp_path: Path) -> None:
    cmip6 = [
        {"modelo": "MODELO-TESTE", "cenario": "ssp245", "mes": 2, "chuva_pct": -10.0,
         "tmax_c": 2.0, "tmin_c": 1.0},
        {"modelo": "MODELO-TESTE", "cenario": "ssp245", "mes": 3, "chuva_pct": 0.0, "tmax_c": 2.0},
    ]  # fmt: skip
    repo = FixtureClimateRepository(_write_fixture(tmp_path / "clima.json", cmip6=cmip6))

    deltas = repo.get_cmip6_deltas("-190_-482")

    assert [d.tmin_c for d in deltas] == [1.0, None]


class _FakeCmip6Source:
    """Fonte de deltas falsa (tabela ou arquivo): devolve o que recebeu e conta as consultas."""

    def __init__(self, deltas: list[Cmip6Delta]) -> None:
        self._deltas = deltas
        self.calls: list[str] = []

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        self.calls.append(cell_id)
        return list(self._deltas)


def _test_deltas(model: str) -> list[Cmip6Delta]:
    return [Cmip6Delta(model, "ssp245", 2, rain_pct=-10.0, tmax_c=2.0, tmin_c=1.0)]


FIXTURE_CMIP6 = [
    {"modelo": "FIXTURE-TESTE", "cenario": "ssp245", "mes": 2, "chuva_pct": 5.0, "tmax_c": 1.0}
]


def test_should_take_deltas_from_the_deltas_file_before_the_fixture_list(tmp_path: Path) -> None:
    file_repo = _FakeCmip6Source(_test_deltas("ARQUIVO-TESTE"))
    repo = FixtureClimateRepository(
        _write_fixture(tmp_path / "clima.json", cmip6=FIXTURE_CMIP6), cmip6_file_repo=file_repo
    )

    deltas = repo.get_cmip6_deltas("-190_-482")

    assert [d.model for d in deltas] == ["ARQUIVO-TESTE"]
    assert file_repo.calls == ["-190_-482"]


def test_should_use_the_fixture_list_when_the_deltas_file_has_nothing_for_the_cell(
    tmp_path: Path,
) -> None:
    repo = FixtureClimateRepository(
        _write_fixture(tmp_path / "clima.json", cmip6=FIXTURE_CMIP6),
        cmip6_file_repo=_FakeCmip6Source([]),
    )

    assert [d.model for d in repo.get_cmip6_deltas("-190_-482")] == ["FIXTURE-TESTE"]


def _postgis_with_sources(
    table: list[Cmip6Delta], file: list[Cmip6Delta], fixture: list[Cmip6Delta]
) -> tuple[PostgisClimateRepository, _FakeCmip6Source, _FakeCmip6Source, _FakeCmip6Source]:
    table_repo, file_repo = _FakeCmip6Source(table), _FakeCmip6Source(file)
    fallback = _FakeCmip6Source(fixture)
    repo = PostgisClimateRepository(
        "postgresql://teste",
        fallback_repo=fallback,
        cmip6_repo=table_repo,
        cmip6_file_repo=file_repo,
    )
    return repo, table_repo, file_repo, fallback


def test_should_read_cmip6_deltas_from_the_table_first() -> None:
    repo, _, file_repo, fallback = _postgis_with_sources(
        table=_test_deltas("TABELA-TESTE"),
        file=_test_deltas("ARQUIVO-TESTE"),
        fixture=_test_deltas("FIXTURE-TESTE"),
    )

    assert [d.model for d in repo.get_cmip6_deltas("-190_-482")] == ["TABELA-TESTE"]
    assert file_repo.calls == fallback.calls == []


def test_should_read_cmip6_deltas_from_the_file_when_the_table_has_none_for_the_cell() -> None:
    repo, table_repo, _, fallback = _postgis_with_sources(
        table=[], file=_test_deltas("ARQUIVO-TESTE"), fixture=_test_deltas("FIXTURE-TESTE")
    )

    assert [d.model for d in repo.get_cmip6_deltas("-190_-482")] == ["ARQUIVO-TESTE"]
    assert table_repo.calls == ["-190_-482"]
    assert fallback.calls == []


def test_should_read_cmip6_deltas_from_the_fixture_when_table_and_file_have_none() -> None:
    repo, table_repo, file_repo, _ = _postgis_with_sources(
        table=[], file=[], fixture=_test_deltas("FIXTURE-TESTE")
    )

    assert [d.model for d in repo.get_cmip6_deltas("-190_-482")] == ["FIXTURE-TESTE"]
    assert table_repo.calls == file_repo.calls == ["-190_-482"]


def test_should_return_no_cmip6_deltas_when_no_source_has_them() -> None:
    repo, *_ = _postgis_with_sources(table=[], file=[], fixture=[])

    assert repo.get_cmip6_deltas("-190_-482") == []


def test_should_load_shipped_example_farm_fixture_with_twenty_full_seasons() -> None:
    # O arquivo que vai junto com a API precisa ser lido sem erro (o bug do 500 era isso).
    repo = FixtureClimateRepository(Settings(_env_file=None).clima_path)

    cell_id = repo.find_cell_id(-18.9543, -48.1993)
    assert cell_id is not None
    seasons = repo.get_seasons(cell_id)

    assert [s.year for s in seasons] == list(range(2005, 2025))
    assert all(len(s.rain_mm) == len(s.tmax_c) == len(s.tmin_c) == 212 for s in seasons)


class _FakeCursor:
    def __init__(self, rows: list[tuple[Any, ...]]) -> None:
        self._rows = rows
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    def __enter__(self) -> "_FakeCursor":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        self.executed.append((sql, params))

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._rows[0] if self._rows else None

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self._rows)


class _FakeConnection:
    def __init__(self, cursor: _FakeCursor) -> None:
        self._cursor = cursor

    def __enter__(self) -> "_FakeConnection":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def cursor(self) -> _FakeCursor:
        return self._cursor

    def commit(self) -> None:
        return None


def _fake_driver(monkeypatch: pytest.MonkeyPatch, rows: list[tuple[Any, ...]]) -> _FakeCursor:
    cursor = _FakeCursor(rows)
    fake = SimpleNamespace(connect=lambda _url: _FakeConnection(cursor))
    monkeypatch.setattr(climate_repository, "psycopg", fake)
    return cursor


def test_should_look_up_postgis_cell_by_the_floor_cell_id(monkeypatch: pytest.MonkeyPatch) -> None:
    cursor = _fake_driver(monkeypatch, rows=[("-190_-483",)])

    cell_id = PostgisClimateRepository("postgresql://teste").find_cell_id(-18.92, -48.27)

    assert cell_id == "-190_-483"
    assert "-190_-483" in cursor.executed[0][1]


def test_should_save_cell_with_polygon_and_center_of_the_floor_cell(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cursor = _fake_driver(monkeypatch, rows=[])
    season = ClimateSeason(
        cell_id="-190_-483",
        year=2005,
        start_date=date(2005, 1, 1),
        rain_mm=(1.0,),
        rain_source="nasa_power",
        tmax_c=(30.0,),
        tmin_c=(18.0,),
        eto_mm=(4.0,),
    )

    PostgisClimateRepository("postgresql://teste").save_cell_seasons(
        cell_id="-190_-483", lat=-18.92, lon=-48.27, seasons=[season]
    )

    grid_params = cursor.executed[0][1]
    assert grid_params[0] == "-190_-483"
    assert grid_params[1] == cell_polygon_wkt("-190_-483")
    assert grid_params[3] == "POINT(-48.25 -18.95)"


def test_should_read_postgis_seasons_with_the_cell_center_latitude(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Sem coluna de latitude no banco, a temporada vinha com lat = 0,0 e o Hargreaves errava a ETo.
    row = (2005, date(2005, 1, 1), [1.0], "nasa_power", [30.0], [18.0], [], [], [], [], [], [])
    _fake_driver(monkeypatch, rows=[row])

    seasons = PostgisClimateRepository("postgresql://teste").get_seasons("-178_-510")

    assert seasons[0].lat == pytest.approx(-17.75)
