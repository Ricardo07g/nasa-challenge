"""Tabela `community_report` e o `PostgisCommunityReportRepository` contra o banco de teste.

Seção 7 da remodelagem (tarefa 0047): relatos da comunidade sem cadastro. A tabela guarda só a
célula de 0,1° e o hash do aparelho; os valores aqui são de teste.
"""

import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta

import psycopg
import pytest

from app import dependencies
from app.models.community_report import NewCommunityReport
from app.repositories.community_report_repository import PostgisCommunityReportRepository
from tests.integration.db.support import Api, count_rows, run_alembic

pytestmark = pytest.mark.db

MIGRATION_BEFORE = "6e961f333ddc"
HASH_A = "a" * 64
HASH_B = "b" * 64
CELL = "-190_-482"
OTHER_CELL = "-189_-482"
SENT = datetime(2026, 11, 15, 15, 0, tzinfo=UTC)

COLUMNS = {
    "id": ("uuid", False),
    "report_type": ("text", False),
    "subtype": ("text", True),
    "details": ("jsonb", False),
    "cell_id": ("text", False),
    "fact_date": ("date", True),
    "sent_at": ("timestamptz", False),
    "device_hash": ("text", False),
}


def _columns(url: str) -> dict[str, tuple[str, bool]]:
    with psycopg.connect(url) as conn:
        rows = conn.execute(
            "SELECT column_name, udt_name, is_nullable = 'YES' FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'community_report';"
        ).fetchall()
    return {str(name): (str(udt), bool(nullable)) for name, udt, nullable in rows}


def _report(**changes: object) -> NewCommunityReport:
    values: dict[str, object] = {
        "tipo": "chuva",
        "subtipo": None,
        "valores": {"mm": 32.5},
        "celula": CELL,
        "data_fato": date(2026, 11, 14),
        "device_hash": HASH_A,
    }
    values.update(changes)
    return NewCommunityReport(**values)  # type: ignore[arg-type]


@pytest.fixture
def back_to_head(db_url: str) -> Iterator[str]:
    yield db_url
    result = run_alembic(db_url, "upgrade", "head")
    assert result.returncode == 0, result.stderr


def test_table_has_the_cell_and_the_device_hash_never_the_point(db_url: str) -> None:
    assert _columns(db_url) == COLUMNS


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("cell_id", "-18.9543,-48.1993"),  # coordenada no lugar da célula
        ("device_hash", "aparelho-sem-hash"),  # identificador sem hash
    ],
)
def test_table_refuses_a_point_or_a_raw_device_id(db_url: str, column: str, value: str) -> None:
    row = {"cell_id": CELL, "device_hash": HASH_A, column: value}
    with psycopg.connect(db_url) as conn, pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO community_report (report_type, details, cell_id, device_hash) "
            "VALUES ('chuva', '{}', %s, %s);",
            (row["cell_id"], row["device_hash"]),
        )


def test_migration_goes_down_and_up_again(back_to_head: str) -> None:
    url = back_to_head

    assert run_alembic(url, "downgrade", MIGRATION_BEFORE).returncode == 0
    assert _columns(url) == {}

    assert run_alembic(url, "upgrade", "head").returncode == 0
    assert _columns(url) == COLUMNS


def test_add_returns_the_stored_report_with_id_and_sending_time(db_url: str) -> None:
    repo = PostgisCommunityReportRepository(db_url)

    stored = repo.add(_report(), sent_at=SENT)

    assert uuid.UUID(stored.id)
    assert (stored.tipo, stored.subtipo, stored.valores) == ("chuva", None, {"mm": 32.5})
    assert (stored.celula, stored.data_fato) == (CELL, date(2026, 11, 14))
    assert stored.enviado_em == SENT
    assert stored.device_hash == HASH_A


def test_count_sent_since_counts_only_the_device_in_the_window(db_url: str) -> None:
    repo = PostgisCommunityReportRepository(db_url)
    repo.add(_report(), sent_at=SENT - timedelta(hours=25))
    repo.add(_report(), sent_at=SENT - timedelta(hours=1))
    repo.add(_report(), sent_at=SENT)
    repo.add(_report(device_hash=HASH_B), sent_at=SENT)

    assert repo.count_sent_since(HASH_A, SENT - timedelta(days=1)) == 2
    assert repo.count_sent_since(HASH_B, SENT - timedelta(days=1)) == 1


def test_list_in_cells_filters_by_cell_and_fact_date_and_keeps_plantings(db_url: str) -> None:
    repo = PostgisCommunityReportRepository(db_url)
    recent = repo.add(_report(data_fato=date(2026, 11, 10)), sent_at=SENT)
    repo.add(_report(data_fato=date(2026, 10, 1)), sent_at=SENT)  # velho demais
    planting = repo.add(
        _report(
            tipo="plantio",
            subtipo="milho_safrinha",
            valores={"ano": 2026, "resultado": "bem"},
            data_fato=None,
        ),
        sent_at=SENT,
    )
    repo.add(_report(celula="-180_-480"), sent_at=SENT)  # outra célula
    other = repo.add(_report(celula=OTHER_CELL, subtipo=None), sent_at=SENT)

    found = repo.list_in_cells([CELL, OTHER_CELL], fact_since=date(2026, 10, 16))

    assert {r.id for r in found} == {recent.id, planting.id, other.id}
    assert next(r for r in found if r.id == planting.id).valores == {
        "ano": 2026,
        "resultado": "bem",
    }
    assert repo.list_in_cells([], fact_since=date(2026, 10, 16)) == []


def test_list_by_device_and_type(db_url: str) -> None:
    repo = PostgisCommunityReportRepository(db_url)
    planting = repo.add(
        _report(tipo="plantio", subtipo="sorgo", valores={"ano": 2025, "resultado": "bem"}),
        sent_at=SENT,
    )
    repo.add(_report(), sent_at=SENT)
    repo.add(_report(tipo="plantio", subtipo="sorgo", device_hash=HASH_B), sent_at=SENT)

    assert [r.id for r in repo.list_by_device(HASH_A, "plantio")] == [planting.id]


def test_delete_only_the_device_own_report(db_url: str) -> None:
    repo = PostgisCommunityReportRepository(db_url)
    report = repo.add(_report(), sent_at=SENT)

    assert repo.delete(report.id, HASH_B) is False
    assert repo.delete(str(uuid.uuid4()), HASH_A) is False
    assert repo.delete(report.id, HASH_A) is True
    assert repo.list_in_cells([CELL], fact_since=date(2026, 1, 1)) == []


@pytest.fixture
def community_api(api: Api) -> Iterator[Api]:
    """A API de verdade com o banco de teste, sem o repository dos relatos de outro teste."""
    dependencies.get_community_report_repository.cache_clear()
    yield api
    dependencies.get_community_report_repository.cache_clear()


def test_api_sends_lists_and_deletes_a_report_in_the_database(
    community_api: Api, db_url: str
) -> None:
    client = community_api.client
    device = {"X-Aparelho": "a1b2c3d4-e5f6-4789-8abc-def012345678"}
    planting = {
        "tipo": "plantio",
        "subtipo": "milho_braquiaria",
        "valores": {"ano": 2026, "resultado": "perdi", "motivo": "seca"},
        "lat": -18.9543,
        "lon": -48.1993,
    }

    created = client.post("/api/comunidade/relatos", json=planting, headers=device)

    assert created.status_code == 201
    with psycopg.connect(db_url) as conn:
        row = conn.execute(
            "SELECT cell_id, device_hash, details::text FROM community_report;"
        ).fetchone()
    assert row is not None
    cell_id, device_hash, details = row
    assert cell_id == CELL
    assert len(device_hash) == 64 and device["X-Aparelho"] not in device_hash
    assert "-18.9543" not in details and "-48.1993" not in details

    listed = client.get(
        "/api/comunidade/relatos", params={"lat": -18.9543, "lon": -48.1993}, headers=device
    ).json()
    assert [(r["subtipo"], r["meu"]) for r in listed["relatos"]] == [("milho_braquiaria", True)]

    deleted = client.delete(f"/api/comunidade/relatos/{created.json()['id']}", headers=device)
    assert deleted.status_code == 204
    assert count_rows(db_url, "community_report") == 0
