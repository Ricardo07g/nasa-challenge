"""Chuva diária do GPM IMERG Final na caixa piloto, por recorte do OPeNDAP (R2.4, tarefa 0026).

Uso (a partir de projeto/backend; o token vem do `.env` pelo `Settings`, `EARTHDATA_TOKEN`):

    uv run python -m pipeline.fetch_imerg --dry-run          # pedidos e tempo, sem rede
    uv run python -m pipeline.fetch_imerg --anos 2024        # um ano só, para conferir
    uv run python -m pipeline.fetch_imerg                    # 2005–2024, caixa piloto inteira

Produto: `GPM_3IMERGDF` versão 07 (IMERG Final, 1 dia, 0,1°), variável `precipitation` (mm/dia).
A grade do IMERG tem centros em x,x5: cada célula de 0,1° do projeto (`cell_id_for`, `floor`) é
exatamente um pixel. Passos:

1. **CMR** (busca pública, sem token): a lista dos arquivos de cada ano, paginada. O nome do
   arquivo muda com o processamento (`V07A`, `V07B`): vem sempre do CMR, nunca é montado à mão.
2. **DAS** (atributos) de um arquivo por versão: confere a unidade (`mm/day`), o valor de
   preenchimento e a origem do eixo do tempo.
3. **Um recorte ASCII por dia** no OPeNDAP do GES DISC (`gpm1`), com o retângulo de pixels que
   cobre as 225 células da caixa (`PILOT_*`). O primeiro pedido vai sozinho (confere o acesso e
   abre a sessão); os outros vão em paralelo (`--paralelo`, padrão 6), com retentativa e espera
   exponencial. Acesso recusado (401, 403, página de login) para tudo na hora.

Cada recorte é conferido (arquivo, dia, pixels e valores) antes de entrar no cache, gravado com
nome provisório e renomeado no fim: se o script parar, rodar de novo continua de onde parou.
Algum dia falhou: nada é gravado e o script pede para rodar de novo (o que baixou fica no cache).

A saída segue o contrato "IMERG" do `AGENTS.md` do backend: `versao_dados` (`fonte: gpm_imerg`)
e uma série por célula, com a chuva de 212 dias desde 1/jan de cada ano (a janela do
`ClimateSeasonBuilder`). Dia sem arquivo ou pixel com o valor de preenchimento: `null`, nunca 0.
Saída e cache padrão em `data/baixados/nasa_gpm_imerg/`, a partir da raiz do repositório.
"""

import argparse
import http.client
import http.cookiejar
import json
import logging
import math
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.constants import (
    CLIMATE_SEASON_DAYS,
    HISTORICAL_END_YEAR,
    HISTORICAL_START_YEAR,
    PILOT_MAX_LAT,
    PILOT_MAX_LON,
    PILOT_MIN_LAT,
    PILOT_MIN_LON,
)
from app.models.climate import ImergCellSeries, ImergSeason
from app.models.data_run import DataRun
from app.repositories.climate_repository import cell_center
from app.repositories.external.http_client import (
    HttpRequest,
    HttpResponse,
    HttpTransport,
    default_http_request,
)
from pipeline.fetch_cmip6_deltas import repo_root
from pipeline.preload_pilot_box import pilot_box_cells

logger = logging.getLogger(__name__)

SOURCE_KEY = "gpm_imerg"
PRODUCT = "GPM_3IMERGDF"
PRODUCT_VERSION = "07"
VARIABLE = "precipitation"
EXPECTED_UNIT = "mm/day"
CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
# OPeNDAP do GES DISC testado com o token em 14/11/2026. O link de OPeNDAP que o CMR traz é o da
# nuvem (opendap.earthdata.nasa.gov), que não foi testado: do CMR o script usa só o nome do arquivo.
OPENDAP_BASE_URL = (
    f"https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/{PRODUCT}.{PRODUCT_VERSION}"
)
OPENDAP_SERVICE = "GES DISC OPeNDAP (gpm1, recorte por área, ASCII)"

# Grade do IMERG (DDS conferido em 14/11/2026): precipitation[time = 1][lon = 3600][lat = 1800],
# centros de 0,1° de −179,95 a 179,95 e de −89,95 a 89,95.
GRID_STEP = 0.1
GRID_LAT_START = -89.95
GRID_LON_START = -179.95
GRID_LAT_COUNT = 1800
GRID_LON_COUNT = 3600
# Pixel do IMERG da célula: o índice `floor` da célula (lat × 10) mais o deslocamento da grade.
LAT_INDEX_OFFSET = 900
LON_INDEX_OFFSET = 1800
COORDINATE_TOLERANCE = 1.0e-3
# _FillValue do DAS: -9999.90039. Abaixo deste limite o valor é preenchimento (sem dado).
FILL_VALUE_LIMIT = -9999.0
RAIN_DECIMALS = 2

CMR_PAGE_SIZE = 2000
CMR_MAX_PAGES = 20
DEFAULT_PARALLEL = 6
MAX_PARALLEL = 10  # o GES DISC é público: mais que isso pesa no servidor
OPENDAP_TIMEOUT_SECONDS = 120.0
MAX_RETRIES = 3
BACKOFF_SECONDS = 5.0
# Medido pelo orquestrador em 14/11/2026: ~11 s no primeiro pedido (inclui o login da Earthdata).
# Com a sessão aberta (cookie), os seguintes devem ser mais rápidos: a estimativa é um teto.
MEASURED_SECONDS_PER_REQUEST = 11.0

# Hosts que podem receber o token no redirecionamento do login da Earthdata.
TRUSTED_AUTH_HOST_SUFFIXES = (".earthdata.nasa.gov", ".eosdis.nasa.gov")

DOWNLOADS_DIR = repo_root() / "data" / "baixados" / "nasa_gpm_imerg"
DEFAULT_OUTPUT = DOWNLOADS_DIR / "imerg_diario_caixa.json"
DEFAULT_CACHE_DIR = DOWNLOADS_DIR / "cache_opendap"

PILOT_BOX = {
    "lat_min": PILOT_MIN_LAT,
    "lat_max": PILOT_MAX_LAT,
    "lon_min": PILOT_MIN_LON,
    "lon_max": PILOT_MAX_LON,
}

_FILE_NAME = re.compile(r"3B-DAY\.MS\.MRG\.3IMERG\.(\d{8})-S000000-E235959\.(V\d{2}[A-Z])\.nc4")


class DownloadError(RuntimeError):
    """Pedido que não deu certo depois das retentativas (o dia fica para a próxima execução)."""


class ImergAuthError(RuntimeError):
    """O GES DISC recusou o acesso: token vencido, aplicativo não autorizado ou EULA não aceita."""


# --- grade, células e dias ----------------------------------------------------------------------


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
class Granule:
    """Um arquivo diário do IMERG Final: o dia e o nome que o CMR deu."""

    day: date
    file_name: str

    @property
    def version(self) -> str:
        """Versão do processamento no nome do arquivo (ex.: `V07B`)."""
        match = _FILE_NAME.fullmatch(self.file_name)
        if match is None:
            raise ValueError(f"nome de arquivo do IMERG inesperado: {self.file_name!r}")
        return match.group(2)


def pixel_lat(index: int) -> float:
    return GRID_LAT_START + GRID_STEP * index


def pixel_lon(index: int) -> float:
    return GRID_LON_START + GRID_STEP * index


def _cell_indexes(cell_id: str) -> tuple[int, int]:
    lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))
    return lat_idx, lon_idx


def cell_pixel(cell_id: str) -> tuple[int, int]:
    """(índice de lat, índice de lon) do pixel do IMERG da célula de 0,1° do projeto."""
    lat_idx, lon_idx = _cell_indexes(cell_id)
    lat_index, lon_index = lat_idx + LAT_INDEX_OFFSET, lon_idx + LON_INDEX_OFFSET
    if not (0 <= lat_index < GRID_LAT_COUNT and 0 <= lon_index < GRID_LON_COUNT):
        raise ValueError(f"célula fora da grade do IMERG: {cell_id}")
    return lat_index, lon_index


def pilot_cells() -> list[str]:
    """As 225 células de 0,1° da caixa piloto (as da pré-carga), em ordem de lat e lon."""
    return sorted((cell.cell_id for cell in pilot_box_cells()), key=_cell_indexes)


def pixel_window(cell_ids: Sequence[str]) -> PixelWindow:
    """Menor retângulo de pixels que contém o pixel de cada célula."""
    if not cell_ids:
        raise ValueError("nenhuma célula informada")
    pixels = [cell_pixel(cell_id) for cell_id in cell_ids]
    return PixelWindow(
        lat_first=min(p[0] for p in pixels),
        lat_last=max(p[0] for p in pixels),
        lon_first=min(p[1] for p in pixels),
        lon_last=max(p[1] for p in pixels),
    )


def season_days(year: int) -> list[date]:
    """Os 212 dias desde 1/jan, a janela do `ClimateSeasonBuilder` (no bissexto, até 30/jul)."""
    start = date(year, 1, 1)
    return [start + timedelta(days=offset) for offset in range(CLIMATE_SEASON_DAYS)]


def opendap_ascii_url(granule: Granule, window: PixelWindow) -> str:
    """Recorte em ASCII de um dia: `precipitation[tempo][lon][lat]` no retângulo de pixels."""
    constraint = (
        f"{VARIABLE}[0:0][{window.lon_first}:{window.lon_last}]"
        f"[{window.lat_first}:{window.lat_last}]"
    )
    return f"{_file_url(granule)}.ascii?{urllib.parse.quote(constraint, safe=':')}"


def opendap_das_url(granule: Granule) -> str:
    """DAS (só os atributos) do arquivo: unidade, preenchimento e eixo do tempo."""
    return f"{_file_url(granule)}.das"


def _file_url(granule: Granule) -> str:
    return f"{OPENDAP_BASE_URL}/{granule.day:%Y}/{granule.day:%m}/{granule.file_name}"


# --- CMR ----------------------------------------------------------------------------------------


def _granule_day(file_name: str) -> date:
    match = _FILE_NAME.fullmatch(file_name)
    if match is None:
        raise ValueError(f"arquivo que não é do IMERG Final diário: {file_name!r}")
    return datetime.strptime(match.group(1), "%Y%m%d").date()


def parse_cmr_granules(payload: Mapping[str, Any]) -> list[Granule]:
    """Os arquivos de uma página do `granules.json` do CMR.

    Recusa (ValueError) nome que não seja do IMERG Final diário ou com dia diferente do
    `time_start` do próprio item.
    """
    granules: list[Granule] = []
    for entry in payload["feed"]["entry"]:
        file_name = entry.get("producer_granule_id") or str(entry["title"]).split(":")[-1]
        day = _granule_day(file_name)
        start = entry.get("time_start")
        if start is not None and date.fromisoformat(str(start)[:10]) != day:
            raise ValueError(f"CMR: {file_name} com time_start {start}")
        granules.append(Granule(day=day, file_name=file_name))
    return granules


def _cmr_params(year: int, page: int, page_size: int) -> dict[str, Any]:
    days = season_days(year)
    return {
        "short_name": PRODUCT,
        "version": PRODUCT_VERSION,
        "temporal": f"{days[0].isoformat()}T00:00:00Z,{days[-1].isoformat()}T23:59:59Z",
        "page_size": page_size,
        "page_num": page,
        "sort_key": "start_date",
    }


def list_granules(
    transport: HttpTransport,
    years: Iterable[int],
    *,
    sleep: Callable[[float], None] = time.sleep,
    page_size: int = CMR_PAGE_SIZE,
    max_retries: int = MAX_RETRIES,
    backoff_seconds: float = BACKOFF_SECONDS,
) -> dict[date, Granule]:
    """Arquivo de cada dia das temporadas, pela busca pública do CMR (sem token), paginada.

    Fica só o que cai nos 212 dias de cada ano; dia repetido fica com a versão mais nova.
    """
    wanted = {day for year in years for day in season_days(year)}
    granules: dict[date, Granule] = {}
    for year in sorted({day.year for day in wanted}):
        for page in range(1, CMR_MAX_PAGES + 1):
            request = HttpRequest(
                "GET", CMR_GRANULES_URL, params=_cmr_params(year, page, page_size)
            )
            response = _send_with_retries(
                transport,
                request,
                f"CMR {year} página {page}",
                sleep=sleep,
                max_retries=max_retries,
                backoff_seconds=backoff_seconds,
                check=lambda r: parse_cmr_granules(r.json()),
            )
            entries = parse_cmr_granules(response.json())
            for granule in entries:
                if granule.day not in wanted:
                    continue
                current = granules.get(granule.day)
                if current is None or granule.version > current.version:
                    granules[granule.day] = granule
            if len(entries) < page_size:
                break
        else:
            raise DownloadError(f"CMR {year}: mais de {CMR_MAX_PAGES} páginas")
    return dict(sorted(granules.items()))


# --- DAS e recorte ASCII ------------------------------------------------------------------------

_DAS_BLOCK = re.compile(r"^ {4}(\S+) \{\s*$")
_DAS_STRING = re.compile(r'^\s+String (\w+) "(.*)";\s*$')
_DAS_NUMBER = re.compile(r"^\s+(?:Float|Int)\d+ (\w+) (\S+);\s*$")
_TIME_UNITS = re.compile(r"days since (\d{4})-(\d{2})-(\d{2})(?: 00:00:00(?:\.0+)?Z?)?")


def _das_blocks(text: str) -> dict[str, dict[str, str]]:
    if not text.lstrip().startswith("Attributes {"):
        raise ValueError(f"DAS do OPeNDAP inválido: {text[:120]!r}")
    blocks: dict[str, dict[str, str]] = {}
    current: dict[str, str] | None = None
    for line in text.splitlines():
        if block := _DAS_BLOCK.match(line):
            current = blocks.setdefault(block.group(1), {})
        elif line.strip() == "}":
            current = None
        elif current is not None and (
            attribute := _DAS_STRING.match(line) or _DAS_NUMBER.match(line)
        ):
            current[attribute.group(1)] = attribute.group(2)
    return blocks


def parse_das(text: str) -> date:
    """Confere no DAS a unidade da chuva e o preenchimento; devolve a origem do eixo do tempo.

    Recusa (ValueError) DAS sem `precipitation`, com outra unidade, com preenchimento acima de
    −9999 (seria confundido com chuva) ou com tempo que não seja "days since AAAA-MM-DD".
    """
    blocks = _das_blocks(text)
    if VARIABLE not in blocks:
        raise ValueError(f"DAS do OPeNDAP sem a variável {VARIABLE}")
    unit = blocks[VARIABLE].get("units")
    if unit != EXPECTED_UNIT:
        raise ValueError(f"unidade de {VARIABLE} inesperada: {unit!r} (esperado {EXPECTED_UNIT!r})")
    fill = blocks[VARIABLE].get("_FillValue")
    if fill is not None and float(fill) > FILL_VALUE_LIMIT:
        raise ValueError(f"valor de preenchimento inesperado: {fill} (esperado −9999,9)")
    time_attributes = blocks.get("time")
    if time_attributes is None:
        raise ValueError("DAS do OPeNDAP sem o eixo do tempo")
    origin = _TIME_UNITS.fullmatch(time_attributes.get("units", ""))
    if origin is None:
        raise ValueError(f"unidade do tempo inesperada: {time_attributes.get('units')!r}")
    return date(int(origin.group(1)), int(origin.group(2)), int(origin.group(3)))


_ROW = re.compile(
    rf"{VARIABLE}\.{VARIABLE}\[{VARIABLE}\.time=([^\]]+)\]\[{VARIABLE}\.lon=([^\]]+)\], (.+)"
)
_LAT_HEADER = f"{VARIABLE}.lat,"


def _close(found: float, expected: float) -> bool:
    return math.isclose(found, expected, abs_tol=COORDINATE_TOLERANCE)


def _rain_value(raw: str) -> float | None:
    value = float(raw)
    if math.isnan(value) or value <= FILL_VALUE_LIMIT:
        return None  # preenchimento: sem dado, nunca 0 inventado
    if not math.isfinite(value) or value < 0:
        raise ValueError(f"chuva inválida no recorte: {raw!r}")
    return value


def parse_opendap_ascii(
    text: str, day: date, window: PixelWindow, time_origin: date
) -> tuple[str, dict[tuple[int, int], float | None]]:
    """Lê o recorte ASCII do OPeNDAP do GES DISC (Hyrax) de um dia.

    Devolve a versão do arquivo e a chuva (mm/dia) de cada pixel `(lat, lon)`; preenchimento vira
    `None`. Recusa (ValueError) o que não for o recorte pedido: página de erro ou de login, outro
    arquivo ou dia, outros pixels, resposta pela metade, linha estranha ou chuva negativa.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines or not lines[0].startswith("Dataset: "):
        raise ValueError(f"resposta do OPeNDAP sem dados: {text[:120]!r}")
    file_name = lines[0].removeprefix("Dataset: ").strip()
    if _granule_day(file_name) != day:
        raise ValueError(f"recorte de outro dia: {file_name} (pedido {day.isoformat()})")
    version = Granule(day, file_name).version

    lat_lines = [line for line in lines[1:] if line.startswith(_LAT_HEADER)]
    rows = [_ROW.fullmatch(line) for line in lines[1:] if not line.startswith(_LAT_HEADER)]
    if len(lat_lines) != 1 or any(row is None for row in rows):
        raise ValueError(f"recorte do OPeNDAP fora do formato esperado: {text[:200]!r}")
    lats = [float(v) for v in lat_lines[0].removeprefix(_LAT_HEADER).split(",")]
    expected_lats = [pixel_lat(i) for i in window.lat_indexes]
    if len(lats) != len(expected_lats) or not all(map(_close, lats, expected_lats)):
        raise ValueError(f"latitudes diferentes do pedido: {lats} (esperado {expected_lats})")
    if len(rows) != len(window.lon_indexes):
        raise ValueError(f"recorte com {len(rows)} longitudes (pedido {len(window.lon_indexes)})")

    values: dict[tuple[int, int], float | None] = {}
    for row, lon_index in zip(rows, window.lon_indexes, strict=True):
        assert row is not None
        time_text, lon_text, data = row.groups()
        found_day = time_origin + timedelta(days=math.floor(float(time_text)))
        if found_day != day:
            raise ValueError(f"tempo do recorte é {found_day} (pedido {day.isoformat()})")
        if not _close(float(lon_text), pixel_lon(lon_index)):
            raise ValueError(f"longitude {lon_text} diferente do pedido ({pixel_lon(lon_index)})")
        raw_values = data.split(",")
        if len(raw_values) != len(window.lat_indexes):
            raise ValueError(
                f"linha com {len(raw_values)} valores (esperado {len(window.lat_indexes)})"
            )
        for lat_index, raw in zip(window.lat_indexes, raw_values, strict=True):
            values[(lat_index, lon_index)] = _rain_value(raw)
    return version, values


# --- HTTP da Earthdata --------------------------------------------------------------------------


def is_trusted_auth_host(url: str) -> bool:
    """HTTPS num host da Earthdata ou do EOSDIS (login e GES DISC)."""
    parts = urllib.parse.urlsplit(url)
    host = (parts.hostname or "").lower()
    return parts.scheme == "https" and host.endswith(TRUSTED_AUTH_HOST_SUFFIXES)


class EarthdataRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Segue o redirecionamento do login da Earthdata levando o token só para hosts da NASA.

    O `Authorization` vai como cabeçalho comum (o urllib repete no redirecionamento, como o
    `curl --location-trusted`); fora da Earthdata e do EOSDIS, ele é tirado.
    """

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None and not is_trusted_auth_host(redirected.full_url):
            redirected.remove_header("Authorization")
        return redirected


def earthdata_opener() -> urllib.request.OpenerDirector:
    """Opener com o cookie da sessão (o GES DISC abre a sessão depois do login) e o
    redirecionamento seguro."""
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
        EarthdataRedirectHandler(),
    )


def earthdata_transport(opener: urllib.request.OpenerDirector | None = None) -> HttpTransport:
    """O `default_http_request` do cliente HTTP do projeto, com a sessão da Earthdata."""
    session = opener or earthdata_opener()

    def transport(request: HttpRequest, timeout: float) -> HttpResponse:
        return default_http_request(request, timeout, opener=session.open)

    return transport


_AUTH_STATUSES = frozenset({401, 403})
_NO_RETRY_STATUSES = frozenset({400, 404, 406})


def _looks_like_html(text: str) -> bool:
    start = text.lstrip()[:200].lower()
    return start.startswith("<!doctype html") or start.startswith("<html")


def _send_with_retries(
    transport: HttpTransport,
    request: HttpRequest,
    label: str,
    *,
    sleep: Callable[[float], None],
    max_retries: int,
    backoff_seconds: float,
    check: Callable[[HttpResponse], None] | None = None,
) -> HttpResponse:
    """Um pedido com retentativa (espera exponencial) em erro de rede, 429/5xx e resposta ruim.

    Acesso recusado (401, 403, redirecionamento sem fim, página HTML de login) levanta
    `ImergAuthError` na hora. 400, 404 e 406 não são repetidos. As mensagens nunca levam o token.
    """
    problem = "sem resposta"
    for attempt in range(max_retries + 1):
        try:
            response = transport(request, OPENDAP_TIMEOUT_SECONDS)
        except (OSError, http.client.HTTPException) as exc:
            problem = f"erro de rede ({type(exc).__name__})"
        else:
            if response.status in _AUTH_STATUSES or 300 <= response.status < 400:
                raise ImergAuthError(f"HTTP {response.status} em {label}")
            if response.status == 200 and _looks_like_html(response.text()):
                raise ImergAuthError(f"página HTML (login da Earthdata) em {label}")
            if response.status in _NO_RETRY_STATUSES:
                raise DownloadError(f"{label}: HTTP {response.status}")
            if response.status == 200:
                try:
                    if check is not None:
                        check(response)
                    return response
                except (ValueError, KeyError, TypeError) as exc:
                    problem = f"resposta fora do formato ({exc})"
            else:
                problem = f"HTTP {response.status}"
        logger.warning("%s: %s (tentativa %d de %d)", label, problem, attempt + 1, max_retries + 1)
        if attempt < max_retries:
            sleep(backoff_seconds * (2**attempt))
    raise DownloadError(f"{label}: {problem}, depois de {max_retries + 1} tentativas")


# --- cache --------------------------------------------------------------------------------------


class CachedImergFetcher:
    """Baixa cada recorte diário e cada DAS uma vez só e guarda no cache (retomada)."""

    def __init__(
        self,
        cache_dir: Path,
        transport: HttpTransport,
        token: str,
        window: PixelWindow,
        sleep: Callable[[float], None] = time.sleep,
        max_retries: int = MAX_RETRIES,
        backoff_seconds: float = BACKOFF_SECONDS,
    ) -> None:
        self._cache_dir = cache_dir
        self._transport = transport
        self._headers = {"Authorization": f"Bearer {token}", "Accept": "text/plain, */*"}
        self._window = window
        self._sleep = sleep
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self._lock = threading.Lock()
        self.downloads = 0
        self.pending: int | None = None  # só para o log de progresso

    def _path(self, day: date) -> Path:
        w = self._window
        name = f"{day:%Y%m%d}_lon{w.lon_first}-{w.lon_last}_lat{w.lat_first}-{w.lat_last}.ascii"
        return self._cache_dir / f"{day:%Y}" / name

    def _attributes_path(self, granule: Granule) -> Path:
        return self._cache_dir / f"atributos_{granule.version}.das"

    def is_cached(self, day: date) -> bool:
        return self._path(day).exists()

    def fetch_day(self, granule: Granule, time_origin: date) -> str:
        """O recorte ASCII do dia, do cache ou do OPeNDAP (conferido antes de guardar)."""
        return self._get(
            self._path(granule.day),
            opendap_ascii_url(granule, self._window),
            granule.day.isoformat(),
            lambda text: parse_opendap_ascii(text, granule.day, self._window, time_origin),
        )

    def fetch_attributes(self, granule: Granule) -> str:
        """O DAS de um arquivo da versão do `granule` (um por versão)."""
        return self._get(
            self._attributes_path(granule),
            opendap_das_url(granule),
            f"atributos ({granule.version})",
            parse_das,
        )

    def _get(self, path: Path, url: str, label: str, check: Callable[[str], object]) -> str:
        if path.exists():
            return path.read_text(encoding="utf-8")
        response = _send_with_retries(
            self._transport,
            HttpRequest("GET", url, headers=self._headers),
            label,
            sleep=self._sleep,
            max_retries=self._max_retries,
            backoff_seconds=self._backoff_seconds,
            check=lambda r: check(r.text()),  # só guarda resposta conferida
        )
        text = response.text()
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(f"{path.name}.part")
        partial.write_text(text, encoding="utf-8")
        partial.replace(path)  # arquivo pela metade nunca fica com o nome final
        with self._lock:
            self.downloads += 1
            count = self.downloads
        logger.info("[%d/%s] %s", count, self.pending if self.pending is not None else "?", label)
        return text


def download_days(
    fetcher: CachedImergFetcher,
    granules: Sequence[Granule],
    origins: Mapping[str, date],
    parallel: int,
) -> dict[date, str]:
    """Baixa os dias que faltam no cache. Devolve os dias que falharam (com o motivo).

    O primeiro pedido vai sozinho: confere o acesso e abre a sessão antes dos paralelos. Se ele
    falhar, nada mais é pedido. Acesso recusado em qualquer pedido cancela o que ainda não saiu.
    """
    pending = [g for g in granules if not fetcher.is_cached(g.day)]
    fetcher.pending = len(pending)
    if not pending:
        return {}
    first, rest = pending[0], pending[1:]
    try:
        fetcher.fetch_day(first, origins[first.version])
    except DownloadError as exc:
        raise DownloadError(f"o primeiro pedido falhou, nada mais foi pedido: {exc}") from exc

    failures: dict[date, str] = {}
    pool = ThreadPoolExecutor(max_workers=parallel)
    try:
        futures = {pool.submit(fetcher.fetch_day, g, origins[g.version]): g for g in rest}
        for future in as_completed(futures):
            try:
                future.result()
            except DownloadError as exc:
                failures[futures[future].day] = str(exc)
    except BaseException:
        pool.shutdown(wait=True, cancel_futures=True)
        raise
    pool.shutdown(wait=True)
    return dict(sorted(failures.items()))


# --- contrato -----------------------------------------------------------------------------------


def _rounded(value: float | None) -> float | None:
    return None if value is None else round(value, RAIN_DECIMALS) + 0.0


def build_cell_series(
    cell_ids: Sequence[str],
    years: Sequence[int],
    day_values: Mapping[date, Mapping[tuple[int, int], float | None]],
) -> list[ImergCellSeries]:
    """A série de cada célula, ano a ano (dia sem arquivo ou pixel vazio: `None`)."""
    series: list[ImergCellSeries] = []
    for cell_id in cell_ids:
        pixel = cell_pixel(cell_id)
        lat, lon = cell_center(cell_id)
        seasons = tuple(
            ImergSeason(
                year=year,
                start_date=date(year, 1, 1),
                rain_mm=tuple(
                    _rounded(day_values.get(day, {}).get(pixel)) for day in season_days(year)
                ),
            )
            for year in years
        )
        series.append(
            ImergCellSeries(cell_id=cell_id, latitude=lat, longitude=lon, seasons=seasons)
        )
    return series


def contract_json(series: Sequence[ImergCellSeries], run: DataRun) -> dict[str, Any]:
    return {
        "versao_dados": {
            "fonte": run.source,
            "parametros": dict(run.params),
            "fim": run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": run.version,
        },
        "celulas": [
            {
                "celula": item.cell_id,
                "lat": round(item.latitude, 4),
                "lon": round(item.longitude, 4),
                "temporadas": [
                    {
                        "ano": season.year,
                        "inicio": season.start_date.isoformat(),
                        "chuva_mm": list(season.rain_mm),
                    }
                    for season in item.seasons
                ],
            }
            for item in series
        ],
    }


def _data_run(
    years: Sequence[int],
    cell_count: int,
    window: PixelWindow,
    versions: Iterable[str],
    days_without_file: int,
    finished_at: datetime,
) -> DataRun:
    return DataRun(
        source=SOURCE_KEY,
        params={
            "produto": PRODUCT,
            "versao_produto": PRODUCT_VERSION,
            "versoes_arquivo": sorted(set(versions)),
            "variavel": VARIABLE,
            "unidade": "mm/dia",
            "servico": OPENDAP_SERVICE,
            "anos": [years[0], years[-1]],
            "temporada": {"inicio": "01-01", "dias": CLIMATE_SEASON_DAYS},
            "caixa": dict(PILOT_BOX),
            "pixels": {
                "lat": [window.lat_first, window.lat_last],
                "lon": [window.lon_first, window.lon_last],
            },
            "celulas": cell_count,
            "dias_sem_arquivo": days_without_file,
        },
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-gpm-imerg",
    )


# --- linha de comando ---------------------------------------------------------------------------


def _duration(seconds: float) -> str:
    if seconds < 3600:
        return f"{max(1, round(seconds / 60))} min"
    return f"{seconds / 3600:.1f} h".replace(".", ",")


def _years_arg(text: str) -> list[int]:
    try:
        parts = [int(p) for p in text.split("-")]
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"anos inválidos (use 2024 ou 2005-2024): {text!r}"
        ) from exc
    first, last = (parts[0], parts[0]) if len(parts) == 1 else (parts[0], parts[-1])
    if len(parts) > 2 or not HISTORICAL_START_YEAR <= first <= last <= HISTORICAL_END_YEAR:
        raise argparse.ArgumentTypeError(
            f"anos fora de {HISTORICAL_START_YEAR}–{HISTORICAL_END_YEAR}: {text!r}"
        )
    return list(range(first, last + 1))


def _parallel_arg(text: str) -> int:
    try:
        value = int(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"número de pedidos inválido: {text!r}") from exc
    if not 1 <= value <= MAX_PARALLEL:
        raise argparse.ArgumentTypeError(f"use de 1 a {MAX_PARALLEL} pedidos em paralelo")
    return value


def _token_from_settings() -> str | None:
    token = get_settings().earthdata_token
    return token.strip() or None if token else None


def _print_plan(
    cells: Sequence[str],
    years: Sequence[int],
    window: PixelWindow,
    fetcher: CachedImergFetcher,
    parallel: int,
    output: Path,
    cache_dir: Path,
) -> None:
    days = [day for year in years for day in season_days(year)]
    pending = sum(1 for day in days if not fetcher.is_cached(day))
    seconds = pending * MEASURED_SECONDS_PER_REQUEST / parallel
    example = Granule(days[0], f"3B-DAY.MS.MRG.3IMERG.{days[0]:%Y%m%d}-S000000-E235959.V07B.nc4")
    print(
        f"IMERG Final diário ({PRODUCT} v{PRODUCT_VERSION}), caixa piloto: {len(cells)} células "
        f"de 0,1° (pixels de lat {window.lat_first}–{window.lat_last} × lon "
        f"{window.lon_first}–{window.lon_last})"
    )
    print(
        f"Anos: {years[0]}–{years[-1]} ({len(years)}), {CLIMATE_SEASON_DAYS} dias por ano desde "
        f"1/jan: {len(days)} recortes ao OPeNDAP, um por dia (já no cache: "
        f"{len(days) - pending}; faltam: {pending}), + {len(years)} pedidos ao CMR (sem token) e "
        "1 DAS por versão do arquivo"
    )
    print(
        f"Tempo estimado: até ~{_duration(seconds)} com {parallel} em paralelo "
        f"(~{MEASURED_SECONDS_PER_REQUEST:.0f} s por pedido, medido no primeiro, que inclui o "
        "login; com a sessão aberta os seguintes devem ser mais rápidos)"
    )
    print(f"Exemplo (o nome do arquivo vem do CMR): {opendap_ascii_url(example, window)}")
    print(f"Saída: {output} | cache: {cache_dir}")


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.fetch_imerg", description=(__doc__ or "").splitlines()[0]
    )
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument(
        "--anos",
        type=_years_arg,
        default=list(range(HISTORICAL_START_YEAR, HISTORICAL_END_YEAR + 1)),
        help=f"2024 ou 2005-2024 (padrão: {HISTORICAL_START_YEAR}-{HISTORICAL_END_YEAR})",
    )
    parser.add_argument(
        "--paralelo",
        type=_parallel_arg,
        default=DEFAULT_PARALLEL,
        help=f"pedidos ao mesmo tempo, de 1 a {MAX_PARALLEL} (padrão: {DEFAULT_PARALLEL})",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="só mostra os pedidos e o tempo, sem rede"
    )
    return parser.parse_args(argv)


def _write_atomically(payload: Mapping[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_name(f"{output.name}.part")
    partial.write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
    partial.replace(output)


def main(
    argv: Sequence[str] | None = None,
    *,
    transport: HttpTransport | None = None,
    load_token: Callable[[], str | None] = _token_from_settings,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Executa o script. Devolve 0 (ok), 1 (erro: rode de novo) ou 2 (sem token)."""
    args = _parse_args(argv)
    years: list[int] = args.anos
    cells = pilot_cells()
    window = pixel_window(cells)

    if args.dry_run:
        offline = CachedImergFetcher(args.cache, _no_network, "", window)
        _print_plan(cells, years, window, offline, args.paralelo, args.saida, args.cache)
        return 0

    token = load_token()
    if not token:
        print(
            "Defina EARTHDATA_TOKEN no projeto/backend/.env (token da Earthdata Login, com o "
            "aplicativo NASA GESDISC DATA ARCHIVE autorizado e a EULA do GES DISC aceita).",
            file=sys.stderr,
        )
        return 2

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", stream=sys.stderr)
    transport = transport or earthdata_transport()
    fetcher = CachedImergFetcher(args.cache, transport, token, window, sleep=sleep)
    try:
        granules = list_granules(transport, years, sleep=sleep)
        first_by_version: dict[str, Granule] = {}
        for granule in granules.values():
            first_by_version.setdefault(granule.version, granule)
        origins = {
            version: parse_das(fetcher.fetch_attributes(granule))
            for version, granule in first_by_version.items()
        }
        failures = download_days(fetcher, list(granules.values()), origins, args.paralelo)
        if failures:
            sample = "; ".join(
                f"{day.isoformat()}: {why}" for day, why in list(failures.items())[:5]
            )
            print(
                f"{len(failures)} dias falharam e nada foi gravado. Rode de novo: o que já baixou "
                f"está no cache ({args.cache}). Exemplos: {sample}",
                file=sys.stderr,
            )
            return 1

        day_values: dict[date, Mapping[tuple[int, int], float | None]] = {}
        versions: set[str] = set()
        for day, granule in granules.items():
            text = fetcher.fetch_day(granule, origins[granule.version])
            version, values = parse_opendap_ascii(text, day, window, origins[granule.version])
            versions.add(version)
            day_values[day] = values
    except ImergAuthError as exc:
        print(
            f"O GES DISC recusou o acesso ({exc}). Confira o EARTHDATA_TOKEN (vale 60 dias), o "
            "aplicativo NASA GESDISC DATA ARCHIVE em Authorized Apps e a EULA aceita no perfil da "
            "Earthdata. O que já baixou está no cache.",
            file=sys.stderr,
        )
        return 1
    except (DownloadError, OSError, ValueError, KeyError) as exc:
        print(f"Erro: {exc}. O que já baixou está no cache: rode de novo.", file=sys.stderr)
        return 1

    expected_days = [day for year in years for day in season_days(year)]
    without_file = sum(1 for day in expected_days if day not in granules)
    series = build_cell_series(cells, years, day_values)
    run = _data_run(years, len(cells), window, versions, without_file, now())
    _write_atomically(contract_json(series, run), args.saida)
    complete = sum(1 for item in series for season in item.seasons if season.complete)
    total = sum(len(item.seasons) for item in series)
    print(
        f"{len(cells)} células × {len(years)} anos gravados em {args.saida} "
        f"({fetcher.downloads} recortes baixados agora; {complete} de {total} temporadas "
        f"completas; {without_file} dias sem arquivo no GES DISC)"
    )
    return 0


def _no_network(request: HttpRequest, timeout: float) -> HttpResponse:
    raise RuntimeError("o --dry-run não usa a rede")


if __name__ == "__main__":
    sys.exit(main())
