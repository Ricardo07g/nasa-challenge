"""Área queimada na caixa piloto (alerta de fogo do raio-X, tarefa 0043): MODIS MCD64A1.

Pede à ORNL DAAC (`modis.ornl.gov/rst/api/v1`, pública, sem login) o recorte por área da banda
`Burn_Date` do MCD64A1 (coleção 061, mensal, 500 m) de todos os meses dos anos do `regras.yaml`
(grupo `alertas_area`: 2016 a 2025), para a caixa piloto inteira (ou `--area`), em ladrilhos.
Grava o arquivo do contrato "Área queimada" (`AGENTS.md` do backend), que a API lê pelo
`AREA_QUEIMADA_PATH` (alerta de fogo do `GET /api/raio-x`), e registra a execução em `data_run`
quando há `DATABASE_URL`.

Uso (a partir de projeto/backend; nenhuma credencial):

    uv run python -m pipeline.fetch_area_queimada --dry-run   # ladrilhos, pedidos e tempo, sem rede
    uv run python -m pipeline.fetch_area_queimada             # caixa piloto, 2016 a 2025
    uv run python -m pipeline.fetch_area_queimada --area="-19.0,-18.9,-48.25,-48.15" --anos 2016

Conferido na ORNL em 15/11/2026: `GET /products` lista o MCD64A1 ("Burned Area Monthly L3 Global
500 m"); `GET /MCD64A1/bands` dá `Burn_Date` (dia do ano da queimada, 0 a 366; −1 sem dado) e as
datas são o dia 1 de cada mês. A ORNL conta o km como pixels de 500 m (0,5 km por pixel): ±10 km
= 41 × 41 pixels (34 s com 2 datas). Na mesma hora, ±30 km com 6 e 10 datas e ±60 km com 10 datas
voltaram 502 do proxy (corte de ~60 s): se acontecer de novo, diminua `--km` ou
`--datas-por-pedido`.

Regra (só leitura, sem limite agronômico): pixel com `Burn_Date` > 0 num mês queimou naquele ano
(o MCD64A1 só marca a queimada com confiança; 0 = não queimou, −1 = sem dado, −2 = água). O
arquivo guarda só os pixels que queimaram em algum ano, com os anos. O raio em volta do ponto e o
mínimo de anos ficam na API (`BurnedAreaService`).

Cache e retomada: cada resposta fica em `cache_ornl/` (gzip). Se parar, rode de novo: o que já
baixou não é pedido outra vez.
"""

import argparse
import json
import sys
import time
from collections import defaultdict
from collections.abc import Callable, Iterable, Sequence
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Final

from app.config import get_settings
from app.models.area_queimada import MODIS_500M_PIXEL_M
from app.models.data_run import DataRun
from app.models.regras import Regras
from app.models.soja_recente import SINUSOIDAL_RADIUS_M
from app.repositories.area_queimada_repository import SOURCE_KEY, mapa_from_json
from app.repositories.data_run_repository import PostgisDataRunRepository
from app.repositories.external.http_client import HttpTransport, default_http_request
from app.repositories.rules_repository import YamlRulesRepository
from pipeline.fetch_cmip6_deltas import PILOT_BOX, Box, parse_box, repo_root
from pipeline.fetch_regiao_ndvi import (
    DEFAULT_MAX_ATTEMPTS,
    MAX_DATES_PER_REQUEST,
    ORNL_API_URL,
    OrnlClient,
    OrnlError,
    SubsetCache,
    SubsetRequest,
    chunked,
    parse_subset,
)
from pipeline.fetch_soja_recente import (
    GLOBAL_X_WEST_M,
    GLOBAL_Y_NORTH_M,
    PixelWindow,
    Tile,
    _tile_origin,
    pixel_window,
    plan_tiles,
    tile_half_pixels,
)

PRODUCT: Final[str] = "MCD64A1"
COLLECTION: Final[str] = "061"
BURN_BAND: Final[str] = "Burn_Date"
SOURCE_LABEL: Final[str] = f"MODIS {PRODUCT}"
ORNL_KM_PER_500M_PIXEL: Final[float] = 0.5
MONTHS: Final[int] = 12
DEFAULT_TILE_KM: Final[int] = 30
DEFAULT_DATES_PER_REQUEST: Final[int] = 6
# Medido em 15/11/2026: 34 s para 41 × 41 pixels e 2 datas (com a ORNL lenta: 40 s só para a lista
# de produtos). Em dia normal, o NDVI de 241 × 241 pixels com 8 datas levou 24 s (14/11/2026).
MEASURED_SECONDS_PER_REQUEST: Final[float] = 35.0

DOWNLOADS_DIR: Final[Path] = repo_root() / "data" / "baixados" / "nasa_modis_mcd64a1"
DEFAULT_OUTPUT: Final[Path] = DOWNLOADS_DIR / "area_queimada_mcd64a1.json"
DEFAULT_CACHE_DIR: Final[Path] = DOWNLOADS_DIR / "cache_ornl"

LoadSubset = Callable[[Tile, SubsetRequest], bytes]


def _log(message: str) -> None:
    print(message, file=sys.stderr)


def build_plan(years: Iterable[int], dates_per_request: int) -> list[SubsetRequest]:
    """A banda `Burn_Date` de todos os meses de cada ano, em pedidos que não cruzam o ano."""
    plan: list[SubsetRequest] = []
    for year in years:
        months = [date(year, month, 1) for month in range(1, MONTHS + 1)]
        for group in chunked(months, dates_per_request):
            plan.append(SubsetRequest(PRODUCT, BURN_BAND, group[0], group[-1], len(group)))
    return plan


def burned_pixels(
    window: PixelWindow, tiles: Sequence[Tile], plan: Sequence[SubsetRequest], load: LoadSubset
) -> dict[tuple[int, int], set[int]]:
    """(linha, coluna) na janela → anos em que o pixel queimou (algum mês com `Burn_Date` > 0).

    Cada recorte entra na janela pelo próprio cabeçalho (posição na grade global de 500 m).
    """
    burned: dict[tuple[int, int], set[int]] = defaultdict(set)
    for tile in tiles:
        for request in plan:
            subset = parse_subset(load(tile, request))
            top, left = _tile_origin(subset.grid, MODIS_500M_PIXEL_M)
            for day, layer in subset.layers.items():
                for index, value in enumerate(layer):
                    if value <= 0:
                        continue
                    row, col = divmod(index, subset.grid.ncols)
                    out = (top + row - window.row_first, left + col - window.col_first)
                    if 0 <= out[0] < window.rows and 0 <= out[1] < window.cols:
                        burned[out].add(day.year)
    return dict(burned)


def build_payload(
    window: PixelWindow,
    burned: dict[tuple[int, int], set[int]],
    years: Sequence[int],
    params: dict[str, Any],
    finished_at: datetime,
) -> dict[str, Any]:
    """O JSON do contrato "Área queimada", conferido pelo `DataRun` e pelo `MapaAreaQueimada`."""
    data_run = DataRun(
        source=SOURCE_KEY,
        params=params,
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-modis-mcd64a1",
    )
    payload: dict[str, Any] = {
        "versao_dados": {
            "fonte": data_run.source,
            "parametros": dict(data_run.params),
            "fim": data_run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": data_run.version,
        },
        "fonte": SOURCE_LABEL,
        "anos": [min(years), max(years)],
        "grade": {
            "projecao": "sinusoidal_modis",
            "raio_m": SINUSOIDAL_RADIUS_M,
            "x_oeste_m": GLOBAL_X_WEST_M + window.col_first * MODIS_500M_PIXEL_M,
            "y_norte_m": GLOBAL_Y_NORTH_M - window.row_first * MODIS_500M_PIXEL_M,
            "pixel_m": MODIS_500M_PIXEL_M,
            "linhas": window.rows,
            "colunas": window.cols,
        },
        "queimadas": [[row, col, sorted(burned[(row, col)])] for row, col in sorted(burned)],
    }
    mapa_from_json(payload)  # o mesmo model que a API usa: fora do contrato, nada é gravado
    return payload


def write_payload(payload: dict[str, Any], output: Path) -> None:
    """Grava com um pixel queimado por linha (pequeno e ainda legível)."""
    rows = payload["queimadas"]
    head = json.dumps({**payload, "queimadas": []}, ensure_ascii=False, indent=2)
    body = ",\n".join("    " + json.dumps(row, separators=(",", ":")) for row in rows)
    text = head.replace('"queimadas": []', f'"queimadas": [\n{body}\n  ]', 1)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f"{output.name}.tmp")
    temporary.write_text(text + "\n", encoding="utf-8")
    temporary.replace(output)


def _years_arg(text: str) -> range:
    """'2016' ou '2016-2025'."""
    try:
        first, _, last = text.partition("-")
        start, end = int(first), int(last or first)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"anos inválidos: {text!r} (use 2016 ou 2016-2025)"
        ) from exc
    if start > end:
        raise argparse.ArgumentTypeError(f"anos fora de ordem: {text!r}")
    return range(start, end + 1)


def _box_arg(text: str) -> Box:
    try:
        return parse_box(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _dates_arg(text: str) -> int:
    value = int(text)
    if not 1 <= value <= MAX_DATES_PER_REQUEST:
        raise argparse.ArgumentTypeError(f"de 1 a {MAX_DATES_PER_REQUEST} datas por pedido")
    return value


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.fetch_area_queimada",
        description="Área queimada do MODIS MCD64A1 na caixa piloto, pela ORNL DAAC.",
    )
    parser.add_argument(
        "--area",
        type=_box_arg,
        default=PILOT_BOX,
        metavar="LAT_MIN,LAT_MAX,LON_MIN,LON_MAX",
        help='caixa (use --area="..."). Padrão: caixa piloto',
    )
    parser.add_argument(
        "--anos", type=_years_arg, default=None, help="2016 ou 2016-2025 (padrão: regras.yaml)"
    )
    parser.add_argument(
        "--km", type=int, default=DEFAULT_TILE_KM, help="±km de cada ladrilho (padrão: 30)"
    )
    parser.add_argument(
        "--datas-por-pedido",
        type=_dates_arg,
        default=DEFAULT_DATES_PER_REQUEST,
        help="meses por pedido, de 1 a 10 (padrão: 6)",
    )
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT, help="arquivo JSON")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR, help="pasta do cache")
    parser.add_argument("--dry-run", action="store_true", help="só mostra o plano, sem rede")
    parser.add_argument(
        "--tentativas", type=int, default=DEFAULT_MAX_ATTEMPTS, help="tentativas por pedido"
    )
    return parser.parse_args(sys.argv[1:] if argv is None else argv)


def _rules_from_settings() -> Regras:
    return YamlRulesRepository(get_settings().regras_path).get_rules()


def _save_run_in_database(run: DataRun) -> None:
    """Grava a execução no `data_run` do banco do `DATABASE_URL`; sem banco, só avisa."""
    database_url = get_settings().database_url
    if not database_url:
        _log("Sem DATABASE_URL: a execução não foi gravada no data_run (o arquivo tem a versão).")
        return
    PostgisDataRunRepository(database_url).save_run(run)


def _params(
    args: argparse.Namespace,
    years: Sequence[int],
    tiles: int,
    plan: Sequence[SubsetRequest],
    window: PixelWindow,
    burned: int,
) -> dict[str, Any]:
    box = args.area
    return {
        "servico": "ornl_daac",
        "url": ORNL_API_URL,
        "produto": PRODUCT,
        "colecao": COLLECTION,
        "banda": BURN_BAND,
        "regra": "Burn_Date > 0 em algum mês = queimou no ano (0 não, -1 sem dado, -2 água)",
        "anos": [min(years), max(years)],
        "area": {
            "lat_min": box.lat_min,
            "lat_max": box.lat_max,
            "lon_min": box.lon_min,
            "lon_max": box.lon_max,
        },
        "km_pedido": args.km,
        "datas_por_pedido": args.datas_por_pedido,
        "ladrilhos": tiles,
        "pedidos": tiles * len(plan),
        "pixels": {"total": window.rows * window.cols, "queimados": burned},
    }


def run(
    argv: Sequence[str] | None = None,
    *,
    transport: HttpTransport = default_http_request,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    log: Callable[[str], None] = _log,
    load_rules: Callable[[], Regras] = _rules_from_settings,
    save_run: Callable[[DataRun], None] = _save_run_in_database,
) -> int:
    """Executa o script. Devolve 0 (ok) ou 1 (erro; rode de novo que continua do cache)."""
    args = _parse_args(argv)
    try:
        regra = load_rules().alertas_area
        years = args.anos or range(regra.fogo_ano_inicio, regra.fogo_ano_fim + 1)
        plan = build_plan(years, args.datas_por_pedido)
        window = pixel_window(args.area, pixel_m=MODIS_500M_PIXEL_M)
        half = tile_half_pixels(args.km, km_per_pixel=ORNL_KM_PER_500M_PIXEL)
        tiles = plan_tiles(window, half, pixel_m=MODIS_500M_PIXEL_M)
        total = len(tiles) * len(plan)
        if args.dry_run:
            minutes = total * MEASURED_SECONDS_PER_REQUEST / 60
            print(
                f"Plano: {len(tiles)} ladrilhos de ±{args.km} km × {len(plan)} pedidos "
                f"({len(list(years))} anos, {args.datas_por_pedido} meses por pedido) = {total} "
                f"pedidos à ORNL para {window.rows} × {window.cols} pixels de 500 m; cerca de "
                f"{minutes:.0f} min (~{MEASURED_SECONDS_PER_REQUEST:.0f} s por pedido). "
                f"Saída: {args.saida}"
            )
            log("(dry-run) nada foi pedido à ORNL.")
            return 0

        client = OrnlClient(transport, max_attempts=args.tentativas, sleep=sleep, log=log)
        cache = SubsetCache(args.cache)
        step = 0
        for tile in tiles:
            for request in plan:
                step += 1
                name = request.cache_name(tile.center, args.km)
                label = f"[{step}/{total}] {request.start:%Y-%m} a {request.end:%Y-%m}"
                if cache.has(name):
                    log(f"{label}: no cache")
                    continue
                started = clock()
                cache.put(name, client.fetch_subset(request, tile.center, args.km))
                log(f"{label}: {clock() - started:.0f} s")

        def load(tile: Tile, request: SubsetRequest) -> bytes:
            raw = cache.get(request.cache_name(tile.center, args.km))
            if raw is None:
                raise OrnlError(f"Falta no cache: {request.cache_name(tile.center, args.km)}")
            return raw

        burned = burned_pixels(window, tiles, plan, load)
        params = _params(args, list(years), len(tiles), plan, window, len(burned))
        payload = build_payload(window, burned, list(years), params, now())
        write_payload(payload, args.saida)
        versao = payload["versao_dados"]
        save_run(
            DataRun(source=SOURCE_KEY, params=params, finished_at=now(), version=versao["versao"])
        )
        log(f"Área queimada gravada em {args.saida}: {len(burned)} pixels queimaram em algum ano.")
        return 0
    except (OrnlError, OSError, ValueError) as exc:
        log(f"Erro: {exc}. Rode de novo: o que já baixou fica no cache ({args.cache}).")
        return 1


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
