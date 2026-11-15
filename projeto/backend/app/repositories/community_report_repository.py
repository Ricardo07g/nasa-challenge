"""Contrato e implementação do acesso aos relatos da comunidade (tabela `community_report`).

Só lê e grava: a validação, a célula, o hash do aparelho, o limite por dia e o raio ficam no
`CommunityReportService` (tarefa 0047).
"""

import uuid
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any, Final, Protocol

import psycopg
from psycopg.types.json import Jsonb

from app.models.community_report import CommunityReport, NewCommunityReport

_COLUMNS: Final[str] = "id, report_type, subtype, details, cell_id, fact_date, sent_at, device_hash"


class CommunityReportRepository(Protocol):
    """Relatos guardados por célula de 0,1°, com o hash do aparelho que enviou."""

    def add(self, report: NewCommunityReport, sent_at: datetime) -> CommunityReport: ...

    def count_sent_since(self, device_hash: str, since: datetime) -> int: ...

    def list_in_cells(self, cell_ids: Sequence[str], fact_since: date) -> list[CommunityReport]:
        """Relatos das células com a data do fato a partir de `fact_since` ou sem data do fato."""
        ...

    def list_by_device(self, device_hash: str, tipo: str) -> list[CommunityReport]: ...

    def delete(self, report_id: str, device_hash: str) -> bool:
        """Apaga o relato se ele for do aparelho; False se não existir ou for de outro."""
        ...


def _from_row(row: tuple[Any, ...]) -> CommunityReport:
    report_id, tipo, subtipo, details, cell_id, fact_date, sent_at, device_hash = row
    return CommunityReport(
        id=str(report_id),
        tipo=str(tipo),
        subtipo=None if subtipo is None else str(subtipo),
        valores=dict(details),
        celula=str(cell_id),
        data_fato=fact_date,
        enviado_em=sent_at,
        device_hash=str(device_hash),
    )


class PostgisCommunityReportRepository:
    """`community_report` no PostgreSQL: uma linha por relato (migração `3f7c2a9d4e81`)."""

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def add(self, report: NewCommunityReport, sent_at: datetime) -> CommunityReport:
        with psycopg.connect(self._database_url) as conn:
            row = conn.execute(
                f"""
                INSERT INTO community_report (
                    report_type, subtype, details, cell_id, fact_date, sent_at, device_hash
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING {_COLUMNS};
                """,
                (
                    report.tipo,
                    report.subtipo,
                    Jsonb(dict(report.valores)),
                    report.celula,
                    report.data_fato,
                    sent_at,
                    report.device_hash,
                ),
            ).fetchone()
        assert row is not None
        return _from_row(row)

    def count_sent_since(self, device_hash: str, since: datetime) -> int:
        with psycopg.connect(self._database_url) as conn:
            row = conn.execute(
                "SELECT count(*) FROM community_report WHERE device_hash = %s AND sent_at >= %s;",
                (device_hash, since),
            ).fetchone()
        assert row is not None
        return int(row[0])

    def list_in_cells(self, cell_ids: Sequence[str], fact_since: date) -> list[CommunityReport]:
        if not cell_ids:
            return []
        with psycopg.connect(self._database_url) as conn:
            rows = conn.execute(
                f"""
                SELECT {_COLUMNS} FROM community_report
                WHERE cell_id = ANY(%s) AND (fact_date IS NULL OR fact_date >= %s)
                ORDER BY sent_at DESC;
                """,
                (list(cell_ids), fact_since),
            ).fetchall()
        return [_from_row(row) for row in rows]

    def list_by_device(self, device_hash: str, tipo: str) -> list[CommunityReport]:
        with psycopg.connect(self._database_url) as conn:
            rows = conn.execute(
                f"""
                SELECT {_COLUMNS} FROM community_report
                WHERE device_hash = %s AND report_type = %s
                ORDER BY sent_at DESC;
                """,
                (device_hash, tipo),
            ).fetchall()
        return [_from_row(row) for row in rows]

    def delete(self, report_id: str, device_hash: str) -> bool:
        try:
            parsed = uuid.UUID(report_id)
        except ValueError:
            return False
        with psycopg.connect(self._database_url) as conn:
            cursor = conn.execute(
                "DELETE FROM community_report WHERE id = %s AND device_hash = %s;",
                (parsed, device_hash),
            )
            return cursor.rowcount > 0
