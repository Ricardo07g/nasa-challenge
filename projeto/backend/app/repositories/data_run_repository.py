"""Contrato e implementação do registro das cargas dos scripts de dados (tabela `data_run`).

A coluna `version` é da migração R1.6. Montar o `versao_dados` da resposta a partir daqui é o R3.5.
"""

from collections.abc import Mapping
from datetime import datetime
from typing import Any, Protocol

import psycopg
from psycopg.types.json import Jsonb

from app.models.data_run import DataRun


def data_run_from_json(item: Mapping[str, Any]) -> DataRun:
    """O `versao_dados` de um arquivo do contrato (chaves em português) como `DataRun`.

    `fim` em ISO 8601 com fuso (`2026-11-14T13:00:00Z`); o model recusa hora sem fuso.
    """
    return DataRun(
        source=str(item["fonte"]),
        params=dict(item.get("parametros") or {}),
        finished_at=datetime.fromisoformat(str(item["fim"])),
        version=str(item["versao"]),
    )


class DataRunRepository(Protocol):
    """Cargas feitas pelos scripts de dados, uma linha por execução."""

    def save_run(self, run: DataRun) -> None: ...

    def get_latest_run(self, source: str) -> DataRun | None: ...


class PostgisDataRunRepository:
    """`data_run` no PostGIS."""

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def save_run(self, run: DataRun) -> None:
        with psycopg.connect(self._database_url) as conn:
            conn.execute(
                "INSERT INTO data_run (source, params, finished_at, version) "
                "VALUES (%s, %s, %s, %s);",
                (run.source, Jsonb(dict(run.params)), run.finished_at, run.version),
            )

    def get_latest_run(self, source: str) -> DataRun | None:
        """A carga mais recente da fonte (pelo `finished_at`), ou None se não houver nenhuma."""
        with psycopg.connect(self._database_url) as conn:
            row = conn.execute(
                "SELECT source, params, finished_at, version FROM data_run "
                "WHERE source = %s ORDER BY finished_at DESC, id DESC LIMIT 1;",
                (source,),
            ).fetchone()
        if row is None:
            return None
        return DataRun(source=str(row[0]), params=row[1], finished_at=row[2], version=str(row[3]))
