"""Contrato e implementação do acesso à umidade do solo do SMAP L4 por ponto e dia (tabela).

A tabela `smap_point` é a da migração R1.6. Usar o SMAP no balde inicial é o R3.3.
"""

from typing import Final, Protocol

import psycopg

from app.constants import DEFAULT_SRID
from app.models.climate import SmapSoilMoisture
from app.repositories.point_cache import point_key

# Chave estável da fonte (AGENTS.md, "Contrato dos dados das fontes"). A tabela não tem coluna de
# fonte: tudo em `smap_point` é SMAP.
SMAP_SOURCE: Final[str] = "smap"


class SmapRepository(Protocol):
    """Série diária do SMAP L4 de um ponto."""

    def get_smap_series(self, lat: float, lon: float) -> list[SmapSoilMoisture]: ...

    def save_smap_series(self, records: list[SmapSoilMoisture]) -> None: ...


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
