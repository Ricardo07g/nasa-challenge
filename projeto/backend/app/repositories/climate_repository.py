"""Contrato e implementação do acesso às séries de clima por célula e aos deltas do CMIP6."""

import json
import math
from datetime import date
from pathlib import Path
from typing import Any, Protocol

import psycopg

from app.constants import (
    DEFAULT_SRID,
    GRID_CELL_HALF_SIZE_DEG,
    GRID_CELL_SCALE_FACTOR,
)
from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture


def compute_grid_cell_id(lat: float, lon: float) -> str:
    """Computes the canonical 0.1-degree grid cell identifier for a coordinate."""
    lat_idx = round(lat * GRID_CELL_SCALE_FACTOR)
    lon_idx = round(lon * GRID_CELL_SCALE_FACTOR)
    return f"{lat_idx}_{lon_idx}"


class ClimateRepository(Protocol):
    """Acesso às séries de clima (por célula de 0,1°) e às projeções do CMIP6."""

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        """Id da célula do ponto, ou None quando não há dados preparados para ele."""
        ...

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]: ...

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]: ...


def cell_id_for(lat: float, lon: float) -> str:
    """Id da célula de 0,1° (plano técnico §5): "<floor(lat*10)>_<floor(lon*10)>"."""
    lat_idx = math.floor(round(lat * GRID_CELL_SCALE_FACTOR, 6))
    lon_idx = math.floor(round(lon * GRID_CELL_SCALE_FACTOR, 6))
    return f"{lat_idx}_{lon_idx}"


class FixtureClimateRepository:
    """Lê as temporadas de um arquivo JSON gerado pelo pipeline (fazenda de exemplo).

    O arquivo traz a série de um ponto e a área que ela representa (`cobertura`: a célula do
    NASA POWER, que devolve o mesmo valor para qualquer ponto dentro dela). Fora dessa área o
    repositório responde que não há dados, em vez de devolver o clima de outra região.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._payload: dict[str, Any] | None = None

    def _load(self) -> dict[str, Any]:
        if self._payload is None:
            self._payload = json.loads(self._path.read_text(encoding="utf-8"))
        return self._payload

    def _covers(self, lat: float, lon: float) -> bool:
        box = self._load()["cobertura"]
        return box["lat_min"] <= lat < box["lat_max"] and box["lon_min"] <= lon < box["lon_max"]

    def _covers_cell(self, cell_id: str) -> bool:
        try:
            lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))
        except ValueError:
            return False
        center_lat = (lat_idx + 0.5) / GRID_CELL_SCALE_FACTOR
        center_lon = (lon_idx + 0.5) / GRID_CELL_SCALE_FACTOR
        return self._covers(center_lat, center_lon)

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return cell_id_for(lat, lon) if self._covers(lat, lon) else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        if not self._covers_cell(cell_id):
            return []
        payload = self._load()
        lat = float(payload["ponto"]["lat"])
        source = str(payload["fonte"])
        return [
            ClimateSeason(
                cell_id=cell_id,
                year=int(item["ano"]),
                start_date=date.fromisoformat(item["inicio"]),
                lat=lat,
                rain_mm=tuple(float(v) for v in item["chuva_mm"]),
                rain_source=source,
                tmax_c=tuple(float(v) for v in item["tmax_c"]),
                tmin_c=tuple(float(v) for v in item["tmin_c"]),
                eto_mm=tuple(float(v) for v in item.get("eto_mm", [])),
            )
            for item in payload["temporadas"]
        ]

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        if not self._covers_cell(cell_id):
            return []
        return [
            Cmip6Delta(
                model=str(item["modelo"]),
                scenario=str(item["cenario"]),
                month=int(item["mes"]),
                rain_pct=float(item["chuva_pct"]),
                tmax_c=float(item["tmax_c"]),
            )
            for item in self._load().get("cmip6", [])
        ]


class PostgisClimateRepository:
    """PostgreSQL + PostGIS repository supporting spatial cache-aside and KNN fallback."""

    def __init__(
        self,
        database_url: str,
        fallback_repo: ClimateRepository | None = None,
    ) -> None:
        self._database_url = database_url
        self._fallback = fallback_repo

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM grid_cell
                WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint(%s, %s), %s))
                LIMIT 1;
                """,
                (lon, lat, DEFAULT_SRID),
            )
            row = cur.fetchone()
            if row:
                return str(row[0])
        return self._fallback.find_cell_id(lat, lon) if self._fallback else None

    def find_nearest_cell_id(self, lat: float, lon: float) -> str | None:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM grid_cell
                ORDER BY ST_ClosestPoint(geom, ST_SetSRID(ST_MakePoint(%s, %s), %s))
                         <-> ST_SetSRID(ST_MakePoint(%s, %s), %s)
                LIMIT 1;
                """,
                (lon, lat, DEFAULT_SRID, lon, lat, DEFAULT_SRID),
            )
            row = cur.fetchone()
            if row:
                return str(row[0])
        if self._fallback and hasattr(self._fallback, "find_nearest_cell_id"):
            return self._fallback.find_nearest_cell_id(lat, lon)
        return None

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None:
        lat_c = round(lat * GRID_CELL_SCALE_FACTOR) / GRID_CELL_SCALE_FACTOR
        lon_c = round(lon * GRID_CELL_SCALE_FACTOR) / GRID_CELL_SCALE_FACTOR
        h = GRID_CELL_HALF_SIZE_DEG
        poly_wkt = (
            f"POLYGON(({lon_c - h} {lat_c - h}, {lon_c + h} {lat_c - h}, "
            f"{lon_c + h} {lat_c + h}, {lon_c - h} {lat_c + h}, {lon_c - h} {lat_c - h}))"
        )
        point_wkt = f"POINT({lon_c} {lat_c})"

        with psycopg.connect(self._database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO grid_cell (id, geom, center)
                    VALUES (%s, ST_GeomFromText(%s, %s), ST_GeomFromText(%s, %s))
                    ON CONFLICT (id) DO UPDATE
                    SET geom = EXCLUDED.geom, center = EXCLUDED.center;
                    """,
                    (cell_id, poly_wkt, DEFAULT_SRID, point_wkt, DEFAULT_SRID),
                )
                for s in seasons:
                    cur.execute(
                        """
                        INSERT INTO climate_season (
                            cell_id, year, start_date, rain_mm, rain_source,
                            tmax_c, tmin_c, tmean_c, rh2m_pct, ws2m_ms,
                            solar_rad_mj, gwetroot, eto_mm
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (cell_id, year) DO UPDATE
                        SET rain_mm = EXCLUDED.rain_mm,
                            tmax_c = EXCLUDED.tmax_c,
                            tmin_c = EXCLUDED.tmin_c,
                            eto_mm = EXCLUDED.eto_mm;
                        """,
                        (
                            cell_id,
                            s.year,
                            s.start_date,
                            list(s.rain_mm),
                            s.rain_source,
                            list(s.tmax_c),
                            list(s.tmin_c),
                            list(s.tmean_c),
                            list(s.rh2m_pct),
                            list(s.ws2m_ms),
                            list(s.solar_rad_mj),
                            list(s.gwetroot),
                            list(s.eto_mm),
                        ),
                    )
            conn.commit()

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT year, start_date, rain_mm, rain_source, tmax_c, tmin_c,
                       eto_mm, COALESCE(gwetroot, '{}'), COALESCE(tmean_c, '{}'),
                       COALESCE(rh2m_pct, '{}'), COALESCE(ws2m_ms, '{}'),
                       COALESCE(solar_rad_mj, '{}')
                FROM climate_season
                WHERE cell_id = %s
                ORDER BY year ASC;
                """,
                (cell_id,),
            )
            rows = cur.fetchall()
            if not rows and self._fallback:
                return self._fallback.get_seasons(cell_id)
            return [
                ClimateSeason(
                    cell_id=cell_id,
                    year=int(r[0]),
                    start_date=r[1],
                    rain_mm=tuple(float(v) for v in r[2]),
                    rain_source=str(r[3]),
                    tmax_c=tuple(float(v) for v in r[4]),
                    tmin_c=tuple(float(v) for v in r[5]),
                    eto_mm=tuple(float(v) for v in r[6]),
                    gwetroot=tuple(float(v) for v in r[7]),
                    tmean_c=tuple(float(v) for v in r[8]),
                    rh2m_pct=tuple(float(v) for v in r[9]),
                    ws2m_ms=tuple(float(v) for v in r[10]),
                    solar_rad_mj=tuple(float(v) for v in r[11]),
                )
                for r in rows
            ]

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        if self._fallback:
            return self._fallback.get_cmip6_deltas(cell_id)
        return []

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        if self._fallback and hasattr(self._fallback, "get_latest_smap"):
            return self._fallback.get_latest_smap(lat, lon)
        return None
