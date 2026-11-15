"""Contrato e implementação do acesso à série de NDVI (MODIS MOD13Q1 e MYD13Q1) por ponto."""

import json
from dataclasses import dataclass
from datetime import date
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Protocol

import psycopg

from app.constants import DEFAULT_SRID, EARTH_RADIUS_M, NDVI_POINT_MAX_DISTANCE_M
from app.models.data_run import DataRun
from app.models.talhao import NDVI_WORST_ACCEPTED_QUALITY, NdviRecord
from app.repositories.data_run_repository import data_run_from_json
from app.repositories.point_cache import point_key


class NdviRepository(Protocol):
    """Acesso à série de NDVI de 16 dias de um ponto."""

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]: ...


class WritableNdviRepository(NdviRepository, Protocol):
    """NDVI que também grava a série de um ponto (tabela `ndvi_point`)."""

    def save_ndvi_history(self, lat: float, lon: float, records: list[NdviRecord]) -> None: ...


class LayeredNdviRepository:
    """Lê as fontes na ordem dada e fica com a primeira que tiver a série do ponto.

    Na API (tarefa 0050): o arquivo por ponto (`NDVI_CACHE_PATH`, só os pontos pedidos, a até um
    pixel) e depois a grade por área (`NDVI_AREA_PATH`, qualquer ponto dos ladrilhos).
    """

    def __init__(self, *sources: NdviRepository) -> None:
        self._sources = sources

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        for source in self._sources:
            records = source.get_ndvi_history(lat, lon)
            if records:
                return records
        return []


@dataclass(frozen=True)
class NdviPointSeries:
    """A série de um ponto do arquivo, lida como o `get_ndvi_history` lê.

    `discarded` = linhas que a leitura deixou de fora (sem NDVI, neve ou nuvem).
    """

    lat: float
    lon: float
    records: tuple[NdviRecord, ...]
    discarded: int


def _distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância em metros sobre a esfera (haversine), com coordenadas WGS 84 em graus."""
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def _record(item: dict[str, Any]) -> NdviRecord | None:
    """Uma linha da série; None se não tiver NDVI ou se for neve ou nuvem (qualidade > 1)."""
    if item.get("ndvi") is None:
        return None
    qualidade = item.get("qualidade")
    if qualidade is not None and int(qualidade) > NDVI_WORST_ACCEPTED_QUALITY:
        return None
    return NdviRecord(
        data=date.fromisoformat(str(item["data"])),
        ndvi=float(item["ndvi"]),
        qualidade=None if qualidade is None else int(qualidade),
        produto=item.get("produto"),
    )


class CachedNdviRepository:
    """Lê a série de NDVI do arquivo do contrato (`NDVI_CACHE_PATH`).

    Formato novo: `versao_dados` + `pontos[].serie[{data, ndvi, qualidade, produto}]`, com o NDVI
    físico. Também aceita o cache antigo (`data` e `ndvi` bruto). Usa o ponto do arquivo mais perto
    do pedido, se estiver a até `max_distance_m`. Sem ponto perto (ou sem arquivo): série vazia, e
    o `/talhao` devolve `historico: null` (plano técnico §3.1).
    """

    def __init__(
        self, cache_path: Path | None, max_distance_m: float = NDVI_POINT_MAX_DISTANCE_M
    ) -> None:
        self._cache_path = cache_path
        self._max_distance_m = max_distance_m
        self._payload: dict[str, Any] | None = None

    def _load(self) -> dict[str, Any]:
        if self._payload is None:
            path = self._cache_path
            if path is None or not path.is_file():
                self._payload = {}
            else:
                self._payload = json.loads(path.read_text(encoding="utf-8"))
        return self._payload

    def _points(self) -> list[dict[str, Any]]:
        points: list[dict[str, Any]] = self._load().get("pontos", [])
        return points

    def get_data_run(self) -> DataRun | None:
        """A execução que gerou o arquivo (`versao_dados`); None sem arquivo ou no cache antigo."""
        versao_dados = self._load().get("versao_dados")
        return None if versao_dados is None else data_run_from_json(versao_dados)

    def list_point_series(self) -> list[NdviPointSeries]:
        """Todos os pontos do arquivo, na ordem dele, com a série lida (para a carga no banco)."""
        series: list[NdviPointSeries] = []
        for point in self._points():
            items = point.get("serie", [])
            records = tuple(rec for rec in (_record(item) for item in items) if rec is not None)
            series.append(
                NdviPointSeries(
                    lat=float(point["lat"]),
                    lon=float(point["lon"]),
                    records=records,
                    discarded=len(items) - len(records),
                )
            )
        return series

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        points = self._points()
        nearest = min(
            (
                (_distance_m(lat, lon, float(p["lat"]), float(p["lon"])), i)
                for i, p in enumerate(points)
            ),
            default=None,
        )
        if nearest is None or nearest[0] > self._max_distance_m:
            return []
        records = (_record(item) for item in points[nearest[1]].get("serie", []))
        return [rec for rec in records if rec is not None]


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
