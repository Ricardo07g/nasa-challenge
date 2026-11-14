"""Contrato e implementações do acesso aos deltas mensais do NEX-GDDP-CMIP6 por célula.

Duas fontes: a tabela `cmip6_delta` (migração R1.6) e o arquivo do contrato CMIP6 que o
`pipeline/fetch_cmip6_deltas.py` grava. A API lê pelo `ClimateRepository.get_cmip6_deltas`, que
consulta as duas nessa ordem (R3.1).
"""

import json
from pathlib import Path
from typing import Any, Protocol

import psycopg

from app.models.climate import Cmip6Delta
from app.models.data_run import DataRun
from app.repositories.climate_repository import cell_center, cmip6_delta_from_json
from app.repositories.data_run_repository import data_run_from_json


class Cmip6Repository(Protocol):
    """Deltas mensais por modelo de uma célula de 0,1°."""

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]: ...


class WritableCmip6Repository(Cmip6Repository, Protocol):
    """Deltas que também são gravados (tabela `cmip6_delta`)."""

    def save_cmip6_deltas(self, cell_id: str, deltas: list[Cmip6Delta]) -> None: ...


class FileCmip6Repository:
    """Lê os deltas do arquivo do contrato CMIP6 (`versao_dados` + `pontos[]`).

    Cada ponto traz a `cobertura` (a célula do NASA POWER, 0,5° × 0,625°) a que os deltas valem.
    A célula de 0,1° recebe os deltas do ponto cuja cobertura contém o centro dela, com a mesma
    regra da fixture do clima (borda de baixo dentro, borda de cima fora). Sem arquivo ou sem
    ponto que cubra a célula: nenhum delta, nunca os de outra região.
    """

    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._payload: dict[str, Any] | None = None

    def _load(self) -> dict[str, Any]:
        if self._payload is None:
            if self._path is None or not self._path.is_file():
                self._payload = {}
            else:
                self._payload = json.loads(self._path.read_text(encoding="utf-8"))
        return self._payload

    def get_data_run(self) -> DataRun | None:
        """A execução que gerou o arquivo (`versao_dados`); None sem arquivo ou sem a chave."""
        versao_dados = self._load().get("versao_dados")
        return None if versao_dados is None else data_run_from_json(versao_dados)

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        try:
            lat, lon = cell_center(cell_id)
        except ValueError:
            return []
        for point in self._load().get("pontos", []):
            box = point["cobertura"]
            if box["lat_min"] <= lat < box["lat_max"] and box["lon_min"] <= lon < box["lon_max"]:
                return [cmip6_delta_from_json(item) for item in point.get("cmip6", [])]
        return []


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
