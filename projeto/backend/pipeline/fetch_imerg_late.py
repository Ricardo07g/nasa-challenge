"""Chuva dos últimos 30 dias pelo IMERG Late, por célula de 0,1°, contra a média (A2.3, 0033).

Uso (a partir de projeto/backend; o token vem do `.env` pelo `Settings`):

    uv run python -m pipeline.fetch_imerg_late --dry-run          # o plano, sem rede e sem token
    uv run python -m pipeline.fetch_imerg_late                    # caixa piloto, 30 dias
    uv run python -m pipeline.fetch_imerg_late --fim 2027-02-28 --area="-19.0,-18.8,-48.2,-48.0"

Fluxo:

1. **CMR** (público, sem token): os granulos diários do `GPM_3IMERGDL` v07 da janela, com o nome
   (o sufixo muda com o reprocessamento: `V07B`, `V07C`) e o link do OPeNDAP na nuvem
   (`opendap.earthdata.nasa.gov`). Sem `--fim`, a janela termina no dia mais recente que o CMR
   tem (o Late diário sai com cerca de 1 dia de atraso).
2. **OPeNDAP** (Hyrax, com o `EARTHDATA_TOKEN`): um pedido por dia, em ASCII, com o retângulo de
   pixels de 0,1° da caixa (`precipitation[time][lon][lat]`, em mm/dia). Cada resposta fica num
   cache local (fora do git): rodar de novo não pede o mesmo dia outra vez.
3. **Soma** dos dias por célula. Célula com algum dia sem dado (o -9999,9 do IMERG) fica de fora:
   nada de soma pela metade.
4. **Média:** a chuva do NASA POWER **já guardada** (`climate_season` do banco, com a fixture da
   fazenda de exemplo como reserva; sem `DATABASE_URL`, só a fixture), somada nos mesmos dias do
   calendário em cada ano anterior ao da janela. O POWER guardado vai de 1/jan a 31/jul: janela
   fora disso (ou que cruza o ano) não tem média, e nada é gravado. O sinal é para fev/mar.
5. Grava o arquivo do contrato "Chuva recente" (`AGENTS.md` do backend), que o
   `FileRecentRainRepository` lê pelo `IMERG_LATE_PATH`. Nada vai para o banco.
"""

import argparse
import json
import math
import re
import sys
import time
import urllib.parse
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from statistics import fmean
from typing import Any, Final, Protocol

from app.config import get_settings
from app.models.climate import ClimateSeason
from app.models.data_run import DataRun
from app.models.recent_rain import RecentRainRecord
from app.repositories.climate_repository import (
    FixtureClimateRepository,
    PostgisClimateRepository,
    cell_center,
    cell_id_for,
)
from app.repositories.external.http_client import (
    HttpRequest,
    HttpResponse,
    HttpTransport,
    default_http_request,
)
from app.repositories.recent_rain_repository import SOURCE_KEY
from pipeline.fetch_cmip6_deltas import PILOT_BOX, Box, parse_box, repo_root

SHORT_NAME: Final[str] = "GPM_3IMERGDL"
PRODUCT_VERSION: Final[str] = "07"
PRODUCT: Final[str] = f"{SHORT_NAME}.{PRODUCT_VERSION}"
VARIABLE: Final[str] = "precipitation"
CMR_GRANULES_URL: Final[str] = "https://cmr.earthdata.nasa.gov/search/granules.json"
# Uma página do CMR basta para a janela (30 dias); janela maior que isso é recusada.
CMR_PAGE_SIZE: Final[int] = 100
OPENDAP_PREFIX: Final[str] = "https://opendap.earthdata.nasa.gov/"
OPENDAP_SERVICE: Final[str] = "Cloud OPeNDAP da Earthdata (Hyrax), recorte por área em ASCII"
DEFAULT_DAYS: Final[int] = 30

# Grade do IMERG V07: pixels de 0,1° com centros em x,x5, latitude de -89,95 a 89,95 (1.800) e
# longitude de -179,95 a 179,95 (3.600). Bordas nos décimos: cada pixel é uma célula do backend.
GRID_STEP: Final[float] = 0.1
GRID_LAT_START: Final[float] = -89.95
GRID_LON_START: Final[float] = -179.95
GRID_LAT_COUNT: Final[int] = 1800
GRID_LON_COUNT: Final[int] = 3600
GRID_CELL_SCALE: Final[int] = 10
COORD_DECIMALS: Final[int] = 2
COORD_TOLERANCE: Final[float] = 1.0e-3  # o Hyrax imprime os mapas Float32 com 6 algarismos
RAIN_DECIMALS: Final[int] = 1
FRACTION_DECIMALS: Final[int] = 4

POWER_SOURCE: Final[str] = "nasa_power"
POWER_VARIABLE: Final[str] = "PRECTOTCORR"
REQUEST_TIMEOUT_SECONDS: Final[float] = 120.0
MAX_RETRIES: Final[int] = 3
BACKOFF_SECONDS: Final[float] = 5.0
_REFUSED: Final[frozenset[int]] = frozenset({401, 403})
# CMR medido em 14/11/2026: 0,8 s para os 30 granulos de uma janela. O recorte do OPeNDAP é
# ESTIMATIVA (sem token para medir): um dia, poucas centenas de pixels.
MEASURED_SECONDS_PER_CMR_REQUEST: Final[float] = 1.0
ESTIMATED_SECONDS_PER_OPENDAP_REQUEST: Final[float] = 3.0

# Pasta organizada do time (fora do git): o compose monta `data/baixados` no backend.
DOWNLOADS_DIR: Final[Path] = repo_root() / "data" / "baixados" / "nasa_gpm_imerg_late"
DEFAULT_OUTPUT: Final[Path] = DOWNLOADS_DIR / "chuva_30d_imerg_late.json"
DEFAULT_CACHE_DIR: Final[Path] = DOWNLOADS_DIR / "cache_opendap"

TOKEN_HINT: Final[str] = (
    "confira o EARTHDATA_TOKEN (vale 60 dias) e se o aplicativo NASA GESDISC DATA ARCHIVE está "
    "autorizado no perfil da Earthdata (Applications → Authorized Apps)"
)


class ImergLateError(Exception):
    """Falha ao falar com o CMR ou com o OPeNDAP (a mensagem nunca leva o token)."""


class SeasonsRepository(Protocol):
    """O que o script usa do clima guardado: as temporadas (1/jan a 31/jul) de uma célula."""

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]: ...


# --- grade do IMERG e caixa ----------------------------------------------------------------------


def pixel_center(lat_index: int, lon_index: int) -> tuple[float, float]:
    """Centro (lat, lon) do pixel do IMERG pelos índices na grade do arquivo."""
    return (
        round(GRID_LAT_START + GRID_STEP * lat_index, COORD_DECIMALS),
        round(GRID_LON_START + GRID_STEP * lon_index, COORD_DECIMALS),
    )


def pixel_cell_id(lat_index: int, lon_index: int) -> str:
    """Id da célula do backend (`cell_id_for`) que o pixel ocupa."""
    return cell_id_for(*pixel_center(lat_index, lon_index))


@dataclass(frozen=True)
class ImergWindow:
    """Retângulo de pixels do IMERG (índices inclusivos) que o OPeNDAP recorta de uma vez."""

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

    def cell_ids(self) -> list[str]:
        return [pixel_cell_id(i, j) for i in self.lat_indexes for j in self.lon_indexes]

    def key(self) -> str:
        return f"lat{self.lat_first}-{self.lat_last}_lon{self.lon_first}-{self.lon_last}"


def _cell_index_range(low: float, high: float) -> range:
    # As células de 0,1° da caixa, como na pré-carga: da borda de baixo (dentro) à de cima (fora).
    return range(
        math.floor(round(low * GRID_CELL_SCALE, 6)), math.ceil(round(high * GRID_CELL_SCALE, 6))
    )


def _pixel_index(cell_index: int, start: float) -> int:
    center = (cell_index + 0.5) / GRID_CELL_SCALE
    return round((center - start) / GRID_STEP)


def box_window(box: Box) -> ImergWindow:
    """Pixels do IMERG das células de 0,1° da caixa (caixa piloto: 15 × 15 = 225)."""
    lat_cells = _cell_index_range(box.lat_min, box.lat_max)
    lon_cells = _cell_index_range(box.lon_min, box.lon_max)
    window = ImergWindow(
        lat_first=_pixel_index(lat_cells[0], GRID_LAT_START),
        lat_last=_pixel_index(lat_cells[-1], GRID_LAT_START),
        lon_first=_pixel_index(lon_cells[0], GRID_LON_START),
        lon_last=_pixel_index(lon_cells[-1], GRID_LON_START),
    )
    if window.lat_first < 0 or window.lat_last >= GRID_LAT_COUNT:
        raise ValueError(
            f"caixa fora da grade do IMERG (latitude de {box.lat_min} a {box.lat_max})"
        )
    if window.lon_first < 0 or window.lon_last >= GRID_LON_COUNT:
        raise ValueError(
            f"caixa fora da grade do IMERG (longitude de {box.lon_min} a {box.lon_max})"
        )
    return window


# --- CMR: os granulos de cada dia --------------------------------------------------------------


@dataclass(frozen=True)
class Granule:
    """Um arquivo diário do IMERG Late: o dia, o nome e o endereço no OPeNDAP."""

    day: date
    name: str
    opendap_url: str


def cmr_params(start: date, end: date) -> dict[str, Any]:
    """Busca no CMR dos granulos diários da janela, em ordem de data."""
    return {
        "short_name": SHORT_NAME,
        "version": PRODUCT_VERSION,
        "temporal": f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z",
        "page_size": CMR_PAGE_SIZE,
        "sort_key": "start_date",
    }


def cmr_latest_params() -> dict[str, Any]:
    """Busca no CMR do granulo mais recente (o fim da janela quando não há `--fim`)."""
    return {
        "short_name": SHORT_NAME,
        "version": PRODUCT_VERSION,
        "page_size": 1,
        "sort_key": "-start_date",
    }


def parse_cmr_granules(payload: Mapping[str, Any]) -> list[Granule]:
    """Granulos da resposta JSON do CMR. Sem o link do OPeNDAP na nuvem, o granulo é ignorado."""
    granules: list[Granule] = []
    for entry in payload.get("feed", {}).get("entry", []):
        url = next(
            (
                str(link["href"])
                for link in entry.get("links", [])
                if str(link.get("href", "")).startswith(OPENDAP_PREFIX)
            ),
            None,
        )
        if url is None:
            continue
        granules.append(
            Granule(
                day=date.fromisoformat(str(entry["time_start"])[:10]),
                name=str(entry["title"]).split(":", 1)[-1],
                opendap_url=url,
            )
        )
    return granules


def window_days(end: date, days: int) -> list[date]:
    """Os `days` dias que terminam em `end` (inclusive), em ordem."""
    return [end - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


def check_granules(granules: Sequence[Granule], days: Sequence[date]) -> list[Granule]:
    """Um granulo por dia da janela. Dia repetido: fica o nome maior (`V07C` depois de `V07B`).

    Recusa (ValueError) janela com dia faltando: a soma de 30 dias com 29 parece seca.
    """
    by_day: dict[date, Granule] = {}
    for granule in sorted(granules, key=lambda g: g.name):
        by_day[granule.day] = granule
    missing = [day.isoformat() for day in days if day not in by_day]
    if missing:
        raise ValueError(f"o CMR não tem o {PRODUCT} (com OPeNDAP) de {', '.join(missing)}")
    return [by_day[day] for day in days]


# --- recorte em ASCII (Hyrax) ------------------------------------------------------------------


def opendap_ascii_url(granule: Granule, window: ImergWindow) -> str:
    """URL do recorte em ASCII: o único passo de tempo do dia no retângulo de pixels."""
    constraint = (
        f"{VARIABLE}[0:1:0][{window.lon_first}:1:{window.lon_last}]"
        f"[{window.lat_first}:1:{window.lat_last}]"
    )
    # Colchetes codificados, como no OPeNDAP da NCCS (o servidor pode recusar "[" e "]" crus).
    return f"{granule.opendap_url}.ascii?{urllib.parse.quote(constraint, safe=':')}"


_LAT_MAP = re.compile(rf"^{VARIABLE}\.lat, (.+)$")
_ROW = re.compile(rf"^{VARIABLE}(?:\.{VARIABLE})?((?:\[[^\]]*\])+), (.+)$")
_BRACKET = re.compile(r"\[([^\]]*)\]")


def _is_rain(value: float) -> bool:
    return math.isfinite(value) and value >= 0.0  # o preenchimento do IMERG é -9999,9


def _check_coordinates(axis: str, found: Sequence[float], expected: Sequence[float]) -> None:
    if len(found) != len(expected) or any(
        abs(f - e) > COORD_TOLERANCE for f, e in zip(found, expected, strict=True)
    ):
        raise ValueError(
            f"pixels de {axis} diferentes do pedido: {list(found)} (esperado {list(expected)})"
        )


def parse_imerg_ascii(text: str, window: ImergWindow) -> dict[str, float | None]:
    """Chuva do dia (mm) por célula, lida do ASCII do Hyrax; None onde o IMERG não tem dado.

    Aceita a variável como Grid (com os mapas: `precipitation.lat, ...` e linhas
    `precipitation.precipitation[precipitation.time=...][precipitation.lon=...], ...`) ou como
    Array (`precipitation[0][k], ...`). Recusa (ValueError) mensagem de erro, página HTML (como a
    do login da Earthdata), outro retângulo de pixels ou resposta pela metade.
    """
    stripped = text.lstrip()
    if stripped.startswith(("Error", "<")):
        raise ValueError(
            f"resposta do OPeNDAP sem dados ({TOKEN_HINT}): {stripped[:120]!r}".replace("\n", " ")
        )
    lat_indexes, lon_indexes = window.lat_indexes, window.lon_indexes
    lats: list[float] | None = None
    rows: list[tuple[list[str], str]] = []
    for line in text.splitlines():
        line = line.strip()
        if lat_map := _LAT_MAP.match(line):
            lats = [float(v) for v in lat_map.group(1).split(",")]
        elif row := _ROW.match(line):
            rows.append((_BRACKET.findall(row.group(1)), row.group(2)))
    if len(rows) != len(lon_indexes):
        raise ValueError(
            f"resposta do OPeNDAP com {len(rows)} linhas de longitude (esperado {len(lon_indexes)})"
        )
    if lats is not None:
        _check_coordinates("lat", lats, [pixel_center(i, 0)[0] for i in lat_indexes])

    values: dict[str, float | None] = {}
    for position, (lon_index, (brackets, row_values)) in enumerate(
        zip(lon_indexes, rows, strict=True)
    ):
        if len(brackets) != 2:
            raise ValueError(f"linha inesperada no OPeNDAP: {brackets!r}")
        lon_label = brackets[1]
        if "=" in lon_label:
            found = float(lon_label.split("=", 1)[1])
            _check_coordinates("lon", [found], [pixel_center(0, lon_index)[1]])
        elif int(lon_label) != position:
            raise ValueError(f"linha de longitude fora de ordem no OPeNDAP: {lon_label!r}")
        rain = [float(v) for v in row_values.split(",")]
        if len(rain) != len(lat_indexes):
            raise ValueError(f"linha com {len(rain)} valores (esperado {len(lat_indexes)})")
        for lat_index, value in zip(lat_indexes, rain, strict=True):
            values[pixel_cell_id(lat_index, lon_index)] = value if _is_rain(value) else None
    return values


# --- soma dos dias, média do POWER e registros -------------------------------------------------


def cell_totals(daily: Sequence[Mapping[str, float | None]]) -> dict[str, float]:
    """Soma dos dias por célula. Célula com algum dia sem dado fica de fora."""
    cells = sorted(set().union(*daily)) if daily else []
    totals: dict[str, float] = {}
    for cell_id in cells:
        values = [day.get(cell_id) for day in daily]
        if all(value is not None for value in values):
            totals[cell_id] = sum(value for value in values if value is not None)
    return totals


def _same_day(year: int, day: date) -> date:
    try:
        return day.replace(year=year)
    except ValueError:  # 29/fev num ano comum
        return date(year, 2, 28)


def power_window_average(
    seasons: Sequence[ClimateSeason], start: date, end: date
) -> tuple[float, int] | None:
    """Média da chuva somada nos mesmos dias do calendário nos anos anteriores ao da janela.

    Devolve (média em mm, anos usados). Ano cuja temporada (1/jan a 31/jul) não cobre a janela
    inteira fica de fora; sem nenhum ano, None.
    """
    span = end - start
    sums: list[float] = []
    for season in seasons:
        if season.year >= end.year:
            continue
        last_day = _same_day(season.year, end)
        first = (last_day - span - season.start_date).days
        last = (last_day - season.start_date).days
        if first < 0 or last >= len(season.rain_mm):
            continue
        sums.append(sum(season.rain_mm[first : last + 1]))
    return (fmean(sums), len(sums)) if sums else None


def build_records(
    totals: Mapping[str, float],
    averages: Mapping[str, tuple[float, int]],
    end: date,
    days: int,
) -> list[RecentRainRecord]:
    """Um registro por célula com a soma e a média. Sem média, ou com média zero: fora."""
    records: list[RecentRainRecord] = []
    for cell_id in sorted(totals):
        average = averages.get(cell_id)
        if average is None:
            continue
        media = round(average[0], RAIN_DECIMALS)
        if media <= 0.0:
            continue
        chuva = round(totals[cell_id], RAIN_DECIMALS)
        lat, lon = cell_center(cell_id)
        records.append(
            RecentRainRecord(
                cell_id=cell_id,
                lat=round(lat, COORD_DECIMALS),
                lon=round(lon, COORD_DECIMALS),
                data=end,
                dias=days,
                chuva_30d_mm=chuva,
                media_30d_mm=media,
                fracao_da_media=round(chuva / media, FRACTION_DECIMALS),
                anos_media=average[1],
            )
        )
    return records


def _record_json(record: RecentRainRecord) -> dict[str, Any]:
    return {
        "cell_id": record.cell_id,
        "lat": record.lat,
        "lon": record.lon,
        "data": record.data.isoformat(),
        "dias": record.dias,
        "chuva_30d_mm": record.chuva_30d_mm,
        "media_30d_mm": record.media_30d_mm,
        "fracao_da_media": record.fracao_da_media,
        "anos_media": record.anos_media,
    }


def _data_run(
    granules: Sequence[Granule],
    box: Box,
    days: int,
    cells: int,
    finished_at: datetime,
) -> DataRun:
    return DataRun(
        source=SOURCE_KEY,
        params={
            "produto": PRODUCT,
            "servico": OPENDAP_SERVICE,
            "variavel": VARIABLE,
            "inicio": granules[0].day.isoformat(),
            "fim": granules[-1].day.isoformat(),
            "dias": days,
            "granulos": [g.name for g in granules],
            "caixa": {
                "lat_min": box.lat_min,
                "lat_max": box.lat_max,
                "lon_min": box.lon_min,
                "lon_max": box.lon_max,
            },
            "celulas": cells,
            "media": {
                "fonte": POWER_SOURCE,
                "variavel": POWER_VARIABLE,
                "origem": "chuva guardada (climate_season do banco ou fixture do clima)",
                "regra": "mesmos dias do calendário, nos anos anteriores ao da janela",
            },
        },
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-imerg-late",
    )


def contract_json(records: Sequence[RecentRainRecord], run: DataRun) -> dict[str, Any]:
    """O arquivo do contrato "Chuva recente": `versao_dados` + `celulas[]`."""
    return {
        "versao_dados": {
            "fonte": run.source,
            "parametros": dict(run.params),
            "fim": run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": run.version,
        },
        "celulas": [_record_json(record) for record in records],
    }


# --- HTTP ----------------------------------------------------------------------------------------


def _short_url(url: str) -> str:
    return url.split("?", 1)[0]


def _get(transport: HttpTransport, request: HttpRequest, sleep: Callable[[float], None]) -> bytes:
    """GET com novas tentativas em erro de rede e 5xx. 401/403 param na hora, com a dica."""
    error = ""
    for attempt in range(MAX_RETRIES + 1):
        try:
            response: HttpResponse = transport(request, REQUEST_TIMEOUT_SECONDS)
        except OSError as exc:  # inclui URLError e timeout
            error = f"falha de rede: {exc}"
        else:
            if response.status == 200:
                return response.body
            if response.status in _REFUSED:
                raise ImergLateError(
                    f"pedido recusado (HTTP {response.status}) em {_short_url(request.url)}: "
                    f"{TOKEN_HINT}"
                )
            error = f"HTTP {response.status}"
        if attempt < MAX_RETRIES:
            sleep(BACKOFF_SECONDS * 2**attempt)
    raise ImergLateError(
        f"{_short_url(request.url)}: {error} depois de {MAX_RETRIES + 1} tentativas"
    )


def _cmr_granules(
    transport: HttpTransport, params: dict[str, Any], sleep: Callable[[float], None]
) -> list[Granule]:
    body = _get(transport, HttpRequest(method="GET", url=CMR_GRANULES_URL, params=params), sleep)
    return parse_cmr_granules(json.loads(body.decode("utf-8")))


def _cache_path(cache_dir: Path, day: date, window: ImergWindow) -> Path:
    return cache_dir / f"{day:%Y%m%d}_{window.key()}.txt"


def fetch_day(
    granule: Granule,
    window: ImergWindow,
    *,
    transport: HttpTransport,
    token: str,
    cache_dir: Path,
    sleep: Callable[[float], None],
) -> dict[str, float | None]:
    """Chuva do dia por célula, do cache ou do OPeNDAP (só resposta válida vai para o cache)."""
    path = _cache_path(cache_dir, granule.day, window)
    if path.is_file():
        return parse_imerg_ascii(path.read_text(encoding="utf-8"), window)
    request = HttpRequest(
        method="GET",
        url=opendap_ascii_url(granule, window),
        authorization=f"Bearer {token}",
        headers={"Accept": "text/plain"},
    )
    text = _get(transport, request, sleep).decode("utf-8-sig")
    values = parse_imerg_ascii(text, window)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return values


# --- execução ------------------------------------------------------------------------------------


def token_from_settings() -> str | None:
    return get_settings().earthdata_token


def climate_repository_from_settings() -> SeasonsRepository:
    """O clima guardado, como a API lê: banco com a fixture de reserva, ou só a fixture."""
    settings = get_settings()
    fixture = FixtureClimateRepository(settings.clima_path)
    if settings.database_url:
        return PostgisClimateRepository(settings.database_url, fallback_repo=fixture)
    return fixture


def _log(message: str) -> None:
    print(message, file=sys.stderr)


def _box_arg(text: str) -> Box:
    try:
        return parse_box(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _days_arg(text: str) -> int:
    days = int(text)
    if not 1 <= days <= CMR_PAGE_SIZE:
        raise argparse.ArgumentTypeError(f"--dias precisa estar entre 1 e {CMR_PAGE_SIZE}")
    return days


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Chuva dos últimos dias pelo IMERG Late, por célula, contra a média do POWER."
    )
    parser.add_argument(
        "--fim",
        type=date.fromisoformat,
        default=None,
        help="último dia somado (AAAA-MM-DD); padrão: o mais recente no CMR",
    )
    parser.add_argument(
        "--dias", type=_days_arg, default=DEFAULT_DAYS, help=f"dias somados (padrão {DEFAULT_DAYS})"
    )
    parser.add_argument(
        "--area",
        type=_box_arg,
        default=PILOT_BOX,
        help='caixa "lat_min,lat_max,lon_min,lon_max" (padrão: caixa piloto)',
    )
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--dry-run", action="store_true",
                        help="mostra o plano sem rede e sem token")  # fmt: skip
    return parser.parse_args(argv)


def _print_plan(args: argparse.Namespace, window: ImergWindow) -> None:
    cells = len(window.cell_ids())
    if args.fim is not None:
        days = window_days(args.fim, args.dias)
        cached = sum(_cache_path(args.cache, day, window).is_file() for day in days)
        janela = f"{days[0].isoformat()} a {days[-1].isoformat()}"
        cmr_requests = 1
    else:
        cached = 0
        janela = f"os {args.dias} dias até o mais recente no CMR (o Late sai com ~1 dia)"
        cmr_requests = 2
    pending = args.dias - cached
    seconds = (
        cmr_requests * MEASURED_SECONDS_PER_CMR_REQUEST
        + pending * ESTIMATED_SECONDS_PER_OPENDAP_REQUEST
    )
    print(f"IMERG Late ({PRODUCT}), chuva dos últimos {args.dias} dias")
    print(f"janela: {janela}")
    print(
        f"caixa: {cells} células de 0,1° (pixels lat {window.lat_first}–{window.lat_last}, "
        f"lon {window.lon_first}–{window.lon_last})"
    )
    print(
        f"pedidos: {cmr_requests} ao CMR (público) + {pending} pedidos ao OPeNDAP "
        f"(com EARTHDATA_TOKEN; {cached} dias já no cache), ~{math.ceil(seconds)} s (estimativa)"
    )
    print(f"média: {POWER_SOURCE} {POWER_VARIABLE} guardado (banco com a fixture de reserva)")
    print(f"saída: {args.saida}")
    print("(dry-run) nada foi pedido nem gravado.")


def run(
    argv: Sequence[str] | None = None,
    *,
    transport: HttpTransport = default_http_request,
    load_token: Callable[[], str | None] = token_from_settings,
    load_climate_repository: Callable[[], SeasonsRepository] = climate_repository_from_settings,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    sleep: Callable[[float], None] = time.sleep,
    log: Callable[[str], None] = _log,
) -> int:
    """Executa o script. Devolve 0 (arquivo gravado) ou 1 (erro: nada foi gravado)."""
    args = _parse_args(argv)
    window = box_window(args.area)
    if args.dry_run:
        _print_plan(args, window)
        return 0
    token = load_token()
    if not token:
        log(
            "Erro: falta o EARTHDATA_TOKEN no projeto/backend/.env (gere em "
            "https://urs.earthdata.nasa.gov, em Generate Token). Nada foi pedido."
        )
        return 1
    try:
        end: date | None = args.fim
        if end is None:
            latest = _cmr_granules(transport, cmr_latest_params(), sleep)
            if not latest:
                raise ImergLateError(f"o CMR não tem nenhum granulo do {PRODUCT} com OPeNDAP")
            end = latest[0].day
        days = window_days(end, args.dias)
        granules = check_granules(_cmr_granules(transport, cmr_params(days[0], end), sleep), days)
        log(f"IMERG Late de {days[0]} a {end}: {len(window.cell_ids())} células, {len(days)} dias")
        daily = []
        for position, granule in enumerate(granules, start=1):
            daily.append(
                fetch_day(
                    granule,
                    window,
                    transport=transport,
                    token=token,
                    cache_dir=args.cache,
                    sleep=sleep,
                )
            )
            log(f"  {position}/{len(granules)} {granule.day}")
        totals = cell_totals(daily)
        climate = load_climate_repository()
        averages: dict[str, tuple[float, int]] = {}
        for cell_id in totals:
            average = power_window_average(climate.get_seasons(cell_id), days[0], end)
            if average is not None:
                averages[cell_id] = average
        records = build_records(totals, averages, end, args.dias)
        if not records:
            log(
                f"Erro: nenhuma célula com a média do POWER para {days[0]} a {end}. O POWER "
                "guardado vai de 1/jan a 31/jul (com banco, rode antes a pré-carga da caixa). "
                "Nada foi gravado."
            )
            return 1
        payload = contract_json(
            records, _data_run(granules, args.area, args.dias, len(records), now())
        )
        args.saida.parent.mkdir(parents=True, exist_ok=True)
        args.saida.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        missing_rain = len(window.cell_ids()) - len(totals)
        log(
            f"{len(records)} células gravadas em {args.saida} ({missing_rain} com algum dia sem "
            f"dado do IMERG; {len(totals) - len(records)} sem a média do POWER)"
        )
        return 0
    except (ImergLateError, OSError, ValueError) as exc:
        log(f"Erro: {exc}")
        return 1


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
