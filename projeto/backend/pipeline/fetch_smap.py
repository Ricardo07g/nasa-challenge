"""Baixa a umidade do solo do SMAP L4 nos dias de semeadura, por recorte (R2.3, tarefa 0029).

Uso (a partir de projeto/backend; o token vem do `.env` pelo `Settings`, `EARTHDATA_TOKEN`):

    uv run python -m pipeline.fetch_smap --dry-run      # dias, pedidos e tempo, sem rede
    uv run python -m pipeline.fetch_smap                # caixa piloto, 2016 a 2025 (~7 min)
    uv run python -m pipeline.fetch_smap --area="-19.0,-18.9,-48.2,-48.1" --anos=2024
    uv run python -m pipeline.fetch_smap --recente --dry-run   # dia recente e custo (CMR público)
    uv run python -m pipeline.fetch_smap --recente             # SMAP de agora + percentil (A2.2)

Produto: SMAP L4 `SPL4SMGP` versão 008 (EASE-Grid 2.0 global de 9 km, de 3 em 3 horas, desde
31/03/2015). Para cada dia de semeadura do motor (`SOWING_MONTH_DAY_BY_HARVEST`: cedo 08/02, meio
18/02, tarde 03/03) de cada ano:

1. a busca **pública** do CMR lista os 8 granulos de 3 h do dia (em UTC) e o link do OPeNDAP de
   cada um. O link vem do CMR, nunca montado pelo nome: alguns têm um sufixo (`_u9loH5HD`) e,
   sem ele, o servidor responde 404;
2. o OPeNDAP na nuvem da Earthdata (Hyrax, DAP4) recorta só o retângulo de pixels de 9 km que cobre
   a caixa, em CSV, uma variável por pedido (`sm_rootzone_wetness`, `sm_rootzone`, `sm_surface`),
   sem baixar o arquivo global (~140 MB);
3. a média dos granulos do dia (sem o valor de preenchimento) dá o valor do dia; cada célula de
   0,1° da caixa recebe o pixel de 9 km mais perto do centro dela.

O retângulo sai de `cell_lat` e `cell_lon`: uma coluna de latitudes e uma linha de longitudes da
grade (baixadas uma vez) acham as linhas e colunas dos pontos; depois o `cell_lat` e o `cell_lon` do
próprio retângulo escolhem o pixel mais perto de cada ponto. O DMR do primeiro granulo confere o
tamanho da grade, os nomes, as unidades e o valor de preenchimento.

Autenticação: `Authorization: Bearer <EARTHDATA_TOKEN>` como cabeçalho comum, que segue os
redirecionamentos. Token recusado (401/403 ou a página de login) para tudo na hora. Nenhuma
mensagem, log ou arquivo mostra o token, e o CMR (público) não o recebe.

Modo `--recente` (A2.2, sinal para o outono): o dia completo (8 granulos) mais recente do CMR, com
o percentil da `sm_rootzone` desse dia na climatologia da mesma janela do ano (o dia ±
`--janela-dias`, padrão 7) de 2016 até o ano anterior. A climatologia sai do mesmo cache: a primeira
execução baixa ~1.200 recortes de uma variável (10 anos × 15 dias × 8 granulos, ~10 min); as
seguintes, só os dias novos da janela. Grava `smap_recente.json` (contrato SMAP com o
`sm_rootzone_pctl` em cada ponto).

Cada resposta conferida fica num cache local (fora do git): se o script parar, rodar de novo
continua de onde parou. Os recortes são pedidos em paralelo (`--paralelo`, padrão 4), com
retentativa. A saída segue o contrato "SMAP" do `AGENTS.md` do backend. Saída e cache padrão ficam
em `data/baixados/nasa_smap/`, a partir da raiz do repositório. Para levar ao banco:
`python -m pipeline.load_files_to_db --smap <arquivo>`.
"""

import argparse
import json
import logging
import math
import re
import sys
import threading
import time
import urllib.parse
import xml.etree.ElementTree as ET
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from statistics import fmean
from typing import Any, Final

from app.config import Settings, get_settings
from app.constants import GRID_CELL_SCALE_FACTOR, SOWING_MONTH_DAY_BY_HARVEST
from app.models.data_run import DataRun
from app.repositories.climate_repository import cell_center
from app.repositories.external.http_client import (
    HttpGetter,
    HttpRequest,
    HttpTransport,
    TextHttpGetter,
    default_http_get,
    default_http_request,
    get_json_with_retries,
)
from pipeline.fetch_cmip6_deltas import PILOT_BOX, Box, Point, parse_box, repo_root

logger = logging.getLogger(__name__)

__all__ = ["PILOT_BOX", "Box", "Point"]  # reexportados do script do CMIP6 (mesma caixa e ponto)

SOURCE_KEY: Final[str] = "smap"
SHORT_NAME: Final[str] = "SPL4SMGP"
PRODUCT_VERSION: Final[str] = "008"
PRODUCT: Final[str] = f"{SHORT_NAME}.{PRODUCT_VERSION}"
CMR_GRANULES_URL: Final[str] = "https://cmr.earthdata.nasa.gov/search/granules.json"
CMR_PAGE_SIZE: Final[int] = 50
OPENDAP_SERVICE_REL: Final[str] = "http://esipfed.org/ns/fedsearch/1.1/service#"
OPENDAP_HOST: Final[str] = "opendap.earthdata.nasa.gov"
SERVICE: Final[str] = "NASA Earthdata OPeNDAP na nuvem (Hyrax, DAP4), recorte por área em CSV"

SMAP_FIRST_DAY: Final[date] = date(2015, 3, 31)  # primeiro dia do SPL4SMGP
# Fevereiro de 2015 não existe no SMAP: a série começa no primeiro ano com todos os dias de
# semeadura (o PRD 7.2 diz "quando houver"; antes disso o balde fica em 50% da CAD).
FIRST_YEAR: Final[int] = 2016
LAST_YEAR: Final[int] = 2025
GRANULES_PER_DAY: Final[int] = 8  # de 3 em 3 horas: 01:30, 04:30, ..., 22:30 UTC

# Grade conferida pelo orquestrador no DMR (14/11/2026): EASE-Grid 2.0 global de 9 km.
GRID_ROWS: Final[int] = 1624  # dimensão y
GRID_COLUMNS: Final[int] = 3856  # dimensão x
LAT_VARIABLE: Final[str] = "/cell_lat"
LON_VARIABLE: Final[str] = "/cell_lon"
COORDINATE_VARIABLES: Final[tuple[str, ...]] = (LAT_VARIABLE, LON_VARIABLE)
# Campo do contrato SMAP → variável do arquivo.
DATA_VARIABLES: Final[dict[str, str]] = {
    "sm_rootzone_wetness": "/Geophysical_Data/sm_rootzone_wetness",
    "sm_rootzone_m3_m3": "/Geophysical_Data/sm_rootzone",
    "sm_surface_m3_m3": "/Geophysical_Data/sm_surface",
}
REQUIRED_FIELDS: Final[tuple[str, ...]] = ("sm_rootzone_wetness", "sm_rootzone_m3_m3")
_VOLUMETRIC: Final[frozenset[str]] = frozenset({"m3 m-3", "m3/m3", "m^3 m^-3", "m^3/m^3"})
# Unidades aceitas no DMR. Outra unidade para tudo com a unidade encontrada na mensagem.
EXPECTED_UNITS: Final[dict[str, frozenset[str]]] = {
    LAT_VARIABLE: frozenset({"degrees_north"}),
    LON_VARIABLE: frozenset({"degrees_east"}),
    DATA_VARIABLES["sm_rootzone_wetness"]: frozenset({"dimensionless", "1", "-", ""}),
    DATA_VARIABLES["sm_rootzone_m3_m3"]: _VOLUMETRIC,
    DATA_VARIABLES["sm_surface_m3_m3"]: _VOLUMETRIC,
}
DEFAULT_FILL_VALUE: Final[float] = -9999.0  # _FillValue do SMAP L4 quando o DMR não traz
MIN_FRACTION: Final[float] = 0.0
MAX_FRACTION: Final[float] = 1.0
VALUE_DECIMALS: Final[int] = 4
COORD_DECIMALS: Final[int] = 4
WINDOW_MARGIN_PIXELS: Final[int] = 1

DEFAULT_WORKERS: Final[int] = 4
OPENDAP_TIMEOUT_SECONDS: Final[float] = 60.0
OPENDAP_MAX_RETRIES: Final[int] = 3
OPENDAP_BACKOFF_SECONDS: Final[float] = 2.0
CMR_TIMEOUT_SECONDS: Final[float] = 30.0
# Medidas reais (14/11/2026): o orquestrador mediu o DMR (~2 s) e o recorte em CSV (1,7 s) com o
# token; a busca pública de um dia no CMR levou 0,6 s.
MEASURED_SECONDS_PER_OPENDAP_REQUEST: Final[float] = 2.0
MEASURED_SECONDS_PER_CMR_REQUEST: Final[float] = 0.6
ACCEPT_TEXT: Final[str] = (
    "text/csv, text/plain, application/vnd.opendap.dap4.dataset-metadata+xml, application/xml, */*"
)
_TOKEN_REJECTED: Final[frozenset[int]] = frozenset({401, 403})
_BODY_SNIPPET_CHARS: Final[int] = 200
_LOGIN_MARKERS: Final[tuple[str, ...]] = ("earthdata login", "urs.earthdata.nasa.gov")

# Modo --recente (A2.2). Percentil da `sm_rootzone` do dia recente na climatologia da mesma janela
# do ano, de 2016 (o primeiro ano inteiro do SMAP) até o ano anterior.
CLIMATOLOGY_FIRST_YEAR: Final[int] = 2016
DEFAULT_WINDOW_DAYS: Final[int] = 7  # o dia ± 7: 15 dias por ano
# Menos anos que isso na janela: sem percentil (poucos anos não dizem o que é seco para o lugar).
MIN_CLIMATOLOGY_YEARS: Final[int] = 5
LATEST_LOOKBACK_DAYS: Final[int] = 3  # o dia mais recente pode estar incompleto no CMR
CLIMATOLOGY_FIELD: Final[str] = "sm_rootzone_m3_m3"
PCTL_DECIMALS: Final[int] = 1

DOWNLOADS_DIR = repo_root() / "data" / "baixados" / "nasa_smap"
DEFAULT_OUTPUT = DOWNLOADS_DIR / "smap_semeadura.json"
DEFAULT_RECENT_OUTPUT = DOWNLOADS_DIR / "smap_recente.json"
DEFAULT_CACHE_DIR = DOWNLOADS_DIR / "cache_opendap"


class OpendapError(RuntimeError):
    """Falha ao falar com o OPeNDAP ou o CMR, ou resposta que não é a pedida."""


class TokenRejectedError(OpendapError):
    """A Earthdata recusou o token: não adianta tentar de novo (nada vai para o cache)."""


@dataclass(frozen=True)
class Granule:
    """Um granulo de 3 h do SPL4SMGP, como o CMR lista."""

    name: str  # producer_granule_id, ex.: SMAP_L4_SM_gph_20240215T103000_Vv8012_001.h5
    time: datetime  # meio da janela de 3 h, pelo nome (UTC)
    opendap_url: str  # link `service#` do CMR, com o sufixo quando houver
    collection: str

    @property
    def day(self) -> date:
        return self.time.date()

    @property
    def science_version(self) -> str:
        match = re.search(r"_(Vv\d+)_", self.name)
        return match.group(1) if match else ""


@dataclass(frozen=True, order=True)
class Pixel:
    """Pixel de 9 km da EASE-Grid 2.0, pelos índices na grade do arquivo (linha y, coluna x)."""

    row: int
    col: int


@dataclass(frozen=True)
class PixelWindow:
    """Retângulo de pixels (índices inclusivos) que o OPeNDAP recorta de uma vez."""

    row_first: int
    row_last: int
    col_first: int
    col_last: int

    @property
    def rows(self) -> range:
        return range(self.row_first, self.row_last + 1)

    @property
    def cols(self) -> range:
        return range(self.col_first, self.col_last + 1)


@dataclass(frozen=True)
class SubsetTask:
    """Um recorte: uma variável de um granulo num retângulo de pixels."""

    granule: Granule
    variable: str
    window: PixelWindow


@dataclass(frozen=True)
class GridStructure:
    """O que o DMR diz da grade: tamanho, unidades e valor de preenchimento de cada variável."""

    rows: int
    cols: int
    units: Mapping[str, str]
    fill_values: Mapping[str, float]

    def fill_value(self, variable: str) -> float:
        return self.fill_values.get(variable, DEFAULT_FILL_VALUE)


# --- dias, células e busca no CMR ----------------------------------------------------------------


def sowing_days(first_year: int = FIRST_YEAR, last_year: int = LAST_YEAR) -> list[date]:
    """Os dias de semeadura das faixas de colheita (os do motor), sem os anteriores ao SMAP."""
    month_days = sorted(SOWING_MONTH_DAY_BY_HARVEST.values())
    days = [
        date(year, month, day)
        for year in range(first_year, last_year + 1)
        for month, day in month_days
    ]
    return [day for day in days if day >= SMAP_FIRST_DAY]


def _cell_index_floor(value: float) -> int:
    # Arredonda antes do floor (como o `cell_id_for`): -18,75 não pode virar -18,7500000001.
    return math.floor(round(value * GRID_CELL_SCALE_FACTOR, 6))


def _cell_index_ceil(value: float) -> int:
    return math.ceil(round(value * GRID_CELL_SCALE_FACTOR, 6))


def box_cell_centers(box: Box) -> list[Point]:
    """Centros das células de 0,1° que cobrem a caixa (225 na caixa piloto), de sul a norte."""
    return [
        Point(*cell_center(f"{lat_idx}_{lon_idx}"))
        for lat_idx in range(_cell_index_floor(box.lat_min), _cell_index_ceil(box.lat_max))
        for lon_idx in range(_cell_index_floor(box.lon_min), _cell_index_ceil(box.lon_max))
    ]


def cmr_params(day: date) -> dict[str, Any]:
    """Busca dos granulos de um dia em UTC (o CMR também devolve o das 22:30 da véspera)."""
    return {
        "short_name": SHORT_NAME,
        "version": PRODUCT_VERSION,
        "temporal": f"{day.isoformat()}T00:00:00Z,{day.isoformat()}T23:59:59Z",
        "page_size": CMR_PAGE_SIZE,
    }


def latest_cmr_params() -> dict[str, Any]:
    """Busca do granulo mais recente da versão 008 (o primeiro, em ordem de data decrescente)."""
    return {
        "short_name": SHORT_NAME,
        "version": PRODUCT_VERSION,
        "sort_key": "-start_date",
        "page_size": 1,
    }


_GRANULE_TIME = re.compile(r"_(\d{8}T\d{6})_")


def _cmr_entries(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    feed = payload.get("feed") if isinstance(payload, Mapping) else None
    entries = feed.get("entry") if isinstance(feed, Mapping) else None
    if not isinstance(entries, list):
        raise ValueError(f"resposta do CMR sem a lista de granulos: {str(payload)[:120]!r}")
    return entries


def _granule_time(entry: Mapping[str, Any]) -> tuple[str, datetime]:
    name = str(entry.get("producer_granule_id") or entry.get("title") or "")
    match = _GRANULE_TIME.search(name)
    if match is None:
        raise ValueError(f"granulo do CMR sem a hora no nome: {name!r}")
    return name, datetime.strptime(match.group(1), "%Y%m%dT%H%M%S").replace(tzinfo=UTC)


def _opendap_link(entry: Mapping[str, Any]) -> str | None:
    for link in entry.get("links") or []:
        href = str(link.get("href", ""))
        if (
            link.get("rel") == OPENDAP_SERVICE_REL
            and urllib.parse.urlparse(href).hostname == OPENDAP_HOST
        ):
            return href
    return None


def parse_cmr_granules(payload: Mapping[str, Any], day: date) -> list[Granule]:
    """Os granulos do dia (pela hora no nome), em ordem, com o link do OPeNDAP de cada um.

    Recusa (ValueError) resposta sem a lista de granulos e granulo sem link do OPeNDAP.
    """
    granules: dict[str, Granule] = {}
    for entry in _cmr_entries(payload):
        name, moment = _granule_time(entry)
        if moment.date() != day:
            continue
        url = _opendap_link(entry)
        if url is None:
            raise ValueError(f"granulo {name} sem o link do OPeNDAP no CMR")
        granules[name] = Granule(
            name=name,
            time=moment,
            opendap_url=url,
            collection=str(entry.get("collection_concept_id", "")),
        )
    return sorted(granules.values(), key=lambda granule: granule.time)


# --- OPeNDAP: URLs e respostas -----------------------------------------------------------------


def dmr_url(granule: Granule) -> str:
    return f"{granule.opendap_url}.dmr"


def dap_csv_url(granule: Granule, variable: str, window: PixelWindow) -> str:
    """URL do recorte DAP4 em CSV (colchetes codificados, como no pedido real)."""
    constraint = (
        f"{variable}[{window.row_first}:1:{window.row_last}]"
        f"[{window.col_first}:1:{window.col_last}]"
    )
    return f"{granule.opendap_url}.dap.csv?dap4.ce={urllib.parse.quote(constraint, safe='/:')}"


def parse_dap_csv(text: str, variable: str, window: PixelWindow) -> list[list[float]]:
    """Lê o recorte em CSV (`Dataset: ...` e uma linha por linha da grade: `var[i], v, v`).

    Recusa (ValueError) o que não for o recorte pedido: página HTML, outra variável, linha fora
    de ordem, linha com outro número de valores ou resposta pela metade.
    """
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines or not lines[0].startswith("Dataset:"):
        raise ValueError(f"resposta do OPeNDAP sem o recorte: {text[:120]!r}")
    prefix = f"{variable}["
    grid: list[list[float]] = []
    for line in lines[1:]:
        if not line.startswith(prefix):
            raise ValueError(f"linha inesperada no recorte de {variable}: {line[:80]!r}")
        index, _, values_text = line[len(prefix) :].partition("], ")
        if not index.isdigit() or int(index) != len(grid):
            raise ValueError(f"linha fora de ordem no recorte de {variable}: {line[:80]!r}")
        values = [float(value) for value in values_text.split(",")]
        if len(values) != len(window.cols):
            raise ValueError(
                f"linha com {len(values)} valores no recorte de {variable} "
                f"(pedido {len(window.cols)})"
            )
        grid.append(values)
    if len(grid) != len(window.rows):
        raise ValueError(
            f"recorte de {variable} com {len(grid)} linhas (pedido {len(window.rows)})"
        )
    return grid


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _dmr_variables(root: ET.Element) -> dict[str, dict[str, str]]:
    """Atributos de cada variável (elemento com `<Dim>`), pelo caminho com os grupos."""
    variables: dict[str, dict[str, str]] = {}

    def walk(element: ET.Element, path: str) -> None:
        for child in element:
            tag = _local(child.tag)
            if tag == "Group":
                walk(child, f"{path}/{child.get('name')}")
            elif any(_local(grandchild.tag) == "Dim" for grandchild in child):
                attributes: dict[str, str] = {}
                for attribute in child:
                    if _local(attribute.tag) != "Attribute":
                        continue
                    value = next((v for v in attribute if _local(v.tag) == "Value"), None)
                    text = "" if value is None else (value.text or value.get("value") or "")
                    attributes[str(attribute.get("name"))] = text.strip()
                variables[f"{path}/{child.get('name')}"] = attributes

    walk(root, "")
    return variables


def parse_dmr(text: str) -> GridStructure:
    """Confere no DMR (DAP4) a grade de 9 km, as variáveis e as unidades.

    Recusa (ValueError) DMR inválido, grade de outro tamanho, variável ausente ou unidade
    inesperada (a mensagem traz a unidade encontrada).
    """
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise ValueError(f"DMR do OPeNDAP inválido: {text[:120]!r}") from exc
    if _local(root.tag) != "Dataset":
        raise ValueError(f"DMR do OPeNDAP inválido (sem o Dataset): {text[:120]!r}")
    dimensions = {
        str(element.get("name", "")).lstrip("/"): int(element.get("size", "0"))
        for element in root
        if _local(element.tag) == "Dimension"
    }
    rows, cols = dimensions.get("y"), dimensions.get("x")
    if (rows, cols) != (GRID_ROWS, GRID_COLUMNS):
        raise ValueError(
            f"grade do DMR com y = {rows} e x = {cols} (esperado {GRID_ROWS} × {GRID_COLUMNS}, "
            "a EASE-Grid 2.0 de 9 km)"
        )
    variables = _dmr_variables(root)
    units: dict[str, str] = {}
    fill_values: dict[str, float] = {}
    for variable, accepted in EXPECTED_UNITS.items():
        if variable not in variables:
            raise ValueError(f"DMR sem a variável {variable}")
        unit = variables[variable].get("units", "")
        if unit not in accepted:
            raise ValueError(
                f"unidade de {variable} inesperada no DMR: {unit!r} (esperado {sorted(accepted)})"
            )
        units[variable] = unit
        fill = variables[variable].get("_FillValue")
        fill_values[variable] = float(fill) if fill else DEFAULT_FILL_VALUE
    return GridStructure(rows=GRID_ROWS, cols=GRID_COLUMNS, units=units, fill_values=fill_values)


# --- pixel de cada ponto e média do dia -----------------------------------------------------------


def _nearest_index(values: Sequence[float], target: float, circular: bool = False) -> int:
    def distance(value: float) -> float:
        gap = abs(value - target)
        return min(gap, 360.0 - gap) if circular else gap

    return min(range(len(values)), key=lambda index: distance(values[index]))


def pixel_window_for(
    points: Sequence[Point],
    row_lats: Sequence[float],
    col_lons: Sequence[float],
    margin: int = WINDOW_MARGIN_PIXELS,
) -> PixelWindow:
    """Menor retângulo com a linha e a coluna mais perto de cada ponto, mais a margem.

    `row_lats` é a latitude de cada linha e `col_lons` a longitude de cada coluna (na EASE-Grid
    2.0 global a latitude só muda com a linha e a longitude só com a coluna). A margem fica
    dentro da grade.
    """
    if not points:
        raise ValueError("nenhum ponto informado")
    rows = [_nearest_index(row_lats, point.lat) for point in points]
    cols = [_nearest_index(col_lons, point.lon, circular=True) for point in points]
    return PixelWindow(
        row_first=max(0, min(rows) - margin),
        row_last=min(len(row_lats) - 1, max(rows) + margin),
        col_first=max(0, min(cols) - margin),
        col_last=min(len(col_lons) - 1, max(cols) + margin),
    )


def nearest_pixel(
    point: Point,
    lat_grid: Sequence[Sequence[float]],
    lon_grid: Sequence[Sequence[float]],
    window: PixelWindow,
) -> Pixel:
    """O pixel do retângulo com o centro (`cell_lat`, `cell_lon`) mais perto do ponto."""
    cos_lat = math.cos(math.radians(point.lat))
    best: tuple[float, Pixel] | None = None
    for i, row in enumerate(window.rows):
        for j, col in enumerate(window.cols):
            d_lat = lat_grid[i][j] - point.lat
            d_lon = (lon_grid[i][j] - point.lon + 180.0) % 360.0 - 180.0
            distance = d_lat * d_lat + (d_lon * cos_lat) ** 2
            if best is None or distance < best[0]:
                best = (distance, Pixel(row, col))
    if best is None:
        raise ValueError("retângulo de pixels vazio")
    return best[1]


def _is_value(value: float, fill_value: float) -> bool:
    return math.isfinite(value) and value != fill_value and MIN_FRACTION <= value <= MAX_FRACTION


def daily_mean(values: Sequence[float], fill_value: float) -> float | None:
    """Média dos granulos do dia, sem preenchimento, NaN e valor fora de 0 a 1; None sem nenhum."""
    valid = [value for value in values if _is_value(value, fill_value)]
    return round(fmean(valid), VALUE_DECIMALS) if valid else None


# --- HTTP autenticado e cliente com cache ---------------------------------------------------------


def _is_login_page(text: str) -> bool:
    head = text[:4000].lower()
    return head.lstrip().startswith(("<!doctype html", "<html")) and any(
        marker in head for marker in _LOGIN_MARKERS
    )


class EarthdataTextGetter:
    """GET com `Authorization: Bearer <token>` como cabeçalho comum (segue os redirecionamentos).

    O token nunca aparece no `repr` nem nas mensagens de erro.
    """

    def __init__(self, token: str, transport: HttpTransport = default_http_request) -> None:
        if not token:
            raise ValueError("token da Earthdata vazio")
        self._token = token
        self._transport = transport

    def __repr__(self) -> str:
        return "EarthdataTextGetter(token=<oculto>)"

    def _hide(self, text: str) -> str:
        return text.replace(self._token, "<token>")

    def __call__(self, url: str, params: dict[str, Any], timeout: float) -> str:
        request = HttpRequest(
            method="GET",
            url=url,
            params=params,
            headers={"Authorization": f"Bearer {self._token}", "Accept": ACCEPT_TEXT},
        )
        response = self._transport(request, timeout)
        if response.status in _TOKEN_REJECTED:
            raise TokenRejectedError(
                f"a Earthdata recusou o token (HTTP {response.status}) em {self._hide(url)}: "
                "confira o EARTHDATA_TOKEN (vale 60 dias)"
            )
        if response.status != 200:
            snippet = response.body[:_BODY_SNIPPET_CHARS].decode("utf-8", errors="replace")
            raise OpendapError(
                f"HTTP {response.status} em {self._hide(url)}: {self._hide(snippet)!r}"
            )
        return response.text()


def _write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(f"{path.name}.part")
    partial.write_text(text, encoding="utf-8")
    partial.replace(path)  # arquivo pela metade nunca fica com o nome final


class SmapOpendapClient:
    """Busca no CMR e recortes no OPeNDAP, cada resposta conferida e guardada uma vez no cache.

    Pastas do cache: `cmr/<dia>.json`, `estrutura.dmr`, `coordenadas/` (iguais em todos os
    granulos) e `recortes/<dia>/<granulo>/`. `downloads` conta os pedidos feitos ao OPeNDAP.
    """

    def __init__(
        self,
        cache_dir: Path,
        opendap_get: TextHttpGetter,
        cmr_get: HttpGetter = default_http_get,
        workers: int = DEFAULT_WORKERS,
        sleep: Callable[[float], None] = time.sleep,
        max_retries: int = OPENDAP_MAX_RETRIES,
        backoff_seconds: float = OPENDAP_BACKOFF_SECONDS,
    ) -> None:
        self._cache_dir = cache_dir
        self._opendap_get = opendap_get
        self._cmr_get = cmr_get
        self._workers = max(1, workers)
        self._sleep = sleep
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self._lock = threading.Lock()
        self.downloads = 0
        self.pending: int | None = None  # só para o log de progresso

    # caminhos do cache

    def _cmr_path(self, day: date) -> Path:
        return self._cache_dir / "cmr" / f"{day.isoformat()}.json"

    def _dmr_path(self) -> Path:
        return self._cache_dir / "estrutura.dmr"

    def _subset_path(self, task: SubsetTask) -> Path:
        w = task.window
        short_name = task.variable.rsplit("/", 1)[-1]
        name = f"{short_name}_y{w.row_first}-{w.row_last}_x{w.col_first}-{w.col_last}.csv"
        if task.variable in COORDINATE_VARIABLES:
            return self._cache_dir / "coordenadas" / name
        granule = task.granule
        return self._cache_dir / "recortes" / granule.day.isoformat() / granule.name / name

    def is_cached(self, task: SubsetTask) -> bool:
        return self._subset_path(task).exists()

    def is_cmr_cached(self, day: date) -> bool:
        return self._cmr_path(day).exists()

    def has_structure(self) -> bool:
        return self._dmr_path().exists()

    def cached_granules(self, day: date) -> list[Granule] | None:
        """Os granulos do dia que já estão no cache (sem rede), ou None."""
        path = self._cmr_path(day)
        if not path.exists():
            return None
        return parse_cmr_granules(json.loads(path.read_text(encoding="utf-8")), day)

    def cached_subset(self, task: SubsetTask) -> list[list[float]] | None:
        path = self._subset_path(task)
        if not path.exists():
            return None
        return parse_dap_csv(path.read_text(encoding="utf-8"), task.variable, task.window)

    # pedidos

    def granules(self, day: date) -> list[Granule]:
        """Os granulos do dia pelo CMR. Só vai para o cache o dia com os 8 granulos."""
        cached = self.cached_granules(day)
        if cached is not None:
            return cached
        payload = get_json_with_retries(
            self._cmr_get,
            CMR_GRANULES_URL,
            cmr_params(day),
            timeout=CMR_TIMEOUT_SECONDS,
            max_retries=self._max_retries,
            backoff_base=self._backoff_seconds,
        )
        granules = parse_cmr_granules(payload, day)
        if len(granules) == GRANULES_PER_DAY:
            _write_atomic(self._cmr_path(day), json.dumps(payload, ensure_ascii=False))
        else:
            logger.warning(
                "%s: o CMR listou %d granulos (esperado %d)", day, len(granules), GRANULES_PER_DAY
            )
        return granules

    def latest_complete_day(self, lookback_days: int = LATEST_LOOKBACK_DAYS) -> date:
        """O dia mais recente com os 8 granulos no CMR (busca pública, sem token).

        O dia do granulo mais recente costuma estar pela metade: volta até `lookback_days` dias.
        """
        payload = get_json_with_retries(
            self._cmr_get,
            CMR_GRANULES_URL,
            latest_cmr_params(),
            timeout=CMR_TIMEOUT_SECONDS,
            max_retries=self._max_retries,
            backoff_base=self._backoff_seconds,
        )
        entries = _cmr_entries(payload)
        if not entries:
            raise OpendapError("o CMR não listou nenhum granulo do SMAP")
        latest = _granule_time(entries[0])[1].date()
        for back in range(lookback_days + 1):
            day = latest - timedelta(days=back)
            if len(self.granules(day)) == GRANULES_PER_DAY:
                return day
        first = latest - timedelta(days=lookback_days)
        raise OpendapError(
            f"nenhum dia com os {GRANULES_PER_DAY} granulos entre {first} e {latest} no CMR"
        )

    def structure(self, granule: Granule) -> GridStructure:
        text = self._text(self._dmr_path(), dmr_url(granule), parse_dmr, f"DMR de {granule.name}")
        return parse_dmr(text)

    def subset(self, granule: Granule, variable: str, window: PixelWindow) -> list[list[float]]:
        task = SubsetTask(granule, variable, window)
        text = self._text(
            self._subset_path(task),
            dap_csv_url(granule, variable, window),
            lambda body: parse_dap_csv(body, variable, window),
            f"{granule.name} {variable}",
        )
        return parse_dap_csv(text, variable, window)

    def prefetch(self, tasks: Sequence[SubsetTask]) -> None:
        """Baixa em paralelo os recortes que faltam no cache.

        Token recusado para na hora. Outras falhas (depois das retentativas) não param os demais
        pedidos: o que deu certo fica no cache e o erro sobe no fim (rodar de novo continua).
        """
        missing = [task for task in dict.fromkeys(tasks) if not self.is_cached(task)]
        if not missing:
            return
        self.pending = len(missing)
        failures: list[tuple[SubsetTask, Exception]] = []
        with ThreadPoolExecutor(max_workers=self._workers) as pool:
            futures = {
                pool.submit(self.subset, task.granule, task.variable, task.window): task
                for task in missing
            }
            for future in as_completed(futures):
                try:
                    future.result()
                except TokenRejectedError:
                    pool.shutdown(wait=True, cancel_futures=True)
                    raise
                except Exception as exc:
                    failures.append((futures[future], exc))
        if failures:
            task, exc = failures[0]
            raise OpendapError(
                f"{len(failures)} de {len(missing)} recortes falharam depois das retentativas "
                f"(o resto ficou no cache: rode de novo). Primeiro: {task.granule.name} "
                f"{task.variable}: {exc}"
            )

    def _text(self, path: Path, url: str, check: Callable[[str], object], label: str) -> str:
        if path.exists():
            return path.read_text(encoding="utf-8")
        text = self._download(url, check)
        _write_atomic(path, text)  # só resposta conferida: página de erro nunca vira dado
        with self._lock:
            self.downloads += 1
            count = self.downloads
        logger.info("[%d/%s] %s", count, self.pending if self.pending else "?", label)
        return text

    def _download(self, url: str, check: Callable[[str], object]) -> str:
        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                text = self._opendap_get(url, {}, OPENDAP_TIMEOUT_SECONDS)
                if _is_login_page(text):
                    raise TokenRejectedError(
                        "a resposta foi a página de login da Earthdata: confira o EARTHDATA_TOKEN "
                        "(vale 60 dias)"
                    )
                check(text)
                return text
            except TokenRejectedError:
                raise
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Pedido ao OPeNDAP falhou (%d/%d) em %s: %s",
                    attempt + 1,
                    self._max_retries + 1,
                    url,
                    exc,
                )
                if attempt < self._max_retries:
                    self._sleep(self._backoff_seconds * 2**attempt)
        assert last_error is not None
        raise last_error


# --- arquivo do contrato --------------------------------------------------------------------------


@dataclass(frozen=True)
class PixelGrid:
    """O retângulo de pixels que cobre os pontos e o pixel de cada ponto."""

    window: PixelWindow
    lat_grid: list[list[float]]
    lon_grid: list[list[float]]
    pixel_of: dict[Point, Pixel]

    def center(self, pixel: Pixel) -> tuple[float, float]:
        i, j = pixel.row - self.window.row_first, pixel.col - self.window.col_first
        return self.lat_grid[i][j], self.lon_grid[i][j]


def locate_pixels(
    points: Sequence[Point], client: SmapOpendapClient, granule: Granule, structure: GridStructure
) -> PixelGrid:
    """Acha o retângulo pelo `cell_lat` e `cell_lon` e o pixel de 9 km mais perto de cada ponto."""
    lat_column = client.subset(granule, LAT_VARIABLE, PixelWindow(0, structure.rows - 1, 0, 0))
    lon_row = client.subset(granule, LON_VARIABLE, PixelWindow(0, 0, 0, structure.cols - 1))
    window = pixel_window_for(points, [row[0] for row in lat_column], lon_row[0])
    lat_grid = client.subset(granule, LAT_VARIABLE, window)
    lon_grid = client.subset(granule, LON_VARIABLE, window)
    pixel_of = {point: nearest_pixel(point, lat_grid, lon_grid, window) for point in points}
    return PixelGrid(window=window, lat_grid=lat_grid, lon_grid=lon_grid, pixel_of=pixel_of)


def _daily_item(
    day: date,
    pixel: Pixel,
    window: PixelWindow,
    grids: Mapping[str, Sequence[Sequence[Sequence[float]]]],
    structure: GridStructure,
) -> dict[str, Any] | None:
    """Um item da `serie`: a média do dia de cada variável no pixel; None sem as obrigatórias."""
    i, j = pixel.row - window.row_first, pixel.col - window.col_first
    values = {
        field: daily_mean(
            [grid[i][j] for grid in field_grids], structure.fill_value(DATA_VARIABLES[field])
        )
        for field, field_grids in grids.items()
    }
    if any(values[field] is None for field in REQUIRED_FIELDS):
        return None
    item: dict[str, Any] = {"data": day.isoformat()}
    item.update({field: value for field, value in values.items() if value is not None})
    return item


def _base_params(
    granules: Sequence[Granule], pixels: PixelGrid, box: Box, points: Sequence[Point]
) -> dict[str, Any]:
    """Parâmetros do `versao_dados` iguais nos dois modos: produto, grade, caixa e pontos."""
    window = pixels.window
    return {
        "produto": PRODUCT,
        "colecao": ", ".join(sorted({granule.collection for granule in granules})),
        "servico": SERVICE,
        "versoes_do_granulo": sorted({granule.science_version for granule in granules}),
        "variaveis": dict(DATA_VARIABLES),
        "media_do_dia": (
            "média dos granulos de 3 h do dia em UTC (8 por dia), sem o valor de preenchimento"
        ),
        "caixa": {
            "lat_min": box.lat_min,
            "lat_max": box.lat_max,
            "lon_min": box.lon_min,
            "lon_max": box.lon_max,
        },
        "grade": f"EASE-Grid 2.0 global de 9 km ({GRID_ROWS} × {GRID_COLUMNS})",
        "janela_pixels": {
            "linha_inicio": window.row_first,
            "linha_fim": window.row_last,
            "coluna_inicio": window.col_first,
            "coluna_fim": window.col_last,
        },
        "ponto": "centro da célula de 0,1°, com o pixel de 9 km mais perto",
        "pontos": len(points),
    }


def _data_run(
    days: Sequence[date],
    points: Sequence[Point],
    granules_by_day: Mapping[date, Sequence[Granule]],
    pixels: PixelGrid,
    box: Box,
    finished_at: datetime,
) -> DataRun:
    granules = [granule for day in days for granule in granules_by_day[day]]
    return DataRun(
        source=SOURCE_KEY,
        params={
            **_base_params(granules, pixels, box, points),
            "dias_de_semeadura": {
                band: f"{month:02d}-{day:02d}"
                for band, (month, day) in SOWING_MONTH_DAY_BY_HARVEST.items()
            },
            "dias": [day.isoformat() for day in days],
            "dias_incompletos": {
                day.isoformat(): len(granules_by_day[day])
                for day in days
                if len(granules_by_day[day]) != GRANULES_PER_DAY
            },
        },
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-smap-l4",
    )


def _point_json(point: Point, pixels: PixelGrid, serie: list[dict[str, Any]]) -> dict[str, Any]:
    pixel = pixels.pixel_of[point]
    lat, lon = pixels.center(pixel)
    return {
        "lat": point.lat,
        "lon": point.lon,
        "pixel_9km": {
            "linha": pixel.row,
            "coluna": pixel.col,
            "lat": round(lat, COORD_DECIMALS),
            "lon": round(lon, COORD_DECIMALS),
        },
        "serie": serie,
    }


def build_smap_file(
    days: Sequence[date],
    points: Sequence[Point],
    client: SmapOpendapClient,
    clock: Callable[[], datetime],
    box: Box = PILOT_BOX,
) -> dict[str, Any]:
    """Monta o arquivo do contrato SMAP: `versao_dados` e a série de cada ponto nos `days`.

    `clock` é lido depois de todos os pedidos: o `fim` é a hora em que a carga acabou.
    """
    if not days or not points:
        raise ValueError("informe ao menos um dia e um ponto")
    granules_by_day = {day: client.granules(day) for day in days}
    granules = [granule for day in days for granule in granules_by_day[day]]
    if not granules:
        raise OpendapError("o CMR não listou nenhum granulo do SMAP nos dias pedidos")
    structure = client.structure(granules[0])
    pixels = locate_pixels(points, client, granules[0], structure)
    client.prefetch(
        [
            SubsetTask(granule, variable, pixels.window)
            for granule in granules
            for variable in DATA_VARIABLES.values()
        ]
    )

    series: dict[Point, list[dict[str, Any]]] = {point: [] for point in points}
    for day in days:
        grids = {
            field: [client.subset(g, variable, pixels.window) for g in granules_by_day[day]]
            for field, variable in DATA_VARIABLES.items()
        }
        for point in points:
            item = _daily_item(day, pixels.pixel_of[point], pixels.window, grids, structure)
            if item is not None:
                series[point].append(item)

    run = _data_run(days, points, granules_by_day, pixels, box, clock())
    return _contract(run, [_point_json(point, pixels, series[point]) for point in points])


# --- SMAP recente e percentil na climatologia (A2.2) ----------------------------------------------


def climatology_days(
    day: date, window_days: int = DEFAULT_WINDOW_DAYS, first_year: int = CLIMATOLOGY_FIRST_YEAR
) -> list[date]:
    """A mesma janela do ano (o dia ± `window_days`) de `first_year` até o ano anterior ao `day`.

    29/02 vira 28/02 nos anos que não são bissextos. Dia antes do início do SMAP fica de fora.
    """
    days: list[date] = []
    for year in range(first_year, day.year):
        try:
            center = day.replace(year=year)
        except ValueError:
            center = date(year, 2, 28)
        days.extend(
            center + timedelta(days=offset) for offset in range(-window_days, window_days + 1)
        )
    return [d for d in days if SMAP_FIRST_DAY <= d < day]


def percentile_rank(value: float, climatology: Sequence[float]) -> float:
    """Posição percentual (0 a 100): % da climatologia abaixo do valor, com empates valendo meio."""
    if not climatology:
        raise ValueError("climatologia vazia")
    below = sum(1 for v in climatology if v < value)
    equal = sum(1 for v in climatology if v == value)
    return round(100.0 * (below + 0.5 * equal) / len(climatology), PCTL_DECIMALS)


def _contract(run: DataRun, pontos: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "versao_dados": {
            "fonte": run.source,
            "parametros": dict(run.params),
            "fim": run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": run.version,
        },
        "pontos": pontos,
    }


def _point_percentile(
    recent: dict[str, Any] | None,
    pixel: Pixel,
    window: PixelWindow,
    climatology: Mapping[date, Sequence[Sequence[Sequence[float]]]],
    fill_value: float,
) -> float | None:
    """Percentil da `sm_rootzone` de agora no pixel; None sem dado ou com poucos anos."""
    if recent is None:
        return None
    i, j = pixel.row - window.row_first, pixel.col - window.col_first
    by_day = {
        day: daily_mean([grid[i][j] for grid in grids], fill_value)
        for day, grids in climatology.items()
    }
    values = [value for value in by_day.values() if value is not None]
    years = {day.year for day, value in by_day.items() if value is not None}
    if len(years) < MIN_CLIMATOLOGY_YEARS:
        return None
    return percentile_rank(recent[CLIMATOLOGY_FIELD], values)


def build_recent_file(
    points: Sequence[Point],
    client: SmapOpendapClient,
    clock: Callable[[], datetime],
    box: Box = PILOT_BOX,
    window_days: int = DEFAULT_WINDOW_DAYS,
    first_year: int = CLIMATOLOGY_FIRST_YEAR,
) -> dict[str, Any]:
    """Arquivo do SMAP recente: o dia completo mais recente e o percentil de cada ponto (A2.2).

    O ponto segue o contrato SMAP (série com o dia recente) e ganha `sm_rootzone_pctl` (0 a 100,
    ou `null` com menos de `MIN_CLIMATOLOGY_YEARS` anos na janela).
    """
    if not points:
        raise ValueError("informe ao menos um ponto")
    day = client.latest_complete_day()
    recent_granules = client.granules(day)
    clim_days = climatology_days(day, window_days, first_year)
    clim_granules = {clim_day: client.granules(clim_day) for clim_day in clim_days}
    structure = client.structure(recent_granules[0])
    pixels = locate_pixels(points, client, recent_granules[0], structure)
    window = pixels.window
    clim_variable = DATA_VARIABLES[CLIMATOLOGY_FIELD]
    client.prefetch(
        [
            SubsetTask(g, variable, window)
            for g in recent_granules
            for variable in DATA_VARIABLES.values()
        ]
        + [SubsetTask(g, clim_variable, window) for d in clim_days for g in clim_granules[d]]
    )

    recent_grids = {
        field: [client.subset(g, variable, window) for g in recent_granules]
        for field, variable in DATA_VARIABLES.items()
    }
    climatology = {
        clim_day: [client.subset(g, clim_variable, window) for g in granules]
        for clim_day, granules in clim_granules.items()
        if granules
    }
    fill_value = structure.fill_value(clim_variable)
    pontos: list[dict[str, Any]] = []
    for point in points:
        pixel = pixels.pixel_of[point]
        recent = _daily_item(day, pixel, window, recent_grids, structure)
        point_json = _point_json(point, pixels, [recent] if recent else [])
        point_json["sm_rootzone_pctl"] = _point_percentile(
            recent, pixel, window, climatology, fill_value
        )
        pontos.append(point_json)

    finished_at = clock()
    run = DataRun(
        source=SOURCE_KEY,
        params={
            **_base_params(recent_granules, pixels, box, points),
            "modo": "recente",
            "data": day.isoformat(),
            "climatologia": {
                "variavel": clim_variable,
                "anos": [first_year, day.year - 1],
                "janela_dias": window_days,
                "dias": len(clim_days),
                "dias_incompletos": {
                    d.isoformat(): len(clim_granules[d])
                    for d in clim_days
                    if len(clim_granules[d]) != GRANULES_PER_DAY
                },
                "minimo_de_anos": MIN_CLIMATOLOGY_YEARS,
                "percentil": (
                    "% dos dias da climatologia com a média do dia abaixo da de agora "
                    "(empate conta meio)"
                ),
            },
        },
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-smap-l4-recente",
    )
    return _contract(run, pontos)


# --- plano (--dry-run) e linha de comando ---------------------------------------------------------


@dataclass(frozen=True)
class PlanCounts:
    """Pedidos de uma execução e quantos ainda faltam no cache (contados sem rede)."""

    cmr_total: int
    cmr_pending: int
    meta_total: int  # DMR e coordenadas
    meta_pending: int
    data_total: int
    data_pending: int


def _cached_window(points: Sequence[Point], client: SmapOpendapClient) -> PixelWindow | None:
    """O retângulo, se as coordenadas da grade já estiverem no cache (sem rede)."""
    dummy = Granule("", datetime(2015, 3, 31, tzinfo=UTC), "", "")
    lat_column = client.cached_subset(
        SubsetTask(dummy, LAT_VARIABLE, PixelWindow(0, GRID_ROWS - 1, 0, 0))
    )
    lon_row = client.cached_subset(
        SubsetTask(dummy, LON_VARIABLE, PixelWindow(0, 0, 0, GRID_COLUMNS - 1))
    )
    if lat_column is None or lon_row is None:
        return None
    return pixel_window_for(points, [row[0] for row in lat_column], lon_row[0])


def count_requests(
    days: Sequence[date], points: Sequence[Point], client: SmapOpendapClient
) -> PlanCounts:
    """Conta os pedidos e o que já está no cache, sem rede (o que não dá para saber, falta)."""
    window = _cached_window(points, client)
    dummy = Granule("", datetime(2015, 3, 31, tzinfo=UTC), "", "")
    meta_pending = 0 if client.has_structure() else 1
    if window is None:
        meta_pending += 4
    else:
        meta_pending += sum(
            1
            for variable in COORDINATE_VARIABLES
            if not client.is_cached(SubsetTask(dummy, variable, window))
        )
    data_total = len(days) * GRANULES_PER_DAY * len(DATA_VARIABLES)
    data_pending = 0
    for day in days:
        granules = client.cached_granules(day)
        if granules is None or window is None:
            data_pending += GRANULES_PER_DAY * len(DATA_VARIABLES)
            continue
        data_pending += sum(
            1
            for granule in granules
            for variable in DATA_VARIABLES.values()
            if not client.is_cached(SubsetTask(granule, variable, window))
        )
    return PlanCounts(
        cmr_total=len(days),
        cmr_pending=sum(1 for day in days if not client.is_cmr_cached(day)),
        meta_total=5,
        meta_pending=meta_pending,
        data_total=data_total,
        data_pending=data_pending,
    )


def _duration(seconds: float) -> str:
    if seconds < 3600:
        return f"{max(1, round(seconds / 60))} min"
    return f"{seconds / 3600:.1f} h".replace(".", ",")


def describe_plan(
    days: Sequence[date],
    points: Sequence[Point],
    client: SmapOpendapClient,
    workers: int,
    box: Box,
) -> str:
    counts = count_requests(days, points, client)
    seconds = (
        counts.cmr_pending * MEASURED_SECONDS_PER_CMR_REQUEST
        + counts.meta_pending * MEASURED_SECONDS_PER_OPENDAP_REQUEST
        + counts.data_pending * MEASURED_SECONDS_PER_OPENDAP_REQUEST / max(1, workers)
    )
    bands = ", ".join(
        f"{band} {day:02d}/{month:02d}"
        for band, (month, day) in SOWING_MONTH_DAY_BY_HARVEST.items()
    )
    years = sorted({day.year for day in days})
    variables = ", ".join(variable.rsplit("/", 1)[-1] for variable in DATA_VARIABLES.values())
    return "\n".join(
        [
            f"{len(days)} dias de semeadura ({bands}; de {years[0]} a {years[-1]}) | "
            f"{len(points)} células de 0,1° (caixa {box.lat_min}..{box.lat_max}, "
            f"{box.lon_min}..{box.lon_max})",
            f"{len(days) * GRANULES_PER_DAY} granulos do {PRODUCT} ({GRANULES_PER_DAY} por dia, "
            f"de 3 h, em UTC) | variáveis: {variables}",
            f"Pedidos: {counts.cmr_total} buscas no CMR (públicas; faltam {counts.cmr_pending}) + "
            f"{counts.meta_total} de estrutura e coordenadas (faltam {counts.meta_pending}) + "
            f"{counts.data_total} recortes no OPeNDAP (faltam {counts.data_pending})",
            f"Tempo estimado: ~{_duration(seconds)} com {workers} em paralelo "
            f"(~{MEASURED_SECONDS_PER_OPENDAP_REQUEST:g} s por pedido ao OPeNDAP)",
        ]
    )


def describe_recent_plan(
    points: Sequence[Point],
    client: SmapOpendapClient,
    workers: int,
    box: Box,
    window_days: int,
) -> str:
    """Plano do `--recente`: acha o dia no CMR (público) e conta os recortes que faltam."""
    day = client.latest_complete_day()
    clim_days = climatology_days(day, window_days)
    window = _cached_window(points, client)
    clim_variable = DATA_VARIABLES[CLIMATOLOGY_FIELD]

    def pending(days: Sequence[date], variables: Sequence[str]) -> int:
        missing = 0
        for each in days:
            granules = client.cached_granules(each)
            if granules is None or window is None:
                missing += GRANULES_PER_DAY * len(variables)
                continue
            missing += sum(
                1
                for granule in granules
                for variable in variables
                if not client.is_cached(SubsetTask(granule, variable, window))
            )
        return missing

    recent_total = GRANULES_PER_DAY * len(DATA_VARIABLES)
    recent_pending = pending([day], list(DATA_VARIABLES.values()))
    clim_total = len(clim_days) * GRANULES_PER_DAY
    clim_pending = pending(clim_days, [clim_variable])
    cmr_pending = sum(1 for each in clim_days if not client.is_cmr_cached(each))
    meta_pending = (0 if client.has_structure() else 1) + (4 if window is None else 0)
    seconds = (
        cmr_pending * MEASURED_SECONDS_PER_CMR_REQUEST
        + meta_pending * MEASURED_SECONDS_PER_OPENDAP_REQUEST
        + (recent_pending + clim_pending) * MEASURED_SECONDS_PER_OPENDAP_REQUEST / max(1, workers)
    )
    years = sorted({each.year for each in clim_days})
    year_range = f"de {years[0]} a {years[-1]}" if years else "sem anos"
    return "\n".join(
        [
            f"Dia completo mais recente no CMR: {day} | {len(points)} células de 0,1° (caixa "
            f"{box.lat_min}..{box.lat_max}, {box.lon_min}..{box.lon_max})",
            f"Recente: {recent_total} recortes ({GRANULES_PER_DAY} granulos × "
            f"{len(DATA_VARIABLES)} variáveis; faltam {recent_pending})",
            f"Climatologia: {len(clim_days)} dias ({year_range}, {day:%d/%m} ± {window_days} "
            f"dias) → {clim_total} recortes de {clim_variable.rsplit('/', 1)[-1]} (faltam "
            f"{clim_pending}) e {len(clim_days)} buscas no CMR (faltam {cmr_pending})",
            f"Tempo estimado: ~{_duration(seconds)} com {workers} em paralelo "
            f"(~{MEASURED_SECONDS_PER_OPENDAP_REQUEST:g} s por pedido ao OPeNDAP)",
        ]
    )


def parse_years(text: str) -> tuple[int, int]:
    """`"2016-2025"` ou `"2024"` → (primeiro, último). Recusa ano fora de ordem."""
    parts = [part.strip() for part in text.split("-")]
    if len(parts) not in (1, 2) or not all(part.isdigit() for part in parts):
        raise ValueError(f"anos inválidos (use 2016-2025 ou 2024): {text!r}")
    first, last = int(parts[0]), int(parts[-1])
    if first > last:
        raise ValueError(f"anos fora de ordem: {text!r}")
    return first, last


def _years_arg(text: str) -> tuple[int, int]:
    try:
        return parse_years(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _box_arg(text: str) -> Box:
    try:
        return parse_box(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _workers_arg(text: str) -> int:
    value = int(text)
    if value < 1:
        raise argparse.ArgumentTypeError("--paralelo precisa ser 1 ou mais")
    return value


def _window_arg(text: str) -> int:
    value = int(text)
    if value < 0:
        raise argparse.ArgumentTypeError("--janela-dias precisa ser 0 ou mais")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.fetch_smap", description=(__doc__ or "").splitlines()[0]
    )
    parser.add_argument(
        "--saida",
        type=Path,
        default=None,
        help=f"padrão: {DEFAULT_OUTPUT.name} (ou {DEFAULT_RECENT_OUTPUT.name} com --recente)",
    )
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument(
        "--area",
        type=_box_arg,
        default=PILOT_BOX,
        metavar="LAT_MIN,LAT_MAX,LON_MIN,LON_MAX",
        help='caixa (use --area="..."). Padrão: caixa piloto',
    )
    parser.add_argument(
        "--anos",
        type=_years_arg,
        default=(FIRST_YEAR, LAST_YEAR),
        metavar="PRIMEIRO-ULTIMO",
        help=f"padrão: {FIRST_YEAR}-{LAST_YEAR} (o SMAP começa em 31/03/2015)",
    )
    parser.add_argument(
        "--paralelo",
        type=_workers_arg,
        default=DEFAULT_WORKERS,
        help=f"pedidos ao OPeNDAP ao mesmo tempo (padrão {DEFAULT_WORKERS})",
    )
    parser.add_argument(
        "--recente",
        action="store_true",
        help="SMAP de agora e percentil na climatologia (A2.2), no lugar dos dias de semeadura",
    )
    parser.add_argument(
        "--janela-dias",
        type=_window_arg,
        default=DEFAULT_WINDOW_DAYS,
        help=f"com --recente: o dia ± N na climatologia (padrão {DEFAULT_WINDOW_DAYS})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="só mostra dias, pedidos e tempo (com --recente, faz a busca pública no CMR)",
    )
    return parser


def _offline_getter(url: str, params: dict[str, Any], timeout: float) -> str:
    raise OpendapError("o --dry-run não faz pedidos")


def main(
    argv: Sequence[str] | None = None,
    cmr_get: HttpGetter = default_http_get,
    opendap_transport: HttpTransport = default_http_request,
    settings: Settings | None = None,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    days = sowing_days(*args.anos)
    if not days and not args.recente:
        parser.error(f"nenhum dia de semeadura com SMAP nos anos pedidos (desde {SMAP_FIRST_DAY})")
    points = box_cell_centers(args.area)
    output = args.saida or (DEFAULT_RECENT_OUTPUT if args.recente else DEFAULT_OUTPUT)

    if args.dry_run:
        offline = SmapOpendapClient(args.cache, opendap_get=_offline_getter, cmr_get=cmr_get)
        if args.recente:
            try:
                plan = describe_recent_plan(
                    points, offline, args.paralelo, args.area, args.janela_dias
                )
            except OpendapError as exc:
                print(f"Parou: {exc}", file=sys.stderr)
                return 1
            print(plan)
            print(
                "--dry-run: só buscas públicas no CMR; nenhum recorte pedido nem arquivo gravado."
            )
            return 0
        print(describe_plan(days, points, offline, args.paralelo, args.area))
        print("--dry-run: nada foi pedido nem gravado.")
        return 0

    token = (settings or get_settings()).earthdata_token
    if not token:
        print(
            "Defina EARTHDATA_TOKEN (token da Earthdata Login, no .env desta pasta).",
            file=sys.stderr,
        )
        return 2

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", stream=sys.stderr)
    client = SmapOpendapClient(
        args.cache,
        opendap_get=EarthdataTextGetter(token, transport=opendap_transport),
        cmr_get=cmr_get,
        workers=args.paralelo,
    )
    try:
        if args.recente:
            result = build_recent_file(
                points, client, clock=now, box=args.area, window_days=args.janela_dias
            )
        else:
            result = build_smap_file(days, points, client, clock=now, box=args.area)
    except OpendapError as exc:
        print(f"Parou: {exc}", file=sys.stderr)
        return 1
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    what = (
        f"o dia {result['versao_dados']['parametros']['data']}"
        if args.recente
        else (f"{len(days)} dias")
    )
    print(
        f"{len(points)} pontos × {what} gravados em {output} "
        f"({client.downloads} pedidos ao OPeNDAP agora)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
