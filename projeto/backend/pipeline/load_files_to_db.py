"""Carrega no PostGIS os arquivos do CMIP6 (R2.1), do NDVI (R2.2) e do IMERG (R2.4).

Os scripts de dados gravam arquivos no "Contrato dos dados das fontes" (`AGENTS.md` do backend) e
a API já lê os do CMIP6 e do NDVI (`CMIP6_PATH`, `NDVI_CACHE_PATH`). Esta carga copia o conteúdo
deles para o banco: `cmip6_delta`, `ndvi_point` e a chuva do `climate_season`. Não busca nada na
rede.

Uso (a partir de projeto/backend, com DATABASE_URL apontando para o banco que recebe a carga):

    uv run python -m pipeline.load_files_to_db --cmip6 <arq> --ndvi <arq> --imerg <arq> --dry-run
    uv run python -m pipeline.load_files_to_db --cmip6 <arq> --ndvi <arq> --imerg <arq>

- CMIP6: cada célula que já está em `grid_cell` (o `cmip6_delta` exige a célula) recebe os
  deltas do ponto do arquivo cuja `cobertura` contém o centro dela, pela leitura do
  `FileCmip6Repository` (borda de baixo dentro, de cima fora). Célula sem cobertura: nada.
- NDVI: a série de cada ponto do arquivo, lida pelo `CachedNdviRepository` (sem neve, nuvem nem
  NDVI vazio). Registro sem `produto` ou `qualidade` (cache antigo) ou com o NDVI bruto não cabe
  na tabela: fica de fora e conta como pulado.
- IMERG (R3.4): para cada célula e ano que já estão no `climate_season`, com a mesma janela (212
  dias desde 1/jan), a chuva passa a ser a do IMERG e o `rain_source` passa a `gpm_imerg`, **só
  quando o ano do IMERG está completo** (nenhum dia nulo). Ano incompleto continua com o NASA
  POWER. Nenhuma temporada é criada.
- Os arquivos são lidos e conferidos antes de gravar: arquivo ausente, sem `versao_dados`, de
  outra fonte ou fora do contrato para a carga sem gravar nada.
- Idempotente: as tabelas recebem upsert (a chuva, update). Cada fonte com alguma linha gravada
  ganha uma linha em `data_run`, com a versão do arquivo.
"""

import argparse
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Final, Protocol

from app.config import get_settings
from app.constants import CLIMATE_SEASON_DAYS, IMERG_RAIN_SOURCE
from app.models.climate import Cmip6Delta
from app.models.data_run import DataRun
from app.models.talhao import NdviRecord
from app.repositories.climate_repository import PostgisClimateRepository, SeasonWindow
from app.repositories.cmip6_repository import FileCmip6Repository, PostgisCmip6Repository
from app.repositories.data_run_repository import PostgisDataRunRepository
from app.repositories.imerg_repository import FileImergRepository
from app.repositories.ndvi_repository import CachedNdviRepository, PostgisNdviRepository

CMIP6_SOURCE: Final[str] = "nex_gddp_cmip6"
NDVI_SOURCE: Final[str] = "modis_mod13q1"
IMERG_SOURCE: Final[str] = IMERG_RAIN_SOURCE
SCRIPT_NAME: Final[str] = "pipeline.load_files_to_db"
# A tabela guarda o NDVI físico (-0,2 a 1). Acima de 1 em módulo é o bruto do MOD13Q1 (fator
# 0,0001 não aplicado), a mesma regra do `scaled_ndvi` do histórico do talhão.
PHYSICAL_NDVI_MAX_ABS: Final[float] = 1.0


class LoadError(Exception):
    """Arquivo que a carga não aceita. Levantado antes de qualquer gravação."""


class GridCellRepository(Protocol):
    """As células que já estão em `grid_cell` (`PostgisClimateRepository.list_cell_ids`)."""

    def list_cell_ids(self) -> list[str]: ...


class Cmip6Writer(Protocol):
    def save_cmip6_deltas(self, cell_id: str, deltas: list[Cmip6Delta]) -> None: ...


class NdviWriter(Protocol):
    def save_ndvi_history(self, lat: float, lon: float, records: list[NdviRecord]) -> None: ...


class RunWriter(Protocol):
    def save_run(self, run: DataRun) -> None: ...


class SeasonRainRepository(Protocol):
    """As temporadas do `climate_season` e a troca da chuva (`PostgisClimateRepository`)."""

    def list_season_windows(self) -> list[SeasonWindow]: ...

    def replace_seasons_rain(
        self, rain_source: str, rains: Mapping[tuple[str, int], tuple[float, ...]]
    ) -> int: ...


@dataclass(frozen=True)
class Cmip6Plan:
    """O que vai para o `cmip6_delta`: os deltas de cada célula coberta pelo arquivo."""

    file_name: str
    file_run: DataRun
    cells: tuple[tuple[str, tuple[Cmip6Delta, ...]], ...]
    cells_without_deltas: int

    @property
    def cells_with_deltas(self) -> int:
        return len(self.cells)

    @property
    def cells_in_grid(self) -> int:
        return self.cells_with_deltas + self.cells_without_deltas

    @property
    def rows(self) -> int:
        return sum(len(deltas) for _, deltas in self.cells)


@dataclass(frozen=True)
class NdviPointPlan:
    lat: float
    lon: float
    records: tuple[NdviRecord, ...]


@dataclass(frozen=True)
class NdviPlan:
    """O que vai para o `ndvi_point`: a série que cabe na tabela, ponto a ponto.

    `skipped_unreadable`: sem NDVI, neve ou nuvem (a leitura da API também descarta).
    `skipped_out_of_table`: sem `produto` ou `qualidade` (cache antigo) ou com o NDVI bruto.
    """

    file_name: str
    file_run: DataRun
    points: tuple[NdviPointPlan, ...]
    points_total: int
    skipped_unreadable: int
    skipped_out_of_table: int

    @property
    def points_with_series(self) -> int:
        return len(self.points)

    @property
    def rows(self) -> int:
        return sum(len(point.records) for point in self.points)

    @property
    def skipped(self) -> int:
        return self.skipped_unreadable + self.skipped_out_of_table


@dataclass(frozen=True)
class ImergPlan:
    """O que vai para o `climate_season`: a chuva dos anos completos do IMERG.

    `incomplete`: ano com algum dia nulo (fica com o NASA POWER). `without_climate`: célula e ano
    sem temporada no banco, ou com outra janela (a chuva não casaria com as outras séries).
    """

    file_name: str
    file_run: DataRun
    rains: tuple[tuple[tuple[str, int], tuple[float, ...]], ...]
    cells_in_file: int
    seasons_in_file: int
    incomplete: int
    without_climate: int

    @property
    def rows(self) -> int:
        return len(self.rains)


@dataclass(frozen=True)
class LoadPlan:
    cmip6: Cmip6Plan | None = None
    ndvi: NdviPlan | None = None
    imerg: ImergPlan | None = None


def _fits_ndvi_table(record: NdviRecord) -> bool:
    return (
        record.produto is not None
        and record.qualidade is not None
        and abs(record.ndvi) <= PHYSICAL_NDVI_MAX_ABS
    )


def _checked_run(path: Path, run: DataRun | None, expected_source: str) -> DataRun:
    if run is None:
        raise LoadError(f"{path}: sem versao_dados (fora do contrato dos dados das fontes)")
    if run.source != expected_source:
        raise LoadError(
            f"{path}: o versao_dados diz fonte {run.source!r}; esta carga só aceita "
            f"{expected_source!r}"
        )
    return run


def _require_file(path: Path) -> None:
    if not path.is_file():
        raise LoadError(f"{path}: arquivo não encontrado")


def plan_cmip6(path: Path, cell_ids: Sequence[str]) -> Cmip6Plan:
    """Lê o arquivo do CMIP6 e monta os deltas de cada célula de `cell_ids` (sem gravar)."""
    _require_file(path)
    reader = FileCmip6Repository(path)
    try:
        run = _checked_run(path, reader.get_data_run(), CMIP6_SOURCE)
        covered = [(cell_id, tuple(reader.get_cmip6_deltas(cell_id))) for cell_id in cell_ids]
    except (KeyError, TypeError, ValueError) as exc:
        raise LoadError(f"{path}: fora do contrato ({exc!r})") from exc
    cells = tuple((cell_id, deltas) for cell_id, deltas in covered if deltas)
    return Cmip6Plan(
        file_name=path.name,
        file_run=run,
        cells=cells,
        cells_without_deltas=len(covered) - len(cells),
    )


def plan_ndvi(path: Path) -> NdviPlan:
    """Lê o arquivo do NDVI e separa, ponto a ponto, o que cabe no `ndvi_point` (sem gravar)."""
    _require_file(path)
    reader = CachedNdviRepository(path)
    try:
        run = _checked_run(path, reader.get_data_run(), NDVI_SOURCE)
        series = reader.list_point_series()
    except (KeyError, TypeError, ValueError) as exc:
        raise LoadError(f"{path}: fora do contrato ({exc!r})") from exc
    points: list[NdviPointPlan] = []
    unreadable = out_of_table = 0
    for point in series:
        records = tuple(rec for rec in point.records if _fits_ndvi_table(rec))
        unreadable += point.discarded
        out_of_table += len(point.records) - len(records)
        if records:
            points.append(NdviPointPlan(lat=point.lat, lon=point.lon, records=records))
    return NdviPlan(
        file_name=path.name,
        file_run=run,
        points=tuple(points),
        points_total=len(series),
        skipped_unreadable=unreadable,
        skipped_out_of_table=out_of_table,
    )


def _same_window(window: SeasonWindow) -> bool:
    return window.start_date == date(window.year, 1, 1) and window.days == CLIMATE_SEASON_DAYS


def plan_imerg(path: Path, windows: Sequence[SeasonWindow]) -> ImergPlan:
    """Lê o arquivo do IMERG e separa a chuva que entra no `climate_season` (sem gravar)."""
    _require_file(path)
    reader = FileImergRepository(path)
    try:
        run = _checked_run(path, reader.get_data_run(), IMERG_SOURCE)
        series = reader.list_cell_series()
    except (KeyError, TypeError, ValueError) as exc:
        raise LoadError(f"{path}: fora do contrato ({exc!r})") from exc
    in_db = {(w.cell_id, w.year) for w in windows if _same_window(w)}
    rains: list[tuple[tuple[str, int], tuple[float, ...]]] = []
    incomplete = without_climate = 0
    for cell in series:
        for season in cell.seasons:
            if (cell.cell_id, season.year) not in in_db:
                without_climate += 1
            elif not season.complete:
                incomplete += 1
            else:
                rain = tuple(value for value in season.rain_mm if value is not None)
                rains.append(((cell.cell_id, season.year), rain))
    return ImergPlan(
        file_name=path.name,
        file_run=run,
        rains=tuple(rains),
        cells_in_file=len(series),
        seasons_in_file=sum(len(cell.seasons) for cell in series),
        incomplete=incomplete,
        without_climate=without_climate,
    )


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _iso_utc(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class FilesToDbLoader:
    """Planeja (só lê) e executa a carga, com os repositories do banco injetados."""

    def __init__(
        self,
        grid_repo: GridCellRepository,
        cmip6_repo: Cmip6Writer,
        ndvi_repo: NdviWriter,
        run_repo: RunWriter,
        season_repo: SeasonRainRepository,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._grid_repo = grid_repo
        self._cmip6_repo = cmip6_repo
        self._ndvi_repo = ndvi_repo
        self._run_repo = run_repo
        self._season_repo = season_repo
        self._clock = clock

    def plan(
        self,
        cmip6_path: Path | None = None,
        ndvi_path: Path | None = None,
        imerg_path: Path | None = None,
    ) -> LoadPlan:
        """Lê e confere os arquivos. Qualquer problema levanta `LoadError` antes de gravar."""
        cmip6 = None
        if cmip6_path is not None:
            cmip6 = plan_cmip6(cmip6_path, self._grid_repo.list_cell_ids())
        ndvi = plan_ndvi(ndvi_path) if ndvi_path is not None else None
        imerg = None
        if imerg_path is not None:
            imerg = plan_imerg(imerg_path, self._season_repo.list_season_windows())
        return LoadPlan(cmip6=cmip6, ndvi=ndvi, imerg=imerg)

    def run(self, plan: LoadPlan) -> None:
        """Grava o plano (upsert) e uma linha de `data_run` por fonte com linhas gravadas."""
        if plan.cmip6 is not None and plan.cmip6.rows:
            for cell_id, deltas in plan.cmip6.cells:
                self._cmip6_repo.save_cmip6_deltas(cell_id, list(deltas))
            self._record_run(
                CMIP6_SOURCE,
                plan.cmip6.file_name,
                plan.cmip6.file_run,
                celulas_com_deltas=plan.cmip6.cells_with_deltas,
                celulas_sem_deltas=plan.cmip6.cells_without_deltas,
                linhas=plan.cmip6.rows,
            )
        if plan.ndvi is not None and plan.ndvi.rows:
            for point in plan.ndvi.points:
                self._ndvi_repo.save_ndvi_history(point.lat, point.lon, list(point.records))
            self._record_run(
                NDVI_SOURCE,
                plan.ndvi.file_name,
                plan.ndvi.file_run,
                pontos=plan.ndvi.points_total,
                pontos_gravados=plan.ndvi.points_with_series,
                linhas=plan.ndvi.rows,
                registros_pulados=plan.ndvi.skipped,
            )
        if plan.imerg is not None and plan.imerg.rows:
            replaced = self._season_repo.replace_seasons_rain(IMERG_SOURCE, dict(plan.imerg.rains))
            self._record_run(
                IMERG_SOURCE,
                plan.imerg.file_name,
                plan.imerg.file_run,
                celulas_no_arquivo=plan.imerg.cells_in_file,
                temporadas_no_arquivo=plan.imerg.seasons_in_file,
                temporadas_trocadas=replaced,
                temporadas_incompletas=plan.imerg.incomplete,
                temporadas_sem_clima=plan.imerg.without_climate,
            )

    def _record_run(self, source: str, file_name: str, file_run: DataRun, **counts: int) -> None:
        # Só o nome do arquivo: o caminho local (com a pasta do usuário) não vai para o banco,
        # que circula na cópia do pacote do time.
        self._run_repo.save_run(
            DataRun(
                source=source,
                params={
                    "script": SCRIPT_NAME,
                    "arquivo": file_name,
                    "arquivo_fim": _iso_utc(file_run.finished_at),
                    **counts,
                    "parametros_do_arquivo": dict(file_run.params),
                },
                finished_at=self._clock(),
                version=file_run.version,
            )
        )


def describe_plan(plan: LoadPlan, dry_run: bool = False) -> str:
    """Resumo da carga: células com e sem deltas, pontos de NDVI, linhas e registros pulados."""
    verb = "a gravar" if dry_run else "gravadas"
    lines: list[str] = []
    if plan.cmip6 is not None:
        c = plan.cmip6
        lines.append(
            f"CMIP6 ({c.file_name}, versão {c.file_run.version}): {c.cells_in_grid} células no "
            f"banco: {c.cells_with_deltas} com deltas, {c.cells_without_deltas} sem deltas no "
            f"arquivo (nada para elas); {c.rows} linhas em cmip6_delta ({verb})."
        )
    if plan.ndvi is not None:
        n = plan.ndvi
        lines.append(
            f"NDVI ({n.file_name}, versão {n.file_run.version}): {n.points_total} pontos no "
            f"arquivo, {n.points_with_series} com série; {n.rows} linhas em ndvi_point ({verb}); "
            f"{n.skipped} registros pulados ({n.skipped_unreadable} sem NDVI ou com neve/nuvem, "
            f"{n.skipped_out_of_table} sem produto ou qualidade, ou com NDVI bruto)."
        )
    if plan.imerg is not None:
        i = plan.imerg
        lines.append(
            f"IMERG ({i.file_name}, versão {i.file_run.version}): {i.cells_in_file} células e "
            f"{i.seasons_in_file} temporadas no arquivo; {i.rows} temporadas com a chuva trocada "
            f"para {IMERG_SOURCE} ({verb}); {i.incomplete} incompletas (ficam com o NASA POWER); "
            f"{i.without_climate} sem a mesma temporada no climate_season (nada para elas)."
        )
    return "\n".join(lines)


class _EmptyDatabase:
    """Faz o papel do banco vazio no `--dry-run` sem DATABASE_URL. Não grava nada."""

    def list_cell_ids(self) -> list[str]:
        return []

    def save_cmip6_deltas(self, cell_id: str, deltas: list[Cmip6Delta]) -> None:
        raise RuntimeError("sem DATABASE_URL não há onde gravar")

    def save_ndvi_history(self, lat: float, lon: float, records: list[NdviRecord]) -> None:
        raise RuntimeError("sem DATABASE_URL não há onde gravar")

    def save_run(self, run: DataRun) -> None:
        raise RuntimeError("sem DATABASE_URL não há onde gravar")

    def list_season_windows(self) -> list[SeasonWindow]:
        return []

    def replace_seasons_rain(
        self, rain_source: str, rains: Mapping[tuple[str, int], tuple[float, ...]]
    ) -> int:
        raise RuntimeError("sem DATABASE_URL não há onde gravar")


def build_loader(database_url: str | None) -> FilesToDbLoader:
    """Monta a carga com os repositories do PostGIS (ou o banco vazio, sem URL)."""
    if not database_url:
        empty = _EmptyDatabase()
        return FilesToDbLoader(
            grid_repo=empty, cmip6_repo=empty, ndvi_repo=empty, run_repo=empty, season_repo=empty
        )
    # Sem reserva: as células e as temporadas são só as do banco.
    climate = PostgisClimateRepository(database_url)
    return FilesToDbLoader(
        grid_repo=climate,
        cmip6_repo=PostgisCmip6Repository(database_url),
        ndvi_repo=PostgisNdviRepository(database_url),
        run_repo=PostgisDataRunRepository(database_url),
        season_repo=climate,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.load_files_to_db",
        description=(__doc__ or "").splitlines()[0],
    )
    parser.add_argument(
        "--cmip6",
        type=Path,
        metavar="ARQUIVO",
        help="arquivo dos deltas do CMIP6 (saída do pipeline.fetch_cmip6_deltas)",
    )
    parser.add_argument(
        "--ndvi", type=Path, metavar="ARQUIVO", help="arquivo do NDVI do MODIS (contrato NDVI)"
    )
    parser.add_argument(
        "--imerg",
        type=Path,
        metavar="ARQUIVO",
        help="arquivo da chuva do IMERG (saída do pipeline.fetch_imerg): troca a chuva do POWER",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="só lê os arquivos e mostra o resumo: não grava"
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cmip6 is None and args.ndvi is None and args.imerg is None:
        parser.error("informe ao menos um arquivo: --cmip6, --ndvi ou --imerg")
    database_url = get_settings().database_url
    if not database_url and not args.dry_run:
        print("Defina DATABASE_URL (o banco que recebe a carga).", file=sys.stderr)
        return 2

    loader = build_loader(database_url)
    try:
        plan = loader.plan(cmip6_path=args.cmip6, ndvi_path=args.ndvi, imerg_path=args.imerg)
    except LoadError as exc:
        print(f"Nada foi gravado: {exc}", file=sys.stderr)
        return 1
    if args.dry_run:
        print(describe_plan(plan, dry_run=True))
        if not database_url:
            print("Sem DATABASE_URL: o resumo supõe o banco sem células.")
        print("--dry-run: nada foi gravado.")
        return 0
    loader.run(plan)
    # Depois de gravar: o resumo diz o que entrou no banco.
    print(describe_plan(plan))
    return 0


if __name__ == "__main__":
    sys.exit(main())
