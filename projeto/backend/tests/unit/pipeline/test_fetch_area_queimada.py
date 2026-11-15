"""Testes do script da área queimada (MODIS MCD64A1 pela ORNL DAAC, tarefa 0043), com HTTP falso.

Os valores de `Burn_Date` aqui são de teste, não dados do MODIS. O único número real é a posição
do recorte de 41 × 41 pixels de 500 m que a ORNL devolveu em volta da fazenda de exemplo em
15/11/2026 (xllcorner −5078370,71 e yllcorner −2117339,15), usado para conferir a conta do pixel.
"""

import json
import math
from datetime import UTC, date, datetime
from pathlib import Path

from app.models.area_queimada import MODIS_500M_PIXEL_M
from app.models.data_run import DataRun
from app.models.soja_recente import SINUSOIDAL_RADIUS_M
from app.repositories.area_queimada_repository import FileAreaQueimadaRepository
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.rules_repository import load_default_rules
from pipeline.fetch_area_queimada import BURN_BAND, build_plan, burned_pixels, run
from pipeline.fetch_cmip6_deltas import parse_box
from pipeline.fetch_ndvi import Point
from pipeline.fetch_regiao_ndvi import Grid, modis_date
from pipeline.fetch_soja_recente import PixelWindow, Tile, global_pixel, pixel_window, plan_tiles

P = MODIS_500M_PIXEL_M
X_WEST = -math.pi * SINUSOIDAL_RADIUS_M
Y_NORTH = math.pi / 2 * SINUSOIDAL_RADIUS_M
FAZENDA = (-18.9543, -48.1993)
FINISHED_AT = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


def _grid_at(row: int, col: int, nrows: int, ncols: int) -> Grid:
    return Grid(
        xll=X_WEST + col * P, yll=Y_NORTH - (row + nrows) * P, cellsize=P, nrows=nrows, ncols=ncols
    )


def _subset_json(grid: Grid, layers: dict[date, list[int]]) -> bytes:
    return json.dumps(
        {
            "xllcorner": f"{grid.xll:.2f}",
            "yllcorner": f"{grid.yll:.2f}",
            "cellsize": grid.cellsize,
            "nrows": grid.nrows,
            "ncols": grid.ncols,
            "band": BURN_BAND,
            "subset": [
                {"modis_date": modis_date(d), "calendar_date": d.isoformat(), "band": BURN_BAND,
                 "tile": "h13v10", "data": data}
                for d, data in layers.items()
            ],
        }
    ).encode("utf-8")  # fmt: skip


def test_should_find_the_500_m_pixel_of_the_farm_like_the_ornl() -> None:
    # Recorte real de ±10 km (41 × 41): o canto fica na coluna 32239 e na linha 26129 da grade
    # global de 500 m; a fazenda é o pixel do meio (+20, +20).
    corner_col = round((-5078370.71 - X_WEST) / P)
    corner_row = round((Y_NORTH - (-2117339.15 + 41 * P)) / P)

    assert global_pixel(*FAZENDA, pixel_m=P) == (corner_row + 20, corner_col + 20)


def test_should_ask_every_month_of_the_years_without_crossing_the_year() -> None:
    plan = build_plan(range(2016, 2018), dates_per_request=6)

    assert len(plan) == 4
    assert (plan[0].start, plan[0].end, plan[0].n_dates) == (date(2016, 1, 1), date(2016, 6, 1), 6)
    assert (plan[1].start, plan[1].end) == (date(2016, 7, 1), date(2016, 12, 1))
    assert all(r.product == "MCD64A1" and r.band == BURN_BAND for r in plan)


def test_should_keep_the_years_in_which_each_pixel_burned() -> None:
    window = PixelWindow(row_first=100, row_last=102, col_first=200, col_last=202)
    tile = Tile(row=101, col=201, center=Point(-18.95, -48.2))
    plan = build_plan(range(2016, 2018), dates_per_request=12)
    # 3 × 3 pixels: 0 = não queimou; −1 = sem dado; −2 = água; > 0 = dia da queimada.
    responses = {
        2016: {date(2016, 8, 1): [0, 0, 0, 0, 230, 0, 0, 0, -1]},
        2017: {date(2017, 9, 1): [0, 0, 0, 0, 250, 0, 0, -2, 260]},
    }

    def load(_tile: Tile, request) -> bytes:  # noqa: ANN001
        layers = {d: [0] * 9 for d in (date(request.start.year, m, 1) for m in range(1, 13))}
        layers.update(responses[request.start.year])
        return _subset_json(_grid_at(100, 200, 3, 3), layers)

    burned = burned_pixels(window, [tile], plan, load)

    assert burned == {(1, 1): {2016, 2017}, (2, 2): {2017}}


def test_should_write_a_file_the_api_reads_and_record_the_run(tmp_path: Path) -> None:
    box = parse_box("-18.96,-18.95,-48.20,-48.19")
    window = pixel_window(box, pixel_m=P)
    tiles = plan_tiles(window, half=2, pixel_m=P)
    assert len(tiles) == 1
    requests: list[HttpRequest] = []

    def transport(request: HttpRequest, timeout: float) -> HttpResponse:
        requests.append(request)
        start = date(2016, 1, 1) if "A2016001" in request.params["startDate"] else date(2016, 7, 1)
        grid = _grid_at(tiles[0].row - 2, tiles[0].col - 2, 5, 5)
        layers = {date(2016, start.month + i, 1): [0] * 25 for i in range(6)}
        if start.month == 7:
            # O pixel do meio queima em agosto (dia 230)
            layers[date(2016, 8, 1)] = [0] * 12 + [230] + [0] * 12
        return HttpResponse(status=200, body=_subset_json(grid, layers))

    saved: list[DataRun] = []
    output = tmp_path / "area_queimada.json"
    code = run(
        [
            "--area=-18.96,-18.95,-48.20,-48.19",
            "--anos",
            "2016",
            "--km",
            "1",
            "--datas-por-pedido",
            "6",
            "--saida",
            str(output),
            "--cache",
            str(tmp_path / "cache"),
        ],
        transport=transport,
        sleep=lambda _s: None,
        now=lambda: FINISHED_AT,
        log=lambda _m: None,
        load_rules=load_default_rules,
        save_run=saved.append,
    )

    assert code == 0
    assert len(requests) == 2
    near = FileAreaQueimadaRepository(output).get_burned_near(-18.955, -48.195, km=2.0)
    assert near is not None
    assert (near.ano_inicio, near.ano_fim, near.fonte) == (2016, 2016, "MODIS MCD64A1")
    assert [p.anos for p in near.pixels] == [(2016,)]
    assert saved and saved[0].source == "modis_mcd64a1"
    assert saved[0].params["pedidos"] == 2


def test_should_only_show_the_plan_in_dry_run(tmp_path: Path) -> None:
    def transport(request: HttpRequest, timeout: float) -> HttpResponse:
        raise AssertionError("o dry-run não pede nada")

    code = run(
        ["--dry-run", "--saida", str(tmp_path / "x.json")],
        transport=transport,
        log=lambda _m: None,
        load_rules=load_default_rules,
        save_run=lambda _run: None,
    )

    assert code == 0
    assert not (tmp_path / "x.json").exists()
