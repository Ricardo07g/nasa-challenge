"""Nota de futuro (R3.1) com o banco: deltas do CMIP6 lidos da tabela `cmip6_delta` da célula.

O resto (dependencies.py, services, repositories) é o de verdade; POWER e SoilGrids são falsos.
Os deltas são de teste (`MODELO-TESTE`, valores redondos), não dado real.
"""

import json
from pathlib import Path

import psycopg
import pytest

from app.config import Settings
from app.models.climate import Cmip6Delta
from app.repositories.climate_repository import (
    FixtureClimateRepository,
    PostgisClimateRepository,
    cell_center_wkt,
    cell_polygon_wkt,
)
from app.repositories.cmip6_repository import FileCmip6Repository, PostgisCmip6Repository
from tests.integration.db.support import Api

pytestmark = pytest.mark.db

# Lavoura de demonstração: a célula está na cobertura da fixture do clima, que dá as temporadas.
UFU = {"lat": -18.9543, "lon": -48.1993}
UFU_CELL_ID = "-190_-482"


def _insert_cell(db_url: str, cell_id: str) -> None:
    with psycopg.connect(db_url) as conn:
        conn.execute(
            "INSERT INTO grid_cell (id, geom, center) "
            "VALUES (%s, ST_GeomFromText(%s, 4326), ST_GeomFromText(%s, 4326));",
            (cell_id, cell_polygon_wkt(cell_id), cell_center_wkt(cell_id)),
        )


def _zero_deltas(model: str) -> list[Cmip6Delta]:
    # Delta zero de janeiro a julho: o clima de 2041-2060 fica igual ao observado.
    return [
        Cmip6Delta(model, "ssp245", m, rain_pct=0.0, tmax_c=0.0, tmin_c=0.0) for m in range(1, 8)
    ]


def test_should_answer_future_from_the_cmip6_delta_table_of_the_cell(api: Api, db_url: str) -> None:
    _insert_cell(db_url, UFU_CELL_ID)
    PostgisCmip6Repository(db_url).save_cmip6_deltas(UFU_CELL_ID, _zero_deltas("MODELO-TESTE"))

    talhao = api.client.get("/api/talhao", params=UFU).json()
    rec = api.client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert talhao["celula_id"] == UFU_CELL_ID
    assert {
        "fonte": "nex_gddp_cmip6",
        "periodo": "2041-2060",
        "cenario": "ssp245",
        "modelos": 1,
    } in (talhao["dados"])
    assert rec["opcoes"]
    for opcao in rec["opcoes"]:
        anos_bons = opcao["chuva"]["anos_bons"]
        assert opcao["futuro"] == {
            "anos_bons_media": anos_bons,
            "anos_bons_min": anos_bons,
            "anos_bons_max": anos_bons,
            "modelos": 1,
            "cenario": "ssp245",
        }
        assert opcao["notas"]["futuro"] is not None
    # Nada foi buscado fora: a célula já estava no banco.
    assert api.nasa.calls == []


def test_should_leave_future_out_when_the_table_has_no_deltas_for_the_cell(
    api: Api, db_url: str
) -> None:
    _insert_cell(db_url, UFU_CELL_ID)

    talhao = api.client.get("/api/talhao", params=UFU).json()
    rec = api.client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert [d["fonte"] for d in talhao["dados"]] == ["nasa_power"]
    assert all(o["futuro"] is None for o in rec["opcoes"])


def _write_cmip6_file(path: Path, model: str) -> Path:
    cmip6 = [
        {"modelo": model, "cenario": "ssp245", "mes": m, "chuva_pct": 0.0, "tmax_c": 0.0}
        for m in range(1, 8)
    ]
    payload = {
        "versao_dados": {"fonte": "nex_gddp_cmip6", "parametros": {},
                         "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-teste"},
        "pontos": [{
            "lat": -19.0, "lon": -48.125,
            "cobertura": {"lat_min": -19.25, "lat_max": -18.75,
                          "lon_min": -48.4375, "lon_max": -47.8125},
            "cmip6": cmip6,
        }],
    }  # fmt: skip
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_the_table_before_the_file_and_the_file_when_the_table_is_empty(
    db_url: str, tmp_path: Path
) -> None:
    _insert_cell(db_url, UFU_CELL_ID)
    table = PostgisCmip6Repository(db_url)
    repo = PostgisClimateRepository(
        db_url,
        fallback_repo=FixtureClimateRepository(Settings.model_fields["clima_path"].default),
        cmip6_repo=table,
        cmip6_file_repo=FileCmip6Repository(_write_cmip6_file(tmp_path / "c.json", "ARQUIVO")),
    )
    table.save_cmip6_deltas(UFU_CELL_ID, _zero_deltas("TABELA-TESTE"))

    assert {d.model for d in repo.get_cmip6_deltas(UFU_CELL_ID)} == {"TABELA-TESTE"}

    with psycopg.connect(db_url) as conn:
        conn.execute("DELETE FROM cmip6_delta;")

    assert {d.model for d in repo.get_cmip6_deltas(UFU_CELL_ID)} == {"ARQUIVO"}
