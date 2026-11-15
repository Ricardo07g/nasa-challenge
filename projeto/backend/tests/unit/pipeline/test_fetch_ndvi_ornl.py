"""Testes do NDVI do MODIS pela ORNL DAAC (`--fonte ornl`), com HTTP falso (sem rede real).

Os números de NDVI aqui são valores de teste, não dados do MODIS, exceto o `REAL_SUBSET_SAMPLE`,
que é um trecho de uma resposta real (marcado como tal).
"""

import json
import urllib.parse
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.models.data_run import DataRun
from app.models.talhao import NdviRecord
from app.repositories.external.http_client import HttpRequest, HttpResponse
from pipeline.fetch_ndvi import (
    DEFAULT_OUTPUT,
    DEFAULT_POINT,
    ORNL_API_URL,
    ORNL_NDVI_BAND,
    ORNL_QUALITY_BAND,
    CachedOrnlFetcher,
    NdviBand,
    OrnlBlock,
    OrnlClient,
    OrnlError,
    OrnlUnavailableError,
    check_ornl_subset,
    modis_calendar,
    parse_ornl_bands,
    parse_ornl_dates,
    parse_ornl_subset,
    plan_blocks,
    repo_root,
    run,
)

FINISHED_AT = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)
API_PATH = urllib.parse.urlparse(ORNL_API_URL).path

# Amostra real (trecho): GET /MOD13Q1/subset da fazenda de exemplo, 2016-04-06 a 2016-04-22,
# todas as bandas, pedida em 14/11/2026. Só ficaram NDVI, pixel_reliability e EVI (das 12 bandas).
REAL_SUBSET_SAMPLE: dict[str, Any] = {
    "xllcorner": "-5069104.48",
    "yllcorner": "-2107841.20",
    "cellsize": 231.656358264,
    "nrows": 1,
    "ncols": 1,
    "band": "all",
    "latitude": -18.9543,
    "longitude": -48.1993,
    "header": "https://modisrest.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=-18.9543"
    "&longitude=-48.1993&startDate=A2016097&endDate=A2016113&kmAboveBelow=0&kmLeftRight=0",
    "subset": [
        {
            "modis_date": "A2016097",
            "calendar_date": "2016-04-06",
            "band": "250m_16_days_pixel_reliability",
            "tile": "h13v10",
            "proc_date": "2021348042634",
            "data": [0],
        },
        {
            "modis_date": "A2016097",
            "calendar_date": "2016-04-06",
            "band": "250m_16_days_NDVI",
            "tile": "h13v10",
            "proc_date": "2021348042634",
            "data": [3253],
        },
        {
            "modis_date": "A2016097",
            "calendar_date": "2016-04-06",
            "band": "250m_16_days_EVI",
            "tile": "h13v10",
            "proc_date": "2021348042634",
            "data": [1718],
        },
        {
            "modis_date": "A2016113",
            "calendar_date": "2016-04-22",
            "band": "250m_16_days_pixel_reliability",
            "tile": "h13v10",
            "proc_date": "2021349015846",
            "data": [0],
        },
        {
            "modis_date": "A2016113",
            "calendar_date": "2016-04-22",
            "band": "250m_16_days_NDVI",
            "tile": "h13v10",
            "proc_date": "2021349015846",
            "data": [3637],
        },
        {
            "modis_date": "A2016113",
            "calendar_date": "2016-04-22",
            "band": "250m_16_days_EVI",
            "tile": "h13v10",
            "proc_date": "2021349015846",
            "data": [1949],
        },
    ],
}

TEST_BAND = NdviBand(scale=0.0001, fill=-3000)


def _bands_payload(scale: str | None = "0.0001", fill: str = "-3000") -> dict[str, Any]:
    ndvi: dict[str, str] = {
        "band": ORNL_NDVI_BAND,
        "units": "NDVI ratio - No units",
        "valid_range": "-2000 to 10000",
        "fill_value": fill,
    }
    if scale is not None:
        ndvi["scale_factor"] = scale
    return {
        "bands": [
            ndvi,
            {
                "band": ORNL_QUALITY_BAND,
                "units": "rank",
                "valid_range": "0 to 3",
                "fill_value": "-1",
            },
        ]
    }


def _calendar(modis_date: str) -> str:
    year, doy = int(modis_date[1:5]), int(modis_date[5:])
    return date.fromordinal(date(year, 1, 1).toordinal() + doy - 1).isoformat()


def _response(status: int, payload: object = None, body: bytes | None = None) -> HttpResponse:
    if body is None:
        body = json.dumps(payload).encode("utf-8") if payload is not None else b""
    return HttpResponse(status=status, body=body)


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class FakeOrnl:
    """Serviço da ORNL de mentira: bandas, datas e recortes de um pixel, com valores de teste.

    `values[(produto, data_modis)] = (ndvi_bruto, pixel_reliability)`. Recorte cujo `startDate` está
    em `failing`, ou com mais de `max_dates` datas, responde sempre 502 (o proxy da ORNL corta o
    pedido que passa de ~60 s).
    """

    def __init__(
        self,
        values: dict[tuple[str, str], tuple[int, int]],
        failing: set[tuple[str, str]] | None = None,
        max_dates: int | None = None,
    ) -> None:
        self.values = values
        self.failing = failing or set()
        self.max_dates = max_dates
        self.requests: list[HttpRequest] = []

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.requests.append(request)
        path = urllib.parse.urlparse(request.url).path.removeprefix(API_PATH)
        product, endpoint = path.strip("/").split("/")
        if endpoint == "bands":
            return _response(200, _bands_payload())
        if endpoint == "dates":
            dates = sorted({d for p, d in self.values if p == product})
            return _response(
                200, {"dates": [{"modis_date": d, "calendar_date": _calendar(d)} for d in dates]}
            )
        assert endpoint == "subset", f"pedido inesperado: {path}"
        params = request.params
        start, end = str(params["startDate"]), str(params["endDate"])
        in_range = [d for p, d in self.values if p == product and start <= d <= end]
        too_many = self.max_dates is not None and len(in_range) > self.max_dates
        if (product, start) in self.failing or too_many:
            return _response(502, body=b"<html>502 Proxy Error</html>")
        items = []
        for (p, modis_date), (ndvi, quality) in sorted(self.values.items()):
            if p != product or not start <= modis_date <= end:
                continue
            for band, value in ((ORNL_NDVI_BAND, ndvi), (ORNL_QUALITY_BAND, quality)):
                items.append(
                    {
                        "modis_date": modis_date,
                        "calendar_date": _calendar(modis_date),
                        "band": band,
                        "tile": "h00v00",
                        "proc_date": "0000000000000",
                        "data": [value],
                    }
                )
        return _response(200, {"nrows": 1, "ncols": 1, "band": "all", "subset": items})

    def subset_requests(self) -> list[HttpRequest]:
        return [r for r in self.requests if r.url.endswith("/subset")]


# Datas de teste: 4 composições do Terra na janela de 2016, uma fora dos meses (agosto), uma fora
# dos anos (2015), e uma do Aqua. Valores brutos com o fator 0,0001.
TEST_VALUES: dict[tuple[str, str], tuple[int, int]] = {
    ("MOD13Q1", "A2015097"): (5000, 0),  # 2015: fora dos anos
    ("MOD13Q1", "A2016001"): (6000, 0),
    ("MOD13Q1", "A2016017"): (5500, 3),  # nuvem: descartado
    ("MOD13Q1", "A2016097"): (-3000, 0),  # sem dado, mesmo com qualidade boa: descartado
    ("MOD13Q1", "A2016113"): (4000, 1),
    ("MOD13Q1", "A2016225"): (7000, 0),  # agosto: fora dos meses
    ("MYD13Q1", "A2016105"): (4500, 0),
}


def _ornl_client(transport: Any, clock: FakeClock | None = None) -> OrnlClient:
    clock = clock or FakeClock()
    return OrnlClient(
        transport,
        sleep=clock.sleep,
        clock=clock.time,
        log=lambda _msg: None,
        max_retries=3,
        backoff_seconds=20,
    )


def _run_ornl(tmp_path: Path, transport: Any, *extra: str, clock: FakeClock | None = None) -> int:
    clock = clock or FakeClock()

    def no_credentials() -> Any:
        raise AssertionError("a ORNL não usa credencial")

    return run(
        [
            "--fonte",
            "ornl",
            "--saida",
            str(tmp_path / "saida" / "ndvi.json"),
            "--pausa",
            "0",
            *extra,
        ],
        transport=transport,
        load_credentials=no_credentials,
        sleep=clock.sleep,
        clock=clock.time,
        now=lambda: FINISHED_AT,
        log=lambda _msg: None,
    )


# --- calendário e blocos ------------------------------------------------------------------


def test_should_list_the_16_day_composites_from_january_to_july_of_2016_to_2025() -> None:
    terra = modis_calendar("MOD13Q1")
    aqua = modis_calendar("MYD13Q1")

    # Terra começa no dia 1 e Aqua no dia 9, de 16 em 16 dias; julho tem a última de cada ano.
    assert (terra[0], terra[13], terra[-1]) == ("A2016001", "A2016209", "A2025209")
    assert len(terra) == 140
    assert (aqua[0], aqua[12], aqua[-1]) == ("A2016009", "A2016201", "A2025201")
    assert len(aqua) == 130


def test_should_split_the_dates_in_blocks_that_never_cross_a_year() -> None:
    dates = modis_calendar("MOD13Q1")[:14] + modis_calendar("MOD13Q1")[14:28]

    blocks = plan_blocks(dates, 5)

    assert [len(b) for b in blocks] == [5, 5, 4, 5, 5, 4]
    assert all(len({d[1:5] for d in b}) == 1 for b in blocks)
    assert [d for b in blocks for d in b] == dates


def test_should_plan_only_the_missing_dates_in_runs_of_consecutive_dates() -> None:
    dates = modis_calendar("MOD13Q1")[:7]  # A2016001 ... A2016097

    blocks = plan_blocks(dates, 5, skip={"A2016033"})

    # O recorte vai do início ao fim: nunca pula por cima de uma data já guardada.
    assert blocks == [("A2016001", "A2016017"), ("A2016049", "A2016065", "A2016081", "A2016097")]


def test_should_refuse_more_than_10_dates_per_request() -> None:
    with pytest.raises(ValueError, match="10"):
        plan_blocks(modis_calendar("MOD13Q1"), 11)


# --- respostas da ORNL --------------------------------------------------------------------


def test_should_read_the_ndvi_scale_and_fill_from_the_bands_metadata() -> None:
    assert parse_ornl_bands(_bands_payload()) == NdviBand(scale=0.0001, fill=-3000)


@pytest.mark.parametrize(
    "payload",
    [
        {"bands": []},
        _bands_payload(scale=None),
        _bands_payload(scale="abc"),
        {"bands": [_bands_payload()["bands"][0]]},  # sem pixel_reliability
        "<html>erro</html>",
    ],
)
def test_should_refuse_bands_metadata_without_scale_or_quality(payload: Any) -> None:
    with pytest.raises(OrnlError):
        parse_ornl_bands(payload)


def test_should_keep_only_the_season_dates_from_the_dates_list() -> None:
    payload = {
        "dates": [
            {"modis_date": "A2015353", "calendar_date": "2015-12-19"},
            {"modis_date": "A2016001", "calendar_date": "2016-01-01"},
            {"modis_date": "A2016209", "calendar_date": "2016-07-27"},
            {"modis_date": "A2016225", "calendar_date": "2016-08-12"},
            {"modis_date": "A2026001", "calendar_date": "2026-01-01"},
        ]
    }

    assert parse_ornl_dates(payload) == ["A2016001", "A2016209"]
    with pytest.raises(OrnlError):
        parse_ornl_dates({"erro": "x"})


def test_should_parse_a_real_ornl_subset_with_the_scale_applied() -> None:
    block = OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016097", "A2016113"))
    check_ornl_subset(REAL_SUBSET_SAMPLE, block)

    observations = parse_ornl_subset(REAL_SUBSET_SAMPLE, block, "p1", TEST_BAND)

    assert [(o.day, o.product, o.ndvi, o.quality) for o in observations] == [
        (date(2016, 4, 6), "MOD13Q1", 0.3253, 0),
        (date(2016, 4, 22), "MOD13Q1", 0.3637, 0),
    ]
    assert {(o.point_id, o.lat, o.lon) for o in observations} == {("p1", -18.9543, -48.1993)}


def test_should_turn_the_fill_value_into_no_data() -> None:
    payload = json.loads(json.dumps(REAL_SUBSET_SAMPLE))
    payload["subset"][1]["data"] = [-3000]
    block = OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016097", "A2016113"))

    observations = parse_ornl_subset(payload, block, "p1", TEST_BAND)

    assert observations[0].ndvi is None


@pytest.mark.parametrize(
    "change",
    [
        lambda p: p["subset"].pop(1),  # falta o NDVI de uma data
        lambda p: p["subset"].pop(0),  # falta a qualidade de uma data
        lambda p: p["subset"][1].update(data=[]),  # sem valor
        lambda p: p["subset"][1].update(data=[3253, 3300]),  # mais de um pixel
        lambda p: p["subset"][1].update(data=["x"]),  # valor que não é número
        lambda p: p["subset"][1].update(data=[0.3253]),  # NDVI já escalado: a escala dobraria
        lambda p: p.pop("subset"),
    ],
)
def test_should_refuse_a_subset_missing_a_date_band_or_value(change: Any) -> None:
    payload = json.loads(json.dumps(REAL_SUBSET_SAMPLE))
    change(payload)
    block = OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016097", "A2016113"))

    with pytest.raises(OrnlError):
        check_ornl_subset(payload, block)


# --- cliente: retentativa -----------------------------------------------------------------


class ScriptedTransport:
    """Devolve as respostas (ou levanta as exceções) na ordem."""

    def __init__(self, answers: list[HttpResponse | Exception]) -> None:
        self.answers = list(answers)
        self.requests: list[HttpRequest] = []

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.requests.append(request)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def test_should_retry_on_proxy_error_network_failure_and_bad_body() -> None:
    transport = ScriptedTransport(
        [
            _response(502, body=b"<html>502 Proxy Error</html>"),
            TimeoutError("timed out"),
            _response(200, body=b"<html>nao e json</html>"),
            _response(200, _bands_payload()),
        ]
    )
    clock = FakeClock()

    body = _ornl_client(transport, clock).fetch("MOD13Q1/bands", {}, parse_ornl_bands, "bandas")

    assert parse_ornl_bands(json.loads(body)) == TEST_BAND
    assert clock.sleeps == [20, 40, 80]
    assert transport.requests[0].url == f"{ORNL_API_URL}/MOD13Q1/bands"


def test_should_give_up_after_the_retries_with_a_resumable_error() -> None:
    transport = ScriptedTransport([_response(503)] * 4)

    with pytest.raises(OrnlUnavailableError, match="4 tentativas"):
        _ornl_client(transport).fetch("MOD13Q1/bands", {}, parse_ornl_bands, "bandas")


def test_should_not_retry_a_request_the_ornl_refuses() -> None:
    transport = ScriptedTransport([_response(400, {"message": "Invalid band"})])

    with pytest.raises(OrnlError, match="400.*Invalid band") as excinfo:
        _ornl_client(transport).fetch("MOD13Q1/bands", {}, parse_ornl_bands, "bandas")

    assert not isinstance(excinfo.value, OrnlUnavailableError)
    assert len(transport.requests) == 1


def test_should_ask_one_pixel_and_the_block_dates_in_the_subset_request() -> None:
    fake = FakeOrnl(TEST_VALUES)
    fetcher = CachedOrnlFetcher(_ornl_client(fake), Path("/nao-usado"), pause_seconds=0)
    block = OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016001", "A2016017", "A2016097"))

    params = fetcher.subset_params(block)

    assert params == {
        "latitude": -18.9543,
        "longitude": -48.1993,
        "startDate": "A2016001",
        "endDate": "A2016097",
        "kmAboveBelow": 0,
        "kmLeftRight": 0,
    }


# --- cache --------------------------------------------------------------------------------


def test_should_cache_only_checked_responses_and_reuse_them(tmp_path: Path) -> None:
    fake = FakeOrnl(TEST_VALUES)
    cache = tmp_path / "cache"
    fetcher = CachedOrnlFetcher(_ornl_client(fake), cache, pause_seconds=0)
    block = OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016001", "A2016017"))

    first = fetcher.subset(block)
    second = CachedOrnlFetcher(_ornl_client(fake), cache, pause_seconds=0).subset(block)

    assert first == second
    assert len(fake.subset_requests()) == 1
    assert not list(cache.rglob("*.part"))


def test_should_read_the_cached_values_by_date_from_every_saved_block(tmp_path: Path) -> None:
    fake = FakeOrnl(TEST_VALUES)
    cache = tmp_path / "cache"
    fetcher = CachedOrnlFetcher(_ornl_client(fake), cache, pause_seconds=0)
    fetcher.subset(OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016001",)))
    fetcher.subset(OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016097", "A2016113")))

    values = fetcher.cached_values(DEFAULT_POINT, "MOD13Q1")

    assert values == {
        ("A2016001", ORNL_NDVI_BAND): 6000,
        ("A2016001", ORNL_QUALITY_BAND): 0,
        ("A2016097", ORNL_NDVI_BAND): -3000,
        ("A2016097", ORNL_QUALITY_BAND): 0,
        ("A2016113", ORNL_NDVI_BAND): 4000,
        ("A2016113", ORNL_QUALITY_BAND): 1,
    }
    assert fetcher.cached_values(DEFAULT_POINT, "MYD13Q1") == {}


def test_should_not_cache_a_response_that_fails_the_check(tmp_path: Path) -> None:
    # A ORNL "perdeu" uma data do bloco: a resposta não entra no cache.
    fake = FakeOrnl({("MOD13Q1", "A2016001"): (6000, 0)})
    cache = tmp_path / "cache"
    fetcher = CachedOrnlFetcher(_ornl_client(fake), cache, pause_seconds=0)
    block = OrnlBlock(DEFAULT_POINT, "MOD13Q1", ("A2016001", "A2016017"))

    with pytest.raises(OrnlUnavailableError):
        fetcher.subset(block)

    assert fetcher.cached_values(DEFAULT_POINT, "MOD13Q1") == {}
    assert not [p for p in cache.rglob("*") if p.is_file()]


# --- linha de comando ---------------------------------------------------------------------


def test_should_write_the_contract_file_from_the_ornl_without_credentials(tmp_path: Path) -> None:
    fake = FakeOrnl(TEST_VALUES)

    code = _run_ornl(tmp_path, fake)

    assert code == 0
    output = tmp_path / "saida" / "ndvi.json"
    payload = json.loads(output.read_text(encoding="utf-8"))
    versao = payload["versao_dados"]
    run_record = DataRun(
        source=versao["fonte"],
        params=versao["parametros"],
        finished_at=datetime.fromisoformat(versao["fim"]),
        version=versao["versao"],
    )
    assert run_record.source == "modis_mod13q1"
    assert versao["versao"] == "2026.11-modis-ndvi"
    params = versao["parametros"]
    assert params["servico"] == "ornl"
    assert params["url"] == ORNL_API_URL
    assert params["produtos"] == ["MOD13Q1", "MYD13Q1"]
    assert params["camadas"] == [ORNL_NDVI_BAND, ORNL_QUALITY_BAND]
    assert params["fator_escala"] == 0.0001
    assert params["qualidade_aceita"] == [0, 1]
    [point] = payload["pontos"]
    assert (point["lat"], point["lon"]) == (-18.9543, -48.1993)
    assert point["serie"] == [
        {"data": "2016-01-01", "ndvi": 0.6, "qualidade": 0, "produto": "MOD13Q1"},
        {"data": "2016-04-14", "ndvi": 0.45, "qualidade": 0, "produto": "MYD13Q1"},
        {"data": "2016-04-22", "ndvi": 0.4, "qualidade": 1, "produto": "MOD13Q1"},
    ]
    for item in point["serie"]:
        NdviRecord(
            data=date.fromisoformat(item["data"]),
            ndvi=item["ndvi"],
            qualidade=item["qualidade"],
            produto=item["produto"],
        )
    # Só as datas da janela são pedidas: 2015 e agosto nem entram nos recortes.
    asked = {(r.url.split("/")[-2], r.params["startDate"]) for r in fake.subset_requests()}
    assert asked == {("MOD13Q1", "A2016001"), ("MYD13Q1", "A2016105")}
    assert not list(output.parent.glob("*.part"))


def test_should_keep_the_ornl_cache_next_to_the_output_by_default(tmp_path: Path) -> None:
    _run_ornl(tmp_path, FakeOrnl(TEST_VALUES))

    cache = tmp_path / "saida" / "cache_ornl"
    assert (cache / "MOD13Q1_bandas.json").is_file()
    assert (cache / "lat-18.9543_lon-48.1993" / "MYD13Q1" / "datas.json").is_file()
    assert (cache / "lat-18.9543_lon-48.1993" / "MOD13Q1" / "A2016001_A2016113.json").is_file()


def test_should_resume_from_the_cache_without_asking_the_ornl_again(tmp_path: Path) -> None:
    assert _run_ornl(tmp_path, FakeOrnl(TEST_VALUES)) == 0
    second = FakeOrnl(TEST_VALUES)

    assert _run_ornl(tmp_path, second) == 0

    assert second.requests == []


def test_should_return_code_2_and_keep_what_was_fetched_when_a_block_fails(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    fake = FakeOrnl(TEST_VALUES, failing={("MYD13Q1", "A2016105")})

    code = run(
        ["--fonte", "ornl", "--saida", str(tmp_path / "ndvi.json"), "--pausa", "0"],
        transport=fake,
        sleep=FakeClock().sleep,
        now=lambda: FINISHED_AT,
    )

    assert code == 2
    assert not (tmp_path / "ndvi.json").exists()
    assert (tmp_path / "cache_ornl" / "lat-18.9543_lon-48.1993" / "MOD13Q1").is_dir()
    err = capsys.readouterr().err
    assert "MYD13Q1" in err
    assert "rode de novo" in err


def test_should_split_a_block_that_keeps_failing_into_halves(tmp_path: Path) -> None:
    # Só passa recorte de até 2 datas (os maiores estouram o tempo e voltam 502).
    values = {("MOD13Q1", d): (6000, 0) for d in modis_calendar("MOD13Q1")[:5]}
    fake = FakeOrnl(values, max_dates=2)

    code = _run_ornl(tmp_path, fake)

    assert code == 0
    sizes = [
        len([d for d in values if r.params["startDate"] <= d[1] <= r.params["endDate"]])
        for r in fake.subset_requests()
    ]
    # 5 datas: 2 tentativas e divide em 3 + 2; o de 3 tenta 2 vezes e divide em 2 + 1.
    assert sizes == [5, 5, 3, 3, 2, 1, 2]
    payload = json.loads((tmp_path / "saida" / "ndvi.json").read_text(encoding="utf-8"))
    assert len(payload["pontos"][0]["serie"]) == 5


def test_should_reuse_the_cache_when_the_dates_per_request_change(tmp_path: Path) -> None:
    assert _run_ornl(tmp_path, FakeOrnl(TEST_VALUES)) == 0
    second = FakeOrnl(TEST_VALUES)

    assert _run_ornl(tmp_path, second, "--datas-por-pedido", "2") == 0

    assert second.subset_requests() == []


def test_should_stop_early_when_the_ornl_keeps_failing(tmp_path: Path) -> None:
    values = {("MOD13Q1", d): (6000, 0) for d in modis_calendar("MOD13Q1")[:14]}
    fake = FakeOrnl(values, failing={("MOD13Q1", d) for d in modis_calendar("MOD13Q1")})

    code = _run_ornl(tmp_path, fake, "--datas-por-pedido", "1")

    assert code == 2
    # 3 blocos seguidos sem resposta (4 tentativas cada) e para: não tenta os 14.
    assert len({r.params["startDate"] for r in fake.subset_requests()}) == 3
    assert len(fake.subset_requests()) == 12


def test_should_show_the_requests_and_estimated_time_on_ornl_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = run(
        ["--fonte", "ornl", "--dry-run", "--saida", str(tmp_path / "ndvi.json")],
        transport=FakeOrnl({}),
        load_credentials=lambda: pytest.fail("dry-run não lê credencial"),
    )

    assert code == 0
    out = capsys.readouterr().out
    # 2 bandas + 2 listas de datas + recortes de até 5 datas: Terra 14/ano (5+5+4) e Aqua 13/ano
    # (5+5+3), 3 + 3 por ano em 10 anos.
    assert "Pedidos que faltam: 64 (2 de bandas, 2 de datas, 60 recortes)" in out
    assert "composições já no cache: 0 de 270" in out
    assert "Tempo estimado" in out
    assert not (tmp_path / "ndvi.json").exists()


def test_should_count_only_what_is_missing_in_the_cache_on_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run_ornl(tmp_path, FakeOrnl(TEST_VALUES)) == 0
    capsys.readouterr()

    code = _run_ornl(tmp_path, FakeOrnl({}), "--dry-run")

    assert code == 0
    assert "Pedidos que faltam: 0 (" in capsys.readouterr().out


# --- caminhos padrão ----------------------------------------------------------------------


def test_should_find_the_repo_root_from_the_script_path() -> None:
    assert repo_root(Path("/repo/projeto/backend/pipeline/fetch_ndvi.py")) == Path("/repo")
    # No container não há projeto/backend acima: a raiz fica a pasta do backend.
    assert repo_root(Path("/app/pipeline/fetch_ndvi.py")) == Path("/app")


def test_should_write_to_the_team_folder_by_default() -> None:
    expected = repo_root() / "data" / "baixados" / "nasa_modis_ndvi" / "ndvi_modis_appeears.json"

    assert expected == DEFAULT_OUTPUT


def test_should_fetch_each_point_into_its_own_cache_folder(tmp_path: Path) -> None:
    fake = FakeOrnl({("MOD13Q1", "A2016001"): (6000, 0), ("MYD13Q1", "A2016009"): (6100, 1)})

    code = _run_ornl(tmp_path, fake, "--pontos", "-18.9543,-48.1993;-17.5,-47.25")

    assert code == 0
    cache = tmp_path / "saida" / "cache_ornl"
    assert sorted(p.name for p in cache.iterdir() if p.is_dir()) == [
        "lat-17.5000_lon-47.2500",
        "lat-18.9543_lon-48.1993",
    ]
    payload = json.loads((tmp_path / "saida" / "ndvi.json").read_text(encoding="utf-8"))
    assert [(p["lat"], p["lon"], len(p["serie"])) for p in payload["pontos"]] == [
        (-18.9543, -48.1993, 2),
        (-17.5, -47.25, 2),
    ]
    # As bandas são pedidas uma vez por produto, não por ponto.
    assert len([r for r in fake.requests if r.url.endswith("/bands")]) == 2
