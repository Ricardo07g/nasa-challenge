"""Carga dos arquivos do CMIP6 e do NDVI no PostGIS de teste (tarefa 0022).

Repositories e banco de verdade; os arquivos ficam em `tmp_path`, com valores de teste
(`MODELO-TESTE`, versões `teste-*`), não dado real. O `versao_dados` usa a chave de fonte real
porque a carga recusa arquivo de outra fonte.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any

import psycopg
import pytest

from app.models.climate import ClimateSeason
from app.repositories.climate_repository import PostgisClimateRepository
from app.repositories.cmip6_repository import PostgisCmip6Repository
from app.repositories.ndvi_repository import PostgisNdviRepository
from pipeline.load_files_to_db import build_loader
from tests.integration.db.support import count_rows

pytestmark = pytest.mark.db

UFU_POWER_CELL = {"lat_min": -19.25, "lat_max": -18.75, "lon_min": -48.4375, "lon_max": -47.8125}
FARM_CELL = "-190_-482"  # centro -18,95 / -48,15: dentro da célula do POWER da UFU
OUTSIDE_CELL = "-200_-500"  # nenhum ponto do arquivo cobre
UFU = (-18.9543, -48.1993)


def _season(cell_id: str) -> ClimateSeason:
    return ClimateSeason(
        cell_id=cell_id,
        year=2005,
        start_date=date(2005, 1, 1),
        rain_mm=(1.0, 2.0),
        rain_source="teste",
        tmax_c=(30.0, 31.0),
        tmin_c=(18.0, 19.0),
        eto_mm=(4.0, 4.1),
    )


def _save_cells(db_url: str, *cell_ids: str) -> None:
    repo = PostgisClimateRepository(db_url)
    for cell_id in cell_ids:
        lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))
        repo.save_cell_seasons(
            cell_id, lat=(lat_idx + 0.5) / 10, lon=(lon_idx + 0.5) / 10, seasons=[_season(cell_id)]
        )


def _write(path: Path, fonte: str, versao: str, pontos: list[dict[str, Any]]) -> Path:
    payload = {
        "versao_dados": {
            "fonte": fonte,
            "parametros": {},
            "fim": "2026-11-14T13:00:00Z",
            "versao": versao,
        },
        "pontos": pontos,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _cmip6_file(tmp_path: Path) -> Path:
    deltas = [
        {
            "modelo": modelo,
            "cenario": "ssp245",
            "mes": mes,
            "chuva_pct": -10.0,
            "tmax_c": 2.0,
            "tmin_c": 1.0,
        }
        for modelo in ("MODELO-TESTE", "OUTRO-MODELO-TESTE")
        for mes in (1, 2, 3)
    ]
    pontos = [{"lat": -19.0, "lon": -48.125, "cobertura": UFU_POWER_CELL, "cmip6": deltas}]
    return _write(tmp_path / "cmip6.json", "nex_gddp_cmip6", "teste-cmip6", pontos)


def _ndvi_file(tmp_path: Path) -> Path:
    serie = [
        {"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"},
        {"data": "2016-04-06", "ndvi": 0.69, "qualidade": 1, "produto": "MYD13Q1"},
        {"data": "2016-04-14", "ndvi": 0.88, "qualidade": 3, "produto": "MYD13Q1"},  # nuvem
        {"data": "2016-04-22", "ndvi": 0.65},  # cache antigo: sem produto nem qualidade
    ]
    pontos = [{"lat": UFU[0], "lon": UFU[1], "serie": serie}]
    return _write(tmp_path / "ndvi.json", "modis_mod13q1", "teste-ndvi", pontos)


def _runs(db_url: str) -> list[tuple[str, str]]:
    with psycopg.connect(db_url) as conn:
        rows = conn.execute("SELECT source, version FROM data_run ORDER BY id;").fetchall()
    return [(str(source), str(version)) for source, version in rows]


def test_should_load_both_files_into_their_tables(db_url: str, tmp_path: Path) -> None:
    _save_cells(db_url, FARM_CELL, OUTSIDE_CELL)
    loader = build_loader(db_url)

    plan = loader.plan(cmip6_path=_cmip6_file(tmp_path), ndvi_path=_ndvi_file(tmp_path))
    loader.run(plan)

    deltas = PostgisCmip6Repository(db_url).get_cmip6_deltas(FARM_CELL)
    assert len(deltas) == 6  # 2 modelos × 3 meses
    assert {(d.rain_pct, d.tmax_c) for d in deltas} == {(-10.0, 2.0)}
    assert PostgisCmip6Repository(db_url).get_cmip6_deltas(OUTSIDE_CELL) == []
    ndvi = PostgisNdviRepository(db_url).get_ndvi_history(*UFU)
    assert [(r.data, r.produto, r.qualidade) for r in ndvi] == [
        (date(2016, 4, 6), "MOD13Q1", 0),
        (date(2016, 4, 6), "MYD13Q1", 1),
    ]
    assert _runs(db_url) == [("nex_gddp_cmip6", "teste-cmip6"), ("modis_mod13q1", "teste-ndvi")]
    assert plan.ndvi is not None and plan.ndvi.skipped == 2


def test_should_not_duplicate_rows_when_loaded_twice(db_url: str, tmp_path: Path) -> None:
    _save_cells(db_url, FARM_CELL)
    cmip6, ndvi = _cmip6_file(tmp_path), _ndvi_file(tmp_path)
    loader = build_loader(db_url)

    loader.run(loader.plan(cmip6_path=cmip6, ndvi_path=ndvi))
    first = (count_rows(db_url, "cmip6_delta"), count_rows(db_url, "ndvi_point"))
    loader.run(loader.plan(cmip6_path=cmip6, ndvi_path=ndvi))

    assert first == (6, 2)
    assert (count_rows(db_url, "cmip6_delta"), count_rows(db_url, "ndvi_point")) == first
    assert count_rows(db_url, "data_run") == 4  # uma linha por fonte em cada execução


def test_should_save_nothing_when_no_cell_of_the_grid_is_covered(
    db_url: str, tmp_path: Path
) -> None:
    _save_cells(db_url, OUTSIDE_CELL)
    loader = build_loader(db_url)

    loader.run(loader.plan(cmip6_path=_cmip6_file(tmp_path)))

    assert count_rows(db_url, "cmip6_delta") == 0
    assert count_rows(db_url, "data_run") == 0
