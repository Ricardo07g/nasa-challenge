"""Testes do script do SMAP L4 por recorte no OPeNDAP da Earthdata (R2.3, tarefa 0029).

Nada de rede: o CMR e o OPeNDAP são falsos. A grade falsa (`FakeEarthdata`) é de teste: latitude
linear por linha e valores redondos por variável e hora, com o nome `TESTE` nos granulos e na
coleção. Os únicos trechos de dado real são os `REAL_*`, copiados de respostas de verdade do CMR
(públicas, 14/11/2026) e do OPeNDAP (pedido do orquestrador com o token), marcados como tal.
"""

import json
import re
import urllib.error
import urllib.parse
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.config import Settings
from app.constants import SOWING_MONTH_DAY_BY_HARVEST
from app.models.climate import SmapSoilMoisture
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.smap_repository import FileSmapRepository
from pipeline import fetch_smap
from pipeline.fetch_smap import (
    DATA_VARIABLES,
    GRID_COLUMNS,
    GRID_ROWS,
    LAT_VARIABLE,
    LON_VARIABLE,
    PILOT_BOX,
    Box,
    EarthdataTextGetter,
    Granule,
    Pixel,
    PixelWindow,
    Point,
    SmapOpendapClient,
    SubsetTask,
    TokenRejectedError,
    box_cell_centers,
    build_smap_file,
    cmr_params,
    daily_mean,
    dap_csv_url,
    dmr_url,
    nearest_pixel,
    parse_cmr_granules,
    parse_dap_csv,
    parse_dmr,
    pixel_window_for,
    sowing_days,
)
from pipeline.preload_pilot_box import pilot_box_cells

# --- trechos reais -----------------------------------------------------------------------------

# Recorte DAP4 em CSV feito pelo orquestrador com o token (resposta inteira, 1,7 s):
# GET <granulo>.dap.csv?dap4.ce=/Geophysical_Data/sm_rootzone%5B1000:1:1001%5D%5B1300:1:1301%5D
REAL_OPENDAP_URL = (
    "https://opendap.earthdata.nasa.gov/collections/C3480440870-NSIDC_CPRD/granules/"
    "SMAP_L4_SM_gph_20240215T103000_Vv8012_001.h5_u9loH5HD"
)
REAL_DAP_CSV_URL = (
    f"{REAL_OPENDAP_URL}.dap.csv?dap4.ce="
    "/Geophysical_Data/sm_rootzone%5B1000:1:1001%5D%5B1300:1:1301%5D"
)
REAL_DAP_CSV_SAMPLE = (
    "Dataset: SMAP_L4_SM_gph_20240215T103000_Vv8012_001.h5\n"
    "/Geophysical_Data/sm_rootzone[0], 0.126498, 0.131564\n"
    "/Geophysical_Data/sm_rootzone[1], 0.125674, 0.125826\n"
)
REAL_SAMPLE_WINDOW = PixelWindow(row_first=1000, row_last=1001, col_first=1300, col_last=1301)


def _real_entry(name: str, title: str, start: str, end: str, opendap: str) -> dict[str, Any]:
    folder = f"{name[15:19]}/{name[19:21]}/{name[21:23]}"
    return {
        "producer_granule_id": name,
        "title": title,
        "time_start": start,
        "time_end": end,
        "collection_concept_id": "C3480440870-NSIDC_CPRD",
        "links": [
            {
                "rel": "http://esipfed.org/ns/fedsearch/1.1/data#",
                "title": f"Download {name}",
                "hreflang": "en-US",
                "href": "https://data.nsidc.earthdatacloud.nasa.gov/nsidc-cumulus-prod-protected/"
                f"SMAP/SPL4SMGP/008/{folder}/{name}",
            },
            {
                "rel": "http://esipfed.org/ns/fedsearch/1.1/service#",
                "title": "OPeNDAP request URL",
                "hreflang": "en-US",
                "href": opendap,
            },
        ],
    }


_OPENDAP = "https://opendap.earthdata.nasa.gov/collections/C3480440870-NSIDC_CPRD/granules/"
# Busca pública no CMR (14/11/2026), só os campos e links que o script lê. O dia 08/02/2016 trouxe
# 9 granulos: o das 22:30 do dia 7 (termina à 00:00 do dia 8) e os 8 do dia. O título de 2016 não
# tem o sufixo; o de 2024 tem (`_u9loH5HD`), e o link do OPeNDAP é sempre o do título.
REAL_CMR_2016_02_08 = {
    "feed": {
        "entry": [
            _real_entry(
                "SMAP_L4_SM_gph_20160207T223000_Vv8010_001.h5",
                "SMAP_L4_SM_gph_20160207T223000_Vv8010_001.h5",
                "2016-02-07T21:00:00.000Z",
                "2016-02-08T00:00:00.000Z",
                f"{_OPENDAP}SMAP_L4_SM_gph_20160207T223000_Vv8010_001.h5",
            ),
            _real_entry(
                "SMAP_L4_SM_gph_20160208T013000_Vv8010_001.h5",
                "SMAP_L4_SM_gph_20160208T013000_Vv8010_001.h5",
                "2016-02-08T00:00:00.000Z",
                "2016-02-08T03:00:00.000Z",
                f"{_OPENDAP}SMAP_L4_SM_gph_20160208T013000_Vv8010_001.h5",
            ),
        ]
    }
}
REAL_CMR_2024_02_15 = {
    "feed": {
        "entry": [
            _real_entry(
                "SMAP_L4_SM_gph_20240215T103000_Vv8012_001.h5",
                "SMAP_L4_SM_gph_20240215T103000_Vv8012_001.h5_u9loH5HD",
                "2024-02-15T09:00:00.000Z",
                "2024-02-15T12:00:00.000Z",
                REAL_OPENDAP_URL,
            )
        ]
    }
}

# --- servidor falso (grade de teste) ------------------------------------------------------------

TEST_COLLECTION = "C0000000000-TESTE"
TEST_TOKEN = "token-de-teste-nao-real"
HOURS = (1, 4, 7, 10, 13, 16, 19, 22)  # os 8 granulos de 3 h do dia (meio de cada janela)
LON_STEP = 360.0 / GRID_COLUMNS


def grid_lat(row: int) -> float:
    """Latitude falsa do centro da linha (grade de teste, linear)."""
    return 60.0 - 0.075 * row


def grid_lon(col: int) -> float:
    return -180.0 + (col + 0.5) * LON_STEP


def grid_value(variable: str, hour: int, row: int) -> float:
    if variable.endswith("sm_rootzone_wetness"):
        return 0.5 + hour / 1000
    if variable.endswith("sm_rootzone"):
        return 0.25 + (row % 7) / 100
    if hour == 22:
        return -9999.0  # preenchimento: a média do dia pula
    return 0.2 + hour / 10000


def _dmr(
    rows: int = GRID_ROWS,
    cols: int = GRID_COLUMNS,
    rootzone_unit: str = "m3 m-3",
    skip: str = "",
) -> str:
    """DMR (DAP4) montado para o teste no formato do Hyrax, com os nomes e tamanhos conferidos."""

    def variable(name: str, unit: str) -> str:
        if name == skip:
            return ""
        return (
            f'<Float32 name="{name}"><Dim name="/y"/><Dim name="/x"/>'
            f'<Attribute name="units" type="String"><Value>{unit}</Value></Attribute>'
            '<Attribute name="_FillValue" type="Float32"><Value>-9999.</Value></Attribute>'
            "</Float32>"
        )

    return (
        '<?xml version="1.0" encoding="ISO-8859-1"?>\n'
        '<Dataset xmlns="http://xml.opendap.org/ns/DAP/4.0#" dapVersion="4.0" '
        'name="SMAP_L4_SM_gph_TESTE.h5">'
        f'<Dimension name="y" size="{rows}"/><Dimension name="x" size="{cols}"/>'
        + variable("cell_lat", "degrees_north")
        + variable("cell_lon", "degrees_east")
        + '<Group name="Geophysical_Data">'
        + variable("sm_rootzone", rootzone_unit)
        + variable("sm_rootzone_wetness", "dimensionless")
        + variable("sm_surface", "m3 m-3")
        + "</Group></Dataset>"
    )


_CE = re.compile(r"^(?P<var>/[\w/]+)\[(\d+):1:(\d+)\]\[(\d+):1:(\d+)\]$")


class FakeEarthdata:
    """CMR e OPeNDAP falsos: 8 granulos por dia (mais o das 22:30 da véspera) e a grade de teste."""

    def __init__(self, days_without_granules: tuple[date, ...] = ()) -> None:
        self.cmr_calls: list[dict[str, Any]] = []
        self.opendap_calls: list[str] = []
        self.requests: list[HttpRequest] = []
        self.days_without_granules = days_without_granules

    @staticmethod
    def granule_name(day: date, hour: int) -> str:
        return f"SMAP_L4_SM_gph_{day:%Y%m%d}T{hour:02d}3000_Vv8012_001.h5"

    def _entry(self, day: date, hour: int) -> dict[str, Any]:
        name = self.granule_name(day, hour)
        return {
            "producer_granule_id": name,
            "title": f"{name}_sufixoTESTE",
            "time_start": f"{day.isoformat()}T{hour - 1:02d}:30:00.000Z",
            "collection_concept_id": TEST_COLLECTION,
            "links": [
                {
                    "rel": "http://esipfed.org/ns/fedsearch/1.1/service#",
                    "href": "https://opendap.earthdata.nasa.gov/collections/"
                    f"{TEST_COLLECTION}/granules/{name}_sufixoTESTE",
                }
            ],
        }

    def cmr_get(self, url: str, params: dict[str, Any], timeout: float) -> dict[str, Any]:
        self.cmr_calls.append(dict(params))
        day = date.fromisoformat(str(params["temporal"])[:10])
        if day in self.days_without_granules:
            return {"feed": {"entry": []}}
        previous = date.fromordinal(day.toordinal() - 1)
        entries = [self._entry(previous, 22)] + [self._entry(day, hour) for hour in HOURS]
        return {"feed": {"entry": entries}}

    def _csv(self, url: str) -> str:
        base, query = url.split(".dap.csv?dap4.ce=")
        constraint = urllib.parse.unquote(query)
        match = _CE.match(constraint)
        assert match is not None, constraint
        variable = match.group("var")
        r0, r1, c0, c1 = (int(g) for g in match.groups()[1:])
        hour = int(re.search(r"T(\d{2})3000_", base).group(1))  # type: ignore[union-attr]
        lines = [f"Dataset: {base.rsplit('/', 1)[1]}"]
        for i, row in enumerate(range(r0, r1 + 1)):
            if variable == LAT_VARIABLE:
                values = [grid_lat(row) for _ in range(c0, c1 + 1)]
            elif variable == LON_VARIABLE:
                values = [grid_lon(col) for col in range(c0, c1 + 1)]
            else:
                values = [grid_value(variable, hour, row) for _ in range(c0, c1 + 1)]
            lines.append(f"{variable}[{i}], " + ", ".join(f"{v:g}" for v in values))
        return "\n".join(lines) + "\n"

    def opendap_get(self, url: str, params: dict[str, Any], timeout: float) -> str:
        self.opendap_calls.append(url)
        if url.endswith(".dmr"):
            return _dmr()
        return self._csv(url)

    def transport(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.requests.append(request)
        assert request.headers.get("Authorization") == f"Bearer {TEST_TOKEN}"
        return HttpResponse(200, self.opendap_get(request.url, {}, timeout).encode("utf-8"))

    def data_calls(self) -> list[str]:
        return [u for u in self.opendap_calls if "/Geophysical_Data/" in urllib.parse.unquote(u)]


def _client(tmp_path: Path, fake: FakeEarthdata, workers: int = 1) -> SmapOpendapClient:
    return SmapOpendapClient(
        cache_dir=tmp_path / "cache",
        opendap_get=fake.opendap_get,
        cmr_get=fake.cmr_get,
        workers=workers,
        sleep=lambda seconds: None,
    )


FARM_CELL_CENTER = Point(-18.95, -48.15)  # célula -190_-482, a da fazenda de exemplo
FINISHED = datetime(2026, 11, 14, 18, 0, tzinfo=UTC)

# --- dias, células e parâmetros ------------------------------------------------------------------


def test_should_use_the_sowing_day_of_each_harvest_band_of_the_engine() -> None:
    days = sowing_days(2016, 2025)

    assert len(days) == 30
    assert days[:3] == [date(2016, 2, 8), date(2016, 2, 18), date(2016, 3, 3)]
    assert days[-1] == date(2025, 3, 3)
    expected = {(month, day) for month, day in SOWING_MONTH_DAY_BY_HARVEST.values()}
    assert {(d.month, d.day) for d in days} == expected


def test_should_skip_days_before_smap_starts_on_2015_03_31() -> None:
    assert sowing_days(2015, 2016) == [date(2016, 2, 8), date(2016, 2, 18), date(2016, 3, 3)]


def test_should_take_the_225_cell_centers_of_the_pilot_box() -> None:
    points = box_cell_centers(PILOT_BOX)

    assert len(points) == 225
    assert {(p.lat, p.lon) for p in points} == {(c.lat, c.lon) for c in pilot_box_cells()}
    assert FARM_CELL_CENTER in points


def test_should_search_the_granules_of_one_utc_day_of_version_008() -> None:
    assert cmr_params(date(2016, 2, 8)) == {
        "short_name": "SPL4SMGP",
        "version": "008",
        "temporal": "2016-02-08T00:00:00Z,2016-02-08T23:59:59Z",
        "page_size": 50,
    }


def test_should_keep_only_the_granules_of_the_day_with_the_real_opendap_link() -> None:
    granules = parse_cmr_granules(REAL_CMR_2016_02_08, date(2016, 2, 8))

    assert granules == [
        Granule(
            name="SMAP_L4_SM_gph_20160208T013000_Vv8010_001.h5",
            time=datetime(2016, 2, 8, 1, 30, tzinfo=UTC),
            opendap_url=f"{_OPENDAP}SMAP_L4_SM_gph_20160208T013000_Vv8010_001.h5",
            collection="C3480440870-NSIDC_CPRD",
        )
    ]


def test_should_use_the_opendap_link_with_the_suffix_instead_of_building_it() -> None:
    [granule] = parse_cmr_granules(REAL_CMR_2024_02_15, date(2024, 2, 15))

    assert granule.opendap_url == REAL_OPENDAP_URL
    assert granule.science_version == "Vv8012"


def test_should_refuse_a_cmr_answer_without_the_feed() -> None:
    with pytest.raises(ValueError, match="CMR"):
        parse_cmr_granules({"errors": ["erro de teste"]}, date(2016, 2, 8))


def test_should_refuse_a_granule_without_opendap_link() -> None:
    entry = dict(REAL_CMR_2024_02_15["feed"]["entry"][0])
    entry["links"] = entry["links"][:1]  # só o link de download do arquivo inteiro

    with pytest.raises(ValueError, match="OPeNDAP"):
        parse_cmr_granules({"feed": {"entry": [entry]}}, date(2024, 2, 15))


# --- URLs e respostas do OPeNDAP ------------------------------------------------------------------

REAL_GRANULE = Granule(
    name="SMAP_L4_SM_gph_20240215T103000_Vv8012_001.h5",
    time=datetime(2024, 2, 15, 10, 30, tzinfo=UTC),
    opendap_url=REAL_OPENDAP_URL,
    collection="C3480440870-NSIDC_CPRD",
)


def test_should_build_the_same_dap4_csv_url_the_real_request_used() -> None:
    url = dap_csv_url(REAL_GRANULE, "/Geophysical_Data/sm_rootzone", REAL_SAMPLE_WINDOW)

    assert url == REAL_DAP_CSV_URL


def test_should_build_the_dmr_url_of_the_granule() -> None:
    assert dmr_url(REAL_GRANULE) == f"{REAL_OPENDAP_URL}.dmr"


def test_should_parse_the_real_dap4_csv_sample() -> None:
    grid = parse_dap_csv(REAL_DAP_CSV_SAMPLE, "/Geophysical_Data/sm_rootzone", REAL_SAMPLE_WINDOW)

    assert grid == [[0.126498, 0.131564], [0.125674, 0.125826]]


@pytest.mark.parametrize(
    "text",
    [
        "<!DOCTYPE html><html><body>Earthdata Login</body></html>",
        "",
        REAL_DAP_CSV_SAMPLE.replace("sm_rootzone", "sm_surface"),  # outra variável
        REAL_DAP_CSV_SAMPLE.rsplit("/Geophysical_Data", 1)[0],  # pela metade
        REAL_DAP_CSV_SAMPLE.replace(", 0.125826", ""),  # linha com um valor a menos
        REAL_DAP_CSV_SAMPLE.replace("[1]", "[3]"),  # linha fora de ordem
    ],
)
def test_should_refuse_what_is_not_the_requested_subset(text: str) -> None:
    with pytest.raises(ValueError):
        parse_dap_csv(text, "/Geophysical_Data/sm_rootzone", REAL_SAMPLE_WINDOW)


def test_should_read_grid_size_units_and_fill_value_from_the_dmr() -> None:
    structure = parse_dmr(_dmr())

    assert (structure.rows, structure.cols) == (GRID_ROWS, GRID_COLUMNS)
    assert structure.units["/Geophysical_Data/sm_rootzone"] == "m3 m-3"
    assert structure.fill_values["/Geophysical_Data/sm_rootzone_wetness"] == -9999.0


@pytest.mark.parametrize(
    ("dmr", "message"),
    [
        (_dmr(rows=406, cols=964), "1624"),  # grade de 36 km, não a de 9 km
        (_dmr(skip="sm_rootzone_wetness"), "sm_rootzone_wetness"),
        (_dmr(skip="cell_lat"), "cell_lat"),
        (_dmr(rootzone_unit="percent"), "percent"),
        ("<html>Earthdata Login</html>", "DMR"),
    ],
)
def test_should_refuse_a_dmr_that_is_not_the_expected_product(dmr: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        parse_dmr(dmr)


# --- pixel de cada célula -------------------------------------------------------------------------


def test_should_cover_every_point_with_the_nearest_rows_and_columns_plus_a_margin() -> None:
    row_lats = [grid_lat(r) for r in range(GRID_ROWS)]
    col_lons = [grid_lon(c) for c in range(GRID_COLUMNS)]

    window = pixel_window_for(box_cell_centers(PILOT_BOX), row_lats, col_lons, margin=1)

    # -18,45 cai na linha 1046 e -19,85 na 1065; -48,95 na coluna 1403 e -47,55 na 1418.
    assert window == PixelWindow(row_first=1045, row_last=1066, col_first=1402, col_last=1419)


def test_should_not_let_the_margin_leave_the_grid() -> None:
    row_lats = [grid_lat(r) for r in range(GRID_ROWS)]
    col_lons = [grid_lon(c) for c in range(GRID_COLUMNS)]

    window = pixel_window_for([Point(60.0, -179.99)], row_lats, col_lons, margin=2)

    assert (window.row_first, window.col_first) == (0, 0)


def test_should_pick_the_nearest_9km_pixel_of_the_cell_center() -> None:
    window = PixelWindow(1050, 1056, 1410, 1414)
    lat_grid = [[grid_lat(r) for _ in window.cols] for r in window.rows]
    lon_grid = [[grid_lon(c) for c in window.cols] for _ in window.rows]

    pixel = nearest_pixel(FARM_CELL_CENTER, lat_grid, lon_grid, window)

    # linha 1053 (-18,975) está a 0,025° e a 1052 (-18,9) a 0,05°; coluna 1412 (-48,128)
    assert pixel == Pixel(row=1053, col=1412)


def test_should_average_the_day_skipping_fill_and_out_of_range_values() -> None:
    assert daily_mean([0.2, 0.4, -9999.0, float("nan"), 1.5], fill_value=-9999.0) == 0.3
    assert daily_mean([-9999.0, -9999.0], fill_value=-9999.0) is None


# --- token e HTTP ---------------------------------------------------------------------------------


def test_should_send_the_token_as_a_header_that_follows_redirects() -> None:
    seen: list[HttpRequest] = []

    def transport(request: HttpRequest, timeout: float) -> HttpResponse:
        seen.append(request)
        return HttpResponse(200, b"ok")

    getter = EarthdataTextGetter(TEST_TOKEN, transport=transport)

    assert getter(REAL_DAP_CSV_URL, {}, 30.0) == "ok"
    [request] = seen
    assert request.headers["Authorization"] == f"Bearer {TEST_TOKEN}"
    assert request.authorization is None  # o `authorization` não segue redirecionamento
    assert TEST_TOKEN not in repr(getter)


@pytest.mark.parametrize("status", [401, 403])
def test_should_stop_on_a_rejected_token_without_showing_it(status: int) -> None:
    body = f"recusado: Bearer {TEST_TOKEN}".encode()
    getter = EarthdataTextGetter(
        TEST_TOKEN, transport=lambda request, timeout: HttpResponse(status, body)
    )

    with pytest.raises(TokenRejectedError) as exc:
        getter(REAL_DAP_CSV_URL, {}, 30.0)

    assert "EARTHDATA_TOKEN" in str(exc.value)
    assert TEST_TOKEN not in str(exc.value)


def test_should_raise_on_other_http_errors_without_showing_the_token() -> None:
    body = f"erro de teste {TEST_TOKEN}".encode()
    getter = EarthdataTextGetter(
        TEST_TOKEN, transport=lambda request, timeout: HttpResponse(500, body)
    )

    with pytest.raises(RuntimeError) as exc:
        getter(REAL_DAP_CSV_URL, {}, 30.0)

    assert "500" in str(exc.value)
    assert TEST_TOKEN not in str(exc.value)


# --- cliente com cache, retentativa e paralelo ----------------------------------------------------

DAY = date(2016, 2, 8)
SMALL_WINDOW = PixelWindow(1052, 1054, 1411, 1413)


def test_should_cache_the_cmr_search_and_not_ask_again(tmp_path: Path) -> None:
    fake = FakeEarthdata()

    first = _client(tmp_path, fake).granules(DAY)
    second = _client(tmp_path, fake).granules(DAY)

    assert len(first) == 8 and first == second
    assert [g.time.hour for g in first] == list(HOURS)
    assert len(fake.cmr_calls) == 1


def test_should_cache_each_subset_and_not_request_it_again(tmp_path: Path) -> None:
    fake = FakeEarthdata()
    granule = _client(tmp_path, fake).granules(DAY)[0]
    variable = DATA_VARIABLES["sm_rootzone_m3_m3"]

    first = _client(tmp_path, fake).subset(granule, variable, SMALL_WINDOW)
    second = _client(tmp_path, fake).subset(granule, variable, SMALL_WINDOW)

    assert first == second == [[0.25 + (r % 7) / 100] * 3 for r in SMALL_WINDOW.rows]
    assert len(fake.opendap_calls) == 1


def test_should_keep_coordinates_in_one_place_for_every_granule(tmp_path: Path) -> None:
    fake = FakeEarthdata()
    client = _client(tmp_path, fake)
    first, second = client.granules(DAY)[:2]

    client.subset(first, LAT_VARIABLE, SMALL_WINDOW)
    client.subset(second, LAT_VARIABLE, SMALL_WINDOW)

    assert len(fake.opendap_calls) == 1


def test_should_retry_a_failed_request_and_cache_only_the_good_answer(tmp_path: Path) -> None:
    fake = FakeEarthdata()
    granule = _client(tmp_path, fake).granules(DAY)[0]
    answers: list[Any] = [
        urllib.error.URLError("rede de teste fora"),
        "<html>erro temporário de teste</html>",  # página que não é o recorte
    ]
    sleeps: list[float] = []

    def flaky(url: str, params: dict[str, Any], timeout: float) -> str:
        if answers:
            answer = answers.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return str(answer)
        return fake.opendap_get(url, params, timeout)

    client = SmapOpendapClient(
        cache_dir=tmp_path / "cache",
        opendap_get=flaky,
        cmr_get=fake.cmr_get,
        sleep=sleeps.append,
        max_retries=3,
        backoff_seconds=1.0,
    )

    grid = client.subset(granule, DATA_VARIABLES["sm_rootzone_m3_m3"], SMALL_WINDOW)

    assert len(grid) == 3
    assert sleeps == [1.0, 2.0]  # rede fora, depois resposta que não é o recorte


def test_should_stop_at_once_when_the_answer_is_the_login_page(tmp_path: Path) -> None:
    fake = FakeEarthdata()
    granule = _client(tmp_path, fake).granules(DAY)[0]
    calls: list[str] = []

    def login_page(url: str, params: dict[str, Any], timeout: float) -> str:
        calls.append(url)
        return "<!DOCTYPE html>\n<html><title>Earthdata Login</title></html>"

    client = SmapOpendapClient(
        cache_dir=tmp_path / "cache",
        opendap_get=login_page,
        cmr_get=fake.cmr_get,
        sleep=lambda seconds: None,
    )

    with pytest.raises(TokenRejectedError):
        client.subset(granule, DATA_VARIABLES["sm_rootzone_m3_m3"], SMALL_WINDOW)
    assert len(calls) == 1
    assert not list((tmp_path / "cache").rglob("*.csv"))


def test_should_download_missing_subsets_in_parallel_once_each(tmp_path: Path) -> None:
    fake = FakeEarthdata()
    client = _client(tmp_path, fake, workers=4)
    granules = client.granules(DAY)
    tasks = [SubsetTask(g, v, SMALL_WINDOW) for g in granules for v in DATA_VARIABLES.values()]

    client.prefetch(tasks)
    client.prefetch(tasks)

    assert len(fake.data_calls()) == 24
    assert client.downloads == 24
    assert all(client.is_cached(task) for task in tasks)


# --- arquivo do contrato -------------------------------------------------------------------------


def _build(tmp_path: Path, fake: FakeEarthdata, days: list[date], box: Box) -> dict[str, Any]:
    return build_smap_file(
        days, box_cell_centers(box), _client(tmp_path, fake), clock=lambda: FINISHED, box=box
    )


FARM_BOX = Box(-19.0, -18.9, -48.2, -48.1)  # só a célula da fazenda de exemplo


def test_should_write_one_point_per_cell_with_the_daily_mean_of_its_pixel(tmp_path: Path) -> None:
    result = _build(tmp_path, FakeEarthdata(), [DAY], FARM_BOX)

    [point] = result["pontos"]
    assert (point["lat"], point["lon"]) == (-18.95, -48.15)
    assert point["pixel_9km"] == {
        "linha": 1053,
        "coluna": 1412,
        "lat": round(grid_lat(1053), 4),
        "lon": round(grid_lon(1412), 4),
    }
    assert point["serie"] == [
        {
            "data": "2016-02-08",
            "sm_rootzone_wetness": 0.5115,  # média das 8 horas: 0,5 + 11,5/1000
            "sm_rootzone_m3_m3": 0.28,  # linha 1053: 0,25 + 3/100
            "sm_surface_m3_m3": 0.201,  # 7 horas (a das 22:30 é preenchimento)
        }
    ]


def test_should_follow_the_smap_contract_read_back_by_the_file_repository(tmp_path: Path) -> None:
    result = _build(tmp_path, FakeEarthdata(), [DAY, date(2016, 2, 18)], FARM_BOX)
    path = tmp_path / "smap.json"
    path.write_text(json.dumps(result), encoding="utf-8")

    reader = FileSmapRepository(path)
    run = reader.get_data_run()
    [series] = reader.list_point_series()

    assert run is not None and run.source == "smap"
    assert run.version == "2026.11-smap-l4"
    assert run.finished_at == FINISHED
    assert run.params["produto"] == "SPL4SMGP.008"
    assert run.params["colecao"] == TEST_COLLECTION
    assert run.params["versoes_do_granulo"] == ["Vv8012"]
    assert run.params["dias"] == ["2016-02-08", "2016-02-18"]
    assert run.params["janela_pixels"] == {
        "linha_inicio": 1052,
        "linha_fim": 1054,
        "coluna_inicio": 1411,
        "coluna_fim": 1413,
    }
    assert [r.data for r in series.records] == [DAY, date(2016, 2, 18)]
    assert all(isinstance(r, SmapSoilMoisture) and r.fonte == "smap" for r in series.records)


def test_should_request_each_granule_and_variable_once_for_the_whole_box(tmp_path: Path) -> None:
    fake = FakeEarthdata()

    result = _build(tmp_path, fake, [DAY], PILOT_BOX)

    assert len(result["pontos"]) == 225
    assert len(fake.data_calls()) == 8 * 3
    assert len([u for u in fake.opendap_calls if u.endswith(".dmr")]) == 1
    coordinates = [u for u in fake.opendap_calls if "/cell_l" in urllib.parse.unquote(u)]
    assert len(coordinates) == 4  # coluna de latitudes, linha de longitudes e as 2 da janela


def test_should_note_a_day_without_all_8_granules(tmp_path: Path) -> None:
    fake = FakeEarthdata(days_without_granules=(date(2016, 2, 18),))

    result = _build(tmp_path, fake, [DAY, date(2016, 2, 18)], FARM_BOX)

    assert result["versao_dados"]["parametros"]["dias_incompletos"] == {"2016-02-18": 0}
    assert [item["data"] for item in result["pontos"][0]["serie"]] == ["2016-02-08"]


def test_should_resume_requesting_only_the_new_days(tmp_path: Path) -> None:
    fake = FakeEarthdata()
    _build(tmp_path, fake, [DAY], FARM_BOX)
    before = len(fake.opendap_calls)

    _build(tmp_path, fake, [DAY, date(2016, 2, 18)], FARM_BOX)

    assert len(fake.opendap_calls) - before == 8 * 3


# --- linha de comando -----------------------------------------------------------------------------


def _settings(token: str | None) -> Settings:
    return Settings(_env_file=None, earthdata_token=token)


def _no_network(*args: Any) -> Any:
    raise AssertionError("o teste não deveria chamar a rede")


def test_dry_run_should_show_days_requests_and_time_without_network(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = fetch_smap.main(
        ["--dry-run", "--cache", str(tmp_path / "cache")],
        cmr_get=_no_network,
        opendap_transport=_no_network,
        settings=_settings(None),
    )

    out = capsys.readouterr().out
    assert code == 0
    assert "30 dias" in out
    assert "225 células" in out
    assert "240 granulos" in out
    assert "720 recortes" in out
    assert "4 em paralelo" in out
    assert "min" in out


def test_main_should_need_the_token_to_download(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = fetch_smap.main(
        ["--cache", str(tmp_path / "cache")],
        cmr_get=_no_network,
        opendap_transport=_no_network,
        settings=_settings(None),
    )

    assert code == 2
    assert "EARTHDATA_TOKEN" in capsys.readouterr().err


def test_main_should_write_the_file_without_ever_showing_the_token(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    fake = FakeEarthdata()
    output = tmp_path / "saida" / "smap.json"

    code = fetch_smap.main(
        [
            "--area=-19.0,-18.9,-48.2,-48.1",
            "--anos=2016-2016",
            "--paralelo=2",
            "--cache",
            str(tmp_path / "cache"),
            "--saida",
            str(output),
        ],
        cmr_get=fake.cmr_get,
        opendap_transport=fake.transport,
        settings=_settings(TEST_TOKEN),
        now=lambda: FINISHED,
    )

    captured = capsys.readouterr()
    text = output.read_text(encoding="utf-8")
    assert code == 0
    assert [len(p["serie"]) for p in json.loads(text)["pontos"]] == [3]
    assert all(r.headers["Authorization"] == f"Bearer {TEST_TOKEN}" for r in fake.requests)
    assert TEST_TOKEN not in text + captured.out + captured.err
    files = [p for p in (tmp_path / "cache").rglob("*") if p.is_file()]
    cached = "".join(p.read_text(encoding="utf-8") for p in files)
    assert TEST_TOKEN not in cached


def test_main_should_refuse_years_out_of_order(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        fetch_smap.main(
            ["--anos=2025-2016", "--dry-run", "--cache", str(tmp_path)],
            cmr_get=_no_network,
            opendap_transport=_no_network,
            settings=_settings(None),
        )
