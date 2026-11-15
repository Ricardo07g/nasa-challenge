"""Contrato e implementação do acesso às séries de clima por célula e aos deltas do CMIP6."""

import json
import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol

import psycopg

from app.constants import DEFAULT_SRID, GRID_CELL_SCALE_FACTOR
from app.models.climate import CellRainTotal, ClimateSeason, Cmip6Delta, SmapSoilMoisture

if TYPE_CHECKING:
    # Só o tipo: o cmip6_repository importa daqui as funções da célula (sem import circular).
    from app.repositories.cmip6_repository import Cmip6Repository


class ClimateRepository(Protocol):
    """Acesso às séries de clima (por célula de 0,1°) e às projeções do CMIP6."""

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        """Id da célula do ponto, ou None quando não há dados preparados para ele."""
        ...

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]: ...

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]: ...


class WritableClimateRepository(ClimateRepository, Protocol):
    """Clima que também grava células novas (PostGIS). A busca sob demanda só existe com ele."""

    def find_nearest_cell_id(self, lat: float, lon: float) -> str | None: ...

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None: ...


@dataclass(frozen=True)
class SeasonWindow:
    """Onde uma temporada gravada começa e quantos dias tem (sem as séries)."""

    cell_id: str
    year: int
    start_date: date
    days: int


def cell_id_for(lat: float, lon: float) -> str:
    """Id da célula de 0,1° (plano técnico §5): "<floor(lat*10)>_<floor(lon*10)>".

    É a única regra de id do backend: ingestão, repositories e polígono da célula usam esta função.
    """
    lat_idx = math.floor(round(lat * GRID_CELL_SCALE_FACTOR, 6))
    lon_idx = math.floor(round(lon * GRID_CELL_SCALE_FACTOR, 6))
    return f"{lat_idx}_{lon_idx}"


def _cell_indexes(cell_id: str) -> tuple[int, int]:
    lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))
    return lat_idx, lon_idx


def cell_center(cell_id: str) -> tuple[float, float]:
    """Centro (lat, lon) da célula: ((idx + 0,5) / 10). Id mal formado dá ValueError."""
    lat_idx, lon_idx = _cell_indexes(cell_id)
    return (lat_idx + 0.5) / GRID_CELL_SCALE_FACTOR, (lon_idx + 0.5) / GRID_CELL_SCALE_FACTOR


def cell_bounds(cell_id: str) -> tuple[float, float, float, float]:
    """Limites (lat_min, lat_max, lon_min, lon_max) da célula: idx/10 até (idx + 1)/10.

    O ponto é da célula quando `lat_min <= lat < lat_max` e `lon_min <= lon < lon_max` (floor).
    """
    lat_idx, lon_idx = _cell_indexes(cell_id)
    return (
        lat_idx / GRID_CELL_SCALE_FACTOR,
        (lat_idx + 1) / GRID_CELL_SCALE_FACTOR,
        lon_idx / GRID_CELL_SCALE_FACTOR,
        (lon_idx + 1) / GRID_CELL_SCALE_FACTOR,
    )


def cell_polygon_wkt(cell_id: str) -> str:
    """Quadrado da célula em WKT (lon lat), com bordas nos décimos: idx/10 até (idx + 1)/10."""
    lat_min, lat_max, lon_min, lon_max = cell_bounds(cell_id)
    return (
        f"POLYGON(({lon_min} {lat_min}, {lon_max} {lat_min}, {lon_max} {lat_max}, "
        f"{lon_min} {lat_max}, {lon_min} {lat_min}))"
    )


def cell_center_wkt(cell_id: str) -> str:
    """Centro da célula em WKT (lon lat)."""
    lat, lon = cell_center(cell_id)
    return f"POINT({lon} {lat})"


def cmip6_delta_from_json(item: dict[str, Any]) -> Cmip6Delta:
    """Um item da lista `cmip6[]` do contrato CMIP6 (chaves em português) como `Cmip6Delta`.

    `tmin_c` é opcional: ausente ou `null` fica `None` (o model valida o resto).
    """
    tmin_c = item.get("tmin_c")
    return Cmip6Delta(
        model=str(item["modelo"]),
        scenario=str(item["cenario"]),
        month=int(item["mes"]),
        rain_pct=float(item["chuva_pct"]),
        tmax_c=float(item["tmax_c"]),
        tmin_c=None if tmin_c is None else float(tmin_c),
    )


class FixtureClimateRepository:
    """Lê as temporadas de um arquivo JSON gerado pelo pipeline (fazenda de exemplo).

    O arquivo traz a série de um ponto e a área que ela representa (`cobertura`: a célula do
    NASA POWER, que devolve o mesmo valor para qualquer ponto dentro dela). Fora dessa área o
    repositório responde que não há dados, em vez de devolver o clima de outra região.

    Deltas do CMIP6 (sem banco): primeiro o arquivo dos deltas (`cmip6_file_repo`, o `CMIP6_PATH`),
    depois a lista `cmip6[]` da própria fixture.
    """

    def __init__(self, path: Path, cmip6_file_repo: "Cmip6Repository | None" = None) -> None:
        self._path = path
        self._cmip6_file_repo = cmip6_file_repo
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
            center_lat, center_lon = cell_center(cell_id)
        except ValueError:
            return False
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
        if self._cmip6_file_repo is not None:
            deltas = self._cmip6_file_repo.get_cmip6_deltas(cell_id)
            if deltas:
                return deltas
        if not self._covers_cell(cell_id):
            return []
        return [cmip6_delta_from_json(item) for item in self._load().get("cmip6", [])]


class PostgisClimateRepository:
    """PostgreSQL + PostGIS repository supporting spatial cache-aside and KNN fallback.

    Deltas do CMIP6 da célula, nesta ordem: tabela `cmip6_delta` (`cmip6_repo`), arquivo dos
    deltas (`cmip6_file_repo`, o `CMIP6_PATH`) e a reserva (`fallback_repo`, a fixture).
    """

    def __init__(
        self,
        database_url: str,
        fallback_repo: ClimateRepository | None = None,
        cmip6_repo: "Cmip6Repository | None" = None,
        cmip6_file_repo: "Cmip6Repository | None" = None,
    ) -> None:
        self._database_url = database_url
        self._fallback = fallback_repo
        self._cmip6_repo = cmip6_repo
        self._cmip6_file_repo = cmip6_file_repo

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        # Pelo id (mesma regra da ingestão): um ponto na borda entre duas células não fica ambíguo.
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute("SELECT id FROM grid_cell WHERE id = %s;", (cell_id_for(lat, lon),))
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

    def list_cell_ids(self) -> list[str]:
        """Ids de todas as células em `grid_cell`, em ordem (só o banco, nunca a reserva).

        Usado pela carga dos arquivos no banco (`pipeline/load_files_to_db.py`): o `cmip6_delta`
        só aceita célula que já está aqui.
        """
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute("SELECT id FROM grid_cell ORDER BY id;")
            return [str(row[0]) for row in cur.fetchall()]

    def list_season_windows(self) -> list[SeasonWindow]:
        """Início e número de dias de cada temporada do `climate_season` (só o banco).

        Usado pela carga do IMERG: a chuva nova só entra numa temporada da mesma janela.
        """
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT cell_id, year, start_date, COALESCE(cardinality(rain_mm), 0)
                FROM climate_season
                ORDER BY cell_id, year;
                """
            )
            return [
                SeasonWindow(cell_id=str(r[0]), year=int(r[1]), start_date=r[2], days=int(r[3]))
                for r in cur.fetchall()
            ]

    def replace_seasons_rain(
        self, rain_source: str, rains: Mapping[tuple[str, int], tuple[float, ...]]
    ) -> int:
        """Troca a chuva (e a fonte dela) das temporadas `(célula, ano)` que já estão no banco.

        Não cria temporada nem mexe nas outras séries. Uma transação só. Devolve quantas trocou.
        """
        replaced = 0
        with psycopg.connect(self._database_url) as conn:
            with conn.cursor() as cur:
                for (cell_id, year), rain_mm in rains.items():
                    cur.execute(
                        """
                        UPDATE climate_season SET rain_mm = %s, rain_source = %s
                        WHERE cell_id = %s AND year = %s;
                        """,
                        (list(rain_mm), rain_source, cell_id, year),
                    )
                    replaced += cur.rowcount
            conn.commit()
        return replaced

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None:
        # A geometria sai do id (floor), não do ponto clicado: o polígono contém o ponto.
        poly_wkt = cell_polygon_wkt(cell_id)
        point_wkt = cell_center_wkt(cell_id)

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
                            rain_source = EXCLUDED.rain_source,
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
            # O banco não guarda a latitude da série: usa o centro da célula (a ETo depende dela).
            center_lat, _ = cell_center(cell_id)
            return [
                ClimateSeason(
                    cell_id=cell_id,
                    year=int(r[0]),
                    start_date=r[1],
                    lat=center_lat,
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
        for source in (self._cmip6_repo, self._cmip6_file_repo, self._fallback):
            if source is None:
                continue
            deltas = source.get_cmip6_deltas(cell_id)
            if deltas:
                return deltas
        return []

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        if self._fallback and hasattr(self._fallback, "get_latest_smap"):
            return self._fallback.get_latest_smap(lat, lon)
        return None

    def rain_totals_in_window(
        self, inicio: str, fim: str, box: tuple[float, float, float, float]
    ) -> list[CellRainTotal]:
        """Chuva somada de `inicio` a `fim` ("MM-DD", inclusivos) em cada célula e ano gravados
        cujo centro fica na caixa (`lat_min`, `lat_max`, `lon_min`, `lon_max`). Só o banco.

        O recorte do vetor vai do dia `inicio` ao dia `fim` de cada ano (o PostgreSQL corta o
        que passa do fim da temporada); `dias` diz quantos dias o recorte teve.
        """
        (m1, d1), (m2, d2) = (tuple(int(p) for p in text.split("-")) for text in (inicio, fim))
        lat_min, lat_max, lon_min, lon_max = box
        with psycopg.connect(self._database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT cs.cell_id, cs.year, cs.rain_source,
                       COALESCE((SELECT SUM(v) FROM unnest(cs.rain_mm[w.lo:w.hi]) AS v), 0),
                       COALESCE(cardinality(cs.rain_mm[w.lo:w.hi]), 0)
                FROM climate_season cs
                JOIN grid_cell g ON g.id = cs.cell_id
                CROSS JOIN LATERAL (
                    SELECT (make_date(cs.year, %(m1)s, %(d1)s) - cs.start_date) + 1 AS lo,
                           (make_date(cs.year, %(m2)s, %(d2)s) - cs.start_date) + 1 AS hi
                ) AS w
                WHERE ST_Intersects(
                    g.center,
                    ST_MakeEnvelope(%(lon_min)s, %(lat_min)s, %(lon_max)s, %(lat_max)s, %(srid)s)
                )
                ORDER BY cs.cell_id, cs.year;
                """,
                {
                    "m1": m1,
                    "d1": d1,
                    "m2": m2,
                    "d2": d2,
                    "lat_min": lat_min,
                    "lat_max": lat_max,
                    "lon_min": lon_min,
                    "lon_max": lon_max,
                    "srid": DEFAULT_SRID,
                },
            )
            return [
                CellRainTotal(
                    cell_id=str(r[0]),
                    year=int(r[1]),
                    rain_source=str(r[2]),
                    total_mm=float(r[3]),
                    dias=int(r[4]),
                )
                for r in cur.fetchall()
            ]


class RegionRainRepository(Protocol):
    """Chuva somada numa janela de dias por célula e ano numa caixa (raio-X, tarefa 0043)."""

    def rain_totals_in_window(
        self, inicio: str, fim: str, box: tuple[float, float, float, float]
    ) -> list[CellRainTotal]: ...
