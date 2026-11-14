"""Busca sob demanda de ponta a ponta: rotas → services → PostGIS de teste (tarefa 0003, R1.1).

POWER e SoilGrids são falsos; o resto (dependencies.py, services, repositories e banco) é
o de verdade.
"""

import psycopg
import pytest

from app.constants import EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON
from tests.integration.db.support import Api, count_rows

pytestmark = pytest.mark.db

# Rio Verde (GO): longe da célula do POWER da fixture, então sempre ponto novo.
NEW_LAT, NEW_LON = -17.78, -50.92
NEW_CELL_ID = "-178_-510"


def test_should_fetch_a_new_point_once_and_answer_talhao_and_recomendacao(
    api: Api, db_url: str
) -> None:
    talhao = api.client.get("/api/talhao", params={"lat": NEW_LAT, "lon": NEW_LON})

    assert talhao.status_code == 200
    body = talhao.json()
    assert body["celula_id"] == NEW_CELL_ID
    assert body["dentro_da_area"] is True
    assert body["solo"] == {"textura": "argiloso", "cad_mm": 60.0, "fonte": "soilgrids"}
    assert count_rows(db_url, "grid_cell") == 1
    assert count_rows(db_url, "climate_season") == 20
    assert count_rows(db_url, "soil_point") == 1
    with psycopg.connect(db_url) as conn:
        row = conn.execute(
            "SELECT ST_Covers(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)) "
            "FROM grid_cell WHERE id = %s;",
            (NEW_LON, NEW_LAT, NEW_CELL_ID),
        ).fetchone()
    assert row == (True,)

    rec = api.client.get("/api/recomendacao", params={"lat": NEW_LAT, "lon": NEW_LON})

    assert rec.status_code == 200
    rec_body = rec.json()
    assert rec_body["entrada"]["celula_id"] == NEW_CELL_ID
    assert rec_body["opcoes"]
    assert all(o["chuva"]["anos"] == 20 for o in rec_body["opcoes"])
    # O segundo pedido sai do banco: os clientes externos foram chamados uma vez só.
    assert len(api.nasa.calls) == 1
    assert len(api.soil.calls) == 1


def test_should_fetch_on_demand_when_recomendacao_comes_before_talhao(
    api: Api, db_url: str
) -> None:
    rec = api.client.get("/api/recomendacao", params={"lat": NEW_LAT, "lon": NEW_LON})

    assert rec.status_code == 200
    assert rec.json()["entrada"]["celula_id"] == NEW_CELL_ID
    assert count_rows(db_url, "climate_season") == 20

    talhao = api.client.get("/api/talhao", params={"lat": NEW_LAT, "lon": NEW_LON})

    assert talhao.status_code == 200
    assert len(api.nasa.calls) == 1


def test_should_not_save_default_soil_when_soilgrids_fails(api: Api, db_url: str) -> None:
    api.soil.should_fail = True

    talhao = api.client.get("/api/talhao", params={"lat": NEW_LAT, "lon": NEW_LON})

    assert talhao.status_code == 200
    assert talhao.json()["solo"]["fonte"] == "padrao"
    assert count_rows(db_url, "soil_point") == 0
    assert count_rows(db_url, "grid_cell") == 1


def test_should_stay_outside_area_without_saving_when_no_climate_is_available(
    api: Api, db_url: str
) -> None:
    # POWER fora e banco vazio (sem célula vizinha): nada é gravado e a próxima vez tenta de novo.
    api.nasa.should_fail = True

    talhao = api.client.get("/api/talhao", params={"lat": NEW_LAT, "lon": NEW_LON})
    rec = api.client.get("/api/recomendacao", params={"lat": NEW_LAT, "lon": NEW_LON})

    assert talhao.status_code == 200
    assert talhao.json()["dentro_da_area"] is False
    assert rec.status_code == 404
    assert rec.json()["code"] == "OUTSIDE_AREA"
    assert count_rows(db_url, "grid_cell") == 0
    assert len(api.nasa.calls) == 2


def test_should_answer_example_farm_from_the_fixture_fallback_with_empty_database(
    api: Api, db_url: str
) -> None:
    response = api.client.get("/api/exemplo")

    assert response.status_code == 200
    body = response.json()
    assert body["talhao"]["dentro_da_area"] is True
    assert all(o["chuva"]["anos"] == 20 for o in body["recomendacao"]["opcoes"])
    # A fazenda de exemplo vem da fixture (reserva): nada de busca nem gravação.
    assert api.nasa.calls == []
    assert count_rows(db_url, "grid_cell") == 0
    assert body["talhao"]["ponto"] == {"lat": EXAMPLE_FARM_LAT, "lon": EXAMPLE_FARM_LON}
