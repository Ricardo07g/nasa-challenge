"""Contrato e implementação do acesso à textura do solo (SoilGrids) por ponto."""

from pathlib import Path
from typing import Any, Protocol

import psycopg

from app.constants import (
    CAD_CLAYEY_MM,
    CAD_MEDIUM_MM,
    CAD_SANDY_MM,
    CLAY_THRESHOLD_PCT,
    DEFAULT_CLAY_PCT,
    DEFAULT_SAND_PCT,
    DEFAULT_SRID,
    SAND_THRESHOLD_PCT,
)
from app.models.raio_x import SoloVizinho
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import cell_bounds, cell_id_for
from app.repositories.point_cache import load_points, point_key


class SoilRepository(Protocol):
    """Acesso à textura do solo e à água disponível (CAD) de um ponto."""

    def get_soil(self, lat: float, lon: float) -> SoloInfo: ...


class WritableSoilRepository(SoilRepository, Protocol):
    """Solo que também grava pontos novos (PostGIS), usado pela busca sob demanda."""

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None: ...


def classify_soil_texture(argila_pct: float, areia_pct: float) -> tuple[str, float]:
    """Textura e CAD (mm) pela argila e areia de 0-30 cm (PRD 6.4)."""
    if argila_pct > CLAY_THRESHOLD_PCT:
        return "argiloso", CAD_CLAYEY_MM
    if areia_pct > SAND_THRESHOLD_PCT:
        return "arenoso", CAD_SANDY_MM
    return "medio", CAD_MEDIUM_MM


DEFAULT_SOIL = SoloInfo(
    argila_percentual=DEFAULT_CLAY_PCT,
    areia_percentual=DEFAULT_SAND_PCT,
    textura_solo="medio",
    cad_capacidade_agua_mm=CAD_MEDIUM_MM,
    fonte="padrao",
)


class CachedSoilGridsRepository:
    """Lê a argila e a areia do SoilGrids de um cache JSON por ponto.

    Ponto fora do cache (ou sem cache configurado) recebe solo médio com `fonte: padrao`,
    como manda o plano técnico §3.1, e nunca o solo de outro talhão.
    """

    def __init__(self, cache_path: Path | None) -> None:
        self._cache_path = cache_path
        self._points: dict[str, dict[str, Any]] | None = None

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        if self._points is None:
            self._points = load_points(self._cache_path)
        point = self._points.get(point_key(lat, lon))
        if point is None:
            return DEFAULT_SOIL
        argila = float(point["argila_pct"])
        areia = float(point["areia_pct"])
        textura, cad = classify_soil_texture(argila, areia)
        return SoloInfo(
            argila_percentual=argila,
            areia_percentual=areia,
            textura_solo=textura,
            cad_capacidade_agua_mm=cad,
            fonte="soilgrids",
        )


class PostgisSoilRepository:
    """Solo por ponto na tabela `soil_point`, com o solo da célula de 0,1° como reserva.

    Ordem da busca em `get_soil` (tarefa 0012, R1.5):

    1. o ponto exato (chave de 0,0025°, ~250 m) no banco;
    2. o ponto exato no cache de arquivo (`fallback`), como antes;
    3. o ponto gravado mais próximo **dentro da mesma célula de 0,1°** (a pré-carga grava o
       centro de cada célula da caixa piloto); ponto de célula vizinha nunca entra;
    4. o solo padrão (`fonte: padrao`).
    """

    def __init__(
        self, database_url: str, fallback: CachedSoilGridsRepository | None = None
    ) -> None:
        self._database_url = database_url
        self._fallback = fallback or CachedSoilGridsRepository(None)

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        key = point_key(lat, lon)
        with psycopg.connect(self._database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO soil_point (
                        key, geom, argila_percentual, areia_percentual,
                        textura_solo, cad_capacidade_agua_mm
                    )
                    VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), %s), %s, %s, %s, %s)
                    ON CONFLICT (key) DO UPDATE
                    SET argila_percentual = EXCLUDED.argila_percentual,
                        areia_percentual = EXCLUDED.areia_percentual,
                        textura_solo = EXCLUDED.textura_solo,
                        cad_capacidade_agua_mm = EXCLUDED.cad_capacidade_agua_mm;
                    """,
                    (
                        key,
                        lon,
                        lat,
                        DEFAULT_SRID,
                        soil.argila_percentual,
                        soil.areia_percentual,
                        soil.textura_solo,
                        soil.cad_capacidade_agua_mm,
                    ),
                )
            conn.commit()

    def has_point(self, lat: float, lon: float) -> bool:
        """O ponto (pela chave de 0,0025°) já tem solo gravado? Não olha o resto da célula."""
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute("SELECT 1 FROM soil_point WHERE key = %s LIMIT 1;", (point_key(lat, lon),))
            return cur.fetchone() is not None

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        key = point_key(lat, lon)
        lat_min, lat_max, lon_min, lon_max = cell_bounds(cell_id_for(lat, lon))
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            # Uma ida ao banco: o ponto exato primeiro; senão, o mais próximo da mesma célula
            # (intervalo meio aberto, como o floor do id: a borda de cima é da célula vizinha).
            cur.execute(
                """
                SELECT argila_percentual, areia_percentual, textura_solo,
                       cad_capacidade_agua_mm, key = %(key)s AS exact
                FROM soil_point
                WHERE key = %(key)s
                   OR (geom && ST_MakeEnvelope(
                           %(lon_min)s, %(lat_min)s, %(lon_max)s, %(lat_max)s, %(srid)s)
                       AND ST_Y(geom) >= %(lat_min)s AND ST_Y(geom) < %(lat_max)s
                       AND ST_X(geom) >= %(lon_min)s AND ST_X(geom) < %(lon_max)s)
                ORDER BY exact DESC,
                         geom <-> ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), %(srid)s)
                LIMIT 1;
                """,
                {
                    "key": key,
                    "lat": lat,
                    "lon": lon,
                    "lat_min": lat_min,
                    "lat_max": lat_max,
                    "lon_min": lon_min,
                    "lon_max": lon_max,
                    "srid": DEFAULT_SRID,
                },
            )
            row = cur.fetchone()
        if row is not None and row[4]:
            return _soilgrids_soil(row)
        from_file = self._fallback.get_soil(lat, lon)
        if row is None or from_file.fonte != DEFAULT_SOIL.fonte:
            return from_file
        return _soilgrids_soil(row)

    def get_nearest_soil(self, lat: float, lon: float) -> SoloVizinho | None:
        """O ponto gravado mais perto, de qualquer célula, e a distância até ele (raio-X, 0043).

        Não entra no `get_soil` (o motor nunca usa solo de célula vizinha): só o raio-X mostra,
        dizendo que é da vizinha. Tabela vazia: None.
        """
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT argila_percentual, areia_percentual, textura_solo,
                       cad_capacidade_agua_mm,
                       ST_Distance(geom::geography,
                                   ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), %(srid)s)::geography)
                FROM soil_point
                ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), %(srid)s)
                LIMIT 1;
                """,
                {"lat": lat, "lon": lon, "srid": DEFAULT_SRID},
            )
            row = cur.fetchone()
        if row is None:
            return None
        return SoloVizinho(soil=_soilgrids_soil(row), distancia_km=float(row[4]) / 1000.0)


class NearestSoilRepository(Protocol):
    """O solo gravado mais perto do ponto, de qualquer célula (raio-X, tarefa 0043)."""

    def get_nearest_soil(self, lat: float, lon: float) -> SoloVizinho | None: ...


def _soilgrids_soil(row: tuple[Any, ...]) -> SoloInfo:
    """Linha do `soil_point` como solo: tudo o que está na tabela veio do SoilGrids."""
    return SoloInfo(
        argila_percentual=float(row[0]),
        areia_percentual=float(row[1]),
        textura_solo=str(row[2]),
        cad_capacidade_agua_mm=float(row[3]),
        fonte="soilgrids",
    )
