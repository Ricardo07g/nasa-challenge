"""Contrato e implementação do acesso à série de NDVI (MODIS MOD13Q1) por ponto."""

from datetime import date
from pathlib import Path
from typing import Any, Protocol

import psycopg

from app.constants import DEFAULT_SRID
from app.models.talhao import NdviRecord
from app.repositories.point_cache import load_points, point_key


class NdviRepository(Protocol):
    """Acesso à série de NDVI de 16 dias de um ponto."""

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]: ...


class WritableNdviRepository(NdviRepository, Protocol):
    """NDVI que também grava a série de um ponto (tabela `ndvi_point`)."""

    def save_ndvi_history(self, lat: float, lon: float, records: list[NdviRecord]) -> None: ...


class CachedNdviRepository:
    """Lê a série de NDVI de um cache JSON por ponto (valores brutos do MOD13Q1 ou já escalados).

    Ponto fora do cache (ou sem cache configurado): série vazia, e o `/talhao` devolve
    `historico: null` (plano técnico §3.1).
    """

    def __init__(self, cache_path: Path | None) -> None:
        self._cache_path = cache_path
        self._points: dict[str, dict[str, Any]] | None = None

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        if self._points is None:
            self._points = load_points(self._cache_path)
        point = self._points.get(point_key(lat, lon))
        if point is None:
            return []
        return [
            NdviRecord(data=date.fromisoformat(str(item["data"])), ndvi=float(item["ndvi"]))
            for item in point.get("serie", [])
        ]


class PostgisNdviRepository:
    """`ndvi_point` no PostGIS (migração R1.6): uma linha por ponto, data e produto.

    A chave do ponto é a `point_key` (0,0025°), como nos caches. Grava o NDVI físico, com o
    produto e a qualidade (os dois obrigatórios na tabela). A API ainda lê o NDVI do cache em
    arquivo; ligar esta tabela é o R3.2.
    """

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def save_ndvi_history(self, lat: float, lon: float, records: list[NdviRecord]) -> None:
        key = point_key(lat, lon)
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO ndvi_point (key, geom, date, product, ndvi, quality)
                VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), %s), %s, %s, %s, %s)
                ON CONFLICT (key, date, product) DO UPDATE
                SET geom = EXCLUDED.geom,
                    ndvi = EXCLUDED.ndvi,
                    quality = EXCLUDED.quality;
                """,
                [
                    (key, lon, lat, DEFAULT_SRID, r.data, r.produto, r.ndvi, r.qualidade)
                    for r in records
                ],
            )

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT date, ndvi, quality, product
                FROM ndvi_point
                WHERE key = %s
                ORDER BY date, product;
                """,
                (point_key(lat, lon),),
            )
            rows = cur.fetchall()
        return [
            NdviRecord(data=r[0], ndvi=float(r[1]), qualidade=int(r[2]), produto=str(r[3]))
            for r in rows
        ]
