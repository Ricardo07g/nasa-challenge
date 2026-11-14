"""Repository contract and implementations for SoilGrids 250m soil properties."""

import json
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
    SOIL_POINT_ROUND_DECIMALS,
)
from app.models.talhao import SoloInfo


def compute_soil_point_key(lat: float, lon: float) -> str:
    """Computes rounded spatial cache key (~250m resolution) for a soil point."""
    return f"{round(lat, SOIL_POINT_ROUND_DECIMALS)}_{round(lon, SOIL_POINT_ROUND_DECIMALS)}"


class SoilRepository(Protocol):
    """Data access contract for soil texture and water holding capacity (CAD)."""

    def get_soil(self, lat: float, lon: float) -> SoloInfo: ...

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None: ...


def classify_soil_texture(argila_pct: float, areia_pct: float) -> tuple[str, float]:
    """Classifies soil texture and available water capacity (CAD in mm) from clay and sand %.

    Args:
        argila_pct: Clay content percentage (0-100) in the 0-30cm layer.
        areia_pct: Sand content percentage (0-100) in the 0-30cm layer.

    Returns:
        A tuple of (textura_solo, cad_capacidade_agua_mm).
    """
    if argila_pct > CLAY_THRESHOLD_PCT:
        return "argiloso", CAD_CLAYEY_MM
    if areia_pct > SAND_THRESHOLD_PCT:
        return "arenoso", CAD_SANDY_MM
    return "medio", CAD_MEDIUM_MM


class CachedSoilGridsRepository:
    """Reads SoilGrids soil properties from local cache JSON and in-memory ingested points."""

    def __init__(
        self,
        fallback_json_path: Path = Path("/workspace/data/output/soilgrids_talhao.json"),
    ) -> None:
        self._fallback_json_path = fallback_json_path
        self._cached_soil: SoloInfo | None = None
        self._ingested_soils: dict[str, SoloInfo] = {}

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        key = compute_soil_point_key(lat, lon)
        self._ingested_soils[key] = soil

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        key = compute_soil_point_key(lat, lon)
        if key in self._ingested_soils:
            return self._ingested_soils[key]

        if self._cached_soil is not None:
            return self._cached_soil

        if self._fallback_json_path.exists():
            payload: dict[str, Any] = json.loads(
                self._fallback_json_path.read_text(encoding="utf-8")
            )
            argila = float(payload.get("argila_percentual", DEFAULT_CLAY_PCT))
            areia = float(payload.get("areia_percentual", DEFAULT_SAND_PCT))
            textura, cad = classify_soil_texture(argila, areia)
            self._cached_soil = SoloInfo(
                argila_percentual=argila,
                areia_percentual=areia,
                textura_solo=str(payload.get("textura_solo", textura)),
                cad_capacidade_agua_mm=float(payload.get("cad_capacidade_agua_mm", cad)),
                fonte=str(payload.get("fonte", "soilgrids")),
            )
            return self._cached_soil

        return SoloInfo(
            argila_percentual=DEFAULT_CLAY_PCT,
            areia_percentual=DEFAULT_SAND_PCT,
            textura_solo="medio",
            cad_capacidade_agua_mm=CAD_MEDIUM_MM,
            fonte="padrao",
        )


class PostgisSoilRepository:
    """PostgreSQL + PostGIS repository for soil_point table."""

    def __init__(
        self, database_url: str, fallback: CachedSoilGridsRepository | None = None
    ) -> None:
        self._database_url = database_url
        self._fallback = fallback or CachedSoilGridsRepository()

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        key = compute_soil_point_key(lat, lon)
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

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        key = compute_soil_point_key(lat, lon)
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT argila_percentual, areia_percentual, textura_solo, cad_capacidade_agua_mm
                FROM soil_point
                WHERE key = %s
                LIMIT 1;
                """,
                (key,),
            )
            row = cur.fetchone()
            if row:
                return SoloInfo(
                    argila_percentual=float(row[0]),
                    areia_percentual=float(row[1]),
                    textura_solo=str(row[2]),
                    cad_capacidade_agua_mm=float(row[3]),
                    fonte="soilgrids",
                )
        return self._fallback.get_soil(lat, lon)
