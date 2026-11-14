"""Gera os deltas mensais do NEX-GDDP-CMIP6 por ponto (R2.1 do roteiro, tarefas 0014 e 0023).

Uso (a partir de projeto/backend):

    uv run python -m pipeline.fetch_cmip6_deltas --dry-run --area  # pedidos e tempo nos dois modos
    uv run python -m pipeline.fetch_cmip6_deltas --area            # caixa piloto inteira (~45 min)
    uv run python -m pipeline.fetch_cmip6_deltas --pontos="-18.9543,-48.1993" --modelos ACCESS-CM2

Para cada modelo, pede ao THREDDS da NCCS a série diária de `pr`, `tasmax` e `tasmin` de 1/jan a
31/jul, um arquivo por ano: 1995–2014 (historical) e 2041–2060 (SSP2-4.5). Dois modos:

- **por ponto** (padrão): NetcdfSubset (NCSS), um ponto por pedido, em CSV. O NCSS devolve o pixel
  de 0,25° mais próximo do ponto;
- **por área** (`--area`): OPeNDAP em ASCII, um pedido por arquivo com o retângulo de pixels que
  cobre todos os pontos, mais um DAS (atributos: unidade e eixo do tempo) por variável e período.
  Cada ponto usa o mesmo pixel que o NCSS escolheria, então o resultado de cada ponto é o mesmo do
  modo por ponto. O custo de um pedido cresce com o número de dias, não com a área: a caixa piloto
  sai com 12 vezes menos pedidos.

Delta por modelo e mês (PRD 7.3, método do delta):

- `chuva_pct` = (média diária futura ÷ média diária base − 1) × 100;
- `tmax_c` e `tmin_c` = média futura − média base, em °C.

A saída segue o contrato "CMIP6" do `AGENTS.md` do backend (`versao_dados` + `pontos[]` com
`cobertura` e `cmip6[]`). Cada resposta baixada fica num cache local (fora do git): se o script
parar, rodar de novo continua de onde parou. Saída e cache padrão ficam em
`data/baixados/nasa_nex_gddp_cmip6/`, a partir da raiz do repositório. Nada vai para o banco.
"""

import argparse
import calendar
import csv
import io
import json
import logging
import math
import re
import sys
import time
import urllib.parse
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from statistics import fmean
from typing import Any

from app.constants import PILOT_MAX_LAT, PILOT_MAX_LON, PILOT_MIN_LAT, PILOT_MIN_LON
from app.models.climate import Cmip6Delta
from app.models.data_run import DataRun
from app.repositories.external.http_client import (
    TextHttpGetter,
    default_http_get_text,
    get_with_retries,
)
from pipeline.export_climate_fixture import POWER_LAT_STEP, POWER_LON_STEP, power_cell_bounds

logger = logging.getLogger(__name__)

SOURCE_KEY = "nex_gddp_cmip6"
NCSS_BASE_URL = "https://ds.nccs.nasa.gov/thredds/ncss/grid/AMES/NEX/GDDP-CMIP6"
OPENDAP_BASE_URL = "https://ds.nccs.nasa.gov/thredds/dodsC/AMES/NEX/GDDP-CMIP6"
NCSS_SERVICE = "NCCS THREDDS NetcdfSubset (recorte por ponto, CSV)"
OPENDAP_SERVICE = "NCCS THREDDS OPeNDAP (recorte por área, ASCII)"
SCENARIO = "ssp245"
BASELINE_EXPERIMENT = "historical"
BASELINE_YEARS = tuple(range(1995, 2015))
FUTURE_YEARS = tuple(range(2041, 2061))
MONTHS = tuple(range(1, 8))  # jan–jul (MVP)
VARIABLES = ("pr", "tasmax", "tasmin")
EXPECTED_UNITS = {"pr": "kg m-2 s-1", "tasmax": "K", "tasmin": "K"}
SECONDS_PER_DAY = 86_400.0  # pr (kg/m²/s) × 86.400 = mm/dia
KELVIN_TO_CELSIUS = 273.15
FILL_VALUE_THRESHOLD = 1.0e19  # _FillValue do NEX-GDDP é 1,0E20
DELTA_DECIMALS = 2
COORD_DECIMALS = 4

# Grade do NEX-GDDP-CMIP6, conferida nos eixos `lat` e `lon` do OPeNDAP em 14/11/2026: centros de
# 0,25° em 600 latitudes (−59,875 a 89,875) e 1.440 longitudes (0,125 a 359,875).
GRID_STEP = 0.25
GRID_LAT_START = -59.875
GRID_LAT_COUNT = 600
GRID_LON_START = 0.125
GRID_LON_COUNT = 1440
GRID_TOLERANCE = 1.0e-6
# Calendários em que "dias desde a origem" é a conta gregoriana de sempre (os três modelos padrão
# usam `proleptic_gregorian`). Modelo com 365 ou 360 dias é recusado, nunca lido errado.
GREGORIAN_CALENDARS = frozenset({"standard", "gregorian", "proleptic_gregorian"})

THREDDS_TIMEOUT_SECONDS = 120.0  # um recorte de 212 dias levou de 5 a 15 s
THREDDS_MAX_RETRIES = 3
THREDDS_BACKOFF_SECONDS = 5.0
PAUSE_BETWEEN_REQUESTS_SECONDS = 0.5
# Medido numa chamada real (1 ponto, 1 modelo, 1 variável, 1 ano) em 14/11/2026: 5,9 s. Cada passo
# de tempo do arquivo é um bloco global (_ChunkSizes 1 × 600 × 1440), por isso o custo é por dia.
MEASURED_SECONDS_PER_REQUEST = 6.0
# Medido em 14/11/2026 (caixa piloto com margem, 8 × 8 pixels, jan–jul de 1 ano): 5,6 s, 6,9 s,
# 8,5 s e 14,6 s (o primeiro do dia). O DAS (só atributos) levou 0,9 s.
MEASURED_SECONDS_PER_AREA_REQUEST = 7.0
MEASURED_SECONDS_PER_ATTRIBUTES_REQUEST = 1.0


def repo_root(script: Path = Path(__file__)) -> Path:
    """Raiz do repositório, achada pelo caminho do script (`<raiz>/projeto/backend/pipeline/`).

    Não depende da pasta de onde o script roda. No container (`/app/pipeline/`) não há
    `projeto/backend` acima: a raiz fica a pasta do backend (`/app`).
    """
    backend = script.resolve().parent.parent
    if backend.name == "backend" and backend.parent.name == "projeto":
        return backend.parent.parent
    return backend


# Pasta organizada do time (fora do git): o compose monta `data/baixados` no backend.
DOWNLOADS_DIR = repo_root() / "data" / "baixados" / "nasa_nex_gddp_cmip6"
DEFAULT_OUTPUT = DOWNLOADS_DIR / "cmip6_deltas_nex_gddp.json"
DEFAULT_CACHE_DIR = DOWNLOADS_DIR / "cache_ncss"


@dataclass(frozen=True)
class ModelFiles:
    """Partes do nome do arquivo de um modelo no THREDDS (variante, grade e versão)."""

    variant: str
    grid: str
    version: str


# Conferido no catálogo do THREDDS em 14/11/2026: os três têm pr, tasmax e tasmin em historical
# (1950–2014) e ssp245 (2015–2100), todos os anos com grade `gn` e sufixo `_v2.0`. Modelo novo:
# conferir variante, grade e versão em https://ds.nccs.nasa.gov/thredds/catalog/AMES/NEX/GDDP-CMIP6/
DEFAULT_MODELS: dict[str, ModelFiles] = {
    "ACCESS-CM2": ModelFiles(variant="r1i1p1f1", grid="gn", version="v2.0"),
    "MPI-ESM1-2-HR": ModelFiles(variant="r1i1p1f1", grid="gn", version="v2.0"),
    "MRI-ESM2-0": ModelFiles(variant="r1i1p1f1", grid="gn", version="v2.0"),
}


@dataclass(frozen=True)
class Point:
    """Ponto WGS 84 (graus decimais, longitude de −180 a 180)."""

    lat: float
    lon: float


@dataclass(frozen=True)
class Box:
    """Caixa WGS 84 em graus decimais (longitude de −180 a 180)."""

    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float


PILOT_BOX = Box(PILOT_MIN_LAT, PILOT_MAX_LAT, PILOT_MIN_LON, PILOT_MAX_LON)


@dataclass(frozen=True)
class NcssRequest:
    """Um pedido ao NCSS: um arquivo anual (modelo, experimento, variável, ano) num ponto."""

    model: str
    experiment: str
    variable: str
    year: int
    point: Point
    files: ModelFiles


@dataclass(frozen=True, order=True)
class Pixel:
    """Pixel de 0,25° do NEX-GDDP, pelos índices na grade do arquivo."""

    lat_index: int
    lon_index: int

    @property
    def lat(self) -> float:
        return GRID_LAT_START + GRID_STEP * self.lat_index

    @property
    def lon(self) -> float:
        """Longitude do centro na grade do arquivo (0 a 360)."""
        return GRID_LON_START + GRID_STEP * self.lon_index


@dataclass(frozen=True)
class PixelWindow:
    """Retângulo de pixels (índices inclusivos) que o OPeNDAP recorta de uma vez."""

    lat_first: int
    lat_last: int
    lon_first: int
    lon_last: int

    @property
    def lat_indexes(self) -> range:
        return range(self.lat_first, self.lat_last + 1)

    @property
    def lon_indexes(self) -> range:
        return range(self.lon_first, self.lon_last + 1)


@dataclass(frozen=True)
class AreaRequest:
    """Um pedido ao OPeNDAP: um arquivo anual (modelo, experimento, variável, ano) num retângulo."""

    model: str
    experiment: str
    variable: str
    year: int
    window: PixelWindow
    files: ModelFiles


@dataclass(frozen=True)
class AreaGrid:
    """Recorte do OPeNDAP: o tempo (na unidade do arquivo) e a série de cada pixel.

    Os valores ficam na unidade nativa e com o valor de preenchimento: quem lê decide o que pular.
    """

    times: tuple[float, ...]
    values: dict[Pixel, tuple[float, ...]]


def to_thredds_longitude(lon: float) -> float:
    """Longitude de −180..180 para a grade 0..360 do NEX-GDDP (ex.: −48,2 → 311,8)."""
    return round(lon % 360.0, COORD_DECIMALS)


def _file_path(model: str, experiment: str, variable: str, year: int, files: ModelFiles) -> str:
    file_name = (
        f"{variable}_day_{model}_{experiment}_{files.variant}_{files.grid}_{year}_"
        f"{files.version}.nc"
    )
    return f"{model}/{experiment}/{files.variant}/{variable}/{file_name}"


def season_days(year: int) -> list[date]:
    """Os dias de 1/jan ao fim de julho do ano (213 no ano bissexto, 212 nos outros)."""
    first = date(year, MONTHS[0], 1)
    last = date(year, MONTHS[-1], calendar.monthrange(year, MONTHS[-1])[1])
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


def ncss_url(request: NcssRequest) -> str:
    path = _file_path(
        request.model, request.experiment, request.variable, request.year, request.files
    )
    return f"{NCSS_BASE_URL}/{path}"


def ncss_params(request: NcssRequest) -> dict[str, Any]:
    last_month = MONTHS[-1]
    last_day = calendar.monthrange(request.year, last_month)[1]
    return {
        "var": request.variable,
        "latitude": request.point.lat,
        "longitude": to_thredds_longitude(request.point.lon),
        "time_start": f"{request.year}-{MONTHS[0]:02d}-01T12:00:00Z",
        "time_end": f"{request.year}-{last_month:02d}-{last_day:02d}T12:00:00Z",
        "accept": "csv",
    }


def _is_value(value: float) -> bool:
    """Falso para o valor de preenchimento (1,0E20) e NaN: sem valor, nunca número inventado."""
    return math.isfinite(value) and abs(value) < FILL_VALUE_THRESHOLD


_UNIT_PATTERN = re.compile(r'\[unit="([^"]*)"\]')


def parse_ncss_csv(text: str, variable: str) -> list[tuple[date, float]]:
    """Lê o CSV do NCSS e devolve (dia, valor na unidade nativa), sem os valores de preenchimento.

    Recusa (ValueError) o que não for o CSV esperado: sem a coluna da variável, com outra unidade
    ou sem linhas de dados. Assim uma página de erro nunca vira dado.
    """
    rows = list(csv.reader(io.StringIO(text)))
    header = rows[0] if rows else []
    column = next(
        (i for i, name in enumerate(header) if name == variable or name.startswith(f"{variable}[")),
        None,
    )
    if column is None or "time" not in header:
        raise ValueError(f"CSV do NCSS sem a coluna {variable}: {text[:120]!r}")
    unit = _UNIT_PATTERN.search(header[column])
    if unit is None or unit.group(1) != EXPECTED_UNITS[variable]:
        found = unit.group(1) if unit else None
        raise ValueError(
            f"unidade de {variable} inesperada no NCSS: {found!r} "
            f"(esperado {EXPECTED_UNITS[variable]!r})"
        )
    time_column = header.index("time")

    values: list[tuple[date, float]] = []
    for row in rows[1:]:
        if not row:
            continue
        value = float(row[column])
        if not _is_value(value):
            continue
        values.append((date.fromisoformat(row[time_column][:10]), value))
    if not values:
        raise ValueError(f"CSV do NCSS sem dados de {variable}")
    return values


# --- pixel e recorte por área (OPeNDAP) --------------------------------------------------------


def _nearest_index(coordinate: float, start: float) -> int:
    # Centro mais perto; no empate (ponto na borda entre dois pixels) fica o de coordenada maior,
    # como o NCSS faz (visto em respostas reais: −19,0 → −18,875 e 311,25 → 311,375).
    return math.floor((coordinate - start) / GRID_STEP + 0.5)


def ncss_pixel(point: Point) -> Pixel:
    """O pixel de 0,25° que o NCSS devolve para o ponto (o mesmo do modo por ponto)."""
    lat_index = _nearest_index(point.lat, GRID_LAT_START)
    if not 0 <= lat_index < GRID_LAT_COUNT:
        raise ValueError(f"ponto fora da grade do NEX-GDDP (latitude {point.lat})")
    lon_index = _nearest_index(to_thredds_longitude(point.lon), GRID_LON_START) % GRID_LON_COUNT
    return Pixel(lat_index, lon_index)


def pixel_window(points: Sequence[Point]) -> PixelWindow:
    """Menor retângulo de pixels que contém o pixel de cada ponto."""
    if not points:
        raise ValueError("nenhum ponto informado")
    pixels = [ncss_pixel(point) for point in points]
    return PixelWindow(
        lat_first=min(p.lat_index for p in pixels),
        lat_last=max(p.lat_index for p in pixels),
        lon_first=min(p.lon_index for p in pixels),
        lon_last=max(p.lon_index for p in pixels),
    )


def opendap_ascii_url(request: AreaRequest) -> str:
    """URL do recorte em ASCII: jan–jul do ano (índices de tempo) no retângulo de pixels."""
    last_step = len(season_days(request.year)) - 1
    window = request.window
    constraint = (
        f"{request.variable}[0:1:{last_step}]"
        f"[{window.lat_first}:1:{window.lat_last}][{window.lon_first}:1:{window.lon_last}]"
    )
    path = _file_path(
        request.model, request.experiment, request.variable, request.year, request.files
    )
    # Colchetes codificados: o servidor da NCCS recusa "[" e "]" crus na URL (HTTP 400)
    return f"{OPENDAP_BASE_URL}/{path}.ascii?{urllib.parse.quote(constraint, safe=':')}"


def opendap_das_url(request: AreaRequest) -> str:
    """URL do DAS (só os atributos) do mesmo arquivo: unidade da variável e eixo do tempo."""
    path = _file_path(
        request.model, request.experiment, request.variable, request.year, request.files
    )
    return f"{OPENDAP_BASE_URL}/{path}.das"


_DAS_BLOCK = re.compile(r"^ {4}(\S+) \{\s*$")
_DAS_STRING = re.compile(r'^\s+String (\w+) "(.*)";\s*$')
_TIME_UNITS = re.compile(
    r"days since (\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]0{1,2}:0{1,2}(?::0{1,2}(?:\.0+)?)?)?Z?"
)


def _das_attributes(text: str) -> dict[str, dict[str, str]]:
    if not text.lstrip().startswith("Attributes {"):
        raise ValueError(f"DAS do OPeNDAP inválido: {text[:120]!r}")
    blocks: dict[str, dict[str, str]] = {}
    current: dict[str, str] | None = None
    for line in text.splitlines():
        if block := _DAS_BLOCK.match(line):
            current = blocks.setdefault(block.group(1), {})
        elif line.strip() == "}":
            current = None
        elif current is not None and (attribute := _DAS_STRING.match(line)):
            current[attribute.group(1)] = attribute.group(2)
    return blocks


def parse_das(text: str, variable: str) -> date:
    """Confere no DAS a unidade da variável e o calendário; devolve a origem do eixo do tempo.

    Recusa (ValueError) DAS sem a variável, com outra unidade, com calendário não gregoriano ou
    com tempo que não seja "days since AAAA-MM-DD".
    """
    blocks = _das_attributes(text)
    if variable not in blocks:
        raise ValueError(f"DAS do OPeNDAP sem a variável {variable}")
    unit = blocks[variable].get("units")
    if unit != EXPECTED_UNITS[variable]:
        raise ValueError(
            f"unidade de {variable} inesperada no OPeNDAP: {unit!r} "
            f"(esperado {EXPECTED_UNITS[variable]!r})"
        )
    time_attributes = blocks.get("time")
    if time_attributes is None:
        raise ValueError("DAS do OPeNDAP sem o eixo do tempo")
    calendar_name = time_attributes.get("calendar", "standard")  # padrão do CF
    if calendar_name not in GREGORIAN_CALENDARS:
        raise ValueError(f"calendário {calendar_name!r} sem suporte (esperado gregoriano)")
    origin = _TIME_UNITS.fullmatch(time_attributes.get("units", ""))
    if origin is None:
        raise ValueError(f"unidade do tempo inesperada: {time_attributes.get('units')!r}")
    return date(int(origin.group(1)), int(origin.group(2)), int(origin.group(3)))


_SEPARATOR = re.compile(r"^-{20,}$", re.MULTILINE)
_ROW = re.compile(r"^\[(\d+)\]\[(\d+)\], (.+)$")


def _map_values(blocks: Mapping[str, list[str]], name: str, count: int) -> list[float]:
    lines = blocks.get(name)
    if lines is None:
        raise ValueError(f"resposta do OPeNDAP sem o eixo {name}")
    values = [float(v) for v in " ".join(lines[1:]).split(",") if v.strip()]
    if len(values) != count:
        raise ValueError(f"eixo {name} com {len(values)} valores (esperado {count})")
    return values


def _check_coordinates(axis: str, found: Sequence[float], expected: Sequence[float]) -> None:
    if any(abs(f - e) > GRID_TOLERANCE for f, e in zip(found, expected, strict=True)):
        raise ValueError(
            f"pixels de {axis} diferentes do pedido: {list(found)} (esperado {expected})"
        )


def parse_opendap_ascii(text: str, variable: str, window: PixelWindow) -> AreaGrid:
    """Lê o recorte em ASCII do OPeNDAP (formato de `.ascii?var[t][lat][lon]`).

    Recusa (ValueError) o que não for o recorte pedido: mensagem de erro (`Error {...}`), página
    HTML, outra variável, outro retângulo de pixels ou resposta pela metade.
    """
    parts = _SEPARATOR.split(text, maxsplit=1)
    if len(parts) != 2 or not parts[0].lstrip().startswith("Dataset {"):
        raise ValueError(f"resposta do OPeNDAP sem dados: {text[:120]!r}")
    header, body = parts
    shape = re.search(
        rf"\b{re.escape(variable)}\[time = (\d+)\]\[lat = (\d+)\]\[lon = (\d+)\];", header
    )
    if shape is None:
        raise ValueError(f"resposta do OPeNDAP sem a variável {variable}: {header[:200]!r}")
    steps, lat_count, lon_count = (int(n) for n in shape.groups())
    lat_indexes, lon_indexes = window.lat_indexes, window.lon_indexes
    if (lat_count, lon_count) != (len(lat_indexes), len(lon_indexes)):
        raise ValueError(
            f"recorte com {lat_count} × {lon_count} pixels de lat × lon "
            f"(pedido {len(lat_indexes)} × {len(lon_indexes)})"
        )

    blocks: dict[str, list[str]] = {}
    for block in re.split(r"\n\s*\n", body.strip()):
        lines = block.splitlines()
        blocks[lines[0].split("[", 1)[0]] = lines
    data = blocks.get(f"{variable}.{variable}")
    if data is None or len(data) - 1 != steps * lat_count:
        raise ValueError(f"resposta do OPeNDAP incompleta para {variable}")

    # series[y][x]: valores do pixel (lat_indexes[y], lon_indexes[x]), um por passo de tempo
    series: list[list[list[float]]] = [[[] for _ in lon_indexes] for _ in lat_indexes]
    positions = ((t, y) for t in range(steps) for y in range(lat_count))
    for line, (t, y) in zip(data[1:], positions, strict=True):
        row = _ROW.match(line)
        if row is None or (int(row.group(1)), int(row.group(2))) != (t, y):
            raise ValueError(f"linha inesperada no OPeNDAP: {line[:80]!r}")
        values = row.group(3).split(",")
        if len(values) != lon_count:
            raise ValueError(f"linha com {len(values)} valores (esperado {lon_count})")
        for column, value in zip(series[y], values, strict=True):
            column.append(float(value))

    times = _map_values(blocks, f"{variable}.time", steps)
    lats = _map_values(blocks, f"{variable}.lat", lat_count)
    lons = _map_values(blocks, f"{variable}.lon", lon_count)
    _check_coordinates("lat", lats, [Pixel(i, 0).lat for i in lat_indexes])
    _check_coordinates("lon", lons, [Pixel(0, j).lon for j in lon_indexes])
    return AreaGrid(
        times=tuple(times),
        values={
            Pixel(lat_index, lon_index): tuple(series[y][x])
            for y, lat_index in enumerate(lat_indexes)
            for x, lon_index in enumerate(lon_indexes)
        },
    )


def grid_dates(grid: AreaGrid, origin: date) -> list[date]:
    """O dia de cada passo de tempo ("dias desde a origem", calendário gregoriano)."""
    return [origin + timedelta(days=math.floor(t)) for t in grid.times]


def daily_values(grid: AreaGrid, origin: date, year: int) -> dict[Pixel, list[tuple[date, float]]]:
    """(dia, valor na unidade nativa) de cada pixel, sem os valores de preenchimento.

    Recusa (ValueError) recorte cujos dias não sejam exatamente 1/jan a 31/jul do ano.
    """
    dates = grid_dates(grid, origin)
    expected = season_days(year)
    if dates != expected:
        first, last = (dates[0], dates[-1]) if dates else (None, None)
        raise ValueError(
            f"os dias do recorte não são 1/jan a 31/jul de {year}: "
            f"{len(dates)} dias, de {first} a {last}"
        )
    return {
        pixel: [(day, value) for day, value in zip(dates, values, strict=True) if _is_value(value)]
        for pixel, values in grid.values.items()
    }


def _check_area_response(text: str, request: AreaRequest) -> None:
    grid = parse_opendap_ascii(text, request.variable, request.window)
    expected = len(season_days(request.year))
    if len(grid.times) != expected:
        raise ValueError(f"recorte do OPeNDAP com {len(grid.times)} dias (esperado {expected})")


# --- conversões, médias e delta ----------------------------------------------------------------


def to_daily_unit(variable: str, value: float) -> float:
    """`pr` (kg/m²/s) → mm/dia; `tasmax` e `tasmin` (K) → °C."""
    if variable == "pr":
        return value * SECONDS_PER_DAY
    return value - KELVIN_TO_CELSIUS


def monthly_means(daily: Iterable[tuple[date, float]]) -> dict[int, float]:
    """Média dos dias de cada mês de jan a jul, juntando todos os anos do período."""
    by_month: dict[int, list[float]] = defaultdict(list)
    for day, value in daily:
        if day.month in MONTHS:
            by_month[day.month].append(value)
    for month in MONTHS:
        if not by_month[month]:
            raise ValueError(f"sem dados no mês {month}")
    return {month: fmean(by_month[month]) for month in MONTHS}


def _round_delta(value: float) -> float:
    return round(value, DELTA_DECIMALS) + 0.0  # + 0.0 tira o "-0.0" do JSON


def monthly_deltas(
    model: str,
    base: Mapping[str, Mapping[int, float]],
    future: Mapping[str, Mapping[int, float]],
) -> list[Cmip6Delta]:
    """Delta de cada mês de jan a jul de um modelo, a partir das médias mensais (mm/dia e °C)."""
    deltas: list[Cmip6Delta] = []
    for month in MONTHS:
        base_rain = base["pr"][month]
        if base_rain <= 0.0:
            raise ValueError(f"{model}: chuva média zero no período base, mês {month}")
        deltas.append(
            Cmip6Delta(
                model=model,
                scenario=SCENARIO,
                month=month,
                rain_pct=_round_delta((future["pr"][month] / base_rain - 1.0) * 100.0),
                tmax_c=_round_delta(future["tasmax"][month] - base["tasmax"][month]),
                tmin_c=_round_delta(future["tasmin"][month] - base["tasmin"][month]),
            )
        )
    return deltas


# --- pontos e caixa ----------------------------------------------------------------------------


def box_points(box: Box) -> list[Point]:
    """Centros das células do NASA POWER (0,5° × 0,625°) que cobrem a caixa."""
    lat_indexes = range(
        round(box.lat_min / POWER_LAT_STEP), round(box.lat_max / POWER_LAT_STEP) + 1
    )
    lon_indexes = range(
        round(box.lon_min / POWER_LON_STEP), round(box.lon_max / POWER_LON_STEP) + 1
    )
    return [
        Point(round(i * POWER_LAT_STEP, COORD_DECIMALS), round(j * POWER_LON_STEP, COORD_DECIMALS))
        for i in lat_indexes
        for j in lon_indexes
    ]


def pilot_box_points() -> list[Point]:
    """Células do NASA POWER que cobrem a caixa piloto (ADR-0003)."""
    return box_points(PILOT_BOX)


def parse_box(text: str) -> Box:
    """`"lat_min,lat_max,lon_min,lon_max"` → caixa. Recusa caixa vazia ou fora do globo."""
    parts = [p.strip() for p in text.split(",")]
    if len(parts) != 4:
        raise ValueError(f"caixa inválida (use lat_min,lat_max,lon_min,lon_max): {text!r}")
    lat_min, lat_max, lon_min, lon_max = (float(p) for p in parts)
    if not (-90.0 <= lat_min < lat_max <= 90.0 and -180.0 <= lon_min < lon_max <= 180.0):
        raise ValueError(f"caixa inválida (mínimo < máximo, dentro do globo): {text!r}")
    return Box(lat_min, lat_max, lon_min, lon_max)


def parse_points(text: str) -> list[Point]:
    """`"lat,lon; lat,lon"` → pontos. Recusa par incompleto e coordenada fora do globo."""
    points: list[Point] = []
    for item in text.split(";"):
        if not item.strip():
            continue
        parts = [p.strip() for p in item.split(",")]
        if len(parts) != 2:
            raise ValueError(f"ponto inválido (use lat,lon): {item.strip()!r}")
        lat, lon = float(parts[0]), float(parts[1])
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            raise ValueError(f"ponto fora do globo: {item.strip()!r}")
        points.append(Point(lat, lon))
    if not points:
        raise ValueError("nenhum ponto informado")
    return points


# --- planos de pedidos -------------------------------------------------------------------------


def _periods() -> tuple[tuple[str, tuple[int, ...]], ...]:
    return ((BASELINE_EXPERIMENT, BASELINE_YEARS), (SCENARIO, FUTURE_YEARS))


def plan_requests(points: Sequence[Point], models: Mapping[str, ModelFiles]) -> list[NcssRequest]:
    """Todos os pedidos, na ordem em que são feitos: ponto → modelo → variável → período → ano."""
    return [
        NcssRequest(model, experiment, variable, year, point, files)
        for point in points
        for model, files in models.items()
        for variable in VARIABLES
        for experiment, years in _periods()
        for year in years
    ]


def plan_area_requests(
    points: Sequence[Point], models: Mapping[str, ModelFiles]
) -> list[AreaRequest]:
    """Um recorte por arquivo anual (modelo → variável → período → ano), para todos os pontos."""
    window = pixel_window(points)
    return [
        AreaRequest(model, experiment, variable, year, window, files)
        for model, files in models.items()
        for variable in VARIABLES
        for experiment, years in _periods()
        for year in years
    ]


def plan_attribute_requests(
    points: Sequence[Point], models: Mapping[str, ModelFiles]
) -> list[AreaRequest]:
    """Um DAS por modelo, variável e período (o do primeiro ano do período)."""
    window = pixel_window(points)
    return [
        AreaRequest(model, experiment, variable, years[0], window, files)
        for model, files in models.items()
        for variable in VARIABLES
        for experiment, years in _periods()
    ]


# --- cache --------------------------------------------------------------------------------------


class _CachedTextFetcher:
    """Baixa cada resposta uma vez só e guarda no cache (é o que permite a retomada)."""

    def __init__(
        self,
        cache_dir: Path,
        http_get: TextHttpGetter = default_http_get_text,
        pause_seconds: float = PAUSE_BETWEEN_REQUESTS_SECONDS,
        sleep: Callable[[float], None] = time.sleep,
        max_retries: int = THREDDS_MAX_RETRIES,
        backoff_seconds: float = THREDDS_BACKOFF_SECONDS,
    ) -> None:
        self._cache_dir = cache_dir
        self._http_get = http_get
        self._pause_seconds = pause_seconds
        self._sleep = sleep
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self.downloads = 0
        self.pending: int | None = None  # só para o log de progresso

    def _get(
        self,
        path: Path,
        url: str,
        params: dict[str, Any],
        check: Callable[[str], object],
        label: str,
    ) -> str:
        if path.exists():
            return path.read_text(encoding="utf-8")

        text = get_with_retries(
            self._http_get,
            url,
            params,
            timeout=THREDDS_TIMEOUT_SECONDS,
            max_retries=self._max_retries,
            backoff_base=self._backoff_seconds,
        )
        check(text)  # só guarda resposta conferida: página de erro nunca vira dado
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(f"{path.name}.part")
        partial.write_text(text, encoding="utf-8")
        partial.replace(path)  # arquivo pela metade nunca fica com o nome final
        self.downloads += 1
        logger.info(
            "[%d/%s] %s",
            self.downloads,
            self.pending if self.pending is not None else "?",
            label,
        )
        self._sleep(self._pause_seconds)
        return text


class CachedNcssFetcher(_CachedTextFetcher):
    """Modo por ponto: o CSV do NCSS de cada (modelo, experimento, variável, ano, ponto)."""

    def _path(self, request: NcssRequest) -> Path:
        point = request.point
        name = f"{request.year}_lat{point.lat:.4f}_lon{point.lon:.4f}.csv"
        return self._cache_dir / request.model / request.experiment / request.variable / name

    def is_cached(self, request: NcssRequest) -> bool:
        return self._path(request).exists()

    def fetch(self, request: NcssRequest) -> str:
        label = (
            f"{request.model} {request.experiment} {request.variable} {request.year} "
            f"({request.point.lat}, {request.point.lon})"
        )
        return self._get(
            self._path(request),
            ncss_url(request),
            ncss_params(request),
            lambda text: parse_ncss_csv(text, request.variable),
            label,
        )


class CachedOpendapFetcher(_CachedTextFetcher):
    """Modo por área: o recorte ASCII de cada arquivo anual e o DAS de cada variável e período.

    Fica na mesma pasta do modo por ponto (`<modelo>/<experimento>/<variável>/`), com nome próprio.
    """

    def _folder(self, request: AreaRequest) -> Path:
        return self._cache_dir / request.model / request.experiment / request.variable

    def _path(self, request: AreaRequest) -> Path:
        w = request.window
        name = f"{request.year}_area_lat{w.lat_first}-{w.lat_last}_lon{w.lon_first}-{w.lon_last}"
        return self._folder(request) / f"{name}.ascii"

    def _attributes_path(self, request: AreaRequest) -> Path:
        return self._folder(request) / f"{request.year}_atributos.das"

    def is_cached(self, request: AreaRequest) -> bool:
        return self._path(request).exists()

    def attributes_cached(self, request: AreaRequest) -> bool:
        return self._attributes_path(request).exists()

    def fetch(self, request: AreaRequest) -> str:
        w = request.window
        label = (
            f"{request.model} {request.experiment} {request.variable} {request.year} "
            f"(área: pixels de lat {w.lat_first}–{w.lat_last}, lon {w.lon_first}–{w.lon_last})"
        )
        return self._get(
            self._path(request),
            opendap_ascii_url(request),
            {},
            lambda text: _check_area_response(text, request),
            label,
        )

    def fetch_attributes(self, request: AreaRequest) -> str:
        label = f"{request.model} {request.experiment} {request.variable} (atributos)"
        return self._get(
            self._attributes_path(request),
            opendap_das_url(request),
            {},
            lambda text: parse_das(text, request.variable),
            label,
        )


# --- deltas ------------------------------------------------------------------------------------


def _point_deltas(
    point: Point, models: Mapping[str, ModelFiles], fetcher: CachedNcssFetcher
) -> list[Cmip6Delta]:
    deltas: list[Cmip6Delta] = []
    for model, files in models.items():
        means: dict[str, dict[str, dict[int, float]]] = defaultdict(dict)
        for variable in VARIABLES:
            for experiment, years in _periods():
                daily: list[tuple[date, float]] = []
                for year in years:
                    request = NcssRequest(model, experiment, variable, year, point, files)
                    daily.extend(
                        (day, to_daily_unit(variable, value))
                        for day, value in parse_ncss_csv(fetcher.fetch(request), variable)
                    )
                means[experiment][variable] = monthly_means(daily)
        deltas.extend(monthly_deltas(model, means[BASELINE_EXPERIMENT], means[SCENARIO]))
    return deltas


def _area_deltas(
    points: Sequence[Point], models: Mapping[str, ModelFiles], fetcher: CachedOpendapFetcher
) -> dict[Point, list[Cmip6Delta]]:
    """Deltas de cada ponto a partir dos recortes por área: a mesma conta do modo por ponto.

    Cada ponto usa o pixel que o NCSS escolheria (`ncss_pixel`); só os pixels usados por algum
    ponto entram na conta (pixel sem dado que nenhum ponto usa não atrapalha).
    """
    window = pixel_window(points)
    pixel_of = {point: ncss_pixel(point) for point in points}
    used = sorted(set(pixel_of.values()))
    deltas: dict[Point, list[Cmip6Delta]] = {point: [] for point in points}
    for model, files in models.items():
        means: dict[str, dict[str, dict[Pixel, dict[int, float]]]] = defaultdict(
            lambda: defaultdict(dict)
        )
        for variable in VARIABLES:
            for experiment, years in _periods():
                attributes = AreaRequest(model, experiment, variable, years[0], window, files)
                origin = parse_das(fetcher.fetch_attributes(attributes), variable)
                daily: dict[Pixel, list[tuple[date, float]]] = {pixel: [] for pixel in used}
                for year in years:
                    request = AreaRequest(model, experiment, variable, year, window, files)
                    grid = parse_opendap_ascii(fetcher.fetch(request), variable, window)
                    by_pixel = daily_values(grid, origin, year)
                    for pixel in used:
                        daily[pixel].extend(
                            (day, to_daily_unit(variable, value)) for day, value in by_pixel[pixel]
                        )
                for pixel in used:
                    means[experiment][variable][pixel] = monthly_means(daily[pixel])
        for point, pixel in pixel_of.items():
            base = {variable: means[BASELINE_EXPERIMENT][variable][pixel] for variable in VARIABLES}
            future = {variable: means[SCENARIO][variable][pixel] for variable in VARIABLES}
            deltas[point].extend(monthly_deltas(model, base, future))
    return deltas


def _delta_json(delta: Cmip6Delta) -> dict[str, Any]:
    return {
        "modelo": delta.model,
        "cenario": delta.scenario,
        "mes": delta.month,
        "chuva_pct": delta.rain_pct,
        "tmax_c": delta.tmax_c,
        "tmin_c": delta.tmin_c,
    }


def _data_run(
    points: Sequence[Point],
    models: Mapping[str, ModelFiles],
    finished_at: datetime,
    service: str,
) -> DataRun:
    return DataRun(
        source=SOURCE_KEY,
        params={
            "produto": "NEX-GDDP-CMIP6",
            "servico": service,
            "cenario": SCENARIO,
            "modelos": [
                {
                    "modelo": model,
                    "variante": files.variant,
                    "grade": files.grid,
                    "versao_arquivo": files.version,
                }
                for model, files in models.items()
            ],
            "variaveis": list(VARIABLES),
            "periodo_base": [BASELINE_YEARS[0], BASELINE_YEARS[-1]],
            "periodo_futuro": [FUTURE_YEARS[0], FUTURE_YEARS[-1]],
            "meses": list(MONTHS),
            "pontos": len(points),
        },
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-nex-gddp-cmip6",
    )


def _contract_json(
    points: Sequence[Point],
    models: Mapping[str, ModelFiles],
    deltas: Mapping[Point, Sequence[Cmip6Delta]],
    finished_at: datetime,
    service: str,
) -> dict[str, Any]:
    run = _data_run(points, models, finished_at, service)
    return {
        "versao_dados": {
            "fonte": run.source,
            "parametros": dict(run.params),
            "fim": run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": run.version,
        },
        "pontos": [
            {
                "lat": point.lat,
                "lon": point.lon,
                "cobertura": power_cell_bounds(point.lat, point.lon),
                "cmip6": [_delta_json(d) for d in deltas[point]],
            }
            for point in points
        ],
    }


def build_cmip6_deltas(
    points: Sequence[Point],
    models: Mapping[str, ModelFiles],
    fetcher: CachedNcssFetcher,
    clock: Callable[[], datetime],
) -> dict[str, Any]:
    """Modo por ponto. Monta o arquivo do contrato CMIP6: `versao_dados` e um item por ponto.

    `clock` é lido depois de todos os pedidos: o `fim` é a hora em que a carga acabou.
    """
    deltas = {point: _point_deltas(point, models, fetcher) for point in points}
    return _contract_json(points, models, deltas, clock(), NCSS_SERVICE)


def build_cmip6_deltas_by_area(
    points: Sequence[Point],
    models: Mapping[str, ModelFiles],
    fetcher: CachedOpendapFetcher,
    clock: Callable[[], datetime],
) -> dict[str, Any]:
    """Modo por área. Mesmo arquivo do `build_cmip6_deltas`, com um pedido por arquivo anual."""
    deltas = _area_deltas(points, models, fetcher)
    return _contract_json(points, models, deltas, clock(), OPENDAP_SERVICE)


# --- linha de comando --------------------------------------------------------------------------


def _duration(seconds: float) -> str:
    if seconds < 3600:
        return f"{round(seconds / 60)} min"
    return f"{seconds / 3600:.1f} h".replace(".", ",")


def _pending(requests: Sequence[NcssRequest], fetcher: CachedNcssFetcher) -> int:
    return sum(1 for r in requests if not fetcher.is_cached(r))


def _pending_area(
    points: Sequence[Point], models: Mapping[str, ModelFiles], fetcher: CachedOpendapFetcher
) -> tuple[int, int]:
    """Quantos recortes e quantos DAS ainda faltam no cache."""
    data = sum(1 for r in plan_area_requests(points, models) if not fetcher.is_cached(r))
    attributes = sum(
        1 for r in plan_attribute_requests(points, models) if not fetcher.attributes_cached(r)
    )
    return data, attributes


def _seconds_text(seconds: float) -> str:
    return f"{seconds:g}".replace(".", ",")


def _print_plan(
    points: Sequence[Point],
    models: Mapping[str, ModelFiles],
    ncss: CachedNcssFetcher,
    opendap: CachedOpendapFetcher,
    pause_seconds: float,
    area_mode: bool,
) -> None:
    pause = _seconds_text(pause_seconds)
    print(
        f"Pontos: {len(points)} | modelos: {len(models)} ({', '.join(models)}) | "
        f"variáveis: {', '.join(VARIABLES)} | anos: {len(BASELINE_YEARS)} base + "
        f"{len(FUTURE_YEARS)} futuro"
    )

    point_requests = plan_requests(points, models)
    point_pending = _pending(point_requests, ncss)
    point_seconds = point_pending * (MEASURED_SECONDS_PER_REQUEST + pause_seconds)
    print(
        f"Por ponto (NCSS, CSV): {len(point_requests)} pedidos "
        f"(já no cache: {len(point_requests) - point_pending}; faltam: {point_pending}), "
        f"~{_duration(point_seconds)} "
        f"(~{MEASURED_SECONDS_PER_REQUEST:.0f} s por pedido + {pause} s de pausa)"
    )

    window = pixel_window(points)
    area_requests = plan_area_requests(points, models)
    attribute_count = len(plan_attribute_requests(points, models))
    data_pending, attributes_pending = _pending_area(points, models, opendap)
    total = len(area_requests) + attribute_count
    pending = data_pending + attributes_pending
    area_seconds = data_pending * (
        MEASURED_SECONDS_PER_AREA_REQUEST + pause_seconds
    ) + attributes_pending * (MEASURED_SECONDS_PER_ATTRIBUTES_REQUEST + pause_seconds)
    print(
        f"Por área (OPeNDAP, ASCII, {len(window.lat_indexes)} × {len(window.lon_indexes)} pixels "
        f"de 0,25°): {total} pedidos, {len(area_requests)} de dados e {attribute_count} de "
        f"atributos (já no cache: {total - pending}; faltam: {pending}), "
        f"~{_duration(area_seconds)} (~{MEASURED_SECONDS_PER_AREA_REQUEST:.0f} s por recorte e "
        f"~{MEASURED_SECONDS_PER_ATTRIBUTES_REQUEST:.0f} s por DAS, + {pause} s de pausa)"
    )

    if area_mode:
        print("Modo desta execução: por área (--area)")
        print(f"Exemplo: {opendap_ascii_url(area_requests[0])}")
    else:
        print("Modo desta execução: por ponto (para pedir a caixa de uma vez, use --area)")
        print(f"Exemplo: {ncss_url(point_requests[0])}")


def _models_arg(text: str, known: Mapping[str, ModelFiles]) -> dict[str, ModelFiles]:
    names = [n.strip() for n in text.split(",") if n.strip()]
    unknown = [n for n in names if n not in known]
    if unknown or not names:
        raise argparse.ArgumentTypeError(
            f"modelo sem nome de arquivo conferido: {unknown or text!r}. Conhecidos: "
            f"{', '.join(known)} (para outro, conferir o catálogo e somar em DEFAULT_MODELS)"
        )
    return {name: known[name] for name in names}


def _points_arg(text: str) -> list[Point]:
    try:
        return parse_points(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _box_arg(text: str) -> Box:
    try:
        return parse_box(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def main(
    argv: Sequence[str] | None = None,
    http_get: TextHttpGetter = default_http_get_text,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    known_models: Mapping[str, ModelFiles] = DEFAULT_MODELS,
) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT)
    where = parser.add_mutually_exclusive_group()
    where.add_argument(
        "--pontos",
        type=_points_arg,
        default=None,
        help='"lat,lon; lat,lon" (use --pontos="..."). Padrão: células do POWER da caixa piloto',
    )
    where.add_argument(
        "--area",
        type=_box_arg,
        nargs="?",
        const=PILOT_BOX,
        default=None,
        metavar="LAT_MIN,LAT_MAX,LON_MIN,LON_MAX",
        help=(
            "modo por área: um pedido por arquivo para todas as células do POWER da caixa "
            '(use --area="..."). Sem valor: caixa piloto'
        ),
    )
    parser.add_argument(
        "--modelos",
        type=lambda text: _models_arg(text, known_models),
        default=dict(known_models),
        help=f"separados por vírgula. Padrão: {','.join(known_models)}",
    )
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--pausa", type=float, default=PAUSE_BETWEEN_REQUESTS_SECONDS)
    parser.add_argument(
        "--dry-run", action="store_true", help="só mostra quantos pedidos faria nos dois modos"
    )
    args = parser.parse_args(argv)

    area_mode = args.area is not None
    points = box_points(args.area) if area_mode else (args.pontos or pilot_box_points())
    fetcher_options = {"cache_dir": args.cache, "http_get": http_get, "pause_seconds": args.pausa}
    ncss = CachedNcssFetcher(**fetcher_options)
    opendap = CachedOpendapFetcher(**fetcher_options)
    if args.dry_run:
        _print_plan(points, args.modelos, ncss, opendap, args.pausa, area_mode)
        return

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", stream=sys.stderr)
    if area_mode:
        opendap.pending = sum(_pending_area(points, args.modelos, opendap))
        result = build_cmip6_deltas_by_area(points, args.modelos, opendap, clock=now)
        downloads = opendap.downloads
    else:
        ncss.pending = _pending(plan_requests(points, args.modelos), ncss)
        result = build_cmip6_deltas(points, args.modelos, ncss, clock=now)
        downloads = ncss.downloads
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(
        f"{len(points)} pontos × {len(args.modelos)} modelos gravados em {args.saida} "
        f"({downloads} arquivos baixados agora)"
    )


if __name__ == "__main__":
    main()
