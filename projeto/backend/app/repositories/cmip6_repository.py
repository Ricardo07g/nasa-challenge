"""Contrato e implementação do acesso aos deltas mensais do NEX-GDDP-CMIP6 por célula (tabela).

A tabela `cmip6_delta` é a da migração R1.6. A API ainda lê os deltas pelo
`ClimateRepository.get_cmip6_deltas` (fixture); ligar esta tabela é o R3.1.
"""

from typing import Protocol

import psycopg

from app.models.climate import Cmip6Delta


class Cmip6Repository(Protocol):
    """Deltas mensais por modelo de uma célula de 0,1°."""

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]: ...

    def save_cmip6_deltas(self, cell_id: str, deltas: list[Cmip6Delta]) -> None: ...


class PostgisCmip6Repository:
    """`cmip6_delta` no PostGIS. A célula precisa existir em `grid_cell` (chave estrangeira)."""

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def save_cmip6_deltas(self, cell_id: str, deltas: list[Cmip6Delta]) -> None:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO cmip6_delta (cell_id, model, scenario, month, rain_pct, tmax_c, tmin_c)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (cell_id, model, scenario, month) DO UPDATE
                SET rain_pct = EXCLUDED.rain_pct,
                    tmax_c = EXCLUDED.tmax_c,
                    tmin_c = EXCLUDED.tmin_c;
                """,
                [
                    (cell_id, d.model, d.scenario, d.month, d.rain_pct, d.tmax_c, d.tmin_c)
                    for d in deltas
                ],
            )

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT model, scenario, month, rain_pct, tmax_c, tmin_c
                FROM cmip6_delta
                WHERE cell_id = %s
                ORDER BY model, scenario, month;
                """,
                (cell_id,),
            )
            rows = cur.fetchall()
        return [
            Cmip6Delta(
                model=str(r[0]),
                scenario=str(r[1]),
                month=int(r[2]),
                rain_pct=float(r[3]),
                tmax_c=float(r[4]),
                tmin_c=None if r[5] is None else float(r[5]),
            )
            for r in rows
        ]
