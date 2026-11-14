"""Gera os deltas mensais do NEX-GDDP-CMIP6 por ponto (R2.1 do roteiro, tarefa 0014).

Uso (a partir de projeto/backend):

    uv run python -m pipeline.fetch_cmip6_deltas --dry-run       # só conta os pedidos
    uv run python -m pipeline.fetch_cmip6_deltas                 # caixa piloto, 3 modelos
    uv run python -m pipeline.fetch_cmip6_deltas --pontos="-18.9543,-48.1993" --modelos ACCESS-CM2

Para cada ponto e modelo, pede ao THREDDS da NCCS (NetcdfSubset, recorte por ponto em CSV) a série
diária de `pr`, `tasmax` e `tasmin` de 1/jan a 31/jul, um arquivo por ano: 1995–2014 (historical) e
2041–2060 (SSP2-4.5). Delta por modelo e mês (PRD 7.3, método do delta):

- `chuva_pct` = (média diária futura ÷ média diária base − 1) × 100;
- `tmax_c` e `tmin_c` = média futura − média base, em °C.

A saída segue o contrato "CMIP6" do `AGENTS.md` do backend (`versao_dados` + `pontos[]` com
`cobertura` e `cmip6[]`). Cada CSV baixado fica num cache local (fora do git): se o script parar,
rodar de novo continua de onde parou. Nada vai para o banco (tabela no R1.6, leitura no R3.1).
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
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
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

NCSS_TIMEOUT_SECONDS = 120.0  # um recorte de 212 dias levou 5,9 s
NCSS_MAX_RETRIES = 3
NCSS_BACKOFF_SECONDS = 5.0
PAUSE_BETWEEN_REQUESTS_SECONDS = 0.5
# Medido numa chamada real (1 ponto, 1 modelo, 1 variável, 1 ano) em 14/11/2026: 5,9 s. Cada passo
# de tempo do arquivo é um bloco global (_ChunkSizes 1 × 600 × 1440), por isso o custo é por dia.
MEASURED_SECONDS_PER_REQUEST = 6.0

DEFAULT_OUTPUT = Path("data/output/cmip6_deltas_nex_gddp.json")
DEFAULT_CACHE_DIR = Path("data/cache/nex_gddp_cmip6_ncss")


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
class NcssRequest:
    """Um pedido ao NCSS: um arquivo anual (modelo, experimento, variável, ano) num ponto."""

    model: str
    experiment: str
    variable: str
    year: int
    point: Point
    files: ModelFiles


def to_thredds_longitude(lon: float) -> float:
    """Longitude de −180..180 para a grade 0..360 do NEX-GDDP (ex.: −48,2 → 311,8)."""
    return round(lon % 360.0, COORD_DECIMALS)


def ncss_url(request: NcssRequest) -> str:
    files = request.files
    file_name = (
        f"{request.variable}_day_{request.model}_{request.experiment}_{files.variant}_"
        f"{files.grid}_{request.year}_{files.version}.nc"
    )
    return (
        f"{NCSS_BASE_URL}/{request.model}/{request.experiment}/{files.variant}/"
        f"{request.variable}/{file_name}"
    )


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
        if not math.isfinite(value) or abs(value) >= FILL_VALUE_THRESHOLD:
            continue
        values.append((date.fromisoformat(row[time_column][:10]), value))
    if not values:
        raise ValueError(f"CSV do NCSS sem dados de {variable}")
    return values


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


def pilot_box_points() -> list[Point]:
    """Centros das células do NASA POWER (0,5° × 0,625°) que cobrem a caixa piloto (ADR-0003)."""
    lat_indexes = range(
        round(PILOT_MIN_LAT / POWER_LAT_STEP), round(PILOT_MAX_LAT / POWER_LAT_STEP) + 1
    )
    lon_indexes = range(
        round(PILOT_MIN_LON / POWER_LON_STEP), round(PILOT_MAX_LON / POWER_LON_STEP) + 1
    )
    return [
        Point(round(i * POWER_LAT_STEP, COORD_DECIMALS), round(j * POWER_LON_STEP, COORD_DECIMALS))
        for i in lat_indexes
        for j in lon_indexes
    ]


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


class CachedNcssFetcher:
    """Baixa o CSV de cada pedido uma vez só e guarda no cache (é o que permite a retomada)."""

    def __init__(
        self,
        cache_dir: Path,
        http_get: TextHttpGetter = default_http_get_text,
        pause_seconds: float = PAUSE_BETWEEN_REQUESTS_SECONDS,
        sleep: Callable[[float], None] = time.sleep,
        max_retries: int = NCSS_MAX_RETRIES,
        backoff_seconds: float = NCSS_BACKOFF_SECONDS,
    ) -> None:
        self._cache_dir = cache_dir
        self._http_get = http_get
        self._pause_seconds = pause_seconds
        self._sleep = sleep
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self.downloads = 0
        self.pending: int | None = None  # só para o log de progresso

    def _path(self, request: NcssRequest) -> Path:
        point = request.point
        name = f"{request.year}_lat{point.lat:.4f}_lon{point.lon:.4f}.csv"
        return self._cache_dir / request.model / request.experiment / request.variable / name

    def is_cached(self, request: NcssRequest) -> bool:
        return self._path(request).exists()

    def fetch(self, request: NcssRequest) -> str:
        path = self._path(request)
        if path.exists():
            return path.read_text(encoding="utf-8")

        text = get_with_retries(
            self._http_get,
            ncss_url(request),
            ncss_params(request),
            timeout=NCSS_TIMEOUT_SECONDS,
            max_retries=self._max_retries,
            backoff_base=self._backoff_seconds,
        )
        parse_ncss_csv(text, request.variable)  # só guarda o que é CSV válido
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix(".part")
        partial.write_text(text, encoding="utf-8")
        partial.replace(path)  # arquivo pela metade nunca fica com o nome final
        self.downloads += 1
        logger.info(
            "[%d/%s] %s %s %s %d (%s, %s)",
            self.downloads,
            self.pending if self.pending is not None else "?",
            request.model,
            request.experiment,
            request.variable,
            request.year,
            request.point.lat,
            request.point.lon,
        )
        self._sleep(self._pause_seconds)
        return text


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
    points: Sequence[Point], models: Mapping[str, ModelFiles], finished_at: datetime
) -> DataRun:
    return DataRun(
        source=SOURCE_KEY,
        params={
            "produto": "NEX-GDDP-CMIP6",
            "servico": "NCCS THREDDS NetcdfSubset (recorte por ponto, CSV)",
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


def build_cmip6_deltas(
    points: Sequence[Point],
    models: Mapping[str, ModelFiles],
    fetcher: CachedNcssFetcher,
    clock: Callable[[], datetime],
) -> dict[str, Any]:
    """Monta o arquivo do contrato CMIP6: `versao_dados` e um item por ponto com os deltas.

    `clock` é lido depois de todos os pedidos: o `fim` é a hora em que a carga acabou.
    """
    pontos = [
        {
            "lat": point.lat,
            "lon": point.lon,
            "cobertura": power_cell_bounds(point.lat, point.lon),
            "cmip6": [_delta_json(d) for d in _point_deltas(point, models, fetcher)],
        }
        for point in points
    ]
    run = _data_run(points, models, finished_at=clock())
    return {
        "versao_dados": {
            "fonte": run.source,
            "parametros": dict(run.params),
            "fim": run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": run.version,
        },
        "pontos": pontos,
    }


def _duration(seconds: float) -> str:
    if seconds < 3600:
        return f"{round(seconds / 60)} min"
    return f"{seconds / 3600:.1f} h".replace(".", ",")


def _pending(requests: Sequence[NcssRequest], fetcher: CachedNcssFetcher) -> int:
    return sum(1 for r in requests if not fetcher.is_cached(r))


def _print_plan(
    points: Sequence[Point],
    models: Mapping[str, ModelFiles],
    fetcher: CachedNcssFetcher,
    pause_seconds: float,
) -> None:
    requests = plan_requests(points, models)
    pending = _pending(requests, fetcher)
    cached = len(requests) - pending
    per_request = MEASURED_SECONDS_PER_REQUEST + pause_seconds
    print(
        f"Pontos: {len(points)} | modelos: {len(models)} ({', '.join(models)}) | "
        f"variáveis: {', '.join(VARIABLES)} | anos: {len(BASELINE_YEARS)} base + "
        f"{len(FUTURE_YEARS)} futuro"
    )
    pause_text = f"{pause_seconds:g}".replace(".", ",")
    print(f"Pedidos ao THREDDS: {len(requests)} (já no cache: {cached}; faltam: {pending})")
    print(
        f"Tempo estimado: ~{_duration(pending * per_request)} "
        f"(~{MEASURED_SECONDS_PER_REQUEST:.0f} s por pedido + {pause_text} s de pausa)"
    )
    if requests:
        print(f"Exemplo: {ncss_url(requests[0])}")


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


def main(
    argv: Sequence[str] | None = None,
    http_get: TextHttpGetter = default_http_get_text,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    known_models: Mapping[str, ModelFiles] = DEFAULT_MODELS,
) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--pontos",
        type=_points_arg,
        default=None,
        help='"lat,lon; lat,lon" (use --pontos="..."). Padrão: células do POWER da caixa piloto',
    )
    parser.add_argument(
        "--modelos",
        type=lambda text: _models_arg(text, known_models),
        default=dict(known_models),
        help=f"separados por vírgula. Padrão: {','.join(known_models)}",
    )
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--pausa", type=float, default=PAUSE_BETWEEN_REQUESTS_SECONDS)
    parser.add_argument("--dry-run", action="store_true", help="só mostra quantos pedidos faria")
    args = parser.parse_args(argv)

    points = args.pontos or pilot_box_points()
    fetcher = CachedNcssFetcher(cache_dir=args.cache, http_get=http_get, pause_seconds=args.pausa)
    if args.dry_run:
        _print_plan(points, args.modelos, fetcher, args.pausa)
        return

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", stream=sys.stderr)
    fetcher.pending = _pending(plan_requests(points, args.modelos), fetcher)
    result = build_cmip6_deltas(points, args.modelos, fetcher, clock=now)
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(
        f"{len(points)} pontos × {len(args.modelos)} modelos gravados em {args.saida} "
        f"({fetcher.downloads} arquivos baixados agora)"
    )


if __name__ == "__main__":
    main()
