"""Repository contract and implementations for climate series, SMAP, and CMIP6."""

import json
from datetime import date
from pathlib import Path
from typing import Any, Protocol

import psycopg

from app.constants import (
    DEFAULT_SRID,
    EXAMPLE_CELL_ID,
    GRID_CELL_HALF_SIZE_DEG,
    GRID_CELL_SCALE_FACTOR,
    PILOT_MAX_LAT,
    PILOT_MAX_LON,
    PILOT_MIN_LAT,
    PILOT_MIN_LON,
    RH_DEFAULT_PCT,
    SOLAR_RAD_DEFAULT_MJ,
    WIND_SPEED_DEFAULT_MS,
)
from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture


def compute_grid_cell_id(lat: float, lon: float) -> str:
    """Computes the canonical 0.1-degree grid cell identifier for a coordinate."""
    lat_idx = round(lat * GRID_CELL_SCALE_FACTOR)
    lon_idx = round(lon * GRID_CELL_SCALE_FACTOR)
    return f"{lat_idx}_{lon_idx}"


class ClimateRepository(Protocol):
    """Data access contract for meteorological series, SMAP, and CMIP6 projections."""

    def find_cell_id(self, lat: float, lon: float) -> str | None: ...

    def find_nearest_cell_id(self, lat: float, lon: float) -> str | None: ...

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None: ...

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]: ...

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta: ...

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None: ...


class DataOutputClimateRepository:
    """Reads pre-extracted NASA POWER, SMAP, and CMIP6 datasets with in-memory on-demand cache."""

    def __init__(self, data_output_dir: Path = Path("/workspace/data/output")) -> None:
        self._data_output_dir = data_output_dir
        self._seasons_cache: list[ClimateSeason] | None = None
        self._cmip6_cache: Cmip6Delta | None = None
        self._smap_cache: SmapSoilMoisture | None = None
        self._ingested_cells: dict[str, list[ClimateSeason]] = {}

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        candidate_id = compute_grid_cell_id(lat, lon)
        if candidate_id in self._ingested_cells:
            return candidate_id
        if PILOT_MIN_LAT <= lat <= PILOT_MAX_LAT and PILOT_MIN_LON <= lon <= PILOT_MAX_LON:
            return candidate_id
        return None

    def find_nearest_cell_id(self, lat: float, lon: float) -> str | None:
        return EXAMPLE_CELL_ID

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None:
        self._ingested_cells[cell_id] = list(seasons)

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        if cell_id in self._ingested_cells:
            return list(self._ingested_cells[cell_id])

        if self._seasons_cache is not None:
            return [
                ClimateSeason(
                    cell_id=cell_id,
                    year=s.year,
                    start_date=s.start_date,
                    rain_mm=s.rain_mm,
                    rain_source=s.rain_source,
                    tmax_c=s.tmax_c,
                    tmin_c=s.tmin_c,
                    eto_mm=s.eto_mm,
                    gwetroot=s.gwetroot,
                    tmean_c=s.tmean_c,
                    rh2m_pct=s.rh2m_pct,
                    ws2m_ms=s.ws2m_ms,
                    solar_rad_mj=s.solar_rad_mj,
                )
                for s in self._seasons_cache
            ]

        daily_path = self._data_output_dir / "historico_uberlandia_20anos_diario.json"
        payload: dict[str, Any] = json.loads(daily_path.read_text(encoding="utf-8"))
        rain_source = str(payload.get("fonte", "nasa_power"))
        years_map: dict[str, list[dict[str, Any]]] = payload.get("anos", {})

        seasons: list[ClimateSeason] = []
        for year_str in sorted(years_map.keys(), key=int):
            year = int(year_str)
            records = years_map[year_str]
            start_dt = date.fromisoformat(str(records[0]["date"])) if records else date(year, 1, 1)

            rain_list: list[float] = []
            tmax_list: list[float] = []
            tmin_list: list[float] = []
            tmean_list: list[float] = []
            rh_list: list[float] = []
            ws_list: list[float] = []
            rad_list: list[float] = []
            gwet_list: list[float] = []
            eto_list: list[float] = []

            for rec in records:
                rain = float(rec.get("PRECTOTCORR") or 0.0)
                tmax = float(rec.get("T2M_MAX") or 30.0)
                tmin = float(rec.get("T2M_MIN") or 18.0)
                tmean = float(rec.get("T2M") or ((tmax + tmin) / 2.0))
                rh = float(rec.get("RH2M") or RH_DEFAULT_PCT)
                ws = float(rec.get("WS2M") or WIND_SPEED_DEFAULT_MS)
                rad = float(rec.get("ALLSKY_SFC_SW_DWN") or SOLAR_RAD_DEFAULT_MJ)
                gwet = float(rec.get("GWETROOT") or 0.5)
                eto = float(
                    rec.get("ETO_MM")
                    or (0.0023 * (tmean + 17.8) * ((tmax - tmin) ** 0.5) * (rad * 0.408))
                )

                rain_list.append(rain)
                tmax_list.append(tmax)
                tmin_list.append(tmin)
                tmean_list.append(tmean)
                rh_list.append(rh)
                ws_list.append(ws)
                rad_list.append(rad)
                gwet_list.append(gwet)
                eto_list.append(round(eto, 3))

            seasons.append(
                ClimateSeason(
                    cell_id=cell_id,
                    year=year,
                    start_date=start_dt,
                    rain_mm=tuple(rain_list),
                    rain_source=rain_source,
                    tmax_c=tuple(tmax_list),
                    tmin_c=tuple(tmin_list),
                    eto_mm=tuple(eto_list),
                    gwetroot=tuple(gwet_list),
                    tmean_c=tuple(tmean_list),
                    rh2m_pct=tuple(rh_list),
                    ws2m_ms=tuple(ws_list),
                    solar_rad_mj=tuple(rad_list),
                )
            )

        self._seasons_cache = seasons
        return list(seasons)

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta:
        if self._cmip6_cache is not None:
            return Cmip6Delta(
                cell_id=cell_id,
                cenario=self._cmip6_cache.cenario,
                modelos_referencia=self._cmip6_cache.modelos_referencia,
                aumento_temperatura_media_c=self._cmip6_cache.aumento_temperatura_media_c,
                variacao_chuva_safrinha_pct=self._cmip6_cache.variacao_chuva_safrinha_pct,
                aumento_dias_calor_extremo_ge_35c=self._cmip6_cache.aumento_dias_calor_extremo_ge_35c,
            )

        cmip_path = self._data_output_dir / "cmip6_projecao_2050.json"
        payload: dict[str, Any] = json.loads(cmip_path.read_text(encoding="utf-8"))
        delta_raw: dict[str, Any] = payload["delta_climatico_safrinha"]

        delta = Cmip6Delta(
            cell_id=cell_id,
            cenario=str(payload.get("cenario", "SSP2-4.5")),
            modelos_referencia=tuple(str(m) for m in payload.get("modelos_referencia", [])),
            aumento_temperatura_media_c=float(delta_raw["aumento_temperatura_media_c"]),
            variacao_chuva_safrinha_pct=float(delta_raw["variacao_chuva_safrinha_pct"]),
            aumento_dias_calor_extremo_ge_35c=float(delta_raw["aumento_dias_calor_extremo_ge_35c"]),
        )
        self._cmip6_cache = delta
        return delta

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        if self._smap_cache is not None:
            return SmapSoilMoisture(
                data=self._smap_cache.data,
                latitude=lat,
                longitude=lon,
                sm_surface_m3_m3=self._smap_cache.sm_surface_m3_m3,
                sm_rootzone_m3_m3=self._smap_cache.sm_rootzone_m3_m3,
                sm_rootzone_wetness=self._smap_cache.sm_rootzone_wetness,
                fonte=self._smap_cache.fonte,
            )

        smap_path = self._data_output_dir / "smap_uberlandia_2024_safra.json"
        if not smap_path.exists():
            return None

        payload: dict[str, Any] = json.loads(smap_path.read_text(encoding="utf-8"))
        registros: list[dict[str, Any]] = payload.get("registros", [])
        if not registros:
            return None

        latest = registros[-1]
        smap = SmapSoilMoisture(
            data=date.fromisoformat(str(latest["date"])),
            latitude=lat,
            longitude=lon,
            sm_surface_m3_m3=float(latest["sm_surface_m3_m3"]),
            sm_rootzone_m3_m3=float(latest["sm_rootzone_m3_m3"]),
            sm_rootzone_wetness=float(latest["sm_rootzone_wetness"]),
            fonte=str(payload.get("fonte", "nasa_smap_l4")),
        )
        self._smap_cache = smap
        return smap


class PostgisClimateRepository:
    """PostgreSQL + PostGIS repository supporting spatial cache-aside and KNN fallback."""

    def __init__(
        self,
        database_url: str,
        fallback_repo: DataOutputClimateRepository | None = None,
    ) -> None:
        self._database_url = database_url
        self._fallback = fallback_repo or DataOutputClimateRepository()

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
            return str(row[0]) if row else None

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
            return str(row[0]) if row else self._fallback.find_nearest_cell_id(lat, lon)

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
            if not rows:
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

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta:
        return self._fallback.get_cmip6_delta(cell_id)

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        return self._fallback.get_latest_smap(lat, lon)
