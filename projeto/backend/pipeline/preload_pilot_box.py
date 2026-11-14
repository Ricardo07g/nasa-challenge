"""Pré-carrega o clima (NASA POWER) e o solo (SoilGrids) da caixa piloto no PostGIS (R1.5).

Com tudo no banco, o primeiro clique em qualquer ponto da caixa (`PILOT_*` de `app/constants.py`)
sai do PostGIS, sem esperar a busca sob demanda. Só usa fontes abertas, sem credencial.

Uso (a partir de projeto/backend, com DATABASE_URL apontando para o banco):

    uv run python -m pipeline.preload_pilot_box --dry-run    # só mostra o plano
    uv run python -m pipeline.preload_pilot_box --limite 1   # só a célula da fazenda de exemplo
    uv run python -m pipeline.preload_pilot_box              # a caixa inteira (cerca de 1 h)

- Clima: um pedido ao POWER por região onde ele devolve a mesma resposta (ver
  `power_region_key`); as temporadas de cada célula de 0,1° são montadas com a latitude dela.
- Solo: um pedido ao SoilGrids por centro de célula (e pelo ponto exato da fazenda de exemplo),
  com pausa entre os pedidos (o ISRIC pede uso moderado: cerca de 5 por minuto). O solo padrão
  (falha ou sem dado) não é gravado, como na busca sob demanda.
- Idempotente: pula o que já está no banco (célula com clima, ponto com solo), a não ser com
  `--forcar`. Cada fonte chamada ganha uma linha em `data_run`.
"""

import argparse
import logging
import math
import sys
import time
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final, Protocol

from app.config import get_settings
from app.constants import (
    EXAMPLE_FARM_LAT,
    EXAMPLE_FARM_LON,
    GRID_CELL_SCALE_FACTOR,
    NASA_POWER_COMMUNITY,
    NASA_POWER_PARAMETERS,
    PILOT_MAX_LAT,
    PILOT_MAX_LON,
    PILOT_MIN_LAT,
    PILOT_MIN_LON,
    SOILGRIDS_DEPTHS,
    SOILGRIDS_PROPERTIES,
)
from app.models.climate import ClimateSeason
from app.models.data_run import DataRun
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import (
    PostgisClimateRepository,
    cell_center,
    cell_id_for,
)
from app.repositories.data_run_repository import PostgisDataRunRepository
from app.repositories.external.nasa_power_client import NasaPowerClient, NasaPowerClientProtocol
from app.repositories.external.soilgrids_client import SoilGridsClient, SoilGridsClientProtocol
from app.repositories.soil_repository import PostgisSoilRepository
from app.services.climate_season_builder import ClimateSeasonBuilder
from app.services.satellite_ingestion_service import SOILGRIDS_SOURCE
from app.services.water_balance_calculator import WaterBalanceCalculator
from pipeline.export_climate_fixture import POWER_LAT_STEP, POWER_LON_STEP

logger = logging.getLogger(__name__)

# Radiação (ALLSKY_SFC_SW_DWN) do POWER: grade de 1° com bordas nos graus inteiros.
POWER_SOLAR_STEP: Final[float] = 1.0
# ISRIC: uso moderado da API do SoilGrids, cerca de 5 pedidos por minuto.
DEFAULT_SOIL_PAUSE_SECONDS: Final[float] = 12.0
# A pré-carga não tem a pressa da busca sob demanda: 20 anos do POWER podem levar mais de 8 s.
PRELOAD_POWER_TIMEOUT_SECONDS: Final[float] = 120.0
PRELOAD_SOILGRIDS_TIMEOUT_SECONDS: Final[float] = 30.0
POWER_SOURCE: Final[str] = "nasa_power"
SCRIPT_NAME: Final[str] = "pipeline.preload_pilot_box"
# `version` da linha de `data_run`: "<ano>.<mês do fim>-preload-pilot-box" (ex.: 2026.11-...).
RUN_VERSION_SUFFIX: Final[str] = "preload-pilot-box"
COORD_ROUND_DECIMALS: Final[int] = 6

Point = tuple[float, float]
RegionKey = tuple[int, int, int, int]


@dataclass(frozen=True)
class PreloadCell:
    """Célula de 0,1° a pré-carregar: o clima vai para a célula, o solo para cada ponto."""

    cell_id: str
    lat: float  # centro da célula
    lon: float
    soil_points: tuple[Point, ...]


@dataclass(frozen=True)
class PowerGroup:
    """Células que recebem a mesma resposta do POWER: um pedido só, no centro da região."""

    request_lat: float
    request_lon: float
    cells: tuple[PreloadCell, ...]


@dataclass(frozen=True)
class PreloadPlan:
    cells_total: int
    cells_already_loaded: int
    climate_groups: tuple[PowerGroup, ...]
    soil_points: tuple[Point, ...]
    force: bool = False

    @property
    def climate_cells(self) -> int:
        return sum(len(group.cells) for group in self.climate_groups)

    @property
    def power_calls(self) -> int:
        return len(self.climate_groups)

    @property
    def soilgrids_calls(self) -> int:
        return len(self.soil_points)


@dataclass(frozen=True)
class PreloadReport:
    power_calls: int
    power_failures: int
    climate_saved: int
    climate_without_data: int
    soil_calls: int
    soil_saved: int
    soil_failures: int


class PreloadClimateRepository(Protocol):
    """O que a pré-carga usa do clima: saber se a célula já está no banco e gravá-la."""

    def find_cell_id(self, lat: float, lon: float) -> str | None: ...

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None: ...


class PreloadSoilRepository(Protocol):
    """O que a pré-carga usa do solo: saber se o ponto exato já tem solo e gravá-lo."""

    def has_point(self, lat: float, lon: float) -> bool: ...

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None: ...


class PreloadRunRepository(Protocol):
    """O que a pré-carga usa do `data_run`: o `save_run` do `PostgisDataRunRepository`."""

    def save_run(self, run: DataRun) -> None: ...


def _floor(value: float) -> int:
    # Arredonda antes do floor (como o `cell_id_for`): -18,75 não pode virar -18,7500000001.
    return math.floor(round(value, COORD_ROUND_DECIMALS))


def _preload_cell(cell_id: str, extra_soil: Sequence[Point] = ()) -> PreloadCell:
    lat, lon = cell_center(cell_id)
    return PreloadCell(cell_id=cell_id, lat=lat, lon=lon, soil_points=((lat, lon), *extra_soil))


def pilot_box_cells() -> list[PreloadCell]:
    """As células de 0,1° da caixa piloto (225), com a da fazenda de exemplo primeiro.

    Cada célula grava o solo do seu centro; a da fazenda grava também o do ponto exato dela, para
    o talhão de exemplo ter o solo do próprio ponto.
    """
    lat_indexes = range(
        _floor(PILOT_MIN_LAT * GRID_CELL_SCALE_FACTOR),
        math.ceil(round(PILOT_MAX_LAT * GRID_CELL_SCALE_FACTOR, COORD_ROUND_DECIMALS)),
    )
    lon_indexes = range(
        _floor(PILOT_MIN_LON * GRID_CELL_SCALE_FACTOR),
        math.ceil(round(PILOT_MAX_LON * GRID_CELL_SCALE_FACTOR, COORD_ROUND_DECIMALS)),
    )
    farm_cell_id = cell_id_for(EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON)
    cells = [_preload_cell(farm_cell_id, extra_soil=((EXAMPLE_FARM_LAT, EXAMPLE_FARM_LON),))]
    cells.extend(
        _preload_cell(f"{lat_idx}_{lon_idx}")
        for lat_idx in lat_indexes
        for lon_idx in lon_indexes
        if f"{lat_idx}_{lon_idx}" != farm_cell_id
    )
    return cells


def power_region_key(lat: float, lon: float) -> RegionKey:
    """Região onde o NASA POWER devolve a mesma resposta para todos os parâmetros pedidos.

    - Meteorologia (chuva, temperaturas, UR, vento e altitude): grade do MERRA-2 de
      0,5° × 0,625°, com centros nos múltiplos do passo (a mesma `cobertura` da fixture).
    - Radiação (`ALLSKY_SFC_SW_DWN`): grade de 1° com bordas nos graus inteiros. A ETo de
      Penman-Monteith usa a radiação, então uma célula de meteorologia que cruza um grau inteiro
      vira duas regiões.

    Ponto na borda fica na região de cima (ou a leste), como o POWER faz. Conferido em
    14/11/2026 com pedidos de 2 dias: -18,75 devolve o mesmo que -18,74; -19,1 e -18,9 (mesma
    célula de meteorologia) devolvem radiações diferentes.
    """
    return (
        _floor((lat + POWER_LAT_STEP / 2) / POWER_LAT_STEP),
        _floor((lon + POWER_LON_STEP / 2) / POWER_LON_STEP),
        _floor(lat / POWER_SOLAR_STEP),
        _floor(lon / POWER_SOLAR_STEP),
    )


def power_region_bounds(key: RegionKey) -> tuple[float, float, float, float]:
    """(lat_min, lat_max, lon_min, lon_max) da região: célula de meteorologia ∩ de radiação."""
    weather_lat, weather_lon, solar_lat, solar_lon = key
    lat_center, lon_center = weather_lat * POWER_LAT_STEP, weather_lon * POWER_LON_STEP
    return (
        max(lat_center - POWER_LAT_STEP / 2, solar_lat * POWER_SOLAR_STEP),
        min(lat_center + POWER_LAT_STEP / 2, (solar_lat + 1) * POWER_SOLAR_STEP),
        max(lon_center - POWER_LON_STEP / 2, solar_lon * POWER_SOLAR_STEP),
        min(lon_center + POWER_LON_STEP / 2, (solar_lon + 1) * POWER_SOLAR_STEP),
    )


def group_by_power_region(cells: Iterable[PreloadCell]) -> list[PowerGroup]:
    """Agrupa as células pela região do POWER, na ordem em que aparecem.

    O pedido de cada grupo vai para o centro da região (longe das bordas); o POWER devolve a
    mesma série para qualquer ponto dentro dela.
    """
    by_region: dict[RegionKey, list[PreloadCell]] = {}
    for cell in cells:
        by_region.setdefault(power_region_key(cell.lat, cell.lon), []).append(cell)
    groups: list[PowerGroup] = []
    for key, members in by_region.items():
        lat_min, lat_max, lon_min, lon_max = power_region_bounds(key)
        groups.append(
            PowerGroup(
                request_lat=(lat_min + lat_max) / 2,
                request_lon=(lon_min + lon_max) / 2,
                cells=tuple(members),
            )
        )
    return groups


def _utc_now() -> datetime:
    return datetime.now(UTC)


class PilotBoxPreloader:
    """Planeja e executa a pré-carga com clientes e repositories injetados (testável sem rede)."""

    def __init__(
        self,
        nasa_client: NasaPowerClientProtocol,
        soil_client: SoilGridsClientProtocol,
        climate_repo: PreloadClimateRepository,
        soil_repo: PreloadSoilRepository,
        run_repo: PreloadRunRepository,
        season_builder: ClimateSeasonBuilder | None = None,
        soil_pause_seconds: float = DEFAULT_SOIL_PAUSE_SECONDS,
        sleep: Callable[[float], object] = time.sleep,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._nasa_client = nasa_client
        self._soil_client = soil_client
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._run_repo = run_repo
        self._season_builder = season_builder or ClimateSeasonBuilder(WaterBalanceCalculator())
        self._soil_pause = soil_pause_seconds
        self._sleep = sleep
        self._clock = clock

    def plan(
        self, cells: Sequence[PreloadCell], limit: int | None = None, force: bool = False
    ) -> PreloadPlan:
        """O que falta buscar. Pula o que já está no banco (a não ser com `force`) e para depois
        de `limit` células que ainda precisam de algum dado."""
        climate_cells: list[PreloadCell] = []
        soil_points: list[Point] = []
        already_loaded = taken = 0
        for cell in cells:
            if limit is not None and taken >= limit:
                break
            needs_climate = force or self._climate_repo.find_cell_id(cell.lat, cell.lon) is None
            missing_soil = [
                point
                for point in cell.soil_points
                if force or not self._soil_repo.has_point(*point)
            ]
            if not needs_climate and not missing_soil:
                already_loaded += 1
                continue
            taken += 1
            if needs_climate:
                climate_cells.append(cell)
            soil_points.extend(missing_soil)
        return PreloadPlan(
            cells_total=len(cells),
            cells_already_loaded=already_loaded,
            climate_groups=tuple(group_by_power_region(climate_cells)),
            soil_points=tuple(soil_points),
            force=force,
        )

    def run(self, plan: PreloadPlan) -> PreloadReport:
        """Busca e grava o plano: clima primeiro (deixa a caixa usável mais cedo), depois o solo."""
        start, end = self._season_builder.request_window()
        power_failures = climate_saved = climate_without_data = 0
        for index, group in enumerate(plan.climate_groups, start=1):
            try:
                series = self._nasa_client.fetch_daily(
                    group.request_lat, group.request_lon, start, end
                )
            except Exception as exc:
                # Sem célula vizinha copiada: a célula fica para a próxima execução (ou a busca
                # sob demanda), em vez de gravar o clima de outro lugar.
                logger.warning(
                    "[POWER %d/%d] (%.5f, %.5f) falhou; %d células ficam para depois: %s",
                    index,
                    plan.power_calls,
                    group.request_lat,
                    group.request_lon,
                    len(group.cells),
                    exc,
                )
                power_failures += 1
                continue
            for cell in group.cells:
                seasons = self._season_builder.build(series, cell_id=cell.cell_id, lat=cell.lat)
                if not seasons:
                    climate_without_data += 1
                    continue
                self._climate_repo.save_cell_seasons(cell.cell_id, cell.lat, cell.lon, seasons)
                climate_saved += 1
            logger.info(
                "[POWER %d/%d] (%.5f, %.5f): %d células",
                index,
                plan.power_calls,
                group.request_lat,
                group.request_lon,
                len(group.cells),
            )
        # Registra já: se o solo (a parte longa) parar no meio, a próxima execução pula o clima.
        if plan.power_calls:
            self._record_run(
                POWER_SOURCE,
                plan,
                parametros=NASA_POWER_PARAMETERS,
                comunidade=NASA_POWER_COMMUNITY,
                periodo=[start.isoformat(), end.isoformat()],
                chamadas=plan.power_calls,
                chamadas_com_falha=power_failures,
                celulas_gravadas=climate_saved,
                celulas_sem_dado=climate_without_data,
            )

        soil_saved = soil_failures = 0
        for index, (lat, lon) in enumerate(plan.soil_points, start=1):
            if index > 1:
                self._sleep(self._soil_pause)
            soil = self._fetch_soil(lat, lon)
            if soil is None or soil.fonte != SOILGRIDS_SOURCE:
                soil_failures += 1
                logger.warning(
                    "[SoilGrids %d/%d] (%.4f, %.4f): sem dado, não gravado",
                    index,
                    plan.soilgrids_calls,
                    lat,
                    lon,
                )
                continue
            self._soil_repo.save_soil(lat, lon, soil)
            soil_saved += 1
            logger.info(
                "[SoilGrids %d/%d] (%.4f, %.4f): %s",
                index,
                plan.soilgrids_calls,
                lat,
                lon,
                soil.textura_solo,
            )
        if plan.soilgrids_calls:
            self._record_run(
                SOILGRIDS_SOURCE,
                plan,
                propriedades=list(SOILGRIDS_PROPERTIES),
                profundidades=list(SOILGRIDS_DEPTHS),
                valor="mean",
                chamadas=plan.soilgrids_calls,
                pontos_gravados=soil_saved,
                pontos_sem_dado=soil_failures,
                pausa_s=self._soil_pause,
            )

        return PreloadReport(
            power_calls=plan.power_calls,
            power_failures=power_failures,
            climate_saved=climate_saved,
            climate_without_data=climate_without_data,
            soil_calls=plan.soilgrids_calls,
            soil_saved=soil_saved,
            soil_failures=soil_failures,
        )

    def _fetch_soil(self, lat: float, lon: float) -> SoloInfo | None:
        try:
            return self._soil_client.fetch_soil(lat, lon)
        except Exception as exc:
            logger.warning("SoilGrids falhou em (%.4f, %.4f): %s", lat, lon, exc)
            return None

    def _record_run(self, source: str, plan: PreloadPlan, **details: object) -> None:
        """Uma linha em `data_run` para a fonte chamada, com o que foi pedido e o resultado."""
        finished = self._clock()
        self._run_repo.save_run(
            DataRun(
                source=source,
                params={
                    "script": SCRIPT_NAME,
                    "caixa": _pilot_box(),
                    "forcar": plan.force,
                    **details,
                },
                finished_at=finished,
                version=f"{finished:%Y.%m}-{RUN_VERSION_SUFFIX}",
            )
        )


def _pilot_box() -> dict[str, float]:
    return {
        "lat_min": PILOT_MIN_LAT,
        "lat_max": PILOT_MAX_LAT,
        "lon_min": PILOT_MIN_LON,
        "lon_max": PILOT_MAX_LON,
    }


class _EmptyDatabase:
    """Faz o papel do banco vazio no `--dry-run` sem DATABASE_URL. Não grava nada."""

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return None

    def has_point(self, lat: float, lon: float) -> bool:
        return False

    def save_cell_seasons(
        self, cell_id: str, lat: float, lon: float, seasons: list[ClimateSeason]
    ) -> None:
        raise RuntimeError("sem DATABASE_URL não há onde gravar")

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        raise RuntimeError("sem DATABASE_URL não há onde gravar")

    def save_run(self, run: DataRun) -> None:
        raise RuntimeError("sem DATABASE_URL não há onde gravar")


def build_preloader(database_url: str | None, soil_pause_seconds: float) -> PilotBoxPreloader:
    """Monta a pré-carga com os clientes de verdade e o PostGIS (ou o banco vazio, sem URL)."""
    climate_repo: PreloadClimateRepository
    soil_repo: PreloadSoilRepository
    run_repo: PreloadRunRepository
    if database_url:
        # Sem a fixture como reserva: "já está no banco" tem de olhar só o banco.
        climate_repo = PostgisClimateRepository(database_url)
        soil_repo = PostgisSoilRepository(database_url)
        run_repo = PostgisDataRunRepository(database_url)
    else:
        climate_repo = soil_repo = run_repo = _EmptyDatabase()
    return PilotBoxPreloader(
        nasa_client=NasaPowerClient(timeout=PRELOAD_POWER_TIMEOUT_SECONDS),
        soil_client=SoilGridsClient(timeout=PRELOAD_SOILGRIDS_TIMEOUT_SECONDS),
        climate_repo=climate_repo,
        soil_repo=soil_repo,
        run_repo=run_repo,
        soil_pause_seconds=soil_pause_seconds,
    )


def describe_plan(plan: PreloadPlan, soil_pause_seconds: float) -> str:
    pause_seconds = max(plan.soilgrids_calls - 1, 0) * soil_pause_seconds
    pause = f"{pause_seconds / 60:.0f} min" if pause_seconds >= 120 else f"{pause_seconds:g} s"
    return "\n".join(
        [
            f"Caixa piloto: {plan.cells_total} células de 0,1° (com a da fazenda de exemplo); "
            f"{plan.cells_already_loaded} já estão completas no banco.",
            f"Clima: {plan.climate_cells} células em {plan.power_calls} pedidos ao NASA POWER "
            "(um por região do POWER).",
            f"Solo: {plan.soilgrids_calls} pedidos ao SoilGrids, com pausa de "
            f"{soil_pause_seconds:g} s entre eles (cerca de {pause} só de pausa).",
        ]
    )


def describe_report(report: PreloadReport) -> str:
    return "\n".join(
        [
            f"NASA POWER: {report.power_calls} pedidos ({report.power_failures} com falha); "
            f"{report.climate_saved} células gravadas, {report.climate_without_data} sem dado.",
            f"SoilGrids: {report.soil_calls} pedidos; {report.soil_saved} pontos gravados, "
            f"{report.soil_failures} sem dado (o solo padrão não é gravado).",
        ]
    )


def _positive_int(raw: str) -> int:
    value = int(raw)
    if value < 1:
        raise argparse.ArgumentTypeError("precisa ser 1 ou mais")
    return value


def _non_negative_float(raw: str) -> float:
    value = float(raw)
    if value < 0:
        raise argparse.ArgumentTypeError("não pode ser negativo")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.preload_pilot_box",
        description=(__doc__ or "").splitlines()[0],
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="só mostra o plano: não chama as APIs nem grava"
    )
    parser.add_argument(
        "--limite",
        type=_positive_int,
        default=None,
        metavar="N",
        help="para depois de N células que ainda precisam de dado (a da fazenda vem primeiro)",
    )
    parser.add_argument(
        "--pausa-solo",
        type=_non_negative_float,
        default=DEFAULT_SOIL_PAUSE_SECONDS,
        metavar="S",
        help=f"segundos entre os pedidos ao SoilGrids (padrão {DEFAULT_SOIL_PAUSE_SECONDS:g})",
    )
    parser.add_argument(
        "--forcar", action="store_true", help="busca de novo o que já está no banco"
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    database_url = get_settings().database_url
    if not database_url and not args.dry_run:
        print("Defina DATABASE_URL (o banco que recebe a pré-carga).", file=sys.stderr)
        return 2

    preloader = build_preloader(database_url, soil_pause_seconds=args.pausa_solo)
    plan = preloader.plan(pilot_box_cells(), limit=args.limite, force=args.forcar)
    # flush: o plano aparece antes do log da carga, que vai para o stderr
    print(describe_plan(plan, args.pausa_solo), flush=True)
    if args.dry_run:
        if not database_url:
            print("Sem DATABASE_URL: o plano supõe o banco vazio.")
        print("--dry-run: nada foi buscado nem gravado.")
        return 0

    report = preloader.run(plan)
    print(describe_report(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
