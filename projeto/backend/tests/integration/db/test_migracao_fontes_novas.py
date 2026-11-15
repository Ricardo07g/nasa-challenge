"""Migração R1.6 (tarefa 0013): o banco no "Contrato dos dados das fontes" do AGENTS.md do backend.

Confere o esquema de `cmip6_delta`, `ndvi_point`, `smap_point` e `data_run.version`, e que a
migração desce e sobe de novo. Os testes que descem sempre deixam o banco em `head` no fim.
"""

from collections.abc import Iterator

import psycopg
import pytest

from tests.integration.db.support import run_alembic

pytestmark = pytest.mark.db

INITIAL_REVISION = "cb6b775d83e3"

# coluna -> (tipo no Postgres, aceita nulo)
CONTRACT_COLUMNS: dict[str, dict[str, tuple[str, bool]]] = {
    "cmip6_delta": {
        "cell_id": ("text", False),
        "model": ("text", False),
        "scenario": ("text", False),
        "month": ("int2", False),
        "rain_pct": ("float4", False),
        "tmax_c": ("float4", False),
        "tmin_c": ("float4", True),
    },
    "ndvi_point": {
        "key": ("text", False),
        "geom": ("geometry", False),
        "date": ("date", False),
        "product": ("text", False),
        "ndvi": ("float4", False),
        "quality": ("int2", False),
    },
    "smap_point": {
        "key": ("text", False),
        "geom": ("geometry", False),
        "date": ("date", False),
        "sm_rootzone_wetness": ("float4", False),
        "sm_rootzone_m3_m3": ("float4", False),
        "sm_surface_m3_m3": ("float4", True),
    },
    "data_run": {
        "id": ("int4", False),
        "source": ("text", False),
        "params": ("jsonb", False),
        "finished_at": ("timestamptz", False),
        "version": ("text", False),
    },
}

CONTRACT_PRIMARY_KEYS: dict[str, list[str]] = {
    "cmip6_delta": ["cell_id", "model", "scenario", "month"],
    "ndvi_point": ["key", "date", "product"],
    "smap_point": ["key", "date"],
}


def _columns(url: str, table: str) -> dict[str, tuple[str, bool]]:
    with psycopg.connect(url) as conn:
        rows = conn.execute(
            "SELECT column_name, udt_name, is_nullable = 'YES' FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s;",
            (table,),
        ).fetchall()
    return {str(name): (str(udt), bool(nullable)) for name, udt, nullable in rows}


def _primary_key(url: str, table: str) -> list[str]:
    with psycopg.connect(url) as conn:
        rows = conn.execute(
            "SELECT kcu.column_name FROM information_schema.table_constraints tc "
            "JOIN information_schema.key_column_usage kcu "
            "  ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name "
            "WHERE tc.table_schema = 'public' AND tc.table_name = %s "
            "  AND tc.constraint_type = 'PRIMARY KEY' "
            "ORDER BY kcu.ordinal_position;",
            (table,),
        ).fetchall()
    return [str(row[0]) for row in rows]


def _table_exists(url: str, table: str) -> bool:
    with psycopg.connect(url) as conn:
        row = conn.execute("SELECT to_regclass(%s) IS NOT NULL;", (f"public.{table}",)).fetchone()
    assert row is not None
    return bool(row[0])


def _alembic_ok(url: str, *args: str) -> None:
    result = run_alembic(url, *args)
    assert result.returncode == 0, f"alembic {' '.join(args)} falhou:\n{result.stderr}"


@pytest.fixture
def back_to_head(db_url: str) -> Iterator[str]:
    """Para os testes que descem a migração: o banco volta para `head` mesmo se o teste falhar."""
    yield db_url
    _alembic_ok(db_url, "upgrade", "head")


@pytest.mark.parametrize("table", sorted(CONTRACT_COLUMNS))
def test_should_have_the_contract_columns(db_url: str, table: str) -> None:
    assert _columns(db_url, table) == CONTRACT_COLUMNS[table]


@pytest.mark.parametrize("table", sorted(CONTRACT_PRIMARY_KEYS))
def test_should_have_the_contract_primary_key(db_url: str, table: str) -> None:
    assert _primary_key(db_url, table) == CONTRACT_PRIMARY_KEYS[table]


def test_should_replace_the_cell_smap_table_by_the_point_one(db_url: str) -> None:
    assert not _table_exists(db_url, "smap_moisture")
    assert _table_exists(db_url, "smap_point")


@pytest.mark.parametrize("table", ["ndvi_point", "smap_point"])
def test_should_store_point_geometry_in_wgs84_with_spatial_index(db_url: str, table: str) -> None:
    with psycopg.connect(db_url) as conn:
        geometry = conn.execute(
            "SELECT type, srid FROM geometry_columns "
            "WHERE f_table_name = %s AND f_geometry_column = 'geom';",
            (table,),
        ).fetchone()
        indexes = conn.execute(
            "SELECT indexdef FROM pg_indexes WHERE tablename = %s;", (table,)
        ).fetchall()

    assert geometry == ("POINT", 4326)
    assert any("USING gist (geom)" in str(row[0]) for row in indexes)


def test_should_tie_cmip6_deltas_to_the_grid_cell(db_url: str) -> None:
    with psycopg.connect(db_url) as conn:
        row = conn.execute(
            "SELECT confrelid::regclass::text, confdeltype FROM pg_constraint "
            "WHERE conrelid = 'cmip6_delta'::regclass AND contype = 'f';"
        ).fetchone()

    assert row == ("grid_cell", "c")  # ON DELETE CASCADE, como o climate_season


def test_should_go_down_to_the_initial_schema_and_up_again(back_to_head: str) -> None:
    url = back_to_head

    # Desce até a migração inicial (a R1.6 deixou de ser a última na tarefa 0047).
    _alembic_ok(url, "downgrade", INITIAL_REVISION)

    assert _table_exists(url, "smap_moisture")
    assert not _table_exists(url, "smap_point")
    assert "aumento_temperatura_media_c" in _columns(url, "cmip6_delta")
    assert _primary_key(url, "ndvi_point") == ["key", "date"]
    assert "version" not in _columns(url, "data_run")

    _alembic_ok(url, "upgrade", "head")

    for table, columns in CONTRACT_COLUMNS.items():
        assert _columns(url, table) == columns
    assert not _table_exists(url, "smap_moisture")


def test_should_mark_runs_saved_before_the_version_column_as_unversioned(
    back_to_head: str,
) -> None:
    url = back_to_head
    _alembic_ok(url, "downgrade", INITIAL_REVISION)
    with psycopg.connect(url) as conn:
        conn.execute(
            "INSERT INTO data_run (source, params) VALUES ('nasa_power', '{\"anos\": [2005]}');"
        )

    _alembic_ok(url, "upgrade", "head")

    with psycopg.connect(url) as conn:
        rows = conn.execute("SELECT source, version FROM data_run;").fetchall()
    assert rows == [("nasa_power", "sem-versao")]
