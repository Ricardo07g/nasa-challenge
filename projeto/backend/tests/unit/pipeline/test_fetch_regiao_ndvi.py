"""Testes do script da região pelo satélite (P3) pela ORNL DAAC, com HTTP falso (sem rede real).

Os valores de NDVI, qualidade e uso do solo aqui são de teste, não dados do MODIS. Os únicos
números reais são o cabeçalho de um recorte da ORNL (posição e tamanho do pixel), usados para
conferir a conta da projeção.
"""

import gzip
import json
import math
from dataclasses import replace
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from app.models.data_run import DataRun
from app.models.regiao import RegiaoAno, RegiaoSatelite
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.regiao_repository import FileRegionRepository
from app.repositories.rules_repository import load_default_rules
from app.services.region_service import RegionClassifier
from pipeline.fetch_ndvi import Point
from pipeline.fetch_regiao_ndvi import (
    DEFAULT_CENTER,
    LAND_COVER_PRODUCT,
    MODIS_250M_PIXEL_M,
    NDVI_BAND,
    QUALITY_BAND,
    SINUSOIDAL_RADIUS_M,
    Grid,
    OrnlClient,
    OrnlError,
    SubsetCache,
    SubsetRequest,
    build_plan,
    build_region_payload,
    chunked,
    circle_indices,
    composite_dates,
    count_region_year,
    cropland_indices_by_year,
    mask_year,
    modis_date,
    parse_subset,
    run,
    sinusoidal_to_latlon,
    subset_km,
)

FINISHED_AT = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)
CELL = MODIS_250M_PIXEL_M
CELL_500 = 2 * MODIS_250M_PIXEL_M
RULES = load_default_rules()


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
                {
                    "modis_date": modis_date(day),
                    "calendar_date": day.isoformat(),
                    "band": band,
                    "tile": "h13v10",
                    "data": data,
                }
                for day, data in layers.items()
            ],
        }
    ).encode("utf-8")


def _sinusoidal(point: Point) -> tuple[float, float]:
    lat, lon = math.radians(point.lat), math.radians(point.lon)
    return SINUSOIDAL_RADIUS_M * lon * math.cos(lat), SINUSOIDAL_RADIUS_M * lat


# --- datas e plano dos pedidos --------------------------------------------------------------


def test_should_list_terra_and_aqua_composites_of_the_offseason_window() -> None:
    # Conferido na ORNL (MOD13Q1 e MYD13Q1 de abril a julho de 2016): Aqua defasado 8 dias.
    assert composite_dates("MOD13Q1", 2016, "04-01", "07-31") == [
        date(2016, 4, 6),
        date(2016, 4, 22),
        date(2016, 5, 8),
        date(2016, 5, 24),
        date(2016, 6, 9),
        date(2016, 6, 25),
        date(2016, 7, 11),
        date(2016, 7, 27),
    ]
    assert composite_dates("MYD13Q1", 2016, "04-01", "07-31") == [
        date(2016, 4, 14),
        date(2016, 4, 30),
        date(2016, 5, 16),
        date(2016, 6, 1),
        date(2016, 6, 17),
        date(2016, 7, 3),
        date(2016, 7, 19),
    ]
    # Fora do ano bissexto, o dia 97 é 7 de abril.
    assert composite_dates("MOD13Q1", 2017, "04-01", "07-31")[0] == date(2017, 4, 7)


def test_should_split_dates_in_groups_of_at_most_ten() -> None:
    days = [date(2016, 1, 1 + i) for i in range(23)]

    assert [len(group) for group in chunked(days)] == [10, 10, 3]


def test_should_write_modis_dates_as_year_and_day_of_year() -> None:
    assert modis_date(date(2016, 4, 6)) == "A2016097"
    assert modis_date(date(2025, 1, 1)) == "A2025001"


def test_should_ask_for_a_box_that_covers_the_whole_radius() -> None:
    # A ORNL conta o km como pixels de 250 m, mas o pixel tem 231,66 m: 30 km pedem 33.
    assert subset_km(30.0) == 33
    assert subset_km(30.0) / 0.25 * CELL >= 30_000


def test_should_plan_one_request_per_year_product_and_band_plus_the_land_cover() -> None:
    plan = build_plan(RULES.historico_ndvi)

    ndvi = [r for r in plan if r.product != LAND_COVER_PRODUCT]
    land_cover = [r for r in plan if r.product == LAND_COVER_PRODUCT]
    assert len(plan) == 41
    assert len(ndvi) == 10 * 2 * 2
    assert plan[0] == SubsetRequest("MOD13Q1", NDVI_BAND, date(2016, 4, 6), date(2016, 7, 27), 8)
    assert plan[1] == replace(plan[0], band=QUALITY_BAND)
    assert land_cover == [
        SubsetRequest(LAND_COVER_PRODUCT, "LC_Type1", date(2016, 1, 1), date(2025, 1, 1), 10)
    ]
    assert all(r.n_dates <= 10 for r in plan)


def test_should_split_a_longer_window_into_requests_of_up_to_ten_dates() -> None:
    longer = replace(RULES.historico_ndvi, janela_inicio="01-01", janela_fim="08-31")

    plan = build_plan(replace(longer, ano_inicio=2020, ano_fim=2020))

    terra = [r for r in plan if r.product == "MOD13Q1" and r.band == NDVI_BAND]
    assert [(r.start, r.end, r.n_dates) for r in terra] == [
        (date(2020, 1, 1), date(2020, 5, 24), 10),
        (date(2020, 6, 9), date(2020, 8, 28), 6),
    ]


# --- cliente da ORNL ------------------------------------------------------------------------


class FakeTransport:
    """Devolve as respostas na ordem; uma exceção na lista é levantada (falha de rede)."""

    def __init__(self, responses: list[HttpResponse | Exception]) -> None:
        self._responses = list(responses)
        self.requests: list[HttpRequest] = []

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.requests.append(request)
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


REQUEST = SubsetRequest("MOD13Q1", NDVI_BAND, date(2016, 4, 6), date(2016, 7, 27), 8)


def _client(transport: FakeTransport, sleeps: list[float] | None = None) -> OrnlClient:
    waits = sleeps if sleeps is not None else []
    return OrnlClient(transport, sleep=waits.append, log=lambda _: None)


def test_should_ask_the_subset_of_the_box_around_the_point_and_unzip_the_answer() -> None:
    body = b'{"subset": []}'
    transport = FakeTransport([HttpResponse(200, gzip.compress(body))])

    raw = _client(transport).fetch_subset(REQUEST, DEFAULT_CENTER, 33)

    assert raw == body
    (request,) = transport.requests
    assert request.url == "https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset"
    assert dict(request.params) == {
        "latitude": -18.9543,
        "longitude": -48.1993,
        "band": NDVI_BAND,
        "startDate": "A2016097",
        "endDate": "A2016209",
        "kmAboveBelow": 33,
        "kmLeftRight": 33,
    }
    assert request.headers["Accept-Encoding"] == "gzip"


def test_should_accept_an_answer_that_is_not_zipped() -> None:
    transport = FakeTransport([HttpResponse(200, b'{"subset": []}')])

    assert _client(transport).fetch_subset(REQUEST, DEFAULT_CENTER, 33) == b'{"subset": []}'


def test_should_try_again_after_502_or_network_failure() -> None:
    sleeps: list[float] = []
    transport = FakeTransport(
        [HttpResponse(502, b"Bad Gateway"), TimeoutError("lento"), HttpResponse(200, b"{}")]
    )

    assert _client(transport, sleeps).fetch_subset(REQUEST, DEFAULT_CENTER, 33) == b"{}"
    assert len(transport.requests) == 3
    assert sleeps == [30.0, 60.0]


def test_should_give_up_after_the_last_attempt() -> None:
    transport = FakeTransport([HttpResponse(503, b"fora")] * 5)

    with pytest.raises(OrnlError, match="5 tentativas"):
        _client(transport).fetch_subset(REQUEST, DEFAULT_CENTER, 33)


def test_should_not_retry_a_refused_request() -> None:
    transport = FakeTransport([HttpResponse(400, b"Invalid band")])

    with pytest.raises(OrnlError, match="Invalid band"):
        _client(transport).fetch_subset(REQUEST, DEFAULT_CENTER, 33)
    assert len(transport.requests) == 1


# --- cache -------------------------------------------------------------------------------------


def test_should_keep_each_answer_zipped_in_the_cache_folder(tmp_path: Path) -> None:
    cache = SubsetCache(tmp_path / "cache")

    assert cache.get("pedido.json.gz") is None
    cache.put("pedido.json.gz", b'{"subset": []}')

    assert cache.get("pedido.json.gz") == b'{"subset": []}'
    stored = (tmp_path / "cache" / "pedido.json.gz").read_bytes()
    assert gzip.decompress(stored) == b'{"subset": []}'
    assert [p.name for p in (tmp_path / "cache").iterdir()] == ["pedido.json.gz"]


def test_should_name_the_cache_by_product_band_dates_point_and_box() -> None:
    assert REQUEST.cache_name(DEFAULT_CENTER, 33) == (
        "MOD13Q1_250m_16_days_NDVI_20160406_20160727_-18.9543_-48.1993_33km.json.gz"
    )


# --- grade e projeção --------------------------------------------------------------------------


def test_should_read_the_grid_and_one_layer_per_date() -> None:
    grid = Grid(xll=-100.0, yll=-200.0, cellsize=CELL, nrows=2, ncols=3)
    raw = _subset_json(grid, NDVI_BAND, {date(2016, 4, 6): [1, 2, 3, 4, 5, 6]})

    subset = parse_subset(raw)

    assert subset.grid == grid
    assert list(subset.layers) == [date(2016, 4, 6)]
    assert list(subset.layers[date(2016, 4, 6)]) == [1, 2, 3, 4, 5, 6]


def test_should_refuse_a_layer_with_the_wrong_number_of_pixels() -> None:
    grid = Grid(xll=0.0, yll=0.0, cellsize=CELL, nrows=2, ncols=2)

    with pytest.raises(OrnlError, match="pixels"):
        parse_subset(_subset_json(grid, NDVI_BAND, {date(2016, 4, 6): [1, 2, 3]}))


def test_should_number_pixels_row_by_row_from_the_top_left_corner() -> None:
    # Conferido com um recorte real da ORNL: os valores vêm do canto de cima à esquerda.
    grid = Grid(xll=0.0, yll=0.0, cellsize=10.0, nrows=2, ncols=3)

    assert grid.center_xy(0) == (5.0, 15.0)
    assert grid.center_xy(5) == (25.0, 5.0)
    assert grid.index_at(25.0, 5.0) == 5
    assert grid.index_at(5.0, 15.0) == 0
    assert grid.index_at(31.0, 5.0) is None
    assert grid.index_at(5.0, -1.0) is None


def test_should_convert_the_modis_sinusoidal_projection_to_lat_lon() -> None:
    # Cabeçalho real da ORNL: recorte de 9 × 9 pixels centrado na fazenda de exemplo.
    grid = Grid(xll=-5070031.09, yll=-2108767.79, cellsize=CELL, nrows=9, ncols=9)

    lat, lon = sinusoidal_to_latlon(*grid.center_xy(40))

    assert lat == pytest.approx(-18.9543, abs=0.0025)
    assert lon == pytest.approx(-48.1993, abs=0.0025)
    assert sinusoidal_to_latlon(0.0, 0.0) == (0.0, 0.0)


def test_should_keep_only_pixels_whose_center_is_inside_the_radius() -> None:
    # 5 × 5 pixels de 1 km no equador: com raio de 1,2 km ficam o centro e os 4 vizinhos.
    grid = Grid(xll=-2500.0, yll=-2500.0, cellsize=1000.0, nrows=5, ncols=5)

    assert circle_indices(grid, Point(0.0, 0.0), 1.2) == [7, 11, 12, 13, 17]


# --- máscara de lavoura ------------------------------------------------------------------------


def test_should_pick_the_cropland_pixels_of_each_year() -> None:
    grid = Grid(xll=0.0, yll=0.0, cellsize=CELL_500, nrows=1, ncols=3)
    raw = _subset_json(
        grid, "LC_Type1", {date(2016, 1, 1): [12, 10, 12], date(2017, 1, 1): [14, 12, 255]}
    )

    by_year = cropland_indices_by_year(parse_subset(raw))

    # Só a classe 12 (lavouras) do IGBP; a 14 (mosaico com vegetação natural) fica de fora.
    assert by_year == {2016: frozenset({0, 2}), 2017: frozenset({1})}


def test_should_use_the_latest_land_cover_year_up_to_the_offseason_year() -> None:
    available = range(2016, 2025)

    assert mask_year(2020, available) == 2020
    assert mask_year(2025, available) == 2024
    assert mask_year(2015, available) == 2016
    assert mask_year(2020, []) is None


# --- contagem de um ano ------------------------------------------------------------------------

# NDVI de 2 × 4 pixels no equador; uso do solo de 1 × 2 pixels de 500 m por cima dele. A coluna
# de 500 m da esquerda (pixels de 250 m 0, 1, 4 e 5) é lavoura; a da direita, não.
NDVI_GRID = Grid(xll=0.0, yll=0.0, cellsize=CELL, nrows=2, ncols=4)
LAND_COVER_GRID = Grid(xll=0.0, yll=0.0, cellsize=CELL_500, nrows=1, ncols=2)
CROPLAND = frozenset({0})
CENTER = Point(0.002, 0.004)
DAYS = [date(2022, 4, 7), date(2022, 5, 9), date(2022, 6, 10)]


def _layers(band: str, by_pixel: dict[int, list[int]], fill: int) -> bytes:
    """Uma camada por data; `by_pixel[i]` = os valores do pixel i nas datas (os outros, `fill`)."""
    layers = {
        day: [by_pixel.get(i, [fill] * len(DAYS))[k] for i in range(8)]
        for k, day in enumerate(DAYS)
    }
    return _subset_json(NDVI_GRID, band, layers)


def test_should_count_cropland_pixels_inside_the_radius_by_offseason_situation() -> None:
    ndvi = _layers(
        NDVI_BAND,
        {
            0: [7200, 2200, 2500],  # plantou
            1: [3000, 2200, 2500],  # parado
            4: [6000, 2200, 2500],  # 0,6 no limite: incerto (sem ruído de float)
            5: [9000, 9000, 9000],  # tudo nuvem: sem_dado
        },
        fill=8000,
    )
    quality = _layers(QUALITY_BAND, {5: [3, 3, 3]}, fill=0)

    counts = count_region_year(
        2022,
        [(parse_subset(ndvi), parse_subset(quality))],
        LAND_COVER_GRID,
        CROPLAND,
        CENTER,
        1.0,
        RegionClassifier(RULES),
    )

    assert counts == {"plantou": 1, "parado": 1, "incerto": 1, "sem_dado": 1}


def test_should_drop_fill_values_and_join_terra_and_aqua_observations() -> None:
    # Pixel 0: Terra tem 2 observações boas e um -3000 (sem dado); o Aqua completa a terceira.
    terra_ndvi = _layers(NDVI_BAND, {0: [3000, -3000, 2500]}, fill=3000)
    aqua_ndvi = _layers(NDVI_BAND, {0: [2000, 2000, 2000]}, fill=3000)
    aqua_quality = _layers(QUALITY_BAND, {0: [0, 2, 2]}, fill=0)
    terra_quality = _layers(QUALITY_BAND, {}, fill=0)
    pairs = [
        (parse_subset(terra_ndvi), parse_subset(terra_quality)),
        (parse_subset(aqua_ndvi), parse_subset(aqua_quality)),
    ]

    counts = count_region_year(
        2022, pairs, LAND_COVER_GRID, frozenset({0}), CENTER, 1.0, RegionClassifier(RULES)
    )

    assert counts == {"parado": 4}


def test_should_count_nothing_when_no_pixel_is_cropland() -> None:
    ndvi = parse_subset(_layers(NDVI_BAND, {}, fill=7000))
    quality = parse_subset(_layers(QUALITY_BAND, {}, fill=0))

    counts = count_region_year(
        2022, [(ndvi, quality)], LAND_COVER_GRID, frozenset(), CENTER, 1.0, RegionClassifier(RULES)
    )

    assert counts == {}


# --- arquivo do contrato -----------------------------------------------------------------------


def test_should_write_the_contract_file_that_the_api_reads(tmp_path: Path) -> None:
    region = RegiaoSatelite(
        lat=-18.9543,
        lon=-48.1993,
        raio_km=30.0,
        fonte="MODIS MOD13Q1 + MYD13Q1",
        mascara="MCD12Q1 LC_Type1 classe 12 (lavouras)",
        anos=(
            RegiaoAno(2016, 1372, 60.5, 30.6, 8.9, 2.2),
            RegiaoAno(2017, 0, None, None, None, None),
        ),
    )

    payload = build_region_payload([region], {"raio_km": 30.0}, FINISHED_AT)
    path = tmp_path / "regiao.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    assert payload["versao_dados"] == {
        "fonte": "modis_mod13q1",
        "parametros": {"raio_km": 30.0},
        "fim": "2026-11-14T13:00:00Z",
        "versao": "2026.11-modis-ndvi-regiao",
    }
    assert payload["regioes"][0]["anos"][1]["pct_parado"] is None
    assert FileRegionRepository(path).list_regions() == [region]
    assert FileRegionRepository(path).get_data_run() == DataRun(
        source="modis_mod13q1",
        params={"raio_km": 30.0},
        finished_at=FINISHED_AT,
        version="2026.11-modis-ndvi-regiao",
    )


# --- linha de comando --------------------------------------------------------------------------


def _date_from_modis(text: str) -> date:
    year, doy = int(text[1:5]), int(text[5:])
    return date.fromordinal(date(year, 1, 1).toordinal() + doy - 1)


class FakeOrnl:
    """Responde a qualquer `/subset` com uma grade de 2 × 2 pixels em volta do centro pedido.

    NDVI 0,72 com qualidade boa em todas as datas (plantou) e lavoura (classe 12) em tudo.
    """

    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.calls += 1
        params = request.params
        product = request.url.rsplit("/", 2)[-2]
        x0, y0 = _sinusoidal(Point(params["latitude"], params["longitude"]))
        start, end = _date_from_modis(params["startDate"]), _date_from_modis(params["endDate"])
        if product == LAND_COVER_PRODUCT:
            grid = Grid(xll=x0 - CELL, yll=y0 - CELL, cellsize=CELL_500, nrows=1, ncols=1)
            days = [date(y, 1, 1) for y in range(start.year, end.year + 1)]
            return HttpResponse(200, _subset_json(grid, params["band"], {d: [12] for d in days}))
        grid = Grid(xll=x0 - CELL, yll=y0 - CELL, cellsize=CELL, nrows=2, ncols=2)
        days = [
            d for d in composite_dates(product, start.year, "01-01", "12-31") if start <= d <= end
        ]
        value = 7200 if params["band"] == NDVI_BAND else 0
        body = _subset_json(grid, params["band"], {d: [value] * 4 for d in days})
        return HttpResponse(200, gzip.compress(body))


def _no_network(request: HttpRequest, timeout: float) -> HttpResponse:
    raise AssertionError(f"pedido inesperado: {request.url}")


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
    code = _run(["--dry-run", "--saida", str(tmp_path / "regiao.json")], _no_network)

    assert code == 0
    assert "41 pedidos" in capsys.readouterr().out
    assert not (tmp_path / "regiao.json").exists()


def test_should_download_classify_and_write_the_region_then_resume_from_the_cache(
    tmp_path: Path,
) -> None:
    output = tmp_path / "regiao.json"
    argv = [
        "--centros",
        "-18.9543,-48.1993",
        "--raio-km",
        "1",
        "--saida",
        str(output),
        "--cache",
        str(tmp_path / "cache"),
    ]
    ornl = FakeOrnl()

    assert _run(argv, ornl) == 0
    assert ornl.calls == 41
    (region,) = FileRegionRepository(output).list_regions()
    assert (region.lat, region.lon, region.raio_km) == (-18.9543, -48.1993, 1.0)
    assert region.fonte == "MODIS MOD13Q1 + MYD13Q1"
    assert region.mascara == "MCD12Q1 LC_Type1 classe 12 (lavouras)"
    assert [a.ano for a in region.anos] == list(range(2016, 2026))
    assert region.anos[0] == RegiaoAno(2016, 4, 0.0, 100.0, 0.0, 0.0)
    params = FileRegionRepository(output).get_data_run().params
    assert params["servico"] == "ornl_daac"
    assert params["mascara"]["classes"] == [12]
    assert params["pedidos"] == 41

    first = output.read_text(encoding="utf-8")
    output.unlink()
    assert _run(argv, _no_network) == 0  # tudo do cache, nenhum pedido
    assert output.read_text(encoding="utf-8") == first


def test_should_stop_with_a_hint_to_resume_when_the_ornl_keeps_failing(tmp_path: Path) -> None:
    logs: list[str] = []
    always_down = FakeTransport([HttpResponse(502, b"Bad Gateway")] * 5)
    argv = ["--saida", str(tmp_path / "regiao.json"), "--cache", str(tmp_path / "cache")]

    assert _run(argv, always_down, logs) == 1
    assert any("de novo" in line and "cache" in line for line in logs)
    assert not (tmp_path / "regiao.json").exists()
