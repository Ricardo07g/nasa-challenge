"""Unit tests for FileRegionRepository: a região pelo satélite lida do arquivo do contrato (P3).

O arquivo é o que o `pipeline/fetch_regiao_ndvi.py` grava ("Contrato dos dados das fontes",
"Região pelo satélite"). Os valores são de teste (`fonte: "teste"`), não dado do MODIS.
"""

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.models.data_run import DataRun
from app.models.regiao import RegiaoAno, RegiaoSatelite
from app.repositories.regiao_repository import FileRegionRepository


def _year(ano: int, **overrides: object) -> dict:
    item: dict[str, object] = {
        "ano": ano,
        "n_pixels": 1372,
        "pct_parado": 60.5,
        "pct_plantou": 30.6,
        "pct_incerto": 8.9,
        "pct_sem_dado": 2.2,
    }
    item.update(overrides)
    return item


def _region(lat: float, lon: float, anos: list[dict]) -> dict:
    return {
        "lat": lat,
        "lon": lon,
        "raio_km": 30,
        "fonte": "teste",
        "mascara": "máscara de teste",
        "anos": anos,
    }


def _write(path: Path, regioes: list[dict]) -> Path:
    payload = {
        "versao_dados": {
            "fonte": "teste",
            "parametros": {"raio_km": 30},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "2026.11-teste",
        },
        "regioes": regioes,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_every_region_of_the_file(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "regiao.json",
        [
            _region(-18.9543, -48.1993, [_year(2016), _year(2025)]),
            _region(
                -17.5, -47.25, [_year(2025, pct_parado=50.0, pct_plantou=40.0, pct_incerto=10.0)]
            ),
        ],
    )

    regions = FileRegionRepository(path).list_regions()

    assert regions[0] == RegiaoSatelite(
        lat=-18.9543,
        lon=-48.1993,
        raio_km=30.0,
        fonte="teste",
        mascara="máscara de teste",
        anos=(
            RegiaoAno(2016, 1372, 60.5, 30.6, 8.9, 2.2),
            RegiaoAno(2025, 1372, 60.5, 30.6, 8.9, 2.2),
        ),
    )
    assert regions[1].anos[0].pct_parado == 50.0


def test_should_read_empty_percentages_as_none(tmp_path: Path) -> None:
    sem_lavoura = _year(
        2018, n_pixels=0, pct_parado=None, pct_plantou=None, pct_incerto=None, pct_sem_dado=None
    )
    path = _write(tmp_path / "regiao.json", [_region(-18.9543, -48.1993, [sem_lavoura])])

    (region,) = FileRegionRepository(path).list_regions()

    assert region.anos == (RegiaoAno(2018, 0, None, None, None, None),)


def test_should_return_no_region_without_path_or_without_file(tmp_path: Path) -> None:
    assert FileRegionRepository(None).list_regions() == []
    assert FileRegionRepository(tmp_path / "nao_existe.json").list_regions() == []


def test_should_refuse_a_file_outside_the_contract(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "regiao.json", [_region(-18.9543, -48.1993, [_year(2016, pct_parado=160.0)])]
    )

    with pytest.raises(ValueError, match="pct_parado"):
        FileRegionRepository(path).list_regions()


def test_should_expose_the_data_run_of_the_file(tmp_path: Path) -> None:
    path = _write(tmp_path / "regiao.json", [])

    assert FileRegionRepository(path).get_data_run() == DataRun(
        source="teste",
        params={"raio_km": 30},
        finished_at=datetime(2026, 11, 14, 13, 0, tzinfo=UTC),
        version="2026.11-teste",
    )
    assert FileRegionRepository(None).get_data_run() is None
