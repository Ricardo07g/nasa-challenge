"""Contrato e implementações do acesso à umidade do solo do SMAP L4 por ponto e dia.

Duas fontes: a tabela `smap_point` (migração R1.6) e o arquivo do contrato SMAP que o
`pipeline/fetch_smap.py` grava. Usar o SMAP no balde inicial é o R3.3.
"""

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Final, Protocol

import psycopg

from app.constants import DEFAULT_SRID
from app.models.climate import SmapSoilMoisture
from app.models.data_run import DataRun
from app.repositories.data_run_repository import data_run_from_json
from app.repositories.point_cache import point_key

# Chave estável da fonte (AGENTS.md, "Contrato dos dados das fontes"). A tabela não tem coluna de
# fonte: tudo em `smap_point` é SMAP.
SMAP_SOURCE: Final[str] = "smap"


class SmapRepository(Protocol):
    """Série diária do SMAP L4 de um ponto."""

    def get_smap_series(self, lat: float, lon: float) -> list[SmapSoilMoisture]: ...

    def save_smap_series(self, records: list[SmapSoilMoisture]) -> None: ...


@dataclass(frozen=True)
class SmapPointSeries:
    """A série de um ponto do arquivo (o centro de uma célula de 0,1°), já como models."""

    lat: float
    lon: float
    records: tuple[SmapSoilMoisture, ...]


def _optional_float(value: Any) -> float | None:
    return None if value is None else float(value)


def smap_record_from_json(item: dict[str, Any], lat: float, lon: float) -> SmapSoilMoisture:
    """Um item da `serie` do contrato SMAP como `SmapSoilMoisture` (o model valida 0 a 1)."""
    return SmapSoilMoisture(
        data=date.fromisoformat(str(item["data"])),
        latitude=lat,
        longitude=lon,
        sm_rootzone_m3_m3=float(item["sm_rootzone_m3_m3"]),
        sm_rootzone_wetness=float(item["sm_rootzone_wetness"]),
        fonte=SMAP_SOURCE,
        sm_surface_m3_m3=_optional_float(item.get("sm_surface_m3_m3")),
    )


class FileSmapRepository:
    """Lê o arquivo do contrato SMAP (`versao_dados` + `pontos[].serie[]`).

    Cada ponto é o centro de uma célula de 0,1°, com a média do dia do pixel de 9 km mais perto.
    Sem arquivo: nenhuma execução e nenhuma série (nunca dado inventado).
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

    def list_point_series(self) -> list[SmapPointSeries]:
        """Todos os pontos do arquivo, na ordem dele. Registro fora do contrato: ValueError."""
        series: list[SmapPointSeries] = []
        for point in self._load().get("pontos", []):
            lat, lon = float(point["lat"]), float(point["lon"])
            records = tuple(smap_record_from_json(item, lat, lon) for item in point["serie"])
            series.append(SmapPointSeries(lat=lat, lon=lon, records=records))
        return series


class PostgisSmapRepository:
    """`smap_point` no PostGIS: uma linha por ponto (`point_key`, 0,0025°) e dia."""

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def save_smap_series(self, records: list[SmapSoilMoisture]) -> None:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO smap_point (
                    key, geom, date, sm_rootzone_wetness, sm_rootzone_m3_m3, sm_surface_m3_m3
                )
                VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), %s), %s, %s, %s, %s)
                ON CONFLICT (key, date) DO UPDATE
                SET geom = EXCLUDED.geom,
                    sm_rootzone_wetness = EXCLUDED.sm_rootzone_wetness,
                    sm_rootzone_m3_m3 = EXCLUDED.sm_rootzone_m3_m3,
                    sm_surface_m3_m3 = EXCLUDED.sm_surface_m3_m3;
                """,
                [
                    (
                        point_key(r.latitude, r.longitude),
                        r.longitude,
                        r.latitude,
                        DEFAULT_SRID,
                        r.data,
                        r.sm_rootzone_wetness,
                        r.sm_rootzone_m3_m3,
                        r.sm_surface_m3_m3,
                    )
                    for r in records
                ],
            )

    def get_smap_series(self, lat: float, lon: float) -> list[SmapSoilMoisture]:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT date, ST_Y(geom), ST_X(geom),
                       sm_rootzone_m3_m3, sm_rootzone_wetness, sm_surface_m3_m3
                FROM smap_point
                WHERE key = %s
                ORDER BY date;
                """,
                (point_key(lat, lon),),
            )
            rows = cur.fetchall()
        return [
            SmapSoilMoisture(
                data=r[0],
                latitude=float(r[1]),
                longitude=float(r[2]),
                sm_rootzone_m3_m3=float(r[3]),
                sm_rootzone_wetness=float(r[4]),
                fonte=SMAP_SOURCE,
                sm_surface_m3_m3=None if r[5] is None else float(r[5]),
            )
            for r in rows
        ]
