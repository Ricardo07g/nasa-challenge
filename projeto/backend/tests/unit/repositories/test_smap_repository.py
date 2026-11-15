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
from app.repositories.smap_repository import FileSmapRepository


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
