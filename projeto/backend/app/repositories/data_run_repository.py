"""Contrato e implementação do registro das cargas dos scripts de dados (tabela `data_run`).

A coluna `version` é da migração R1.6. Montar o `versao_dados` da resposta a partir daqui é o R3.5.
"""

from typing import Protocol

import psycopg
from psycopg.types.json import Jsonb

from app.models.data_run import DataRun


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
