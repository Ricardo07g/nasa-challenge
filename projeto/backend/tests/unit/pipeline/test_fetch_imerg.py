"""Testes do script da chuva diária do GPM IMERG Final por recorte (R2.4, tarefa 0026).

Nada de rede: o CMR e o OPeNDAP do GES DISC são um transporte falso (`FakeGesDisc`) que responde
no formato dos servidores de verdade, com valores claramente de teste (centenas estruturadas:
`(lat - 700) * 100 + (lon - 1300) + dia / 100`). Os únicos trechos de dado real são os `REAL_*`,
marcados como tal.
"""

import json
import re
import threading
import time
import urllib.parse
import urllib.request
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from app.models.data_run import DataRun
from app.repositories.climate_repository import cell_center
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.imerg_repository import imerg_series_from_json
from pipeline.fetch_cmip6_deltas import repo_root
from pipeline.fetch_imerg import (
    CMR_GRANULES_URL,
    DEFAULT_CACHE_DIR,
    DEFAULT_OUTPUT,
    CachedImergFetcher,
    DownloadError,
    EarthdataRedirectHandler,
    Granule,
    ImergAuthError,
    PixelWindow,
    cell_pixel,
    earthdata_opener,
    earthdata_transport,
    list_granules,
    main,
    opendap_ascii_url,
    opendap_das_url,
    parse_cmr_granules,
    parse_das,
    parse_opendap_ascii,
    pilot_cells,
    pixel_lat,
    pixel_lon,
    pixel_window,
    season_days,
)

# --- trechos reais ------------------------------------------------------------------------------

# Amostra real (pedido do orquestrador em 14/11/2026, com o token da Earthdata): a URL e a
# resposta inteira do OPeNDAP do GES DISC para 2 × 2 pixels em 15/01/2024.
REAL_ASCII_URL = (
    "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07/2024/01/"
    "3B-DAY.MS.MRG.3IMERG.20240115-S000000-E235959.V07B.nc4.ascii"
    "?precipitation%5B0:0%5D%5B1300:1301%5D%5B1150:1151%5D"
)
REAL_ASCII_SAMPLE = (
    "Dataset: 3B-DAY.MS.MRG.3IMERG.20240115-S000000-E235959.V07B.nc4\n"
    "precipitation.lat, 25.05, 25.15\n"
    "precipitation.precipitation[precipitation.time=16080][precipitation.lon=-49.95], 0, 0\n"
    "precipitation.precipitation[precipitation.time=16080][precipitation.lon=-49.85], 0, 0\n"
)
REAL_SAMPLE_GRANULE_NAME = "3B-DAY.MS.MRG.3IMERG.20240115-S000000-E235959.V07B.nc4"
REAL_SAMPLE_WINDOW = PixelWindow(lat_first=1150, lat_last=1151, lon_first=1300, lon_last=1301)

# Trecho real do DAS do mesmo arquivo (público, sem token), pedido em 14/11/2026: os blocos de
# `precipitation`, `lon`, `lat` e `time`; as outras variáveis foram omitidas.
REAL_DAS_SAMPLE = """Attributes {
    precipitation {
        String units "mm/day";
        String long_name "Daily mean precipitation rate (combined microwave-IR) estimate. Formerly precipitationCal.";
        String coordinates "time lon lat";
        Float32 _FillValue -9999.90039;
    }
    lon {
        String units "degrees_east";
        String long_name "Longitude";
    }
    lat {
        String units "degrees_north";
        String long_name "Latitude";
    }
    time {
        String units "days since 1980-01-06 00:00:00Z";
        String standard_name "time";
        String long_name "time";
        String bounds "time_bnds";
    }
}
"""  # noqa: E501

# Trecho real da busca pública do CMR (granules.json, GPM_3IMERGDF versão 07), pedido em
# 14/11/2026: um item, sem os links herdados da coleção.
REAL_CMR_ENTRY = {
    "producer_granule_id": "3B-DAY.MS.MRG.3IMERG.20240115-S000000-E235959.V07B.nc4",
    "boxes": ["-90 -180 90 180"],
    "time_start": "2024-01-15T00:00:00.000Z",
    "updated": "2024-06-12T14:47:42.000Z",
    "dataset_id": (
        "GPM IMERG Final Precipitation L3 1 day 0.1 degree x 0.1 degree V07 (GPM_3IMERGDF) at "
        "GES DISC"
    ),
    "data_center": "GES_DISC",
    "title": "GPM_3IMERGDF.07:3B-DAY.MS.MRG.3IMERG.20240115-S000000-E235959.V07B.nc4",
    "time_end": "2024-01-15T23:59:59.999Z",
    "id": "G3087543810-GES_DISC",
    "collection_concept_id": "C2723754864-GES_DISC",
    "links": [
        {
            "rel": "http://esipfed.org/ns/fedsearch/1.1/data#",
            "href": (
                "https://data.gesdisc.earthdata.nasa.gov/data/GPM_L3/GPM_3IMERGDF.07/2024/01/"
                "3B-DAY.MS.MRG.3IMERG.20240115-S000000-E235959.V07B.nc4"
            ),
        },
        {
            "rel": "http://esipfed.org/ns/fedsearch/1.1/service#",
            "title": "OPeNDAP request URL (GET DATA : OPENDAP DATA)",
            "href": (
                "https://opendap.earthdata.nasa.gov/collections/C2723754864-GES_DISC/granules/"
                "GPM_3IMERGDF.07%3A3B-DAY.MS.MRG.3IMERG.20240115-S000000-E235959.V07B.nc4"
            ),
        },
    ],
}

# --- servidor falso -----------------------------------------------------------------------------

TOKEN = "token-de-teste-nao-real"
FINISHED_AT = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)
TIME_ORIGIN = date(1980, 1, 6)
PILOT_WINDOW = PixelWindow(lat_first=701, lat_last=715, lon_first=1310, lon_last=1324)
FARM_CELL = "-190_-482"
_CONSTRAINT = re.compile(r"precipitation\[0:0\]\[(\d+):(\d+)\]\[(\d+):(\d+)\]")
_NAME_DATE = re.compile(r"3IMERG\.(\d{8})-")


def granule_name(day: date, version: str = "V07B") -> str:
    return f"3B-DAY.MS.MRG.3IMERG.{day:%Y%m%d}-S000000-E235959.{version}.nc4"


def fake_rain(day: date, lat_index: int, lon_index: int) -> float:
    """Valor de teste, diferente em cada pixel e dia do mês (nunca um valor real)."""
    return (lat_index - 700) * 100 + (lon_index - 1300) + day.day / 100


def cmr_entry(day: date, version: str = "V07B") -> dict[str, object]:
    name = granule_name(day, version)
    return {
        "producer_granule_id": name,
        "title": f"GPM_3IMERGDF.07:{name}",
        "time_start": f"{day.isoformat()}T00:00:00.000Z",
        "time_end": f"{day.isoformat()}T23:59:59.999Z",
        "links": [],
    }


def ascii_response(
    day: date,
    window: PixelWindow,
    *,
    name: str | None = None,
    fill: frozenset[tuple[int, int]] = frozenset(),
) -> str:
    lats = ", ".join(str(round(pixel_lat(i), 2)) for i in window.lat_indexes)
    lines = [f"Dataset: {name or granule_name(day)}", f"precipitation.lat, {lats}"]
    time = (day - TIME_ORIGIN).days
    for lon_index in window.lon_indexes:
        values = ", ".join(
            "-9999.9"
            if (lat_index, lon_index) in fill
            else f"{fake_rain(day, lat_index, lon_index)}"
            for lat_index in window.lat_indexes
        )
        label = (
            f"precipitation.precipitation[precipitation.time={time}]"
            f"[precipitation.lon={round(pixel_lon(lon_index), 2)}]"
        )
        lines.append(f"{label}, {values}")
    return "\n".join(lines) + "\n"


class FakeGesDisc:
    """CMR e OPeNDAP falsos. Guarda os pedidos e responde no formato dos servidores reais."""

    def __init__(
        self,
        *,
        missing_days: frozenset[date] = frozenset(),
        fill: dict[date, frozenset[tuple[int, int]]] | None = None,
        failing_days: frozenset[date] = frozenset(),
        ascii_status: int = 200,
        ascii_body: str | None = None,
        barrier: threading.Barrier | None = None,
        refuse_after: int | None = None,
    ) -> None:
        self.missing_days = missing_days
        self.fill = fill or {}
        self.failing_days = failing_days
        self.ascii_status = ascii_status
        self.ascii_body = ascii_body
        self.barrier = barrier
        self.refuse_after = refuse_after
        self.requests: list[HttpRequest] = []
        self._lock = threading.Lock()

    @property
    def ascii_requests(self) -> list[HttpRequest]:
        return [r for r in self.requests if ".ascii?" in r.url]

    @property
    def cmr_requests(self) -> list[HttpRequest]:
        return [r for r in self.requests if r.url.startswith(CMR_GRANULES_URL)]

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        with self._lock:
            self.requests.append(request)
            ascii_index = len(self.ascii_requests)
        if request.url.startswith(CMR_GRANULES_URL):
            return self._cmr(request)
        if request.url.endswith(".das"):
            return HttpResponse(200, REAL_DAS_SAMPLE.encode())
        if ".ascii?" in request.url:
            if self.barrier is not None and 2 <= ascii_index <= 1 + self.barrier.parties:
                self.barrier.wait()
            if self.refuse_after is not None and ascii_index > self.refuse_after:
                time.sleep(0.05)  # o servidor demora a recusar: os outros pedidos ficam no ar
                return HttpResponse(403, b"Forbidden")
            return self._ascii(request)
        return HttpResponse(404, b"Not Found")

    def _cmr(self, request: HttpRequest) -> HttpResponse:
        start_text, end_text = str(request.params["temporal"]).split(",")
        start, end = date.fromisoformat(start_text[:10]), date.fromisoformat(end_text[:10])
        days = [
            start + timedelta(days=i)
            for i in range((end - start).days + 1)
            if start + timedelta(days=i) not in self.missing_days
        ]
        size, page = int(request.params["page_size"]), int(request.params["page_num"])
        entries = [cmr_entry(day) for day in days[(page - 1) * size : page * size]]
        return HttpResponse(200, json.dumps({"feed": {"entry": entries}}).encode())

    def _ascii(self, request: HttpRequest) -> HttpResponse:
        path, query = request.url.split(".ascii?", 1)
        day = datetime.strptime(_NAME_DATE.search(path).group(1), "%Y%m%d").date()  # type: ignore[union-attr]
        if day in self.failing_days:
            return HttpResponse(500, b"Internal Server Error")
        if self.ascii_status != 200 or self.ascii_body is not None:
            return HttpResponse(self.ascii_status, (self.ascii_body or "").encode())
        lon_first, lon_last, lat_first, lat_last = (
            int(n)
            for n in _CONSTRAINT.fullmatch(urllib.parse.unquote(query)).groups()  # type: ignore[union-attr]
        )
        window = PixelWindow(lat_first, lat_last, lon_first, lon_last)
        body = ascii_response(day, window, fill=self.fill.get(day, frozenset()))
        return HttpResponse(200, body.encode())


def _no_sleep(_: float) -> None:
    return None


def _run(tmp_path: Path, fake: FakeGesDisc, *extra: str, token: str | None = TOKEN) -> int:
    return main(
        [
            "--anos",
            "2024",
            "--saida",
            str(tmp_path / "imerg.json"),
            "--cache",
            str(tmp_path / "cache"),
            *extra,
        ],
        transport=fake,
        load_token=lambda: token,
        now=lambda: FINISHED_AT,
        sleep=_no_sleep,
    )


def _fetcher(tmp_path: Path, fake: FakeGesDisc, **options: object) -> CachedImergFetcher:
    return CachedImergFetcher(
        cache_dir=tmp_path / "cache",
        transport=fake,
        token=TOKEN,
        window=REAL_SAMPLE_WINDOW,
        sleep=options.pop("sleep", _no_sleep),  # type: ignore[arg-type]
        **options,  # type: ignore[arg-type]
    )


REAL_GRANULE = Granule(day=date(2024, 1, 15), file_name=REAL_SAMPLE_GRANULE_NAME)


# --- grade, células e URLs ----------------------------------------------------------------------


def test_cell_pixel_should_match_the_real_request() -> None:
    # A amostra real pediu os pixels [1300:1301] de lon e [1150:1151] de lat: -49,95 e 25,05.
    assert cell_pixel("250_-500") == (1150, 1300)
    assert pixel_lat(1150) == pytest.approx(25.05)
    assert pixel_lon(1300) == pytest.approx(-49.95)


def test_each_pilot_cell_should_be_exactly_one_imerg_pixel() -> None:
    cells = pilot_cells()

    assert len(cells) == 225
    assert cells == sorted(cells, key=lambda c: tuple(int(p) for p in c.split("_")))
    assert FARM_CELL in cells
    for cell_id in cells:
        lat_index, lon_index = cell_pixel(cell_id)
        assert (pixel_lat(lat_index), pixel_lon(lon_index)) == pytest.approx(cell_center(cell_id))


def test_pixel_window_should_cover_the_pilot_box() -> None:
    assert pixel_window(pilot_cells()) == PILOT_WINDOW


def test_ascii_url_should_reproduce_the_real_request() -> None:
    assert opendap_ascii_url(REAL_GRANULE, REAL_SAMPLE_WINDOW) == REAL_ASCII_URL


def test_das_url_should_point_to_the_same_file() -> None:
    assert opendap_das_url(REAL_GRANULE) == (
        "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07/2024/01/"
        f"{REAL_SAMPLE_GRANULE_NAME}.das"
    )


def test_season_days_should_follow_the_power_seasons() -> None:
    # 212 dias desde 1/jan, como o ClimateSeasonBuilder: no bissexto, termina em 30/jul.
    assert len(season_days(2023)) == 212
    assert season_days(2023)[-1] == date(2023, 7, 31)
    assert len(season_days(2024)) == 212
    assert season_days(2024)[0] == date(2024, 1, 1)
    assert season_days(2024)[-1] == date(2024, 7, 30)


def test_default_paths_should_be_in_the_team_folder_from_the_repo_root() -> None:
    folder = repo_root() / "data" / "baixados" / "nasa_gpm_imerg"
    assert folder / "imerg_diario_caixa.json" == DEFAULT_OUTPUT
    assert folder / "cache_opendap" == DEFAULT_CACHE_DIR


# --- CMR ----------------------------------------------------------------------------------------


def test_parse_cmr_should_read_the_real_entry() -> None:
    granules = parse_cmr_granules({"feed": {"entry": [REAL_CMR_ENTRY]}})

    assert granules == [REAL_GRANULE]
    assert granules[0].version == "V07B"


def test_parse_cmr_should_fall_back_to_the_title_without_producer_id() -> None:
    entry = {k: v for k, v in REAL_CMR_ENTRY.items() if k != "producer_granule_id"}

    assert parse_cmr_granules({"feed": {"entry": [entry]}}) == [REAL_GRANULE]


@pytest.mark.parametrize(
    "changes",
    [
        {"producer_granule_id": "3B-HHR.MS.MRG.3IMERG.20240115-S000000-E002959.0000.V07B.HDF5"},
        {"time_start": "2024-01-16T00:00:00.000Z"},
    ],
)
def test_parse_cmr_should_reject_other_files_or_dates(changes: dict[str, str]) -> None:
    with pytest.raises(ValueError):
        parse_cmr_granules({"feed": {"entry": [{**REAL_CMR_ENTRY, **changes}]}})


def test_list_granules_should_ask_the_public_cmr_per_year_without_the_token() -> None:
    fake = FakeGesDisc()

    granules = list_granules(fake, [2023, 2024], sleep=_no_sleep)

    assert len(granules) == 424
    assert granules[date(2024, 1, 15)].file_name == granule_name(date(2024, 1, 15))
    assert len(fake.cmr_requests) == 2
    for request in fake.cmr_requests:
        assert "Authorization" not in request.headers
        assert request.authorization is None
        assert request.params["short_name"] == "GPM_3IMERGDF"
        assert request.params["version"] == "07"
    assert fake.cmr_requests[1].params["temporal"] == "2024-01-01T00:00:00Z,2024-07-30T23:59:59Z"


def test_list_granules_should_follow_the_pages() -> None:
    fake = FakeGesDisc()

    granules = list_granules(fake, [2024], sleep=_no_sleep, page_size=100)

    assert len(granules) == 212
    assert [r.params["page_num"] for r in fake.cmr_requests] == [1, 2, 3]


def test_list_granules_should_keep_only_season_days_and_the_latest_version() -> None:
    entries = [
        cmr_entry(date(2024, 1, 1), "V07A"),
        cmr_entry(date(2024, 1, 1), "V07B"),
        cmr_entry(date(2024, 1, 2), "V07B"),
        cmr_entry(date(2024, 1, 2), "V07A"),  # a mais nova vem antes: a ordem não decide
        cmr_entry(date(2023, 12, 31)),
        cmr_entry(date(2024, 7, 31)),  # 2024 é bissexto: a temporada acaba em 30/jul
    ]

    def transport(request: HttpRequest, timeout: float) -> HttpResponse:
        return HttpResponse(200, json.dumps({"feed": {"entry": entries}}).encode())

    granules = list_granules(transport, [2024], sleep=_no_sleep)

    assert list(granules) == [date(2024, 1, 1), date(2024, 1, 2)]
    assert {granule.version for granule in granules.values()} == {"V07B"}


# --- DAS ----------------------------------------------------------------------------------------


def test_parse_das_should_check_the_unit_and_return_the_time_origin() -> None:
    assert parse_das(REAL_DAS_SAMPLE) == TIME_ORIGIN


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        ('units "mm/day"', 'units "mm/hr"', "unidade"),
        ('"days since 1980-01-06 00:00:00Z"', '"hours since 1980-01-06 00:00:00Z"', "tempo"),
        ("    time {", "    tempo {", "tempo"),
        ("    precipitation {", "    precip {", "precipitation"),
        ("_FillValue -9999.90039", "_FillValue 0", "preenchimento"),
    ],
)
def test_parse_das_should_reject_unexpected_attributes(old: str, new: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        parse_das(REAL_DAS_SAMPLE.replace(old, new))


def test_parse_das_should_reject_an_error_page() -> None:
    with pytest.raises(ValueError):
        parse_das("<html><body>Login</body></html>")


# --- recorte ASCII ------------------------------------------------------------------------------


def test_parse_ascii_should_read_the_real_sample() -> None:
    version, values = parse_opendap_ascii(
        REAL_ASCII_SAMPLE, date(2024, 1, 15), REAL_SAMPLE_WINDOW, TIME_ORIGIN
    )

    assert version == "V07B"
    assert values == {(1150, 1300): 0.0, (1151, 1300): 0.0, (1150, 1301): 0.0, (1151, 1301): 0.0}


def test_parse_ascii_should_read_each_pixel_in_place_and_fill_as_none() -> None:
    day = date(2024, 3, 9)
    text = ascii_response(day, PILOT_WINDOW, fill=frozenset({(705, 1320)}))

    _, values = parse_opendap_ascii(text, day, PILOT_WINDOW, TIME_ORIGIN)

    assert len(values) == 225
    assert values[(701, 1310)] == fake_rain(day, 701, 1310)
    assert values[(715, 1324)] == fake_rain(day, 715, 1324)
    assert values[(705, 1320)] is None


_SAMPLE_DAY = date(2024, 1, 15)


@pytest.mark.parametrize(
    "text",
    [
        "",
        "<!DOCTYPE html><html><body>Earthdata Login</body></html>",
        'Error {\n    code = 400;\n    message = "Constraint expression invalid";\n};\n',
        REAL_ASCII_SAMPLE.replace("20240115", "20240116"),
        REAL_ASCII_SAMPLE.replace("time=16080", "time=16081"),
        REAL_ASCII_SAMPLE.replace("lon=-49.85", "lon=-49.75"),
        REAL_ASCII_SAMPLE.replace("25.05, 25.15", "25.15, 25.25"),
        REAL_ASCII_SAMPLE.replace("25.05, 25.15", "25.05"),
        REAL_ASCII_SAMPLE.replace("-49.85], 0, 0", "-49.85], 0"),
        REAL_ASCII_SAMPLE.replace("-49.85], 0, 0", "-49.85], 0, -1.5"),
        "\n".join(REAL_ASCII_SAMPLE.splitlines()[:3]),
        REAL_ASCII_SAMPLE + "texto inesperado\n",
    ],
)
def test_parse_ascii_should_reject_anything_but_the_requested_cut(text: str) -> None:
    with pytest.raises(ValueError):
        parse_opendap_ascii(text, _SAMPLE_DAY, REAL_SAMPLE_WINDOW, TIME_ORIGIN)


# --- cliente HTTP da Earthdata ------------------------------------------------------------------


def _redirect(handler: EarthdataRedirectHandler, new_url: str) -> urllib.request.Request:
    request = urllib.request.Request(
        "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/x.ascii",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    redirected = handler.redirect_request(request, None, 302, "Found", {}, new_url)
    assert redirected is not None
    return redirected


def test_authorization_should_follow_the_earthdata_login_redirects() -> None:
    handler = EarthdataRedirectHandler()

    for url in (
        "https://urs.earthdata.nasa.gov/oauth/authorize?client_id=x",
        "https://gpm1.gesdisc.eosdis.nasa.gov/data-redirect?code=x",
    ):
        assert _redirect(handler, url).get_header("Authorization") == f"Bearer {TOKEN}"


@pytest.mark.parametrize(
    "url",
    ["https://exemplo.com/x", "http://urs.earthdata.nasa.gov/x", "https://nasa.gov.exemplo.com"],
)
def test_authorization_should_not_follow_a_redirect_outside_nasa(url: str) -> None:
    assert _redirect(EarthdataRedirectHandler(), url).get_header("Authorization") is None


def test_earthdata_opener_should_keep_the_session_cookie_and_the_safe_redirects() -> None:
    handlers = earthdata_opener().handlers

    assert any(isinstance(h, urllib.request.HTTPCookieProcessor) for h in handlers)
    assert any(isinstance(h, EarthdataRedirectHandler) for h in handlers)


def test_earthdata_transport_should_send_the_token_in_a_header_that_follows_redirects() -> None:
    sent: list[urllib.request.Request] = []

    class FakeResponse:
        status = 200

        def read(self) -> bytes:
            return b"ok"

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *args: object) -> None:
            return None

    class FakeOpener:
        def open(self, request: urllib.request.Request, timeout: float) -> FakeResponse:
            sent.append(request)
            return FakeResponse()

    transport = earthdata_transport(FakeOpener())  # type: ignore[arg-type]
    response = transport(
        HttpRequest("GET", REAL_ASCII_URL, headers={"Authorization": f"Bearer {TOKEN}"}), 5.0
    )

    assert response.status == 200
    # Cabeçalho comum: o urllib leva para o redirecionamento (o "unredirected" não iria).
    assert sent[0].get_header("Authorization") == f"Bearer {TOKEN}"
    assert "Authorization" not in sent[0].unredirected_hdrs


# --- cache, retentativa e erros de acesso -------------------------------------------------------


def test_fetch_should_send_the_bearer_token_as_a_common_header(tmp_path: Path) -> None:
    fake = FakeGesDisc()

    _fetcher(tmp_path, fake).fetch_day(REAL_GRANULE, TIME_ORIGIN)

    request = fake.ascii_requests[0]
    assert request.url == REAL_ASCII_URL
    assert request.headers["Authorization"] == f"Bearer {TOKEN}"
    assert request.authorization is None


def test_fetch_should_accept_plain_text_because_hyrax_refuses_json(tmp_path: Path) -> None:
    # Visto no servidor real em 14/11/2026: o DAS com "Accept: application/json" (o padrão do
    # cliente HTTP do projeto) volta 406 "Hyrax - Not Applicable"; com "text/plain, */*", 200.
    fake = FakeGesDisc()
    fetcher = _fetcher(tmp_path, fake)

    fetcher.fetch_attributes(REAL_GRANULE)
    fetcher.fetch_day(REAL_GRANULE, TIME_ORIGIN)

    assert [r.headers["Accept"] for r in fake.requests] == ["text/plain, */*"] * 2


def test_fetch_should_not_retry_a_refused_media_type(tmp_path: Path) -> None:
    fake = FakeGesDisc(ascii_status=406, ascii_body="Hyrax - Not Applicable (406)")

    with pytest.raises(DownloadError, match="406"):
        _fetcher(tmp_path, fake).fetch_day(REAL_GRANULE, TIME_ORIGIN)

    assert len(fake.ascii_requests) == 1


def test_fetch_should_cache_the_checked_cut_and_reuse_it(tmp_path: Path) -> None:
    fake = FakeGesDisc()
    fetcher = _fetcher(tmp_path, fake)

    first = fetcher.fetch_day(REAL_GRANULE, TIME_ORIGIN)
    second = fetcher.fetch_day(REAL_GRANULE, TIME_ORIGIN)

    assert first == second
    assert len(fake.ascii_requests) == 1
    assert fetcher.is_cached(REAL_GRANULE.day)
    assert fetcher.downloads == 1
    assert not list((tmp_path / "cache").rglob("*.part"))


def test_fetch_should_retry_server_errors_with_exponential_backoff(tmp_path: Path) -> None:
    statuses = iter([503, 500, 200])
    sleeps: list[float] = []

    def transport(request: HttpRequest, timeout: float) -> HttpResponse:
        status = next(statuses)
        body = REAL_ASCII_SAMPLE if status == 200 else "Service Unavailable"
        return HttpResponse(status, body.encode())

    fetcher = CachedImergFetcher(
        cache_dir=tmp_path / "cache",
        transport=transport,
        token=TOKEN,
        window=REAL_SAMPLE_WINDOW,
        sleep=sleeps.append,
        backoff_seconds=5.0,
    )

    assert fetcher.fetch_day(REAL_GRANULE, TIME_ORIGIN) == REAL_ASCII_SAMPLE
    assert sleeps == [5.0, 10.0]


def test_fetch_should_retry_network_errors(tmp_path: Path) -> None:
    calls: list[int] = []

    def transport(request: HttpRequest, timeout: float) -> HttpResponse:
        calls.append(1)
        if len(calls) == 1:
            raise TimeoutError("timed out")
        return HttpResponse(200, REAL_ASCII_SAMPLE.encode())

    fetcher = CachedImergFetcher(
        cache_dir=tmp_path / "cache",
        transport=transport,
        token=TOKEN,
        window=REAL_SAMPLE_WINDOW,
        sleep=_no_sleep,
    )

    assert fetcher.fetch_day(REAL_GRANULE, TIME_ORIGIN) == REAL_ASCII_SAMPLE
    assert len(calls) == 2


def test_fetch_should_never_cache_an_invalid_cut(tmp_path: Path) -> None:
    fake = FakeGesDisc(ascii_body="Dataset: outro.nc4\nlixo\n")
    fetcher = _fetcher(tmp_path, fake, max_retries=2)

    with pytest.raises(DownloadError, match="2024-01-15"):
        fetcher.fetch_day(REAL_GRANULE, TIME_ORIGIN)

    assert len(fake.ascii_requests) == 3
    assert not fetcher.is_cached(REAL_GRANULE.day)
    assert not list((tmp_path / "cache").rglob("*.ascii*"))


def test_fetch_should_not_retry_a_missing_file(tmp_path: Path) -> None:
    fake = FakeGesDisc(ascii_status=404, ascii_body="Not Found")

    with pytest.raises(DownloadError, match="404"):
        _fetcher(tmp_path, fake).fetch_day(REAL_GRANULE, TIME_ORIGIN)

    assert len(fake.ascii_requests) == 1


@pytest.mark.parametrize(
    ("status", "body"),
    [
        (401, "Unauthorized"),
        (403, "EULA Acceptance Failure"),
        (302, ""),
        (200, "<!DOCTYPE html><html><head><title>Earthdata Login</title></head></html>"),
    ],
)
def test_fetch_should_stop_at_once_when_access_is_refused(
    tmp_path: Path, status: int, body: str
) -> None:
    fake = FakeGesDisc(ascii_status=status, ascii_body=body)

    with pytest.raises(ImergAuthError):
        _fetcher(tmp_path, fake).fetch_day(REAL_GRANULE, TIME_ORIGIN)

    assert len(fake.ascii_requests) == 1


# --- linha de comando: extração, contrato, paralelo e retomada ----------------------------------


def _payload(tmp_path: Path) -> dict[str, object]:
    return json.loads((tmp_path / "imerg.json").read_text(encoding="utf-8"))


def test_main_should_write_the_imerg_contract_for_every_pilot_cell(tmp_path: Path) -> None:
    fake = FakeGesDisc()

    assert _run(tmp_path, fake) == 0

    payload = _payload(tmp_path)
    run = payload["versao_dados"]
    assert run["fonte"] == "gpm_imerg"  # type: ignore[index]
    assert run["fim"] == "2026-11-14T13:00:00Z"  # type: ignore[index]
    assert run["versao"] == "2026.11-gpm-imerg"  # type: ignore[index]
    params = run["parametros"]  # type: ignore[index]
    assert params["produto"] == "GPM_3IMERGDF"
    assert params["versao_produto"] == "07"
    assert params["versoes_arquivo"] == ["V07B"]
    assert params["anos"] == [2024, 2024]
    assert params["temporada"] == {"inicio": "01-01", "dias": 212}
    assert params["celulas"] == 225
    assert params["dias_sem_arquivo"] == 0
    DataRun(
        source=run["fonte"],  # type: ignore[index]
        params=params,
        finished_at=datetime.fromisoformat(run["fim"].replace("Z", "+00:00")),  # type: ignore[index]
        version=run["versao"],  # type: ignore[index]
    )

    cells = [imerg_series_from_json(item) for item in payload["celulas"]]  # type: ignore[union-attr]
    assert [c.cell_id for c in cells] == pilot_cells()
    farm = next(c for c in cells if c.cell_id == FARM_CELL)
    assert (farm.latitude, farm.longitude) == pytest.approx((-18.95, -48.15))
    season = farm.seasons[0]
    assert (season.year, season.start_date, season.complete) == (2024, date(2024, 1, 1), True)
    lat_index, lon_index = cell_pixel(FARM_CELL)
    day = date(2024, 3, 9)
    expected = round(fake_rain(day, lat_index, lon_index), 2)
    assert season.rain_mm[(day - date(2024, 1, 1)).days] == expected


def test_main_should_make_one_request_per_day_with_the_pilot_window(tmp_path: Path) -> None:
    fake = FakeGesDisc()

    assert _run(tmp_path, fake) == 0

    assert len(fake.ascii_requests) == 212
    assert {r.url.split(".ascii?")[1] for r in fake.ascii_requests} == {
        "precipitation%5B0:0%5D%5B1310:1324%5D%5B701:715%5D"
    }
    assert len([r for r in fake.requests if r.url.endswith(".das")]) == 1
    assert not (tmp_path / "imerg.json.part").exists()


def test_main_should_write_null_for_a_day_without_a_file(tmp_path: Path) -> None:
    fake = FakeGesDisc(missing_days=frozenset({date(2024, 2, 29)}))

    assert _run(tmp_path, fake) == 0

    payload = _payload(tmp_path)
    assert payload["versao_dados"]["parametros"]["dias_sem_arquivo"] == 1  # type: ignore[index]
    position = (date(2024, 2, 29) - date(2024, 1, 1)).days
    for item in payload["celulas"]:  # type: ignore[union-attr]
        rain = item["temporadas"][0]["chuva_mm"]
        assert rain[position] is None
        assert rain[position - 1] is not None
    assert len(fake.ascii_requests) == 211


def test_main_should_write_null_only_in_the_cell_of_a_fill_pixel(tmp_path: Path) -> None:
    day = date(2024, 5, 20)
    lat_index, lon_index = cell_pixel(FARM_CELL)
    fake = FakeGesDisc(fill={day: frozenset({(lat_index, lon_index)})})

    assert _run(tmp_path, fake) == 0

    position = (day - date(2024, 1, 1)).days
    cells = {item["celula"]: item for item in _payload(tmp_path)["celulas"]}  # type: ignore[union-attr]
    assert cells[FARM_CELL]["temporadas"][0]["chuva_mm"][position] is None
    assert cells["-190_-481"]["temporadas"][0]["chuva_mm"][position] is not None


def test_main_should_run_the_requests_in_parallel(tmp_path: Path) -> None:
    # Os 3 pedidos depois do primeiro só passam da barreira se estiverem no ar ao mesmo tempo.
    fake = FakeGesDisc(barrier=threading.Barrier(3, timeout=5))

    assert _run(tmp_path, fake, "--paralelo", "3") == 0

    assert len(fake.ascii_requests) == 212


def test_main_should_stop_after_the_first_request_when_access_is_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], caplog: pytest.LogCaptureFixture
) -> None:
    fake = FakeGesDisc(ascii_status=403, ascii_body="EULA Acceptance Failure")

    assert _run(tmp_path, fake) == 1

    assert len(fake.ascii_requests) == 1
    captured = capsys.readouterr()
    assert "EULA" in captured.err
    assert TOKEN not in captured.out + captured.err + caplog.text
    assert not (tmp_path / "imerg.json").exists()


def test_main_should_cancel_the_queued_requests_when_access_is_refused_midway(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # O primeiro pedido passa; os seguintes são recusados (token venceu no meio da extração).
    fake = FakeGesDisc(refuse_after=1)

    assert _run(tmp_path, fake) == 1

    assert "recusou o acesso" in capsys.readouterr().err
    assert len(fake.ascii_requests) < 50  # sem cancelar, sairiam os 212
    assert not (tmp_path / "imerg.json").exists()


def test_main_should_keep_the_cache_and_resume_after_failed_days(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], caplog: pytest.LogCaptureFixture
) -> None:
    broken = FakeGesDisc(failing_days=frozenset({date(2024, 6, 1)}))

    assert _run(tmp_path, broken) == 1

    captured = capsys.readouterr()
    assert "2024-06-01" in captured.err
    assert TOKEN not in captured.out + captured.err + caplog.text
    assert not (tmp_path / "imerg.json").exists()

    healthy = FakeGesDisc()
    assert _run(tmp_path, healthy) == 0

    assert [r.url for r in healthy.ascii_requests] == [
        opendap_ascii_url(Granule(date(2024, 6, 1), granule_name(date(2024, 6, 1))), PILOT_WINDOW)
    ]
    assert (tmp_path / "imerg.json").exists()


def test_main_should_refuse_to_run_without_the_token(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    fake = FakeGesDisc()

    assert _run(tmp_path, fake, token=None) == 2

    assert "EARTHDATA_TOKEN" in capsys.readouterr().err
    assert fake.requests == []


def _offline(request: HttpRequest, timeout: float) -> HttpResponse:
    raise AssertionError("o --dry-run não pode usar a rede")


def test_dry_run_should_show_requests_and_time_without_network(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = main(
        ["--dry-run", "--cache", str(tmp_path / "cache")],
        transport=_offline,
        load_token=lambda: None,
        now=lambda: FINISHED_AT,
        sleep=_no_sleep,
    )

    assert code == 0
    out = capsys.readouterr().out
    assert "225 células" in out
    assert "4240 recortes" in out
    assert "faltam: 4240" in out
    assert "6 em paralelo" in out
    assert "2,2 h" in out
    assert "precipitation%5B0:0%5D%5B1310:1324%5D%5B701:715%5D" in out


def test_dry_run_should_count_the_days_already_in_the_cache(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run(tmp_path, FakeGesDisc()) == 0
    capsys.readouterr()

    code = main(
        ["--dry-run", "--cache", str(tmp_path / "cache"), "--paralelo", "4"],
        transport=_offline,
        load_token=lambda: None,
        now=lambda: FINISHED_AT,
        sleep=_no_sleep,
    )

    assert code == 0
    out = capsys.readouterr().out
    assert "já no cache: 212" in out
    assert "faltam: 4028" in out
    assert "4 em paralelo" in out


@pytest.mark.parametrize("value", ["0", "11", "dois"])
def test_main_should_refuse_an_unreasonable_parallelism(tmp_path: Path, value: str) -> None:
    with pytest.raises(SystemExit):
        _run(tmp_path, FakeGesDisc(), "--paralelo", value)


@pytest.mark.parametrize("value", ["2004", "2025", "2010-2005", "abc"])
def test_main_should_refuse_years_outside_the_power_window(tmp_path: Path, value: str) -> None:
    with pytest.raises(SystemExit):
        main(
            ["--anos", value, "--dry-run", "--cache", str(tmp_path / "cache")],
            transport=_offline,
            load_token=lambda: None,
        )
