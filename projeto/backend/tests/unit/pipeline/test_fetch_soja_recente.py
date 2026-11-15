"""Testes do script da soja recente (RF-24, tarefa 0037) pela ORNL DAAC, com HTTP falso.

Os valores de NDVI e de qualidade aqui são de teste, não dados do MODIS. Os únicos números reais
são a posição de recortes da ORNL em volta da fazenda de exemplo (o pixel do ponto na grade global
do MODIS) e as datas de 2026 conferidas na ORNL em 15/11/2026, usados para conferir as contas.
"""

import gzip
import json
import math
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from app.models.soja_recente import MODIS_250M_PIXEL_M, SINUSOIDAL_RADIUS_M, PicoSojaRecente
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.rules_repository import load_default_rules
from app.repositories.soja_recente_repository import FileSojaRecenteRepository
from app.services.soja_recente_service import SojaRecenteRule
from pipeline.fetch_cmip6_deltas import PILOT_BOX
from pipeline.fetch_ndvi import Point
from pipeline.fetch_regiao_ndvi import (
    NDVI_BAND,
    QUALITY_BAND,
    Grid,
    OrnlError,
    SubsetRequest,
    composite_dates,
    modis_date,
)
from pipeline.fetch_soja_recente import (
    PixelWindow,
    Tile,
    build_payload,
    build_plan,
    default_output,
    global_pixel,
    peaks_grid,
    pixel_window,
    plan_tiles,
    run,
    tile_half_pixels,
    write_payload,
)

P = MODIS_250M_PIXEL_M
X_WEST = -math.pi * SINUSOIDAL_RADIUS_M
Y_NORTH = math.pi / 2 * SINUSOIDAL_RADIUS_M
FINISHED_AT = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
RULES = load_default_rules()
FAZENDA = (-18.9543, -48.1993)


def _grid_at(row: int, col: int, nrows: int, ncols: int) -> Grid:
    """Grade de um recorte cujo canto de cima à esquerda é o pixel global (row, col)."""
    return Grid(
        xll=X_WEST + col * P, yll=Y_NORTH - (row + nrows) * P, cellsize=P, nrows=nrows, ncols=ncols
    )


def _subset_json(grid: Grid, band: str, layers: dict[date, list[int]]) -> bytes:
    """Resposta no formato do `/subset` da ORNL (cabeçalho + uma lista de valores por data)."""
    return json.dumps(
        {
            "xllcorner": f"{grid.xll:.2f}",
            "yllcorner": f"{grid.yll:.2f}",
            "cellsize": grid.cellsize,
            "nrows": grid.nrows,
            "ncols": grid.ncols,
            "band": band,
            "subset": [
                {"modis_date": modis_date(d), "calendar_date": d.isoformat(), "band": band,
                 "tile": "h13v10", "data": data}
                for d, data in layers.items()
            ],
        }
    ).encode("utf-8")  # fmt: skip


# --- grade global do MODIS, janela de pixels e ladrilhos ----------------------------------------


def test_should_find_the_global_modis_pixel_of_a_point() -> None:
    # Recorte real da ORNL de 1 pixel na fazenda de exemplo: xllcorner −5069104,48 (coluna
    # 64518 desde −πR) e yllcorner −2107841,20 (linha 52298 desde πR/2).
    assert global_pixel(*FAZENDA) == (52298, 64518)


def test_should_cover_the_whole_pilot_box_with_a_window_of_pixels() -> None:
    window = pixel_window(PILOT_BOX)

    assert window == PixelWindow(row_first=52031, row_last=52751, col_first=64082, col_last=64961)
    assert (window.rows, window.cols) == (721, 880)
    # Na projeção sinusoidal a caixa vira um trapézio: os 4 cantos ficam dentro da janela.
    for lat in (PILOT_BOX.lat_min, PILOT_BOX.lat_max):
        for lon in (PILOT_BOX.lon_min, PILOT_BOX.lon_max):
            row, col = global_pixel(lat, lon)
            assert window.row_first <= row <= window.row_last
            assert window.col_first <= col <= window.col_last


def test_should_turn_the_requested_km_into_pixels_like_the_ornl() -> None:
    # A ORNL conta o km como pixels de 250 m: ±30 km = 120 pixels de cada lado (241 × 241).
    assert tile_half_pixels(30) == 120
    assert tile_half_pixels(1) == 4


def test_should_tile_the_pilot_box_with_twelve_requests_of_241_pixels() -> None:
    window = pixel_window(PILOT_BOX)

    tiles = plan_tiles(window, half=120)

    assert len(tiles) == 12
    assert (tiles[0].row, tiles[0].col) == (52031 + 120, 64082 + 120)
    assert (tiles[1].row, tiles[1].col) == (52031 + 120, 64082 + 120 + 241)
    assert max(t.row for t in tiles) + 120 >= window.row_last
    assert max(t.col for t in tiles) + 120 >= window.col_last
    # O centro pedido à ORNL é o centro do pixel planejado (ida e volta pela projeção).
    for tile in tiles:
        assert global_pixel(tile.center.lat, tile.center.lon) == (tile.row, tile.col)


def test_should_ask_ndvi_and_quality_of_terra_and_aqua_from_january_to_march_15() -> None:
    # Datas de 2026 conferidas na ORNL em 15/11/2026 (MOD13Q1 e MYD13Q1 na fazenda de exemplo).
    plan = build_plan(RULES.soja_recente, 2026)

    assert plan == [
        SubsetRequest("MOD13Q1", NDVI_BAND, date(2026, 1, 1), date(2026, 3, 6), 5),
        SubsetRequest("MOD13Q1", QUALITY_BAND, date(2026, 1, 1), date(2026, 3, 6), 5),
        SubsetRequest("MYD13Q1", NDVI_BAND, date(2026, 1, 9), date(2026, 3, 14), 5),
        SubsetRequest("MYD13Q1", QUALITY_BAND, date(2026, 1, 9), date(2026, 3, 14), 5),
    ]


# --- pico de cada pixel -------------------------------------------------------------------------

TERRA = [date(2026, 1, 1), date(2026, 1, 17)]
AQUA = [date(2026, 1, 9)]


def _tile_cache(grid: Grid) -> dict[str, bytes]:
    """Recortes de teste de 2 × 2 pixels: NDVI e qualidade de Terra (2 datas) e Aqua (1 data).

    Pixel 0: 0,8650 e 0,7000 bons e 0,9100 com nuvem (3) → pico 86.
    Pixel 1: só uma observação boa → sem dado.
    Pixel 2: preenchimento (−3000) com qualidade 0 não conta; 0,7500 e 0,4100 → 75.
    Pixel 3: 0,6999 e 0,5000 → 69 (truncado: nunca chega a 70 sem ter 0,70).
    """
    terra_ndvi = {TERRA[0]: [8650, 9900, -3000, 6999], TERRA[1]: [7000, 1000, 7500, 5000]}
    terra_q = {TERRA[0]: [0, 0, 0, 0], TERRA[1]: [1, 3, 0, 1]}
    aqua_ndvi = {AQUA[0]: [9100, 8000, 4100, 3000]}
    aqua_q = {AQUA[0]: [3, 2, 0, 2]}
    return {
        "MOD13Q1:" + NDVI_BAND: _subset_json(grid, NDVI_BAND, terra_ndvi),
        "MOD13Q1:" + QUALITY_BAND: _subset_json(grid, QUALITY_BAND, terra_q),
        "MYD13Q1:" + NDVI_BAND: _subset_json(grid, NDVI_BAND, aqua_ndvi),
        "MYD13Q1:" + QUALITY_BAND: _subset_json(grid, QUALITY_BAND, aqua_q),
    }


PLAN = [
    SubsetRequest("MOD13Q1", NDVI_BAND, TERRA[0], TERRA[1], 2),
    SubsetRequest("MOD13Q1", QUALITY_BAND, TERRA[0], TERRA[1], 2),
    SubsetRequest("MYD13Q1", NDVI_BAND, AQUA[0], AQUA[0], 1),
    SubsetRequest("MYD13Q1", QUALITY_BAND, AQUA[0], AQUA[0], 1),
]


def _load_from(responses: dict[str, bytes]):
    return lambda tile, request: responses[f"{request.product}:{request.band}"]


def _tile(row: int, col: int) -> Tile:
    return Tile(row=row, col=col, center=Point(0.0, 0.0))  # o centro só serve para pedir à ORNL


def test_should_keep_the_highest_good_ndvi_of_each_pixel_in_hundredths() -> None:
    window = PixelWindow(row_first=100, row_last=101, col_first=200, col_last=201)
    tile = _tile(100, 200)

    grid, covered = peaks_grid(
        window,
        [tile],
        PLAN,
        _load_from(_tile_cache(_grid_at(100, 200, 2, 2))),
        SojaRecenteRule(RULES),
    )

    assert grid == [[86, None], [75, 69]]
    assert covered == 4


def test_should_place_each_tile_by_its_header_and_leave_uncovered_pixels_without_data() -> None:
    # Janela de 3 × 4; o recorte de 2 × 2 começa na linha 1 e na coluna 2 da janela.
    window = PixelWindow(row_first=100, row_last=102, col_first=200, col_last=203)
    tile = _tile(101, 202)

    grid, covered = peaks_grid(
        window,
        [tile],
        PLAN,
        _load_from(_tile_cache(_grid_at(101, 202, 2, 2))),
        SojaRecenteRule(RULES),
    )

    assert grid == [
        [None, None, None, None],
        [None, None, 86, None],
        [None, None, 75, 69],
    ]
    assert covered == 4  # os outros 8 pixels ficam sem ladrilho


def test_should_drop_the_part_of_a_tile_outside_the_window() -> None:
    window = PixelWindow(row_first=100, row_last=100, col_first=200, col_last=200)
    tile = _tile(100, 200)

    grid, covered = peaks_grid(
        window,
        [tile],
        PLAN,
        _load_from(_tile_cache(_grid_at(99, 199, 2, 2))),
        SojaRecenteRule(RULES),
    )

    assert grid == [[69]]
    assert covered == 1


def test_should_refuse_a_tile_that_is_not_on_the_modis_grid() -> None:
    window = PixelWindow(row_first=100, row_last=101, col_first=200, col_last=201)
    tile = _tile(100, 200)
    shifted = Grid(xll=X_WEST + 200.4 * P, yll=Y_NORTH - 102 * P, cellsize=P, nrows=2, ncols=2)

    with pytest.raises(OrnlError, match="grade"):
        peaks_grid(window, [tile], PLAN, _load_from(_tile_cache(shifted)), SojaRecenteRule(RULES))


# --- arquivo do contrato ------------------------------------------------------------------------


def test_should_write_the_contract_file_that_the_api_reads(tmp_path: Path) -> None:
    window = PixelWindow(row_first=52297, row_last=52299, col_first=64517, col_last=64519)
    picos = [[41, 41, 41], [41, 86, None], [12, 70, 69]]
    output = tmp_path / "soja_recente_2026.json"

    payload = build_payload(window, picos, 2026, {"tipo": "soja_recente"}, FINISHED_AT)
    write_payload(payload, output)

    repository = FileSojaRecenteRepository(output)
    assert repository.get_pico(*FAZENDA) == PicoSojaRecente(
        safra="2025/26", fonte="MODIS MOD13Q1 + MYD13Q1", ndvi_pico=0.86
    )
    data_run = repository.get_data_run()
    assert data_run is not None
    assert (data_run.source, data_run.version) == ("modis_mod13q1", "2026.11-modis-soja-recente")
    assert payload["grade"]["linhas"] == 3
    assert payload["grade"]["colunas"] == 3
    # Uma linha de pixels por linha do arquivo: pequeno e ainda legível.
    lines = output.read_text(encoding="utf-8").splitlines()
    assert "[41,86,null]," in [line.strip() for line in lines]


# --- linha de comando ---------------------------------------------------------------------------


def _date_from_modis(text: str) -> date:
    year, doy = int(text[1:5]), int(text[5:])
    return date.fromordinal(date(year, 1, 1).toordinal() + doy - 1)


class FakeOrnl:
    """Responde a qualquer `/subset` com o recorte que a ORNL devolveria (alinhado à grade global
    e centrado no pixel do ponto pedido). NDVI 0,8650 com qualidade boa em todas as datas."""

    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.calls += 1
        params = request.params
        half = round(params["kmAboveBelow"] / 0.25)
        row, col = global_pixel(params["latitude"], params["longitude"])
        size = 2 * half + 1
        grid = _grid_at(row - half, col - half, size, size)
        start, end = _date_from_modis(params["startDate"]), _date_from_modis(params["endDate"])
        product = request.url.rsplit("/", 2)[-2]
        days = [
            d for d in composite_dates(product, start.year, "01-01", "12-31") if start <= d <= end
        ]
        value = 8650 if params["band"] == NDVI_BAND else 0
        body = _subset_json(grid, params["band"], {d: [value] * size * size for d in days})
        return HttpResponse(200, gzip.compress(body))


def _no_network(request: HttpRequest, timeout: float) -> HttpResponse:
    raise AssertionError(f"pedido inesperado: {request.url}")


class AlwaysDown:
    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        return HttpResponse(502, b"Bad Gateway")


def _run(argv: list[str], transport, logs: list[str] | None = None) -> int:
    return run(
        argv,
        transport=transport,
        sleep=lambda _: None,
        now=lambda: FINISHED_AT,
        log=(logs if logs is not None else []).append,
        load_rules=lambda: RULES,
    )


def test_should_only_show_the_plan_on_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = _run(["--dry-run", "--saida", str(tmp_path / "soja.json")], _no_network)

    out = capsys.readouterr().out
    assert code == 0
    assert "12 ladrilhos" in out
    assert "48 pedidos" in out
    assert "721 × 880 pixels" in out
    assert not (tmp_path / "soja.json").exists()


# Caixa pequena em volta da fazenda de exemplo: ~2,2 km de norte a sul e ~1,05 km de leste a oeste.
SMALL_AREA = "--area=-18.97,-18.95,-48.205,-48.195"


def test_should_download_compute_and_write_the_peaks_then_resume_from_the_cache(
    tmp_path: Path,
) -> None:
    output = tmp_path / "soja.json"
    argv = [SMALL_AREA, "--km", "1", "--saida", str(output), "--cache", str(tmp_path / "cache")]
    ornl = FakeOrnl()

    assert _run(argv, ornl) == 0
    assert ornl.calls == 8  # 2 ladrilhos de 9 × 9 pixels × 4 pedidos
    repository = FileSojaRecenteRepository(output)
    assert repository.get_pico(*FAZENDA) == PicoSojaRecente(
        safra="2025/26", fonte="MODIS MOD13Q1 + MYD13Q1", ndvi_pico=0.86
    )
    params = repository.get_data_run().params  # type: ignore[union-attr]
    assert params["servico"] == "ornl_daac"
    assert params["tipo"] == "soja_recente"
    assert params["safra"] == "2025/26"
    assert params["janela"] == "01-01 a 03-15"
    assert params["min_observacoes"] == 2
    assert (params["ladrilhos"], params["pedidos"], params["km_pedido"]) == (2, 8, 1)
    assert params["pixels"]["sem_dado"] == 0

    first = output.read_text(encoding="utf-8")
    output.unlink()
    assert _run(argv, _no_network) == 0  # tudo do cache, nenhum pedido
    assert output.read_text(encoding="utf-8") == first


def test_should_stop_with_a_hint_to_resume_when_the_ornl_keeps_failing(tmp_path: Path) -> None:
    logs: list[str] = []
    argv = [SMALL_AREA, "--km", "1", "--saida", str(tmp_path / "soja.json"),
            "--cache", str(tmp_path / "cache")]  # fmt: skip

    assert _run(argv, AlwaysDown(), logs) == 1
    assert any("de novo" in line and "cache" in line for line in logs)
    assert not (tmp_path / "soja.json").exists()


def test_should_name_the_default_output_by_the_harvest_year() -> None:
    assert default_output(2026).name == "soja_recente_2026.json"
    assert default_output(2026).parent.name == "nasa_modis_soja_recente"


def test_should_refuse_an_area_out_of_the_globe() -> None:
    with pytest.raises(SystemExit):
        _run(["--area=-19,-18,-200,-47", "--dry-run"], _no_network)
