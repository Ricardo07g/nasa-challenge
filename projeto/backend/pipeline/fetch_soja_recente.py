"""Soja na safra mais recente (RF-24, tarefa 0037): o pico do NDVI de cada pixel da caixa.

Pede à ORNL DAAC (`modis.ornl.gov/rst/api/v1`, pública, sem login) o recorte por área do NDVI e da
`pixel_reliability` do MODIS (MOD13Q1 e MYD13Q1, coleção 061, 250 m) nas datas da janela do
`regras.yaml` (grupo `soja_recente`: 1/jan a 15/mar) do ano da colheita, para a caixa piloto
inteira (ou `--area`), em ladrilhos. Grava o arquivo do contrato "Soja recente" (`AGENTS.md` do
backend), que a API lê pelo `SOJA_RECENTE_PATH` (campo `soja_recente` do `/talhao`).

Uso (a partir de projeto/backend; nenhuma credencial):

    uv run python -m pipeline.fetch_soja_recente --dry-run   # ladrilhos, pedidos e tempo, sem rede
    uv run python -m pipeline.fetch_soja_recente             # caixa piloto, safra 2025/26
    uv run python -m pipeline.fetch_soja_recente --area="-19.0,-18.9,-48.25,-48.15"

Ladrilhos: o tempo de um pedido à ORNL quase não depende da área (medido em 14/11/2026: ~24 s para
241 × 241 pixels e 8 datas), mas pedido maior passa do corte de ~60 s do proxy (502). Cada
ladrilho é o que a região usa: ±30 km pedidos, que a ORNL conta como 120 pixels de 250 m de cada
lado (241 × 241 pixels de 231,66 m, ±27,9 km reais). Os ladrilhos seguem a grade global do MODIS
(projeção sinusoidal), um ao lado do outro, sem sobra nem buraco; a caixa piloto dá 12 ladrilhos
e 48 pedidos (2 produtos × 2 bandas, 5 datas cada).

Pico de cada pixel (`SojaRecenteRule`): o maior NDVI das observações boas (qualidade 0 ou 1, sem o
−3000 de preenchimento) de Terra e Aqua na janela; com menos de `min_observacoes`, sem dado. Grava
em centésimos truncados (0,6999 vira 69): com o limite de 2 casas do `regras.yaml`, "pico ≥ 0,70" no
arquivo é o mesmo que no NDVI original. O limite da soja fica na API (`SojaRecenteService`).

Cache e retomada: cada resposta fica em `cache_ornl/` (gzip). Se parar, rode de novo: o que já
baixou não é pedido outra vez. Mudou a janela ou o mínimo de observações no `regras.yaml`? Rode de
novo (o mínimo sai do cache, sem rede; a janela pede as datas novas).
"""

import argparse
import json
import math
import sys
import time
from array import array
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Final

from app.config import get_settings
from app.models.data_run import DataRun
from app.models.regras import Regras, RegrasSojaRecente
from app.models.soja_recente import (
    CENTESIMOS,
    MODIS_250M_PIXEL_M,
    SINUSOIDAL_RADIUS_M,
    safra_label,
)
from app.models.talhao import NDVI_VALID_MAX, NDVI_VALID_MIN
from app.repositories.external.http_client import HttpTransport, default_http_request
from app.repositories.rules_repository import YamlRulesRepository
from app.repositories.soja_recente_repository import mapa_from_json
from app.services.soja_recente_service import SojaRecenteRule
from pipeline.fetch_cmip6_deltas import PILOT_BOX, Box, parse_box, repo_root
from pipeline.fetch_ndvi import ACCEPTED_QUALITY, COLLECTION, RAW_FILL_VALUE, SOURCE_KEY, Point
from pipeline.fetch_regiao_ndvi import (
    DEFAULT_MAX_ATTEMPTS,
    NDVI_BAND,
    NDVI_PRODUCTS,
    ORNL_API_URL,
    ORNL_KM_PER_PIXEL,
    QUALITY_BAND,
    SOURCE_LABEL,
    Grid,
    OrnlClient,
    OrnlError,
    SubsetCache,
    SubsetRequest,
    chunked,
    composite_dates,
    parse_subset,
    sinusoidal_to_latlon,
)

# Safra mais recente: a soja colhida em fevereiro de 2026 (2025/26).
DEFAULT_HARVEST_YEAR: Final[int] = 2026
# Ladrilho de ±30 km pedidos (241 × 241 pixels), o tamanho medido que a região usa.
DEFAULT_TILE_KM: Final[int] = 30
# Canto de cima à esquerda da grade global do MODIS na projeção sinusoidal (−πR, πR/2).
GLOBAL_X_WEST_M: Final[float] = -math.pi * SINUSOIDAL_RADIUS_M
GLOBAL_Y_NORTH_M: Final[float] = math.pi / 2 * SINUSOIDAL_RADIUS_M
# Folga para conferir que um recorte da ORNL cai na grade global (cabeçalho com 2 casas).
GRID_ALIGNMENT_TOLERANCE_PX: Final[float] = 0.01
CENTER_DECIMALS: Final[int] = 5  # ~1 m: o centro pedido fica bem dentro do pixel de 231 m
# Medido: 14/11/2026, ~24 s (241 × 241 pixels, 8 datas); 15/11/2026, 52 s (1 pixel, 5 datas).
MEASURED_SECONDS_PER_REQUEST: Final[float] = 40.0

DOWNLOADS_DIR: Final[Path] = repo_root() / "data" / "baixados" / "nasa_modis_soja_recente"
DEFAULT_CACHE_DIR: Final[Path] = DOWNLOADS_DIR / "cache_ornl"


def default_output(harvest_year: int) -> Path:
    return DOWNLOADS_DIR / f"soja_recente_{harvest_year}.json"


def _log(message: str) -> None:
    print(message, file=sys.stderr)


# --- grade global, janela de pixels e ladrilhos ------------------------------------------------


def _sinusoidal(lat: float, lon: float) -> tuple[float, float]:
    phi = math.radians(lat)
    return SINUSOIDAL_RADIUS_M * math.radians(lon) * math.cos(phi), SINUSOIDAL_RADIUS_M * phi


def global_pixel(lat: float, lon: float, pixel_m: float = MODIS_250M_PIXEL_M) -> tuple[int, int]:
    """(linha, coluna) do pixel que contém o ponto na grade global do MODIS (250 m por padrão;
    a área queimada, tarefa 0043, usa a de 500 m)."""
    x, y = _sinusoidal(lat, lon)
    return (
        math.floor((GLOBAL_Y_NORTH_M - y) / pixel_m),
        math.floor((x - GLOBAL_X_WEST_M) / pixel_m),
    )


def _pixel_center(row: int, col: int, pixel_m: float = MODIS_250M_PIXEL_M) -> tuple[float, float]:
    """Centro do pixel global em latitude e longitude."""
    return sinusoidal_to_latlon(
        GLOBAL_X_WEST_M + (col + 0.5) * pixel_m,
        GLOBAL_Y_NORTH_M - (row + 0.5) * pixel_m,
    )


@dataclass(frozen=True)
class PixelWindow:
    """Retângulo de pixels globais (índices inclusivos) que cobre a caixa pedida."""

    row_first: int
    row_last: int
    col_first: int
    col_last: int

    @property
    def rows(self) -> int:
        return self.row_last - self.row_first + 1

    @property
    def cols(self) -> int:
        return self.col_last - self.col_first + 1


def pixel_window(box: Box, pixel_m: float = MODIS_250M_PIXEL_M) -> PixelWindow:
    """Os pixels que cobrem a caixa. Na projeção sinusoidal a caixa vira um trapézio (x encolhe
    com o cosseno da latitude): os extremos ficam nos cantos ou, se a caixa cruzar o equador,
    na latitude zero."""
    lats = [box.lat_min, box.lat_max] + ([0.0] if box.lat_min < 0 < box.lat_max else [])
    pixels = [global_pixel(lat, lon, pixel_m) for lat in lats for lon in (box.lon_min, box.lon_max)]
    rows = [row for row, _ in pixels]
    cols = [col for _, col in pixels]
    return PixelWindow(min(rows), max(rows), min(cols), max(cols))


def tile_half_pixels(km: int, km_per_pixel: float = ORNL_KM_PER_PIXEL) -> int:
    """Pixels de cada lado do centro que a ORNL devolve para `kmAboveBelow` = `km` (ela conta
    0,25 km por pixel nos produtos de 250 m e 0,5 km nos de 500 m)."""
    return round(km / km_per_pixel)


@dataclass(frozen=True)
class Tile:
    """Um ladrilho: o pixel global do centro e o ponto (centro do pixel) pedido à ORNL."""

    row: int
    col: int
    center: Point


def plan_tiles(window: PixelWindow, half: int, pixel_m: float = MODIS_250M_PIXEL_M) -> list[Tile]:
    """Ladrilhos de (2 × half + 1) pixels, lado a lado a partir do canto de cima à esquerda."""
    size = 2 * half + 1
    tiles = []
    for row in range(window.row_first + half, window.row_last + half + 1, size):
        for col in range(window.col_first + half, window.col_last + half + 1, size):
            lat, lon = _pixel_center(row, col, pixel_m)
            center = Point(round(lat, CENTER_DECIMALS), round(lon, CENTER_DECIMALS))
            tiles.append(Tile(row=row, col=col, center=center))
    return tiles


def build_plan(regra: RegrasSojaRecente, harvest_year: int) -> list[SubsetRequest]:
    """NDVI e qualidade de Terra e Aqua nas datas da janela do ano (até 10 datas por pedido)."""
    plan: list[SubsetRequest] = []
    for product in NDVI_PRODUCTS:
        days = composite_dates(product, harvest_year, regra.janela_inicio, regra.janela_fim)
        for group in chunked(days):
            for band in (NDVI_BAND, QUALITY_BAND):
                plan.append(SubsetRequest(product, band, group[0], group[-1], len(group)))
    return plan


# --- pico de cada pixel -------------------------------------------------------------------------

LoadSubset = Callable[[Tile, SubsetRequest], bytes]


def _offset(value: float, label: str) -> int:
    offset = round(value)
    if abs(value - offset) > GRID_ALIGNMENT_TOLERANCE_PX:
        raise OrnlError(f"Recorte fora da grade global do MODIS ({label} = {value:.3f} pixels).")
    return offset


def _tile_origin(grid: Grid, pixel_m: float = MODIS_250M_PIXEL_M) -> tuple[int, int]:
    """Pixel global do canto de cima à esquerda do recorte, pelo cabeçalho da ORNL."""
    if not math.isclose(grid.cellsize, pixel_m, rel_tol=1e-6):
        raise OrnlError(f"Recorte com pixel de {grid.cellsize} m (a grade tem {pixel_m:.2f} m).")
    y_top = grid.yll + grid.nrows * grid.cellsize
    row = _offset((GLOBAL_Y_NORTH_M - y_top) / pixel_m, "linha")
    col = _offset((grid.xll - GLOBAL_X_WEST_M) / pixel_m, "coluna")
    return row, col


def _good_ndvi(raw: int, quality: int) -> bool:
    return (
        quality in ACCEPTED_QUALITY
        and raw != RAW_FILL_VALUE
        and NDVI_VALID_MIN <= raw <= NDVI_VALID_MAX
    )


def _tile_layers(
    tile: Tile, plan: Sequence[SubsetRequest], load: LoadSubset
) -> tuple[Grid, list[tuple[array, array]]]:
    """A grade do ladrilho e os pares (NDVI, qualidade) de cada produto e data."""
    ndvi: dict[tuple[str, date], array] = {}
    quality: dict[tuple[str, date], array] = {}
    grid: Grid | None = None
    for request in plan:
        subset = parse_subset(load(tile, request))
        if grid is None:
            grid = subset.grid
        elif subset.grid != grid:
            raise OrnlError(f"Recortes do ladrilho ({tile.row}, {tile.col}) com grades diferentes.")
        target = ndvi if request.band == NDVI_BAND else quality
        target.update({(request.product, day): layer for day, layer in subset.layers.items()})
    if grid is None:
        raise OrnlError("O plano não tem nenhum pedido.")
    pairs = [(ndvi[key], quality[key]) for key in sorted(ndvi) if key in quality]
    return grid, pairs


def peaks_grid(
    window: PixelWindow,
    tiles: Sequence[Tile],
    plan: Sequence[SubsetRequest],
    load: LoadSubset,
    rule: SojaRecenteRule,
) -> tuple[list[list[int | None]], int]:
    """O pico em centésimos de cada pixel da janela (`None` = sem dado ou sem ladrilho) e quantos
    pixels da janela algum recorte cobriu.

    Cada recorte entra na janela pelo próprio cabeçalho (posição na grade global), não pelo plano.
    """
    picos: list[list[int | None]] = [[None] * window.cols for _ in range(window.rows)]
    covered = [[False] * window.cols for _ in range(window.rows)]
    for tile in tiles:
        grid, pairs = _tile_layers(tile, plan, load)
        top, left = _tile_origin(grid)
        for index in range(grid.nrows * grid.ncols):
            row, col = divmod(index, grid.ncols)
            out_row, out_col = top + row - window.row_first, left + col - window.col_first
            if not (0 <= out_row < window.rows and 0 <= out_col < window.cols):
                continue
            values = [nd[index] for nd, q in pairs if _good_ndvi(nd[index], q[index])]
            peak = rule.pixel_peak(values)
            # Truncado: o bruto vem com fator 0,0001, então 6999 // 100 = 69 (nunca 70).
            picos[out_row][out_col] = None if peak is None else peak // CENTESIMOS
            covered[out_row][out_col] = True
    return picos, sum(sum(row) for row in covered)


# --- arquivo do contrato ------------------------------------------------------------------------


def build_payload(
    window: PixelWindow,
    picos: Sequence[Sequence[int | None]],
    harvest_year: int,
    params: dict[str, Any],
    finished_at: datetime,
) -> dict[str, Any]:
    """O JSON do contrato "Soja recente", conferido pelo `DataRun` e pelo `MapaSojaRecente`."""
    data_run = DataRun(
        source=SOURCE_KEY,
        params=params,
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-modis-soja-recente",
    )
    payload: dict[str, Any] = {
        "versao_dados": {
            "fonte": data_run.source,
            "parametros": dict(data_run.params),
            "fim": data_run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": data_run.version,
        },
        "safra": safra_label(harvest_year),
        "fonte": SOURCE_LABEL,
        "grade": {
            "projecao": "sinusoidal_modis",
            "raio_m": SINUSOIDAL_RADIUS_M,
            "x_oeste_m": GLOBAL_X_WEST_M + window.col_first * MODIS_250M_PIXEL_M,
            "y_norte_m": GLOBAL_Y_NORTH_M - window.row_first * MODIS_250M_PIXEL_M,
            "pixel_m": MODIS_250M_PIXEL_M,
            "linhas": window.rows,
            "colunas": window.cols,
        },
        "pico_centesimos": [list(row) for row in picos],
    }
    mapa_from_json(payload)  # o mesmo model que a API usa: fora do contrato, nada é gravado
    return payload


def write_payload(payload: dict[str, Any], output: Path) -> None:
    """Grava com uma linha de pixels por linha do arquivo (pequeno e ainda legível)."""
    rows = payload["pico_centesimos"]
    head = json.dumps({**payload, "pico_centesimos": []}, ensure_ascii=False, indent=2)
    body = ",\n".join("    " + json.dumps(row, separators=(",", ":")) for row in rows)
    text = head.replace('"pico_centesimos": []', f'"pico_centesimos": [\n{body}\n  ]', 1)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f"{output.name}.tmp")
    temporary.write_text(text + "\n", encoding="utf-8")
    temporary.replace(output)


def _pixel_counts(
    window: PixelWindow, picos: Sequence[Sequence[int | None]], covered: int
) -> dict[str, int]:
    total = window.rows * window.cols
    with_data = sum(value is not None for row in picos for value in row)
    return {
        "total": total,
        "com_dado": with_data,
        "sem_dado": covered - with_data,
        "sem_ladrilho": total - covered,
    }


def _params(
    regra: RegrasSojaRecente,
    harvest_year: int,
    box: Box,
    km: int,
    tiles: int,
    plan: Sequence[SubsetRequest],
    pixels: dict[str, int],
) -> dict[str, Any]:
    dates = {
        product: [
            day.isoformat()
            for day in composite_dates(product, harvest_year, regra.janela_inicio, regra.janela_fim)
        ]
        for product in NDVI_PRODUCTS
    }
    return {
        "servico": "ornl_daac",
        "url": ORNL_API_URL,
        "tipo": "soja_recente",
        "produtos": list(NDVI_PRODUCTS),
        "colecao": COLLECTION,
        "camadas": [NDVI_BAND, QUALITY_BAND],
        "qualidade_aceita": sorted(ACCEPTED_QUALITY),
        "ano": harvest_year,
        "safra": safra_label(harvest_year),
        "janela": f"{regra.janela_inicio} a {regra.janela_fim}",
        "datas": dates,
        "min_observacoes": regra.min_observacoes,
        "pico": "maior NDVI bruto da janela // 100 (centésimos truncados)",
        "area": {
            "lat_min": box.lat_min,
            "lat_max": box.lat_max,
            "lon_min": box.lon_min,
            "lon_max": box.lon_max,
        },
        "km_pedido": km,
        "ladrilhos": tiles,
        "pedidos": tiles * len(plan),
        "pixels": pixels,
    }


# --- linha de comando ---------------------------------------------------------------------------


def _box_arg(text: str) -> Box:
    try:
        return parse_box(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.fetch_soja_recente",
        description="Soja na safra mais recente: pico do NDVI do MODIS por pixel, pela ORNL DAAC.",
    )
    parser.add_argument(
        "--area",
        type=_box_arg,
        default=PILOT_BOX,
        metavar="LAT_MIN,LAT_MAX,LON_MIN,LON_MAX",
        help='caixa (use --area="..."). Padrão: caixa piloto',
    )
    parser.add_argument(
        "--ano", type=int, default=DEFAULT_HARVEST_YEAR, help="ano da colheita (padrão: 2026)"
    )
    parser.add_argument(
        "--km", type=int, default=DEFAULT_TILE_KM, help="±km de cada ladrilho (padrão: 30)"
    )
    parser.add_argument("--saida", type=Path, default=None, help="arquivo JSON")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR, help="pasta do cache")
    parser.add_argument("--dry-run", action="store_true", help="só mostra o plano, sem rede")
    parser.add_argument(
        "--tentativas", type=int, default=DEFAULT_MAX_ATTEMPTS, help="tentativas por pedido"
    )
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    if args.saida is None:
        args.saida = default_output(args.ano)
    return args


def _rules_from_settings() -> Regras:
    return YamlRulesRepository(get_settings().regras_path).get_rules()


def _print_plan(
    window: PixelWindow,
    tiles: Sequence[Tile],
    plan: Sequence[SubsetRequest],
    args: argparse.Namespace,
) -> None:
    for request in plan:
        print(
            f"{request.product} {request.band} {request.start} a {request.end} "
            f"({request.n_dates} datas)"
        )
    total = len(tiles) * len(plan)
    minutes = total * MEASURED_SECONDS_PER_REQUEST / 60
    print(
        f"Plano: {len(tiles)} {'ladrilho' if len(tiles) == 1 else 'ladrilhos'} de ±{args.km} km "
        f"× {len(plan)} pedidos = {total} pedidos "
        f"à ORNL para {window.rows} × {window.cols} pixels (safra {safra_label(args.ano)}); "
        f"cerca de {minutes:.0f} min (~{MEASURED_SECONDS_PER_REQUEST:.0f} s por pedido). "
        f"Saída: {args.saida}"
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
    try:
        rules = load_rules()
        regra = rules.soja_recente
        plan = build_plan(regra, args.ano)
        window = pixel_window(args.area)
        half = tile_half_pixels(args.km)
        tiles = plan_tiles(window, half)
        if args.dry_run:
            _print_plan(window, tiles, plan, args)
            log("(dry-run) nada foi pedido à ORNL.")
            return 0

        client = OrnlClient(transport, max_attempts=args.tentativas, sleep=sleep, log=log)
        cache = SubsetCache(args.cache)
        total = len(tiles) * len(plan)
        step = 0
        for tile in tiles:
            for request in plan:
                step += 1
                name = request.cache_name(tile.center, args.km)
                label = (
                    f"[{step}/{total}] {request.product} {request.band} ({tile.row}, {tile.col})"
                )
                if cache.has(name):
                    log(f"{label}: no cache")
                    continue
                started = clock()
                raw = client.fetch_subset(request, tile.center, args.km)
                cache.put(name, raw)
                log(f"{label}: {clock() - started:.0f} s, {len(raw) / 1e6:.1f} MB")

        def load(tile: Tile, request: SubsetRequest) -> bytes:
            raw = cache.get(request.cache_name(tile.center, args.km))
            if raw is None:
                raise OrnlError(f"Falta no cache: {request.cache_name(tile.center, args.km)}")
            return raw

        rule = SojaRecenteRule(rules)
        picos, covered = peaks_grid(window, tiles, plan, load, rule)
        pixels = _pixel_counts(window, picos, covered)
        params = _params(regra, args.ano, args.area, args.km, len(tiles), plan, pixels)
        write_payload(build_payload(window, picos, args.ano, params, now()), args.saida)
        seen = sum(
            value is not None and rule.seen(value / CENTESIMOS) for row in picos for value in row
        )
        log(
            f"Soja recente gravada em {args.saida}: {pixels['total']} pixels, "
            f"{pixels['com_dado']} com dado ({seen} com soja pelo limite de hoje), "
            f"{pixels['sem_dado']} sem dado e {pixels['sem_ladrilho']} sem ladrilho."
        )
        return 0
    except (OrnlError, OSError, ValueError) as exc:
        log(f"Erro: {exc}. Rode de novo: o que já baixou fica no cache ({args.cache}).")
        return 1


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
