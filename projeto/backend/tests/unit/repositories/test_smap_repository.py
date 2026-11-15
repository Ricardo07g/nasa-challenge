"""Unit tests do FileSmapRepository: a umidade do SMAP L4 lida do arquivo do contrato.

O arquivo é o que o `pipeline/fetch_smap.py` grava ("Contrato dos dados das fontes", SMAP). Os
valores e a versão `teste-smap` são de teste, não dado real; o `versao_dados` usa a chave de fonte
real porque é o formato do contrato.
"""

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.models.climate import SmapSoilMoisture
from app.repositories.smap_repository import FileSmapRepository, LayeredSmapRepository


def _write(path: Path, pontos: list[dict[str, Any]], with_version: bool = True) -> Path:
    payload: dict[str, Any] = {"pontos": pontos}
    if with_version:
        payload["versao_dados"] = {
            "fonte": "smap",
            "parametros": {"produto": "SPL4SMGP.008"},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "teste-smap",
        }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _item(data: str, wetness: float, rootzone: float, surface: float | None = None) -> dict:
    item: dict[str, Any] = {
        "data": data,
        "sm_rootzone_wetness": wetness,
        "sm_rootzone_m3_m3": rootzone,
    }
    if surface is not None:
        item["sm_surface_m3_m3"] = surface
    return item


def test_should_read_the_data_run_of_the_file(tmp_path: Path) -> None:
    run = FileSmapRepository(_write(tmp_path / "smap.json", [])).get_data_run()

    assert run is not None
    assert (run.source, run.version) == ("smap", "teste-smap")
    assert run.params == {"produto": "SPL4SMGP.008"}
    assert run.finished_at == datetime(2026, 11, 14, 13, 0, tzinfo=UTC)


def test_should_have_no_data_run_and_no_series_without_the_file(tmp_path: Path) -> None:
    for path in (None, tmp_path / "nao-existe.json"):
        reader = FileSmapRepository(path)
        assert reader.get_data_run() is None
        assert reader.list_point_series() == []


def test_should_have_no_data_run_in_a_file_without_versao_dados(tmp_path: Path) -> None:
    path = _write(tmp_path / "smap.json", [], with_version=False)

    assert FileSmapRepository(path).get_data_run() is None


def test_should_list_every_point_with_its_series_as_models(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "smap.json",
        [
            {
                "lat": -18.95,
                "lon": -48.15,
                "pixel_9km": {"linha": 1, "coluna": 2, "lat": -18.97, "lon": -48.13},
                "serie": [_item("2016-02-08", 0.61, 0.31, 0.27), _item("2016-02-18", 0.55, 0.29)],
            },
            {"lat": -19.05, "lon": -48.15, "serie": []},
        ],
    )

    first, second = FileSmapRepository(path).list_point_series()

    assert (first.lat, first.lon) == (-18.95, -48.15)
    assert first.records == (
        SmapSoilMoisture(date(2016, 2, 8), -18.95, -48.15, 0.31, 0.61, "smap", 0.27),
        SmapSoilMoisture(date(2016, 2, 18), -18.95, -48.15, 0.29, 0.55, "smap", None),
    )
    assert (second.lat, second.lon, second.records) == (-19.05, -48.15, ())


def test_should_refuse_a_record_outside_the_contract(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "smap.json",
        [{"lat": -18.95, "lon": -48.15, "serie": [_item("2016-02-08", 1.4, 0.31)]}],
    )

    with pytest.raises(ValueError, match="sm_rootzone_wetness"):
        FileSmapRepository(path).list_point_series()


# --- série da célula (R3.3) -------------------------------------------------------------------

FARM_CELL = "-190_-482"  # centro -18,95 / -48,15


def test_should_give_the_series_of_the_point_at_the_cell_center(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "smap.json",
        [
            {"lat": -19.05, "lon": -48.15, "serie": [_item("2016-02-18", 0.11, 0.21)]},
            {"lat": -18.95, "lon": -48.15, "serie": [_item("2016-02-18", 0.61, 0.31)]},
        ],
    )

    [record] = FileSmapRepository(path).get_cell_smap_series(FARM_CELL)

    assert (record.data, record.sm_rootzone_wetness) == (date(2016, 2, 18), 0.61)


def test_should_give_no_series_for_a_cell_the_file_does_not_cover(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "smap.json",
        [{"lat": -19.05, "lon": -48.15, "serie": [_item("2016-02-18", 0.11, 0.21)]}],
    )

    assert FileSmapRepository(path).get_cell_smap_series(FARM_CELL) == []
    assert FileSmapRepository(path).get_cell_smap_series("id-mal-formado") == []
    assert FileSmapRepository(None).get_cell_smap_series(FARM_CELL) == []


class _Source:
    def __init__(self, records: list[SmapSoilMoisture]) -> None:
        self.records = records
        self.calls: list[str] = []

    def get_cell_smap_series(self, cell_id: str) -> list[SmapSoilMoisture]:
        self.calls.append(cell_id)
        return list(self.records)


def _record(wetness: float) -> SmapSoilMoisture:
    return SmapSoilMoisture(date(2016, 2, 18), -18.95, -48.15, 0.3, wetness, "teste")


def test_should_take_the_first_source_that_has_the_series_of_the_cell() -> None:
    table, file = _Source([_record(0.61)]), _Source([_record(0.11)])

    series = LayeredSmapRepository(table, file).get_cell_smap_series(FARM_CELL)

    assert [r.sm_rootzone_wetness for r in series] == [0.61]
    assert file.calls == []


def test_should_fall_back_to_the_next_source_when_the_first_is_empty() -> None:
    table, file = _Source([]), _Source([_record(0.11)])

    series = LayeredSmapRepository(table, file).get_cell_smap_series(FARM_CELL)

    assert [r.sm_rootzone_wetness for r in series] == [0.11]
    assert LayeredSmapRepository(_Source([]), _Source([])).get_cell_smap_series(FARM_CELL) == []
