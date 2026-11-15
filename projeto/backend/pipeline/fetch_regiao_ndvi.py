"""Região pelo satélite (P3): a lavoura num raio em volta de um ponto, na entressafra, ano a ano.

Pede à ORNL DAAC (`modis.ornl.gov/rst/api/v1`, pública, sem login) o recorte por área do NDVI do
MODIS (MOD13Q1 e MYD13Q1, coleção 061, 250 m) e do uso do solo (MCD12Q1, 500 m) e grava o
arquivo do contrato "Região pelo satélite" (`AGENTS.md` do backend), que a API lê pelo
`REGIAO_PATH` (`GET /api/regiao`).

Uso (a partir de projeto/backend; nenhuma credencial):

    uv run python -m pipeline.fetch_regiao_ndvi --dry-run     # o plano dos pedidos, sem rede
    uv run python -m pipeline.fetch_regiao_ndvi               # fazenda de exemplo, raio de 30 km
    uv run python -m pipeline.fetch_regiao_ndvi --centros "-18.9543,-48.1993;-17.5,-47.25"

Por que por área na ORNL: o tempo de um pedido quase não depende da área (medido em 14/11/2026:
27 s para 9 × 9 pixels e 24 s para 241 × 241), e cada pedido aceita até 10 datas e ±100 km. A
região inteira sai em 41 pedidos; uma grade de pontos precisaria de 41 pedidos por ponto.

Regra (guia NDVI, "Região pelo satélite"), em cada ano da janela do `regras.yaml`
(`historico_ndvi`): os pixels de 250 m com o centro dentro do raio e na lavoura do MCD12Q1 daquele
ano; cada um classificado com a regra do talhão (`RegionClassifier`, as mesmas observações boas,
janela, limites e mínimo); os pixels somados em percentuais. Só os totais saem do script (RNF-10).

Cache e retomada: cada resposta fica em `cache_ornl/` (gzip). Se parar, rode de novo: o que já
baixou não é pedido outra vez.
"""

import argparse
import gzip
import json
import math
import sys
import time
from array import array
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Final

from app.config import get_settings
from app.models.data_run import DataRun
from app.models.regiao import RegiaoSatelite
from app.models.regras import Regras, RegrasHistoricoNdvi
from app.models.talhao import NDVI_VALID_MAX, NDVI_VALID_MIN
from app.repositories.external.http_client import (
    HttpRequest,
    HttpTransport,
    default_http_request,
)
from app.repositories.rules_repository import YamlRulesRepository
from app.services.region_service import RegionClassifier, distance_m
from pipeline.fetch_cmip6_deltas import repo_root
from pipeline.fetch_ndvi import (
    ACCEPTED_QUALITY,
    COLLECTION,
    DEFAULT_POINT,
    NDVI_DECIMALS,
    NDVI_SCALE_FACTOR,
    RAW_FILL_VALUE,
    SOURCE_KEY,
    Point,
    parse_points,
)

ORNL_API_URL: Final[str] = "https://modis.ornl.gov/rst/api/v1"
# Terra e Aqua, defasados em 8 dias (conferido na ORNL: abril a julho de 2016 tem 8 + 7 datas).
NDVI_PRODUCTS: Final[tuple[str, ...]] = ("MOD13Q1", "MYD13Q1")
FIRST_COMPOSITE_DOY: Final[dict[str, int]] = {"MOD13Q1": 1, "MYD13Q1": 9}
COMPOSITE_STEP_DAYS: Final[int] = 16
# Nomes conferidos em GET /MOD13Q1/bands (sem o "_" do começo que o AppEEARS usa).
NDVI_BAND: Final[str] = "250m_16_days_NDVI"
QUALITY_BAND: Final[str] = "250m_16_days_pixel_reliability"
# Uso do solo anual (500 m), IGBP. Classe 12 = lavouras (pelo menos 60% da área cultivada; o guia
# NDVI cita esta classe). A 14 (mosaico de lavoura com vegetação natural, 40% a 60%) fica de fora:
# o cerrado e o pasto do mosaico seguem verdes ou secam na entressafra por conta própria e
# confundiriam "parado" com "plantou"; perto da fazenda de exemplo ela quase não aparece (0 ou 1
# pixel de 500 m por ano na caixa de ±33 km, contra 3.800 a 5.400 da classe 12).
LAND_COVER_PRODUCT: Final[str] = "MCD12Q1"
LAND_COVER_BAND: Final[str] = "LC_Type1"
CROPLAND_CLASSES: Final[frozenset[int]] = frozenset({12})
# Limites da ORNL: até 10 datas por pedido e ±100 km em volta do ponto.
MAX_DATES_PER_REQUEST: Final[int] = 10
MAX_ORNL_KM: Final[int] = 100
# A ORNL conta o km como pixels de 250 m, mas o pixel do MODIS tem 231,66 m: kmAboveBelow=30
# devolve 241 linhas (±27,9 km). Pede-se a mais e o círculo é recortado aqui.
ORNL_KM_PER_PIXEL: Final[float] = 0.25
MODIS_250M_PIXEL_M: Final[float] = 231.656358264
# Esfera da projeção sinusoidal do MODIS.
SINUSOIDAL_RADIUS_M: Final[float] = 6_371_007.181
DEFAULT_RADIUS_KM: Final[float] = 30.0
DEFAULT_CENTER: Final[Point] = DEFAULT_POINT

REQUEST_TIMEOUT_SECONDS: Final[float] = 300.0
DEFAULT_MAX_ATTEMPTS: Final[int] = 5
RETRY_WAIT_SECONDS: Final[float] = 30.0
# Medido em 14/11/2026: NDVI da caixa de ±30 km com 8 datas, 24 s e 1,0 MB (gzip; 2,8 MB de
# JSON); MCD12Q1 de ±33 km com 10 datas, 16 s; MYD13Q1 de 9 × 9 pixels, 27 s. Às vezes 502.
MEASURED_SECONDS_PER_REQUEST: Final[float] = 30.0

DOWNLOADS_DIR: Final[Path] = repo_root() / "data" / "baixados" / "nasa_modis_ndvi_regiao"
DEFAULT_OUTPUT: Final[Path] = DOWNLOADS_DIR / "regiao_ndvi_modis.json"
DEFAULT_CACHE_DIR: Final[Path] = DOWNLOADS_DIR / "cache_ornl"

SOURCE_LABEL: Final[str] = f"MODIS {' + '.join(NDVI_PRODUCTS)}"
_CLASSES_TEXT = ", ".join(str(c) for c in sorted(CROPLAND_CLASSES))
MASK_LABEL: Final[str] = (
    f"{LAND_COVER_PRODUCT} {LAND_COVER_BAND} "
    f"{'classe' if len(CROPLAND_CLASSES) == 1 else 'classes'} {_CLASSES_TEXT} (lavouras)"
)


class OrnlError(RuntimeError):
    """Falha ao falar com a ORNL ou ao ler o que ela devolveu."""


def _log(message: str) -> None:
    print(message, file=sys.stderr)


# --- datas e plano dos pedidos --------------------------------------------------------------


def _month_day(text: str) -> tuple[int, int]:
    month, day = text.split("-")
    return int(month), int(day)


def composite_dates(product: str, year: int, start_mmdd: str, end_mmdd: str) -> list[date]:
    """Datas das composições de 16 dias do produto no ano, dentro da janela (inclusiva).

    O calendário recomeça em 1º de janeiro: Terra nos dias 1, 17, 33...; Aqua nos dias 9, 25...
    """
    start, end = _month_day(start_mmdd), _month_day(end_mmdd)
    first_day = date(year, 1, 1)
    days = (
        first_day + timedelta(days=doy - 1)
        for doy in range(FIRST_COMPOSITE_DOY[product], 367, COMPOSITE_STEP_DAYS)
    )
    return [d for d in days if d.year == year and start <= (d.month, d.day) <= end]


def chunked(dates: Sequence[date], size: int = MAX_DATES_PER_REQUEST) -> list[list[date]]:
    return [list(dates[i : i + size]) for i in range(0, len(dates), size)]


def modis_date(day: date) -> str:
    """`AAAAAddd` (ano e dia do ano), o formato de data da ORNL."""
    return f"A{day.year}{day.timetuple().tm_yday:03d}"


def subset_km(radius_km: float) -> int:
    """`kmAboveBelow` / `kmLeftRight` que cobrem o raio inteiro com os pixels de 231,66 m."""
    pixels = math.ceil(radius_km * 1000.0 / MODIS_250M_PIXEL_M)
    km = math.ceil(pixels * ORNL_KM_PER_PIXEL)
    if km > MAX_ORNL_KM:
        raise ValueError(f"raio de {radius_km} km pede ±{km} km; a ORNL aceita até ±{MAX_ORNL_KM}")
    return km


@dataclass(frozen=True)
class SubsetRequest:
    """Um pedido ao `/subset`: uma banda de um produto, de `start` a `end` (até 10 datas)."""

    product: str
    band: str
    start: date
    end: date
    n_dates: int

    def cache_name(self, center: Point, km: int) -> str:
        return (
            f"{self.product}_{self.band}_{self.start:%Y%m%d}_{self.end:%Y%m%d}_"
            f"{center.lat:.4f}_{center.lon:.4f}_{km}km.json.gz"
        )


def build_plan(regra: RegrasHistoricoNdvi) -> list[SubsetRequest]:
    """NDVI e qualidade de Terra e Aqua na janela de cada ano, mais o uso do solo dos anos."""
    years = range(regra.ano_inicio, regra.ano_fim + 1)
    plan: list[SubsetRequest] = []
    for year in years:
        for product in NDVI_PRODUCTS:
            days = composite_dates(product, year, regra.janela_inicio, regra.janela_fim)
            for group in chunked(days):
                for band in (NDVI_BAND, QUALITY_BAND):
                    plan.append(SubsetRequest(product, band, group[0], group[-1], len(group)))
    for group in chunked([date(year, 1, 1) for year in years]):
        plan.append(
            SubsetRequest(LAND_COVER_PRODUCT, LAND_COVER_BAND, group[0], group[-1], len(group))
        )
    return plan


# --- cliente da ORNL e cache ----------------------------------------------------------------


def _is_retryable(status: int) -> bool:
    return status >= 500 or status == 429


class OrnlClient:
    """`GET /<produto>/subset` da ORNL, com nova tentativa em 5xx, 429 e falha de rede."""

    def __init__(
        self,
        transport: HttpTransport,
        *,
        base_url: str = ORNL_API_URL,
        timeout: float = REQUEST_TIMEOUT_SECONDS,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
        retry_wait_seconds: float = RETRY_WAIT_SECONDS,
        sleep: Callable[[float], None] = time.sleep,
        log: Callable[[str], None] = _log,
    ) -> None:
        self._transport = transport
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._max_attempts = max_attempts
        self._retry_wait = retry_wait_seconds
        self._sleep = sleep
        self._log = log

    def fetch_subset(self, request: SubsetRequest, center: Point, km: int) -> bytes:
        """O JSON da resposta (já sem o gzip da transferência)."""
        http_request = HttpRequest(
            method="GET",
            url=f"{self._base_url}/{request.product}/subset",
            params={
                "latitude": center.lat,
                "longitude": center.lon,
                "band": request.band,
                "startDate": modis_date(request.start),
                "endDate": modis_date(request.end),
                "kmAboveBelow": km,
                "kmLeftRight": km,
            },
            headers={"Accept-Encoding": "gzip"},
        )
        last_problem = ""
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._transport(http_request, self._timeout)
            except OSError as exc:
                last_problem = f"falha de rede ({exc})"
            else:
                if response.status == 200:
                    body = response.body
                    return gzip.decompress(body) if body[:2] == b"\x1f\x8b" else body
                message = response.body[:200].decode("utf-8", errors="replace")
                if not _is_retryable(response.status):
                    raise OrnlError(f"A ORNL recusou o pedido (HTTP {response.status}): {message}")
                last_problem = f"HTTP {response.status}"
            if attempt < self._max_attempts:
                wait = self._retry_wait * attempt
                self._log(f"ORNL: {last_problem}; nova tentativa em {wait:.0f} s.")
                self._sleep(wait)
        raise OrnlError(
            f"A ORNL não respondeu {request.product} {request.band} {request.start} a "
            f"{request.end} depois de {self._max_attempts} tentativas (último: {last_problem})"
        )


class SubsetCache:
    """Uma resposta por arquivo (gzip) na pasta do cache. Gravação atômica (arquivo temporário)."""

    def __init__(self, folder: Path) -> None:
        self._folder = folder

    def has(self, name: str) -> bool:
        return (self._folder / name).is_file()

    def get(self, name: str) -> bytes | None:
        path = self._folder / name
        return gzip.decompress(path.read_bytes()) if path.is_file() else None

    def put(self, name: str, raw: bytes) -> None:
        self._folder.mkdir(parents=True, exist_ok=True)
        path = self._folder / name
        temporary = path.with_name(f"{path.name}.tmp")
        temporary.write_bytes(gzip.compress(raw))
        temporary.replace(path)


# --- grade e projeção -----------------------------------------------------------------------


@dataclass(frozen=True)
class Grid:
    """Grade do recorte na projeção sinusoidal do MODIS (metros), como o cabeçalho da ORNL.

    Os valores vêm linha a linha a partir do canto de cima à esquerda (conferido comparando um
    recorte de 9 × 9 com o mesmo trecho de um recorte de 241 × 241).
    """

    xll: float
    yll: float
    cellsize: float
    nrows: int
    ncols: int

    def center_xy(self, index: int) -> tuple[float, float]:
        row, col = divmod(index, self.ncols)
        return (
            self.xll + (col + 0.5) * self.cellsize,
            self.yll + (self.nrows - row - 0.5) * self.cellsize,
        )

    def index_at(self, x: float, y: float) -> int | None:
        col = math.floor((x - self.xll) / self.cellsize)
        row = self.nrows - 1 - math.floor((y - self.yll) / self.cellsize)
        if 0 <= col < self.ncols and 0 <= row < self.nrows:
            return row * self.ncols + col
        return None


@dataclass(frozen=True)
class Subset:
    """Um recorte: a grade e uma camada (valores inteiros brutos) por data."""

    grid: Grid
    layers: dict[date, array]


def parse_subset(raw: bytes) -> Subset:
    payload: dict[str, Any] = json.loads(raw.decode("utf-8"))
    try:
        grid = Grid(
            xll=float(payload["xllcorner"]),
            yll=float(payload["yllcorner"]),
            cellsize=float(payload["cellsize"]),
            nrows=int(payload["nrows"]),
            ncols=int(payload["ncols"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise OrnlError(f"Resposta da ORNL sem o cabeçalho da grade: {exc}") from exc
    size = grid.nrows * grid.ncols
    layers: dict[date, array] = {}
    for item in payload.get("subset", []):
        data = item["data"]
        if len(data) != size:
            raise OrnlError(
                f"Camada de {item.get('calendar_date')} com {len(data)} pixels; a grade tem {size}"
            )
        layers[date.fromisoformat(str(item["calendar_date"]))] = array("h", data)
    return Subset(grid=grid, layers=layers)


def _merge(subsets: Sequence[Subset]) -> Subset | None:
    """Junta os recortes de vários pedidos da mesma grade (uma banda, datas diferentes)."""
    if not subsets:
        return None
    grid = subsets[0].grid
    if any(s.grid != grid for s in subsets):
        raise OrnlError("Recortes da mesma banda com grades diferentes.")
    layers: dict[date, array] = {}
    for subset in subsets:
        layers.update(subset.layers)
    return Subset(grid=grid, layers=layers)


def sinusoidal_to_latlon(x: float, y: float) -> tuple[float, float]:
    """Projeção sinusoidal do MODIS (metros) → latitude e longitude WGS 84 (graus)."""
    lat = y / SINUSOIDAL_RADIUS_M
    lon = x / (SINUSOIDAL_RADIUS_M * math.cos(lat))
    return math.degrees(lat), math.degrees(lon)


def circle_indices(grid: Grid, center: Point, radius_km: float) -> list[int]:
    """Pixels cujo centro fica a até `radius_km` do ponto."""
    limit_m = radius_km * 1000.0
    inside: list[int] = []
    for index in range(grid.nrows * grid.ncols):
        lat, lon = sinusoidal_to_latlon(*grid.center_xy(index))
        if distance_m(center.lat, center.lon, lat, lon) <= limit_m:
            inside.append(index)
    return inside


# --- máscara de lavoura e contagem ----------------------------------------------------------


def cropland_indices_by_year(
    land_cover: Subset, classes: frozenset[int] = CROPLAND_CLASSES
) -> dict[int, frozenset[int]]:
    """Pixels de lavoura do MCD12Q1 em cada ano (índices da grade de 500 m)."""
    return {
        day.year: frozenset(i for i, value in enumerate(layer) if value in classes)
        for day, layer in sorted(land_cover.layers.items())
    }


def mask_year(year: int, available: Iterable[int]) -> int | None:
    """Ano do uso do solo para a entressafra: o mesmo; senão o último antes; senão o primeiro."""
    years = sorted(available)
    earlier = [y for y in years if y <= year]
    if earlier:
        return earlier[-1]
    return years[0] if years else None


def _physical_ndvi(raw: int) -> float | None:
    if raw == RAW_FILL_VALUE or not NDVI_VALID_MIN <= raw <= NDVI_VALID_MAX:
        return None
    return round(raw * NDVI_SCALE_FACTOR, NDVI_DECIMALS)


def count_region_year(
    year: int,
    pairs: Sequence[tuple[Subset, Subset]],
    land_cover_grid: Grid,
    cropland: frozenset[int],
    center: Point,
    radius_km: float,
    classifier: RegionClassifier,
) -> dict[str, int]:
    """Pixels de lavoura dentro do raio por situação no ano (`pairs` = NDVI e qualidade de cada
    produto). Observação boa = qualidade 0 ou 1 e NDVI válido (sem o −3000 de preenchimento).
    """
    if not pairs:
        raise OrnlError(f"Sem camada de NDVI para {year}.")
    grid = pairs[0][0].grid
    if any(s.grid != grid for pair in pairs for s in pair):
        raise OrnlError(f"Recortes de NDVI de {year} com grades diferentes.")
    pixels = [
        i
        for i in circle_indices(grid, center, radius_km)
        if land_cover_grid.index_at(*grid.center_xy(i)) in cropland
    ]
    series = [
        (day, values, quality.layers[day])
        for ndvi, quality in pairs
        for day, values in sorted(ndvi.layers.items())
        if day in quality.layers
    ]
    counts: Counter[str] = Counter()
    for i in pixels:
        observations = []
        for day, values, quality in series:
            ndvi = _physical_ndvi(values[i]) if quality[i] in ACCEPTED_QUALITY else None
            if ndvi is not None:
                observations.append((day, ndvi))
        counts[classifier.classify_pixel(year, observations)] += 1
    return dict(counts)


# --- região e arquivo do contrato -----------------------------------------------------------


def _build_region(
    center: Point,
    radius_km: float,
    km: int,
    plan: Sequence[SubsetRequest],
    cache: SubsetCache,
    classifier: RegionClassifier,
    regra: RegrasHistoricoNdvi,
) -> tuple[RegiaoSatelite, dict[int, int | None]]:
    """A região de um centro, lida do cache. Devolve também o ano do uso do solo de cada ano."""

    def load(requests: Iterable[SubsetRequest]) -> Subset | None:
        subsets = []
        for request in requests:
            raw = cache.get(request.cache_name(center, km))
            if raw is None:
                raise OrnlError(f"Falta no cache: {request.cache_name(center, km)}")
            subsets.append(parse_subset(raw))
        return _merge(subsets)

    land_cover = load(r for r in plan if r.product == LAND_COVER_PRODUCT)
    if land_cover is None:
        raise OrnlError("O plano não tem o uso do solo.")
    cropland = cropland_indices_by_year(land_cover)
    anos = []
    mask_years: dict[int, int | None] = {}
    for year in range(regra.ano_inicio, regra.ano_fim + 1):
        pairs = []
        for product in NDVI_PRODUCTS:
            of_year = [r for r in plan if r.product == product and r.start.year == year]
            ndvi = load(r for r in of_year if r.band == NDVI_BAND)
            quality = load(r for r in of_year if r.band == QUALITY_BAND)
            if ndvi is not None and quality is not None:
                pairs.append((ndvi, quality))
        mask_years[year] = mask_year(year, cropland)
        mask = cropland[mask_years[year]] if mask_years[year] is not None else frozenset()
        counts = count_region_year(
            year, pairs, land_cover.grid, mask, center, radius_km, classifier
        )
        anos.append(classifier.summarize(year, counts))
    region = RegiaoSatelite(
        lat=center.lat,
        lon=center.lon,
        raio_km=radius_km,
        fonte=SOURCE_LABEL,
        mascara=MASK_LABEL,
        anos=tuple(anos),
    )
    return region, mask_years


def build_region_payload(
    regions: Sequence[RegiaoSatelite], params: dict[str, Any], finished_at: datetime
) -> dict[str, Any]:
    """O JSON do contrato "Região pelo satélite" (`versao_dados` validado pelo `DataRun`)."""
    data_run = DataRun(
        source=SOURCE_KEY,
        params=params,
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-modis-ndvi-regiao",
    )
    return {
        "versao_dados": {
            "fonte": data_run.source,
            "parametros": dict(data_run.params),
            "fim": data_run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": data_run.version,
        },
        "regioes": [
            {
                "lat": region.lat,
                "lon": region.lon,
                "raio_km": region.raio_km,
                "fonte": region.fonte,
                "mascara": region.mascara,
                "anos": [
                    {
                        "ano": ano.ano,
                        "n_pixels": ano.n_pixels,
                        "pct_parado": ano.pct_parado,
                        "pct_plantou": ano.pct_plantou,
                        "pct_incerto": ano.pct_incerto,
                        "pct_sem_dado": ano.pct_sem_dado,
                    }
                    for ano in region.anos
                ],
            }
            for region in regions
        ],
    }


def _params(
    regra: RegrasHistoricoNdvi,
    radius_km: float,
    km: int,
    centers: int,
    requests: int,
    mask_years: dict[int, int | None],
) -> dict[str, Any]:
    return {
        "servico": "ornl_daac",
        "url": ORNL_API_URL,
        "tipo": "regiao",
        "produtos": list(NDVI_PRODUCTS),
        "colecao": COLLECTION,
        "camadas": [NDVI_BAND, QUALITY_BAND],
        "qualidade_aceita": sorted(ACCEPTED_QUALITY),
        "mascara": {
            "produto": f"{LAND_COVER_PRODUCT}.{COLLECTION}",
            "camada": LAND_COVER_BAND,
            "classes": sorted(CROPLAND_CLASSES),
            "anos_usados": {str(year): used for year, used in sorted(mask_years.items())},
        },
        "janela": f"{regra.janela_inicio} a {regra.janela_fim}",
        "anos": [regra.ano_inicio, regra.ano_fim],
        "limites": {
            "limite_plantou": regra.limite_plantou,
            "limite_parado": regra.limite_parado,
            "min_observacoes": regra.min_observacoes,
        },
        "raio_km": radius_km,
        "km_pedido": km,
        "centros": centers,
        "pedidos": requests,
    }


# --- linha de comando -----------------------------------------------------------------------


def _join_centers_flag(argv: Sequence[str]) -> list[str]:
    """`--centros -18.9,-48.1` → `--centros=-18.9,-48.1`: o argparse leria o valor como opção."""
    joined: list[str] = []
    items = iter(argv)
    for item in items:
        if item == "--centros":
            value = next(items, None)
            joined.append(item if value is None else f"--centros={value}")
        else:
            joined.append(item)
    return joined


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    argv = _join_centers_flag(sys.argv[1:] if argv is None else argv)
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.fetch_regiao_ndvi",
        description="Região pelo satélite (P3): NDVI do MODIS por área, pela ORNL DAAC.",
    )
    parser.add_argument(
        "--centros",
        type=parse_points,
        default=[DEFAULT_CENTER],
        help='"lat,lon;lat,lon" (padrão: a fazenda de exemplo, -18.9543,-48.1993)',
    )
    parser.add_argument("--raio-km", type=float, default=DEFAULT_RADIUS_KM, help="padrão: 30")
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT, help="arquivo JSON")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR, help="pasta do cache")
    parser.add_argument("--dry-run", action="store_true", help="só mostra o plano, sem rede")
    parser.add_argument(
        "--tentativas", type=int, default=DEFAULT_MAX_ATTEMPTS, help="tentativas por pedido"
    )
    return parser.parse_args(argv)


def _rules_from_settings() -> Regras:
    return YamlRulesRepository(get_settings().regras_path).get_rules()


def _print_plan(
    plan: Sequence[SubsetRequest], centers: Sequence[Point], km: int, args: argparse.Namespace
) -> None:
    for request in plan:
        print(
            f"{request.product} {request.band} {request.start} a {request.end} "
            f"({request.n_dates} datas)"
        )
    total = len(plan) * len(centers)
    minutes = total * MEASURED_SECONDS_PER_REQUEST / 60
    print(
        f"Plano: {total} pedidos à ORNL ({len(plan)} por região, {len(centers)} região(ões)), "
        f"caixa de ±{km} km para o raio de {args.raio_km:g} km; cerca de {minutes:.0f} min "
        f"(~{MEASURED_SECONDS_PER_REQUEST:.0f} s por pedido). Saída: {args.saida}"
    )


def _write_payload(payload: dict[str, Any], output: Path, log: Callable[[str], None]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f"{output.name}.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", "utf-8")
    temporary.replace(output)
    log(f"Região gravada em {output}")
    for region in payload["regioes"]:
        log(f"({region['lat']}, {region['lon']}), {region['raio_km']:g} km:")
        for ano in region["anos"]:
            log(
                f"  {ano['ano']}: {ano['n_pixels']} pixels de lavoura; parado "
                f"{ano['pct_parado']}%, plantou {ano['pct_plantou']}%, incerto "
                f"{ano['pct_incerto']}%, sem dado {ano['pct_sem_dado']}%"
            )


def run(
    argv: Sequence[str] | None = None,
    *,
    transport: HttpTransport = default_http_request,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    log: Callable[[str], None] = _log,
    load_rules: Callable[[], Regras] = _rules_from_settings,
) -> int:
    """Executa o script. Devolve 0 (ok) ou 1 (erro; rode de novo que continua do cache)."""
    args = _parse_args(argv)
    centers: list[Point] = args.centros
    try:
        rules = load_rules()
        regra = rules.historico_ndvi
        plan = build_plan(regra)
        km = subset_km(args.raio_km)
        if args.dry_run:
            _print_plan(plan, centers, km, args)
            log("(dry-run) nada foi pedido à ORNL.")
            return 0

        client = OrnlClient(transport, max_attempts=args.tentativas, sleep=sleep, log=log)
        cache = SubsetCache(args.cache)
        total = len(plan) * len(centers)
        step = 0
        for center in centers:
            for request in plan:
                step += 1
                name = request.cache_name(center, km)
                label = f"[{step}/{total}] {request.product} {request.band} {request.start}"
                if cache.has(name):
                    log(f"{label}: no cache")
                    continue
                started = clock()
                raw = client.fetch_subset(request, center, km)
                cache.put(name, raw)
                log(f"{label}: {clock() - started:.0f} s, {len(raw) / 1e6:.1f} MB")

        classifier = RegionClassifier(rules)
        regions = []
        mask_years: dict[int, int | None] = {}
        for center in centers:
            region, used = _build_region(center, args.raio_km, km, plan, cache, classifier, regra)
            regions.append(region)
            mask_years.update(used)
        params = _params(regra, args.raio_km, km, len(centers), total, mask_years)
        _write_payload(build_region_payload(regions, params, now()), args.saida, log)
        return 0
    except (OrnlError, OSError, ValueError) as exc:
        log(f"Erro: {exc}. Rode de novo: o que já baixou fica no cache ({args.cache}).")
        return 1


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
