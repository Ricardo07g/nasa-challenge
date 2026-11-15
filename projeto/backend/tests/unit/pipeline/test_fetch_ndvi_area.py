"""Testes do NDVI do MODIS por área (RF-34, tarefa 0050) pela ORNL DAAC, com HTTP falso.

Os valores de NDVI e de qualidade aqui são de teste, não dados do MODIS. Os únicos números reais
são a posição da fazenda de exemplo na grade global do MODIS (o pixel de um recorte real da ORNL)
e o calendário das composições de 16 dias, conferido na ORNL em 14/11/2026.
"""

import gzip
import json
import math
import urllib.parse
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from app.models.soja_recente import MODIS_250M_PIXEL_M, SINUSOIDAL_RADIUS_M
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.ndvi_grid_repository import GridNdviRepository, read_tile_header
from app.repositories.ndvi_repository import CachedNdviRepository
from pipeline import fetch_ndvi
from pipeline.fetch_cmip6_deltas import PILOT_BOX, Box
from pipeline.fetch_ndvi import ORNL_NDVI_BAND, ORNL_QUALITY_BAND, modis_calendar
from pipeline.fetch_ndvi_area import (
    DEFAULT_OUTPUT,
    TileCache,
    balanced_chunks,
    plan_area_tiles,
    run,
    season_dates,
    tile_requests,
)
from pipeline.fetch_regiao_ndvi import (
    NDVI_BAND,
    QUALITY_BAND,
    Grid,
    SubsetRequest,
    composite_dates,
    modis_date,
)
from pipeline.fetch_soja_recente import global_pixel, pixel_window, plan_tiles
from tests.ndvi_grid_fakes import pixel_center

P = MODIS_250M_PIXEL_M
X_WEST = -math.pi * SINUSOIDAL_RADIUS_M
Y_NORTH = math.pi / 2 * SINUSOIDAL_RADIUS_M
FINISHED_AT = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
FAZENDA = (-18.9543, -48.1993)
YEARS = range(2017, 2027)
PILOT_AREA = "--area=-19.9,-18.4,-49.0,-47.5"
# Caixa pequena em volta da fazenda de exemplo: com ±1 km (9 × 9 pixels), 2 ladrilhos.
SMALL_AREA = "--area=-18.97,-18.95,-48.205,-48.195"
# ~4,5 km × 4,4 km: com ±1 km, 3 × 3 ladrilhos.
NINE_TILES_AREA = "--area=-18.98,-18.94,-48.22,-48.18"


# --- calendário, blocos e ladrilhos -------------------------------------------------------------


def test_should_list_the_composites_of_terra_and_aqua_from_january_to_july() -> None:
    dates = season_dates(YEARS)

    assert len(dates) == 270  # 10 anos × (14 do Terra + 13 do Aqua)
    assert dates[:3] == [
        (date(2017, 1, 1), "MOD13Q1"),
        (date(2017, 1, 9), "MYD13Q1"),
        (date(2017, 1, 17), "MOD13Q1"),
    ]
    assert dates == sorted(dates)
    # O mesmo calendário do modo por ponto (fetch_ndvi --fonte ornl).
    for product in ("MOD13Q1", "MYD13Q1"):
        point_mode = [_from_modis(d) for d in modis_calendar(product)]
        assert [day for day, p in dates if p == product] == point_mode


@pytest.mark.parametrize(
    ("size", "max_size", "expected"),
    [(14, 10, [7, 7]), (13, 10, [7, 6]), (14, 5, [5, 5, 4]), (10, 10, [10]), (3, 10, [3])],
)
def test_should_split_in_balanced_chunks(size: int, max_size: int, expected: list[int]) -> None:
    chunks = balanced_chunks(list(range(size)), max_size)

    assert [len(c) for c in chunks] == expected
    assert [item for chunk in chunks for item in chunk] == list(range(size))


@pytest.mark.parametrize("max_size", [0, 11])
def test_should_refuse_more_than_the_ornl_limit_of_dates(max_size: int) -> None:
    with pytest.raises(ValueError, match="10"):
        balanced_chunks([1, 2, 3], max_size)


def test_should_tile_the_pilot_box_from_the_center_out() -> None:
    tiles = plan_area_tiles(PILOT_BOX, 30)

    expected = plan_tiles(pixel_window(PILOT_BOX), 120)
    assert sorted((t.row, t.col) for t in tiles) == sorted((t.row, t.col) for t in expected)
    assert len(tiles) == 12
    center = global_pixel(
        (PILOT_BOX.lat_min + PILOT_BOX.lat_max) / 2, (PILOT_BOX.lon_min + PILOT_BOX.lon_max) / 2
    )
    distances = [math.hypot(t.row - center[0], t.col - center[1]) for t in tiles]
    assert distances == sorted(distances)


def test_should_ask_80_requests_for_a_new_tile_with_7_dates_at_most() -> None:
    requests = tile_requests(season_dates(YEARS), set(), 10)

    assert len(requests) == 80  # 10 anos × 2 produtos × 2 pedidos × 2 bandas
    assert all(r.start.year == r.end.year for r in requests)
    assert max(r.n_dates for r in requests) == 7
    assert sum(r.band == NDVI_BAND for r in requests) == 40
    assert requests[:4] == [
        SubsetRequest("MOD13Q1", NDVI_BAND, date(2017, 1, 1), date(2017, 4, 7), 7),
        SubsetRequest("MOD13Q1", QUALITY_BAND, date(2017, 1, 1), date(2017, 4, 7), 7),
        SubsetRequest("MOD13Q1", NDVI_BAND, date(2017, 4, 23), date(2017, 7, 28), 7),
        SubsetRequest("MOD13Q1", QUALITY_BAND, date(2017, 4, 23), date(2017, 7, 28), 7),
    ]
    assert len(tile_requests(season_dates(YEARS), set(), 5)) == 120


def test_should_ask_only_the_dates_missing_in_the_cache() -> None:
    dates = season_dates([2017])
    terra = [day for day, product in dates if product == "MOD13Q1"]
    covered = {("MOD13Q1", NDVI_BAND, day) for day in terra[3:10]}

    requests = [r for r in tile_requests(dates, covered, 10) if r.product == "MOD13Q1"]

    assert [(r.band, r.start, r.end, r.n_dates) for r in requests if r.band == NDVI_BAND] == [
        (NDVI_BAND, terra[0], terra[2], 3),  # antes do trecho no cache
        (NDVI_BAND, terra[10], terra[13], 4),  # depois dele
    ]
    assert sum(r.n_dates for r in requests if r.band == QUALITY_BAND) == 14


def test_should_read_the_covered_dates_from_the_cache_file_names(tmp_path: Path) -> None:
    tile = plan_area_tiles(PILOT_BOX, 30)[0]
    cache = TileCache(tmp_path, tile)
    request = SubsetRequest("MOD13Q1", NDVI_BAND, date(2017, 1, 1), date(2017, 4, 7), 7)

    cache.put(request, b"{}")

    terra = composite_dates("MOD13Q1", 2017, "01-01", "04-07")
    assert cache.covered() == {("MOD13Q1", NDVI_BAND, day) for day in terra}
    assert cache.folder == tmp_path / f"r{tile.row}_c{tile.col}"


def test_should_write_to_the_team_folder_by_default() -> None:
    assert DEFAULT_OUTPUT.name == "ndvi_modis_area.json"
    assert DEFAULT_OUTPUT.parent.name == "nasa_modis_ndvi_area"
    assert DEFAULT_OUTPUT.parent.parent.name == "baixados"


# --- ORNL de mentira ----------------------------------------------------------------------------


def _from_modis(text: str) -> date:
    return date(int(text[1:5]), 1, 1) + timedelta(days=int(text[5:]) - 1)


def _value(row: int, col: int, day: date, product: str) -> tuple[int, int]:
    """(NDVI bruto, pixel_reliability) de teste, com os casos de borda do filtro: preenchimento,
    neve, nuvem, sem dado, os limites −2000 e 10000 e o valor logo abaixo da faixa. (Acima de
    10000 o MOD13Q1 não tem valor, e o modo por ponto leria o produto como bruto.)"""
    k = (row * 7 + col * 13 + day.toordinal() + (5 if product == "MYD13Q1" else 0)) % 12
    special = {
        0: (-3000, 0),
        1: (6000, 2),
        2: (6000, 3),
        3: (6000, -1),
        4: (-2000, 1),
        5: (10000, 0),
        6: (-2001, 0),
    }
    return special.get(k, (1000 + 37 * k + 10 * (row % 10) + col % 10, k % 2))


def _grid_at(row: int, col: int, nrows: int, ncols: int) -> Grid:
    return Grid(
        xll=X_WEST + col * P, yll=Y_NORTH - (row + nrows) * P, cellsize=P, nrows=nrows, ncols=ncols
    )


def _subset_json(grid: Grid, band: str, layers: dict[date, list[int]]) -> bytes:
    return json.dumps(
        {
            "xllcorner": f"{grid.xll:.2f}", "yllcorner": f"{grid.yll:.2f}",
            "cellsize": grid.cellsize, "nrows": grid.nrows, "ncols": grid.ncols, "band": band,
            "subset": [
                {"modis_date": modis_date(d), "calendar_date": d.isoformat(), "band": band,
                 "tile": "h13v10", "data": data}
                for d, data in layers.items()
            ],
        }
    ).encode("utf-8")  # fmt: skip


class FakeAreaOrnl:
    """`/subset` por área da ORNL: recorte alinhado à grade global e centrado no pixel do ponto
    pedido, uma banda por pedido. `fail(request)` verdadeiro = 502; `tamper(payload)` estraga a
    resposta (banda trocada, grade fora do lugar)."""

    def __init__(
        self,
        fail: Callable[[HttpRequest], bool] | None = None,
        tamper: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self.fail = fail or (lambda request: False)
        self.tamper = tamper
        self.requests: list[HttpRequest] = []

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.requests.append(request)
        if self.fail(request):
            return HttpResponse(502, b"<html>502 Proxy Error</html>")
        params = request.params
        half = round(params["kmAboveBelow"] / 0.25)
        row, col = global_pixel(params["latitude"], params["longitude"])
        size = 2 * half + 1
        top, left = row - half, col - half
        product = request.url.rsplit("/", 2)[-2]
        start, end = _from_modis(params["startDate"]), _from_modis(params["endDate"])
        days = [
            d for d in composite_dates(product, start.year, "01-01", "12-31") if start <= d <= end
        ]
        which = 0 if params["band"] == NDVI_BAND else 1
        layers = {
            d: [_value(top + i // size, left + i % size, d, product)[which] for i in range(size**2)]
            for d in days
        }
        body = _subset_json(_grid_at(top, left, size, size), params["band"], layers)
        if self.tamper is not None:
            payload = json.loads(body)
            self.tamper(payload)
            body = json.dumps(payload).encode("utf-8")
        return HttpResponse(200, gzip.compress(body))


class AlwaysDown:
    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.calls += 1
        return HttpResponse(502, b"Bad Gateway")


def _no_network(request: HttpRequest, timeout: float) -> HttpResponse:
    raise AssertionError(f"pedido inesperado: {request.url}")


def _args(tmp_path: Path, *extra: str) -> list[str]:
    return [
        "--saida",
        str(tmp_path / "area" / "ndvi_modis_area.json"),
        "--cache",
        str(tmp_path / "cache"),
        *extra,
    ]


def _run(argv: list[str], transport: Any, logs: list[str] | None = None) -> int:
    return run(
        argv,
        transport=transport,
        sleep=lambda _: None,
        now=lambda: FINISHED_AT,
        log=(logs if logs is not None else []).append,
    )


def _expected_records(row: int, col: int, years: range = YEARS) -> list[tuple[date, float, int]]:
    """O que o filtro do modo por ponto deixa passar: qualidade 0 ou 1 e NDVI de −0,2 a 1."""
    records = []
    for day, product in season_dates(years):
        raw, quality = _value(row, col, day, product)
        if quality in (0, 1) and -2000 <= raw <= 10000:
            records.append((day, round(raw * 0.0001, 4), quality))
    return records


# --- dry-run ------------------------------------------------------------------------------------


def test_should_only_show_the_plan_on_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = _run(_args(tmp_path, PILOT_AREA, "--dry-run"), _no_network)

    out = capsys.readouterr().out
    assert code == 0
    assert "12 ladrilhos (0 prontos, 12 a baixar) × 80 pedidos = 960 pedidos" in out
    assert "faltam 960" in out
    assert "721 × 880 pixels" in out
    assert "270 composições" in out
    assert "5,3 h com 2 em paralelo" in out  # 960 × 40 s ÷ 2
    assert not (tmp_path / "area").exists()
    assert not (tmp_path / "cache").exists()


def test_should_use_the_product_area_by_default(capsys: pytest.CaptureFixture[str]) -> None:
    assert _run(["--dry-run"], _no_network) == 0

    out = capsys.readouterr().out
    box = PILOT_BOX
    assert f"lat {box.lat_min:g} a {box.lat_max:g}, lon {box.lon_min:g} a {box.lon_max:g}" in out


def test_should_count_ready_tiles_and_cached_requests_on_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    argv = _args(tmp_path, SMALL_AREA, "--km", "1", "--anos", "2017", "--paralelo", "1")
    ornl = FakeAreaOrnl(fail=lambda r: len(ornl.requests) > 8)
    assert _run(argv, ornl) == 2  # o 1º ladrilho fica pronto; o 2º não recebe nada

    capsys.readouterr()
    assert _run([*argv, "--dry-run"], _no_network) == 0

    out = capsys.readouterr().out
    assert "2 ladrilhos (1 pronto, 1 a baixar) × 8 pedidos = 16 pedidos" in out
    assert "faltam 8" in out


# --- download, compactação, índice e retomada ---------------------------------------------------


def test_should_download_compact_and_index_the_tiles_then_resume_from_them(tmp_path: Path) -> None:
    argv = _args(tmp_path, SMALL_AREA, "--km", "1", "--anos", "2017")
    ornl = FakeAreaOrnl()

    assert _run(argv, ornl) == 0
    assert len(ornl.requests) == 16  # 2 ladrilhos de 9 × 9 pixels × 8 pedidos

    index = tmp_path / "area" / "ndvi_modis_area.json"
    repository = GridNdviRepository(index)
    records = repository.get_ndvi_history(*FAZENDA)
    assert [(r.data, r.ndvi, r.qualidade) for r in records] == _expected_records(
        *global_pixel(*FAZENDA), range(2017, 2018)
    )
    assert {r.produto for r in records} == {"MOD13Q1", "MYD13Q1"}

    payload = json.loads(index.read_text(encoding="utf-8"))
    assert len(payload["ladrilhos"]) == 2
    assert len(payload["datas"]) == 27
    assert payload["area"] == {"lat_min": -18.97, "lat_max": -18.95, "lon_min": -48.205,
                               "lon_max": -48.195}  # fmt: skip
    data_run = repository.get_data_run()
    assert data_run is not None
    assert (data_run.source, data_run.version) == ("modis_mod13q1", "2026.11-modis-ndvi-area")
    params = data_run.params
    assert params["servico"] == "ornl_daac"
    assert params["tipo"] == "ndvi_area"
    assert params["anos"] == [2017, 2017]
    assert params["fator_escala"] == 0.0001
    assert (params["ladrilhos_planejados"], params["ladrilhos_prontos"]) == (2, 2)
    assert params["completo"] is True
    for tile in payload["ladrilhos"]:
        header = read_tile_header(index.parent / tile["arquivo"])
        assert (header.nrows, header.ncols, header.ndates) == (9, 9, 27)

    first = index.read_bytes()
    assert _run(argv, _no_network) == 0  # os 2 já estão prontos: nenhum pedido
    assert json.loads(index.read_bytes())["ladrilhos"] == json.loads(first)["ladrilhos"]


def test_should_start_with_the_tile_nearest_the_center_of_the_area(tmp_path: Path) -> None:
    ornl = FakeAreaOrnl()

    assert _run(_args(tmp_path, NINE_TILES_AREA, "--km", "1", "--anos", "2017",
                      "--paralelo", "1"), ornl) == 0  # fmt: skip

    first = ornl.requests[0].params
    box = Box(-18.98, -18.94, -48.22, -48.18)
    nearest = plan_area_tiles(box, 1)[0]
    assert (first["latitude"], first["longitude"]) == (nearest.center.lat, nearest.center.lon)
    assert len(plan_area_tiles(box, 1)) == 9
    center = global_pixel((box.lat_min + box.lat_max) / 2, (box.lon_min + box.lon_max) / 2)
    assert abs(nearest.row - center[0]) <= 4 and abs(nearest.col - center[1]) <= 4


def test_should_resume_a_tile_from_the_requests_already_in_the_cache(tmp_path: Path) -> None:
    argv = _args(tmp_path, SMALL_AREA, "--km", "1", "--anos", "2017", "--paralelo", "1",
                 "--tentativas", "1")  # fmt: skip
    broken = FakeAreaOrnl(fail=lambda r: r.params["band"] == QUALITY_BAND and "MYD" in r.url)

    assert _run(argv, broken) == 2
    assert not (tmp_path / "area" / "ndvi_modis_area.json").exists()  # nenhum ladrilho pronto

    healthy = FakeAreaOrnl()
    assert _run(argv, healthy) == 0
    # Cada ladrilho parou no 1º pedido que falhou (a qualidade do 1º bloco do Aqua), com 5 no
    # cache: faltam esse e os 2 do 2º bloco do Aqua, em cada um.
    assert len(healthy.requests) == 6
    assert all("MYD" in r.url for r in healthy.requests)


def test_should_index_each_tile_as_soon_as_it_is_compacted(tmp_path: Path) -> None:
    argv = _args(tmp_path, SMALL_AREA, "--km", "1", "--anos", "2017", "--paralelo", "1",
                 "--tentativas", "1")  # fmt: skip
    ornl = FakeAreaOrnl(fail=lambda r: len(ornl.requests) > 8)
    logs: list[str] = []

    assert _run(argv, ornl, logs) == 2

    index = tmp_path / "area" / "ndvi_modis_area.json"
    payload = json.loads(index.read_text(encoding="utf-8"))
    assert len(payload["ladrilhos"]) == 1
    assert payload["versao_dados"]["parametros"]["completo"] is False
    assert any("rode de novo" in line for line in logs)
    first_tile = plan_area_tiles(Box(-18.97, -18.95, -48.205, -48.195), 1)[0]
    lat, lon = pixel_center(first_tile.row, first_tile.col)
    assert GridNdviRepository(index).get_ndvi_history(lat, lon) != []


def test_should_reuse_the_cache_when_the_dates_per_request_change(tmp_path: Path) -> None:
    base = _args(tmp_path, SMALL_AREA, "--km", "1", "--anos", "2017", "--paralelo", "1",
                 "--tentativas", "1")  # fmt: skip
    # Com 10 datas por pedido, só o 1º bloco do Terra (7 datas, NDVI e qualidade) responde.
    broken = FakeAreaOrnl(fail=lambda r: "MYD" in r.url or r.params["startDate"] != "A2017001")
    assert _run(base, broken) == 2

    healthy = FakeAreaOrnl()
    assert _run([*base, "--datas-por-pedido", "5"], healthy) == 0

    terra = [r for r in healthy.requests if "MOD" in r.url]
    aqua = [r for r in healthy.requests if "MYD" in r.url]
    assert len(terra) == 8  # por ladrilho, as 7 datas que faltam: 4 + 3, × 2 bandas
    assert all(r.params["startDate"] != "A2017001" for r in terra)
    assert len(aqua) == 12  # por ladrilho, 13 datas: 5 + 4 + 4, × 2 bandas


def test_should_delete_the_raw_cache_of_a_tile_after_compacting_it(tmp_path: Path) -> None:
    argv = _args(tmp_path, SMALL_AREA, "--km", "1", "--anos", "2017", "--apagar-cache")

    assert _run(argv, FakeAreaOrnl()) == 0

    assert not any((tmp_path / "cache").glob("*/*.json.gz"))
    assert GridNdviRepository(tmp_path / "area" / "ndvi_modis_area.json").get_ndvi_history(*FAZENDA)


@pytest.mark.parametrize(
    "tamper",
    [
        lambda payload: payload.update(band="250m_16_days_EVI"),
        lambda payload: payload.update(xllcorner=str(float(payload["xllcorner"]) + 100.0)),
    ],
    ids=["banda trocada", "fora da grade"],
)
def test_should_not_cache_a_response_out_of_the_format(tmp_path: Path, tamper) -> None:  # type: ignore[no-untyped-def]
    argv = _args(tmp_path, SMALL_AREA, "--km", "1", "--anos", "2017", "--paralelo", "1")
    logs: list[str] = []

    assert _run(argv, FakeAreaOrnl(tamper=tamper), logs) == 2

    assert not any((tmp_path / "cache").glob("*/*.json.gz"))
    assert not (tmp_path / "area" / "ndvi_modis_area.json").exists()


def test_should_stop_after_three_tiles_in_a_row_without_answer(tmp_path: Path) -> None:
    argv = _args(tmp_path, NINE_TILES_AREA, "--km", "1", "--anos", "2017", "--paralelo", "1",
                 "--tentativas", "1")  # fmt: skip
    down = AlwaysDown()
    logs: list[str] = []

    assert _run(argv, down, logs) == 2

    assert down.calls == 3  # um pedido por ladrilho, e para no 3º seguido
    assert any("fora do ar" in line for line in logs)
    assert not (tmp_path / "area").exists()


# --- paridade com o modo por ponto --------------------------------------------------------------


def _bands_payload() -> dict[str, Any]:
    return {
        "bands": [
            {"band": ORNL_NDVI_BAND, "scale_factor": "0.0001", "fill_value": "-3000"},
            {"band": ORNL_QUALITY_BAND, "fill_value": "-1"},
        ]
    }


class FakePointOrnl:
    """A ORNL do modo por ponto (`fetch_ndvi --fonte ornl`): bandas, datas e recortes de um pixel
    com todas as bandas, com os mesmos valores do `FakeAreaOrnl`."""

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        path = urllib.parse.urlparse(request.url).path
        product, endpoint = path.rstrip("/").split("/")[-2:]
        if endpoint == "bands":
            return HttpResponse(200, json.dumps(_bands_payload()).encode())
        calendar = modis_calendar(product)
        if endpoint == "dates":
            dates = [
                {"modis_date": d, "calendar_date": _from_modis(d).isoformat()} for d in calendar
            ]
            return HttpResponse(200, json.dumps({"dates": dates}).encode())
        params = request.params
        row, col = global_pixel(params["latitude"], params["longitude"])
        items = []
        for modis in calendar:
            if not params["startDate"] <= modis <= params["endDate"]:
                continue
            values = _value(row, col, _from_modis(modis), product)
            for band, value in zip((ORNL_NDVI_BAND, ORNL_QUALITY_BAND), values, strict=True):
                items.append({"modis_date": modis, "calendar_date": _from_modis(modis).isoformat(),
                              "band": band, "data": [value]})  # fmt: skip
        payload = {"nrows": 1, "ncols": 1, "band": "all", "subset": items}
        return HttpResponse(200, json.dumps(payload).encode())


def test_should_give_the_same_records_as_the_point_mode_for_the_same_pixel(tmp_path: Path) -> None:
    neighbor = pixel_center(52297, 64519)  # outro pixel do mesmo ladrilho, a ~330 m
    points = f"--pontos={FAZENDA[0]},{FAZENDA[1]};{neighbor[0]},{neighbor[1]}"
    point_file = tmp_path / "ponto" / "ndvi.json"
    code = fetch_ndvi.run(
        ["--fonte", "ornl", points, "--saida", str(point_file), "--pausa", "0"],
        transport=FakePointOrnl(),
        load_credentials=lambda: pytest.fail("a ORNL não usa credencial"),
        sleep=lambda _: None,
        now=lambda: FINISHED_AT,
        log=lambda _msg: None,
    )
    assert code == 0
    assert _run(_args(tmp_path, SMALL_AREA, "--km", "1"), FakeAreaOrnl()) == 0

    by_point = CachedNdviRepository(point_file)
    by_area = GridNdviRepository(tmp_path / "area" / "ndvi_modis_area.json")
    for lat, lon in (FAZENDA, neighbor):
        expected = by_point.get_ndvi_history(lat, lon)
        assert len(expected) > 100
        assert by_area.get_ndvi_history(lat, lon) == expected
