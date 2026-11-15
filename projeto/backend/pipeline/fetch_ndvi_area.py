"""NDVI do MODIS por área (RF-34, tarefa 0050): a série de cada pixel de 250 m, em ladrilhos.

Pede à ORNL DAAC (`modis.ornl.gov/rst/api/v1`, pública, sem login) o recorte por área do NDVI e da
`pixel_reliability` do MOD13Q1 e do MYD13Q1 (coleção 061) nas composições de 16 dias de janeiro a
julho dos anos do `historico_ndvi` do `regras.yaml` (2017 a 2026): a mesma janela, os mesmos
produtos, bandas, escala e filtro do modo por ponto (`fetch_ndvi --fonte ornl`). O mesmo pixel dá
os mesmos `NdviRecord` pelos dois caminhos. Grava o índice e os ladrilhos do formato do
`GridNdviRepository` (`app/repositories/ndvi_grid_repository.py`), que a API lê pelo
`NDVI_AREA_PATH` quando o arquivo por ponto não tem o talhão.

Uso (a partir de projeto/backend; nenhuma credencial):

    uv run python -m pipeline.fetch_ndvi_area --dry-run   # ladrilhos, pedidos, tempo e espaço
    uv run python -m pipeline.fetch_ndvi_area             # área do produto (PILOT_*), 2017 a 2026
    uv run python -m pipeline.fetch_ndvi_area --area="-19.0,-18.9,-48.25,-48.15" --anos 2026

Ladrilhos: os da soja recente (`plan_tiles`): ±30 km pedidos, 241 × 241 pixels, lado a lado a
partir do canto noroeste da área, na grade global do MODIS. A ordem é do centro da área para fora:
se o download parar, o miolo fica pronto primeiro. Cada ladrilho = 80 pedidos com os padrões (10
anos × 2 produtos × 2 pedidos × 2 bandas): as 14 datas do Terra e as 13 do Aqua de cada ano vão em
2 pedidos equilibrados (7 + 7 e 7 + 6), no limite de 10 da ORNL e menores que um pedido de 10.

Retomada: cada resposta conferida fica no cache (`cache_ornl/<ladrilho>/`, gzip), e o que está no
cache é lido por data (mudar o `--datas-por-pedido` não perde nada). O ladrilho fica pronto quando
é compactado (`ladrilhos/<ladrilho>.bin`, gravado de uma vez), e o índice é regravado a cada
ladrilho pronto: os pontos dos ladrilhos prontos já funcionam na API. Rode de novo que continua.
"""

import argparse
import contextlib
import gzip
import json
import math
import os
import re
import sys
import threading
import time
from array import array
from collections.abc import Callable, Iterable, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, date, datetime
from itertools import zip_longest
from pathlib import Path
from typing import Any, Final

from app.models.data_run import DataRun
from app.models.soja_recente import MODIS_250M_PIXEL_M, SINUSOIDAL_RADIUS_M
from app.repositories.external.http_client import HttpTransport, default_http_request
from app.repositories.ndvi_grid_repository import (
    DEFAULT_ROWS_PER_BLOCK,
    INDEX_FORMAT_NAME,
    INDEX_FORMAT_VERSION,
    NO_OBSERVATION,
    NO_QUALITY,
    TileHeader,
    dates_checksum,
    encode_tile,
    index_from_json,
    read_tile_header,
)
from pipeline.fetch_area_queimada import _years_arg
from pipeline.fetch_cmip6_deltas import PILOT_BOX, Box, parse_box, repo_root
from pipeline.fetch_ndvi import (
    ACCEPTED_QUALITY,
    COLLECTION,
    FIRST_YEAR,
    LAST_YEAR,
    NDVI_SCALE_FACTOR,
    PRODUCTS,
    SEASON_END_MMDD,
    SEASON_MONTHS,
    SEASON_START_MMDD,
    SOURCE_KEY,
    _duration,
)
from pipeline.fetch_regiao_ndvi import (
    DEFAULT_MAX_ATTEMPTS,
    MAX_DATES_PER_REQUEST,
    MAX_ORNL_KM,
    NDVI_BAND,
    ORNL_API_URL,
    QUALITY_BAND,
    SOURCE_LABEL,
    Grid,
    OrnlClient,
    OrnlError,
    Subset,
    SubsetRequest,
    composite_dates,
    parse_subset,
)
from pipeline.fetch_soja_recente import (
    GLOBAL_X_WEST_M,
    GLOBAL_Y_NORTH_M,
    MEASURED_SECONDS_PER_REQUEST,
    Tile,
    _good_ndvi,
    _tile_origin,
    global_pixel,
    pixel_window,
    plan_tiles,
    tile_half_pixels,
)

DEFAULT_TILE_KM: Final[int] = 30
DEFAULT_DATES_PER_REQUEST: Final[int] = MAX_DATES_PER_REQUEST
DEFAULT_PARALLEL: Final[int] = 2
# Até 4 ladrilhos ao mesmo tempo: a ORNL é um serviço público e já devolve 502 quando está lenta.
MAX_PARALLEL: Final[int] = 4
# Ladrilhos seguidos sem resposta (cada um já com as tentativas do `--tentativas`): a ORNL caiu.
MAX_CONSECUTIVE_FAILED_TILES: Final[int] = 3
# Medido em 15/11/2026 com o NDVI real da região (265 × 265 pixels, 243 datas, cache da tarefa
# 0036): 1,48 byte por pixel e data no ladrilho compactado e ~2,0 no cache bruto (gzip da ORNL).
MEASURED_TILE_BYTES_PER_VALUE: Final[float] = 1.48
MEASURED_CACHE_BYTES_PER_VALUE: Final[float] = 2.0
BANDS: Final[tuple[str, str]] = (NDVI_BAND, QUALITY_BAND)
TILES_DIR_NAME: Final[str] = "ladrilhos"

DOWNLOADS_DIR: Final[Path] = repo_root() / "data" / "baixados" / "nasa_modis_ndvi_area"
DEFAULT_OUTPUT: Final[Path] = DOWNLOADS_DIR / "ndvi_modis_area.json"
DEFAULT_CACHE_DIR: Final[Path] = DOWNLOADS_DIR / "cache_ornl"

_CACHE_NAME = re.compile(
    r"^(?P<product>M[OY]D13Q1)_(?P<band>.+)_(?P<start>\d{8})_(?P<end>\d{8})\.json\.gz$"
)


def _log(message: str) -> None:
    print(message, file=sys.stderr)


# --- datas, pedidos e ladrilhos -----------------------------------------------------------------


def season_dates(years: Iterable[int]) -> list[tuple[date, str]]:
    """As composições de Terra e Aqua de janeiro a julho de cada ano, em ordem de data."""
    return sorted(
        (day, product)
        for year in years
        for product in PRODUCTS
        for day in composite_dates(product, year, SEASON_START_MMDD, SEASON_END_MMDD)
    )


def balanced_chunks[T](items: Sequence[T], max_size: int) -> list[list[T]]:
    """Os itens em pedaços seguidos de até `max_size`, do mesmo tamanho (diferença de 1 no máximo):
    14 datas com até 10 viram 7 + 7, não 10 + 4."""
    if not 1 <= max_size <= MAX_DATES_PER_REQUEST:
        raise ValueError(
            f"datas por pedido: de 1 a {MAX_DATES_PER_REQUEST} (limite da ORNL), veio {max_size}"
        )
    if not items:
        return []
    count = math.ceil(len(items) / max_size)
    base, extra = divmod(len(items), count)
    chunks, start = [], 0
    for index in range(count):
        size = base + (1 if index < extra else 0)
        chunks.append(list(items[start : start + size]))
        start += size
    return chunks


def plan_area_tiles(box: Box, km: int) -> list[Tile]:
    """Os ladrilhos que cobrem a área, do mais perto do centro dela para o mais longe."""
    tiles = plan_tiles(pixel_window(box), tile_half_pixels(km))
    row, col = global_pixel((box.lat_min + box.lat_max) / 2, (box.lon_min + box.lon_max) / 2)
    return sorted(tiles, key=lambda tile: math.hypot(tile.row - row, tile.col - col))


def tile_name(tile: Tile) -> str:
    return f"r{tile.row}_c{tile.col}"


def _missing_chunks(
    days: Sequence[date], product: str, band: str, covered: set[tuple[str, str, date]], size: int
) -> list[list[date]]:
    """As datas que faltam no cache, em trechos de datas seguidas (um pedido vai do início ao
    fim do trecho, então não pode passar por cima de uma data já guardada)."""
    runs: list[list[date]] = [[]]
    for day in days:
        if (product, band, day) in covered:
            runs.append([])
        else:
            runs[-1].append(day)
    return [chunk for run in runs for chunk in balanced_chunks(run, size)]


def tile_requests(
    dates: Sequence[tuple[date, str]], covered: set[tuple[str, str, date]], max_dates: int
) -> list[SubsetRequest]:
    """Os pedidos de um ladrilho para as datas que faltam: ano a ano, Terra e depois Aqua, cada
    bloco de datas com o NDVI e a qualidade (uma banda por pedido)."""
    groups: dict[tuple[int, str], list[date]] = {}
    for day, product in dates:
        groups.setdefault((day.year, product), []).append(day)
    order = {product: index for index, product in enumerate(PRODUCTS)}
    requests: list[SubsetRequest] = []
    for (_, product), days in sorted(groups.items(), key=lambda g: (g[0][0], order[g[0][1]])):
        by_band = [_missing_chunks(days, product, band, covered, max_dates) for band in BANDS]
        for pair in zip_longest(*by_band):
            for band, chunk in zip(BANDS, pair, strict=True):
                if chunk:
                    requests.append(SubsetRequest(product, band, chunk[0], chunk[-1], len(chunk)))
    return requests


# --- cache de um ladrilho -----------------------------------------------------------------------


class TileCache:
    """As respostas da ORNL de um ladrilho (`<cache>/<ladrilho>/`), uma por pedido, em gzip.

    O que está guardado é lido pelo nome do arquivo (produto, banda, primeira e última data): as
    composições do produto nesse intervalo estão no cache, seja qual for o tamanho do pedido.
    """

    def __init__(self, root: Path, tile: Tile) -> None:
        self.folder = root / tile_name(tile)

    def _path(self, request: SubsetRequest) -> Path:
        name = f"{request.product}_{request.band}_{request.start:%Y%m%d}_{request.end:%Y%m%d}"
        return self.folder / f"{name}.json.gz"

    def put(self, request: SubsetRequest, raw: bytes) -> None:
        self.folder.mkdir(parents=True, exist_ok=True)
        path = self._path(request)
        partial = path.with_name(f"{path.name}.{os.getpid()}.part")
        partial.write_bytes(gzip.compress(raw))
        partial.replace(path)

    def _files(self) -> list[tuple[str, str, date, date, Path]]:
        found = []
        for path in sorted(self.folder.glob("*.json.gz")):
            match = _CACHE_NAME.match(path.name)
            if match is None or match["band"] not in BANDS:
                continue
            start = datetime.strptime(match["start"], "%Y%m%d").date()
            end = datetime.strptime(match["end"], "%Y%m%d").date()
            found.append((match["product"], match["band"], start, end, path))
        return found

    def covered(self) -> set[tuple[str, str, date]]:
        covered = set()
        for product, band, start, end, _ in self._files():
            for day in composite_dates(product, start.year, "01-01", "12-31"):
                if start <= day <= end:
                    covered.add((product, band, day))
        return covered

    def layers(self, product: str, band: str) -> tuple[Grid | None, dict[date, array]]:
        """A grade e as camadas (valores brutos por data) de todos os recortes guardados."""
        grid: Grid | None = None
        layers: dict[date, array] = {}
        for file_product, file_band, _, _, path in self._files():
            if (file_product, file_band) != (product, band):
                continue
            subset = parse_subset(gzip.decompress(path.read_bytes()))
            if grid is not None and subset.grid != grid:
                raise OrnlError(f"Recortes do ladrilho {self.folder.name} com grades diferentes.")
            grid = subset.grid
            layers.update(subset.layers)
        return grid, layers

    def delete(self) -> None:
        for *_, path in self._files():
            path.unlink()
        with contextlib.suppress(OSError):  # sobrou algo que não é deste script: fica
            self.folder.rmdir()


def check_subset(raw: bytes, request: SubsetRequest, tile: Tile) -> tuple[Subset, list[date]]:
    """Confere a resposta antes de ela entrar no cache: a banda pedida, a grade global do MODIS
    (pixel de 231,66 m, alinhado), o centro do ladrilho dentro do recorte e só datas do pedido.
    Devolve o recorte e as datas do pedido que não vieram (ficam sem observação)."""
    try:
        payload = json.loads(raw.decode("utf-8"))
        items = payload.get("subset", []) if isinstance(payload, dict) else None
        if not isinstance(items, list):
            raise OrnlError("resposta sem 'subset'")
        bands = {payload.get("band")} | {i.get("band") for i in items if isinstance(i, dict)}
        wrong = sorted(str(b) for b in bands - {None, request.band})
        if wrong:
            raise OrnlError(f"veio a banda {', '.join(wrong)}; o pedido era {request.band}")
        subset = parse_subset(raw)
    except (UnicodeDecodeError, ValueError, KeyError, TypeError) as exc:
        raise OrnlError(f"resposta fora do formato ({exc})") from exc
    top, left = _tile_origin(subset.grid)
    inside_rows = top <= tile.row < top + subset.grid.nrows
    if not (inside_rows and left <= tile.col < left + subset.grid.ncols):
        raise OrnlError(f"o recorte não cobre o centro do ladrilho {tile_name(tile)}")
    expected = [
        day
        for day in composite_dates(request.product, request.start.year, "01-01", "12-31")
        if request.start <= day <= request.end
    ]
    extra = sorted(set(subset.layers) - set(expected))
    if extra:
        raise OrnlError(f"veio a data {extra[0]}, fora das composições pedidas")
    return subset, [day for day in expected if day not in subset.layers]


# --- compactação, prontos e índice --------------------------------------------------------------


def compact_tile(
    tile: Tile, dates: Sequence[tuple[date, str]], cache: TileCache, tiles_dir: Path
) -> Path:
    """Junta os recortes do ladrilho e grava o arquivo compactado (de uma vez: o ladrilho só fica
    pronto inteiro). Fica só a observação boa, com o filtro do modo por ponto: qualidade 0 ou 1 e
    NDVI bruto de −2000 a 10000 (sem o −3000 de preenchimento)."""
    loaded = {
        (product, band): cache.layers(product, band) for product in PRODUCTS for band in BANDS
    }
    grids = {grid for grid, _ in loaded.values() if grid is not None}
    if len(grids) != 1:
        raise OrnlError(f"Recortes do ladrilho {tile_name(tile)} sem grade ou com grades trocadas.")
    grid = grids.pop()
    top, left = _tile_origin(grid)
    size = grid.nrows * grid.ncols
    ndvi_layers: list[array] = []
    quality_layers: list[bytes] = []
    for day, product in dates:
        ndvi = loaded[(product, NDVI_BAND)][1].get(day)
        quality = loaded[(product, QUALITY_BAND)][1].get(day)
        if ndvi is None or quality is None:
            ndvi_layers.append(array("h", [NO_OBSERVATION]) * size)
            quality_layers.append(bytes([NO_QUALITY]) * size)
            continue
        good = [_good_ndvi(n, q) for n, q in zip(ndvi, quality, strict=True)]
        ndvi_layers.append(
            array("h", [n if ok else NO_OBSERVATION for n, ok in zip(ndvi, good, strict=True)])
        )
        quality_layers.append(
            bytes(q if ok else NO_QUALITY for q, ok in zip(quality, good, strict=True))
        )
    data = encode_tile(
        top, left, grid.nrows, grid.ncols, dates, ndvi_layers, quality_layers,
        rows_per_block=DEFAULT_ROWS_PER_BLOCK,
    )  # fmt: skip
    tiles_dir.mkdir(parents=True, exist_ok=True)
    path = tiles_dir / f"{tile_name(tile)}.bin"
    partial = path.with_name(f"{path.name}.{os.getpid()}.part")
    partial.write_bytes(data)
    partial.replace(path)
    return path


def ready_tile(path: Path, dates: Sequence[tuple[date, str]]) -> TileHeader | None:
    """O cabeçalho do ladrilho já compactado com estas datas; None se ainda falta (ou se ele foi
    gravado com outras datas, e aí é refeito)."""
    if not path.is_file():
        return None
    try:
        header = read_tile_header(path)
    except (OSError, ValueError):
        return None
    if header.ndates != len(dates) or header.dates_crc != dates_checksum(dates):
        return None
    return header


@dataclass(frozen=True)
class ReadyTile:
    tile: Tile
    header: TileHeader
    path: Path


def _box_json(box: Box) -> dict[str, float]:
    return {
        "lat_min": box.lat_min,
        "lat_max": box.lat_max,
        "lon_min": box.lon_min,
        "lon_max": box.lon_max,
    }


def build_index(
    args: argparse.Namespace,
    dates: Sequence[tuple[date, str]],
    ready: Sequence[ReadyTile],
    planned: int,
    finished_at: datetime,
) -> dict[str, Any]:
    """O índice do NDVI por área, conferido pelo `DataRun` e pelo `index_from_json` da API."""
    years = sorted({day.year for day, _ in dates})
    params = {
        "servico": "ornl_daac",
        "url": ORNL_API_URL,
        "tipo": "ndvi_area",
        "produtos": list(PRODUCTS),
        "colecao": COLLECTION,
        "camadas": list(BANDS),
        "qualidade_aceita": sorted(ACCEPTED_QUALITY),
        "anos": [years[0], years[-1]],
        "meses": sorted(SEASON_MONTHS),
        "datas": len(dates),
        "fator_escala": NDVI_SCALE_FACTOR,
        "area": _box_json(args.area),
        "km_pedido": args.km,
        "datas_por_pedido": args.datas_por_pedido,
        "ladrilhos_planejados": planned,
        "ladrilhos_prontos": len(ready),
        "completo": len(ready) == planned,
    }
    data_run = DataRun(
        source=SOURCE_KEY,
        params=params,
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-modis-ndvi-area",
    )
    payload: dict[str, Any] = {
        "versao_dados": {
            "fonte": data_run.source,
            "parametros": dict(data_run.params),
            "fim": data_run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": data_run.version,
        },
        "formato": {
            "nome": INDEX_FORMAT_NAME,
            "versao": INDEX_FORMAT_VERSION,
            "linhas_por_bloco": DEFAULT_ROWS_PER_BLOCK,
            "ladrilho": "cabeçalho, tabela dos blocos e blocos zlib; em cada bloco, data a data, "
            "o byte alto do NDVI bruto (int16), o byte baixo e a qualidade (uint8)",
            "sem_observacao": NO_OBSERVATION,
        },
        "fonte": SOURCE_LABEL,
        "fator_escala": NDVI_SCALE_FACTOR,
        "grade": {
            "projecao": "sinusoidal_modis",
            "raio_m": SINUSOIDAL_RADIUS_M,
            "pixel_m": MODIS_250M_PIXEL_M,
            "x_oeste_m": GLOBAL_X_WEST_M,
            "y_norte_m": GLOBAL_Y_NORTH_M,
        },
        "datas": [[day.isoformat(), product] for day, product in dates],
        "area": _box_json(args.area),
        "ladrilhos": [
            {
                "arquivo": f"{TILES_DIR_NAME}/{item.path.name}",
                "linha": item.header.origin_row,
                "coluna": item.header.origin_col,
                "linhas": item.header.nrows,
                "colunas": item.header.ncols,
                "centro": {"lat": item.tile.center.lat, "lon": item.tile.center.lon},
                "bytes": item.path.stat().st_size,
            }
            for item in sorted(ready, key=lambda r: (r.header.origin_row, r.header.origin_col))
        ],
    }
    index_from_json(payload)  # a mesma leitura da API: fora do contrato, nada é gravado
    return payload


def write_index(payload: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_name(f"{output.name}.{os.getpid()}.part")
    partial.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    partial.replace(output)  # a API nunca lê um índice pela metade


# --- download -----------------------------------------------------------------------------------


class _Stopped(Exception):
    """A execução parou (ORNL fora do ar): o ladrilho fica para a próxima."""


class _TileTracker:
    """Conta os ladrilhos seguidos sem resposta e manda parar no limite (vale entre os threads)."""

    def __init__(self, limit: int, log: Callable[[str], None]) -> None:
        self._limit = limit
        self._log = log
        self._lock = threading.Lock()
        self._consecutive = 0
        self._stop = threading.Event()
        self.failed = 0

    @property
    def stopped(self) -> bool:
        return self._stop.is_set()

    def success(self) -> None:
        with self._lock:
            self._consecutive = 0

    def failure(self) -> None:
        with self._lock:
            self.failed += 1
            self._consecutive += 1
            if self._consecutive >= self._limit and not self._stop.is_set():
                self._stop.set()
                self._log(
                    f"{self._consecutive} ladrilhos seguidos sem resposta: a ORNL parece fora do "
                    "ar. Parei os outros; rode de novo mais tarde (continua do cache)."
                )


@dataclass(frozen=True)
class _Context:
    args: argparse.Namespace
    dates: Sequence[tuple[date, str]]
    client: OrnlClient
    tracker: _TileTracker
    tiles_dir: Path
    clock: Callable[[], float]
    log: Callable[[str], None]


def _band_label(band: str) -> str:
    return "NDVI" if band == NDVI_BAND else "qualidade"


def _process_tile(tile: Tile, position: str, ctx: _Context) -> ReadyTile | None:
    """Pede o que falta do ladrilho, confere, guarda e compacta. Falha: None (o que veio fica no
    cache para a próxima execução)."""
    name = tile_name(tile)
    if ctx.tracker.stopped:
        return None
    cache = TileCache(ctx.args.cache, tile)
    try:
        requests = tile_requests(ctx.dates, cache.covered(), ctx.args.datas_por_pedido)
        for step, request in enumerate(requests, 1):
            if ctx.tracker.stopped:
                raise _Stopped
            started = ctx.clock()
            raw = ctx.client.fetch_subset(request, tile.center, ctx.args.km)
            _, missing = check_subset(raw, request, tile)
            cache.put(request, raw)
            ctx.log(
                f"[{position} {name} {step}/{len(requests)}] {request.product} "
                f"{_band_label(request.band)} {request.start} a {request.end}: "
                f"{ctx.clock() - started:.0f} s, {len(raw) / 1e6:.1f} MB"
            )
            if missing:
                days = ", ".join(str(day) for day in missing)
                ctx.log(f"Atenção: a ORNL não mandou {days}; no ladrilho, fica sem observação.")
        path = compact_tile(tile, ctx.dates, cache, ctx.tiles_dir)
        header = read_tile_header(path)
        if ctx.args.apagar_cache:
            cache.delete()
    except _Stopped:
        return None
    except (OrnlError, OSError, ValueError) as exc:
        ctx.log(f"Ladrilho {name}: {exc}")
        ctx.tracker.failure()
        return None
    ctx.tracker.success()
    ctx.log(f"[{position}] Ladrilho {name} pronto ({path.stat().st_size / 1e6:.1f} MB).")
    return ReadyTile(tile, header, path)


def _count(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def _plural(count: int, one: str, many: str) -> str:
    return f"{count} {one if count == 1 else many}"


def plan_text(
    args: argparse.Namespace,
    tiles: Sequence[Tile],
    ready: set[tuple[int, int]],
    dates: Sequence[tuple[date, str]],
) -> str:
    """O plano do `--dry-run`: ladrilhos prontos e a baixar, pedidos, tempo e espaço, sem rede."""
    box = args.area
    window = pixel_window(box)
    side = 2 * tile_half_pixels(args.km) + 1
    per_tile = len(tile_requests(dates, set(), args.datas_por_pedido))
    pending_tiles = [t for t in tiles if (t.row, t.col) not in ready]
    missing = sum(
        len(tile_requests(dates, TileCache(args.cache, t).covered(), args.datas_por_pedido))
        for t in pending_tiles
    )
    cached = len(pending_tiles) * per_tile - missing
    seconds = missing * MEASURED_SECONDS_PER_REQUEST / args.paralelo
    values = side * side * len(dates)
    tile_mb = values * MEASURED_TILE_BYTES_PER_VALUE / 1e6
    cache_mb = values * MEASURED_CACHE_BYTES_PER_VALUE / 1e6
    years = sorted({day.year for day, _ in dates})
    ready_count = len(tiles) - len(pending_tiles)
    return "\n".join(
        [
            f"NDVI do MODIS por área pela ORNL DAAC ({ORNL_API_URL}), sem credencial.",
            f"Área: lat {box.lat_min:g} a {box.lat_max:g}, lon {box.lon_min:g} a {box.lon_max:g} | "
            f"{window.rows} × {window.cols} pixels de 250 m | ladrilhos de ±{args.km} km "
            f"({side} × {side} pixels), do centro da área para fora",
            f"Datas: {years[0]} a {years[-1]}, janeiro a julho, {' + '.join(PRODUCTS)} = "
            f"{len(dates)} composições | NDVI e qualidade | até {args.datas_por_pedido} datas "
            "por pedido",
            f"Ladrilhos: {_plural(len(tiles), 'ladrilho', 'ladrilhos')} "
            f"({_plural(ready_count, 'pronto', 'prontos')}, {len(pending_tiles)} a baixar) × "
            f"{per_tile} pedidos = {_count(len(tiles) * per_tile)} pedidos; faltam "
            f"{_count(missing)} ({_count(cached)} já no cache)",
            f"Tempo estimado: ~{_duration(seconds)} com {args.paralelo} em paralelo "
            f"(~{MEASURED_SECONDS_PER_REQUEST:g} s por pedido, medido na soja recente com 241 × "
            "241 pixels; sem contar os 502 e as novas tentativas)",
            f"Espaço: ~{len(tiles) * tile_mb:.0f} MB de ladrilhos (~{tile_mb:.0f} MB cada, medido "
            f"com o NDVI real da região) e até ~{len(tiles) * cache_mb:.0f} MB de cache bruto "
            "(--apagar-cache apaga o de cada ladrilho depois de compactar)",
            f"Saída: {args.saida} | ladrilhos em {args.saida.parent / TILES_DIR_NAME} | cache em "
            f"{args.cache}",
        ]
    )


# --- linha de comando ---------------------------------------------------------------------------


def _box_arg(text: str) -> Box:
    try:
        return parse_box(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _bounded_int(low: int, high: int, what: str) -> Callable[[str], int]:
    def parse(text: str) -> int:
        value = int(text)
        if not low <= value <= high:
            raise argparse.ArgumentTypeError(f"{what}: de {low} a {high}, veio {value}")
        return value

    return parse


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.fetch_ndvi_area",
        description="NDVI do MODIS (MOD13Q1 + MYD13Q1, 061) por área, em ladrilhos, pela ORNL.",
    )
    parser.add_argument(
        "--area",
        type=_box_arg,
        default=PILOT_BOX,
        metavar="LAT_MIN,LAT_MAX,LON_MIN,LON_MAX",
        help='caixa (use --area="..."). Padrão: a área do produto (PILOT_* do app/constants.py)',
    )
    parser.add_argument(
        "--anos",
        type=_years_arg,
        default=range(FIRST_YEAR, LAST_YEAR + 1),
        help=f"2026 ou 2017-2026 (padrão: {FIRST_YEAR}-{LAST_YEAR}, do historico_ndvi)",
    )
    parser.add_argument(
        "--km",
        type=_bounded_int(1, MAX_ORNL_KM, "km"),
        default=DEFAULT_TILE_KM,
        help=f"±km de cada ladrilho (padrão: {DEFAULT_TILE_KM})",
    )
    parser.add_argument(
        "--datas-por-pedido",
        type=_bounded_int(1, MAX_DATES_PER_REQUEST, "datas por pedido"),
        default=DEFAULT_DATES_PER_REQUEST,
        help=f"no máximo, de 1 a {MAX_DATES_PER_REQUEST} (padrão: {DEFAULT_DATES_PER_REQUEST}; "
        "os pedidos saem equilibrados)",
    )
    parser.add_argument(
        "--paralelo",
        type=_bounded_int(1, MAX_PARALLEL, "ladrilhos em paralelo"),
        default=DEFAULT_PARALLEL,
        help=f"ladrilhos ao mesmo tempo, de 1 a {MAX_PARALLEL} (padrão: {DEFAULT_PARALLEL})",
    )
    parser.add_argument(
        "--tentativas",
        type=_bounded_int(1, 20, "tentativas"),
        default=DEFAULT_MAX_ATTEMPTS,
        help=f"tentativas por pedido (padrão: {DEFAULT_MAX_ATTEMPTS})",
    )
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR, help="pasta do cache")
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT, help="índice JSON")
    parser.add_argument(
        "--apagar-cache",
        action="store_true",
        help="apaga o cache bruto de cada ladrilho depois de compactá-lo",
    )
    parser.add_argument("--dry-run", action="store_true", help="só mostra o plano, sem rede")
    return parser.parse_args(sys.argv[1:] if argv is None else argv)


def run(
    argv: Sequence[str] | None = None,
    *,
    transport: HttpTransport = default_http_request,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    log: Callable[[str], None] = _log,
) -> int:
    """Executa o script. Devolve 0 (todos os ladrilhos prontos), 1 (erro) ou 2 (faltou algum
    ladrilho: rode de novo, que continua do cache)."""
    args = _parse_args(argv)
    dates = season_dates(args.anos)
    tiles = plan_area_tiles(args.area, args.km)
    tiles_dir = args.saida.parent / TILES_DIR_NAME
    ready: dict[tuple[int, int], ReadyTile] = {}
    for tile in tiles:
        path = tiles_dir / f"{tile_name(tile)}.bin"
        header = ready_tile(path, dates)
        if header is not None:
            ready[(tile.row, tile.col)] = ReadyTile(tile, header, path)

    if args.dry_run:
        print(plan_text(args, tiles, set(ready), dates))
        log("(dry-run) nada foi pedido à ORNL.")
        return 0

    pending = [tile for tile in tiles if (tile.row, tile.col) not in ready]
    log(
        f"{_plural(len(tiles), 'ladrilho', 'ladrilhos')}: {len(ready)} já prontos, "
        f"{len(pending)} a baixar, {args.paralelo} em paralelo."
    )
    tracker = _TileTracker(MAX_CONSECUTIVE_FAILED_TILES, log)
    client = OrnlClient(transport, max_attempts=args.tentativas, sleep=sleep, log=log)
    ctx = _Context(args, dates, client, tracker, tiles_dir, clock, log)

    def save_index() -> None:
        payload = build_index(args, dates, list(ready.values()), len(tiles), now())
        write_index(payload, args.saida)

    try:
        with ThreadPoolExecutor(max_workers=args.paralelo) as pool:
            futures = [
                pool.submit(_process_tile, tile, f"{index}/{len(pending)}", ctx)
                for index, tile in enumerate(pending, 1)
            ]
            for future in as_completed(futures):
                item = future.result()
                if item is not None:
                    ready[(item.tile.row, item.tile.col)] = item
                    save_index()  # cada ladrilho pronto já vale na API
        if ready:
            save_index()
    except (OSError, ValueError) as exc:
        log(f"Erro: {exc}")
        return 1
    missing = len(tiles) - len(ready)
    if missing:
        where = f" no índice {args.saida}" if ready else ""
        log(
            f"{_plural(missing, 'ladrilho ficou', 'ladrilhos ficaram')} para depois "
            f"({len(ready)} de {len(tiles)} prontos{where}). O que já veio está em "
            f"{args.cache}: rode de novo que continua de onde parou."
        )
        return 2
    log(f"NDVI por área pronto: {len(tiles)} ladrilhos em {tiles_dir}, índice em {args.saida}.")
    return 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
