"""Testes do script da chuva dos últimos 30 dias pelo IMERG Late (A2.3), com HTTP falso.

Os números de chuva aqui são valores de teste, não dados do IMERG nem do POWER.
"""

import json
from collections.abc import Mapping
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.models.climate import ClimateSeason
from app.models.recent_rain import RecentRainRecord
from app.models.sinal_outono import RecentRain
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.recent_rain_repository import FileRecentRainRepository
from pipeline.fetch_cmip6_deltas import PILOT_BOX, Box
from pipeline.fetch_imerg_late import (
    CMR_GRANULES_URL,
    Granule,
    ImergWindow,
    box_window,
    build_records,
    cell_totals,
    check_granules,
    cmr_params,
    opendap_ascii_url,
    parse_cmr_granules,
    parse_imerg_ascii,
    pixel_cell_id,
    pixel_center,
    power_window_average,
    run,
)

TEST_TOKEN = "token-de-teste"
NOW = datetime(2027, 3, 1, 12, 0, tzinfo=UTC)
UFU = (-18.9543, -48.1993)  # célula -190_-482
# Caixa pequena: células -190 e -189 de latitude, -482 e -481 de longitude (2 × 2).
SMALL_BOX = Box(-19.0, -18.8, -48.2, -48.0)
SMALL_WINDOW = ImergWindow(lat_first=710, lat_last=711, lon_first=1318, lon_last=1319)
OPENDAP_PREFIX = "https://opendap.earthdata.nasa.gov/collections/C2723754859-GES_DISC/granules/"


def _granule_name(day: date) -> str:
    return f"3B-DAY-L.MS.MRG.3IMERG.{day:%Y%m%d}-S000000-E235959.V07C.nc4"


def _granule_url(day: date) -> str:
    return f"{OPENDAP_PREFIX}GPM_3IMERGDL.07%3A{_granule_name(day)}"


def _cmr_entry(day: date, with_opendap: bool = True) -> dict[str, Any]:
    links = [
        {
            "rel": "http://esipfed.org/ns/fedsearch/1.1/data#",
            "href": f"https://data.gesdisc.earthdata.nasa.gov/data/GPM_L3/{_granule_name(day)}",
        }
    ]
    if with_opendap:
        links.append(
            {"rel": "http://esipfed.org/ns/fedsearch/1.1/service#", "href": _granule_url(day)}
        )
    return {"title": f"GPM_3IMERGDL.07:{_granule_name(day)}",
            "time_start": f"{day.isoformat()}T00:00:00.000Z", "links": links}  # fmt: skip


def _cmr_payload(days: list[date]) -> dict[str, Any]:
    return {"feed": {"entry": [_cmr_entry(day) for day in days]}}


def _ascii(day: date, values: Mapping[str, float]) -> str:
    """Recorte no formato ASCII do Hyrax (Grid com os mapas), na caixa pequena.

    `values` por célula; célula ausente sai com o valor de preenchimento do IMERG (-9999,9).
    """
    lats, lons = (-18.95, -18.85), (-48.15, -48.05)
    cells = {(-18.95, -48.15): "-190_-482", (-18.85, -48.15): "-189_-482",
             (-18.95, -48.05): "-190_-481", (-18.85, -48.05): "-189_-481"}  # fmt: skip
    seconds = int((datetime(day.year, day.month, day.day, tzinfo=UTC)).timestamp())
    lines = [f"Dataset: {_granule_name(day)}", "precipitation.lat, " + ", ".join(map(str, lats))]
    for lon in lons:
        row = ", ".join(str(values.get(cells[(lat, lon)], -9999.9)) for lat in lats)
        lines.append(
            f"precipitation.precipitation[precipitation.time={seconds}]"
            f"[precipitation.lon={lon}], {row}"
        )
    return "\n".join(lines) + "\n"


def _season(year: int, rain_per_day: float, days: int = 212) -> ClimateSeason:
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple([rain_per_day] * days),
        rain_source="nasa_power",
        tmax_c=tuple([30.0] * days),
        tmin_c=tuple([18.0] * days),
    )


# --- grade do IMERG e caixa ----------------------------------------------------------------------


def test_should_cover_the_225_cells_of_the_pilot_box_with_imerg_pixels() -> None:
    window = box_window(PILOT_BOX)

    assert window == ImergWindow(lat_first=701, lat_last=715, lon_first=1310, lon_last=1324)
    assert len(window.cell_ids()) == 225
    assert "-190_-482" in window.cell_ids()


def test_should_put_each_imerg_pixel_on_the_backend_cell_with_center_at_x_x5() -> None:
    # Pixel de 0,1° do IMERG com bordas nos décimos: é a própria célula do `cell_id_for`.
    assert pixel_cell_id(710, 1318) == "-190_-482"
    assert pixel_center(710, 1318) == pytest.approx((-18.95, -48.15))
    assert box_window(SMALL_BOX) == SMALL_WINDOW


def test_should_build_the_opendap_ascii_url_of_the_window_with_encoded_brackets() -> None:
    granule = Granule(
        day=date(2027, 2, 28), name="x.nc4", opendap_url=_granule_url(date(2027, 2, 28))
    )

    url = opendap_ascii_url(granule, SMALL_WINDOW)

    # precipitation[time][lon][lat]; colchetes codificados como no OPeNDAP da NCCS.
    assert url == (
        f"{_granule_url(date(2027, 2, 28))}.ascii?"
        "precipitation%5B0:1:0%5D%5B1318:1:1319%5D%5B710:1:711%5D"
    )


# --- CMR (público): os granulos de cada dia ---------------------------------------------------


def test_should_ask_cmr_for_the_daily_late_granules_of_the_window() -> None:
    params = cmr_params(date(2027, 1, 30), date(2027, 2, 28))

    assert params == {
        "short_name": "GPM_3IMERGDL",
        "version": "07",
        "temporal": "2027-01-30T00:00:00Z,2027-02-28T23:59:59Z",
        "page_size": 100,
        "sort_key": "start_date",
    }


def test_should_read_day_name_and_opendap_link_of_each_granule() -> None:
    day = date(2027, 2, 28)
    payload = {"feed": {"entry": [_cmr_entry(day), _cmr_entry(date(2027, 2, 27), False)]}}

    granules = parse_cmr_granules(payload)

    # Granulo sem link do OPeNDAP não serve: o dia vai aparecer como faltando.
    assert granules == [Granule(day=day, name=_granule_name(day), opendap_url=_granule_url(day))]


def test_should_refuse_a_window_with_a_missing_day() -> None:
    days = [date(2027, 2, 26), date(2027, 2, 27), date(2027, 2, 28)]
    granules = parse_cmr_granules(_cmr_payload([days[0], days[2]]))

    with pytest.raises(ValueError, match="2027-02-27"):
        check_granules(granules, days)


# --- recorte em ASCII (Hyrax) ------------------------------------------------------------------


def test_should_read_the_hyrax_grid_ascii_by_cell_with_the_fill_value_as_missing() -> None:
    text = _ascii(date(2027, 2, 28), {"-190_-482": 2.5, "-189_-482": 0.0, "-190_-481": 1.25})

    values = parse_imerg_ascii(text, SMALL_WINDOW)

    assert values == {"-190_-482": 2.5, "-189_-482": 0.0, "-190_-481": 1.25, "-189_-481": None}


def test_should_read_the_hyrax_array_ascii_without_maps() -> None:
    # Sem os mapas (variável servida como Array): as coordenadas saem dos índices pedidos.
    text = "Dataset: x.nc4\nprecipitation[0][0], 2.5, 0\nprecipitation[0][1], 1.25, 3\n"

    values = parse_imerg_ascii(text, SMALL_WINDOW)

    assert values == {"-190_-482": 2.5, "-189_-482": 0.0, "-190_-481": 1.25, "-189_-481": 3.0}


@pytest.mark.parametrize(
    "text",
    [
        'Error {\n    code = 404;\n    message = "Not found";\n};\n',
        "<!DOCTYPE html><html><title>Earthdata Login</title></html>",
        "Dataset: x.nc4\nprecipitation.lat, -18.95, -18.85\n",
    ],
)
def test_should_refuse_an_answer_without_the_cut(text: str) -> None:
    # A página de login da Earthdata (token vencido) não pode virar chuva zero.
    with pytest.raises(ValueError, match="OPeNDAP"):
        parse_imerg_ascii(text, SMALL_WINDOW)


def test_should_refuse_a_cut_of_other_pixels() -> None:
    text = _ascii(date(2027, 2, 28), {}).replace(
        "precipitation.lon=-48.05", "precipitation.lon=-47.95"
    )

    with pytest.raises(ValueError, match="lon"):
        parse_imerg_ascii(text, SMALL_WINDOW)


# --- soma dos dias e média do POWER --------------------------------------------------------------


def test_should_sum_the_days_and_drop_a_cell_with_a_missing_day() -> None:
    days = [{"-190_-482": 2.0, "-189_-482": 1.0}, {"-190_-482": 3.5, "-189_-482": None}]

    assert cell_totals(days) == {"-190_-482": 5.5}


def test_should_average_the_same_days_of_the_power_years() -> None:
    seasons = [_season(2005, 1.0), _season(2006, 2.0)]

    # 1/fev a 2/mar: 30 dias; 30 mm em 2005 e 60 mm em 2006.
    assert power_window_average(seasons, date(2027, 2, 1), date(2027, 3, 2)) == (45.0, 2)


def test_should_have_no_power_average_outside_january_to_july() -> None:
    # O POWER guardado vai de 1/jan a 31/jul: outubro e a virada do ano ficam sem média.
    seasons = [_season(2005, 1.0), _season(2006, 2.0)]

    assert power_window_average(seasons, date(2026, 10, 15), date(2026, 11, 13)) is None
    assert power_window_average(seasons, date(2026, 12, 12), date(2027, 1, 10)) is None


def test_should_use_feb_28_for_a_window_ending_on_feb_29_in_common_years() -> None:
    # 2028 é bissexto; 2005 não: a janela de 30 dias termina em 28/fev de 2005.
    seasons = [_season(2005, 1.0)]

    assert power_window_average(seasons, date(2028, 1, 31), date(2028, 2, 29)) == (30.0, 1)


def test_should_leave_the_year_of_the_window_out_of_the_average() -> None:
    seasons = [_season(2005, 1.0), _season(2027, 9.0)]

    assert power_window_average(seasons, date(2027, 2, 1), date(2027, 3, 2)) == (30.0, 1)


def test_should_build_records_with_rounded_sums_and_the_fraction() -> None:
    totals = {"-190_-482": 85.34, "-189_-482": 12.0, "-190_-481": 3.0}
    averages = {"-190_-482": (190.24, 20), "-190_-481": (0.0, 20)}

    records = build_records(totals, averages, end=date(2027, 2, 28), days=30)

    # Sem média (célula fora do POWER) ou com média zero: a célula fica de fora.
    assert records == [
        RecentRainRecord(
            cell_id="-190_-482",
            lat=-18.95,
            lon=-48.15,
            data=date(2027, 2, 28),
            dias=30,
            chuva_30d_mm=85.3,
            media_30d_mm=190.2,
            fracao_da_media=0.4485,
            anos_media=20,
        )
    ]


# --- execução com HTTP falso -------------------------------------------------------------------


class FakeTransport:
    """CMR e OPeNDAP falsos; guarda os pedidos. `opendap_status` força a resposta do OPeNDAP."""

    def __init__(self, days: list[date], values: Mapping[date, Mapping[str, float]],
                 opendap_status: list[int] | None = None) -> None:  # fmt: skip
        self.days = days
        self.values = values
        self.opendap_status = list(opendap_status or [])
        self.requests: list[HttpRequest] = []

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.requests.append(request)
        if request.url == CMR_GRANULES_URL:
            days = self.days if "temporal" in request.params else self.days[-1:]
            return HttpResponse(200, json.dumps(_cmr_payload(days)).encode())
        status = self.opendap_status.pop(0) if self.opendap_status else 200
        if status != 200:
            return HttpResponse(status, b"")
        day = next(d for d in self.days if _granule_name(d) in request.url)
        return HttpResponse(200, _ascii(day, self.values[day]).encode())

    def opendap_requests(self) -> list[HttpRequest]:
        return [r for r in self.requests if r.url != CMR_GRANULES_URL]


class FakeClimateRepository:
    """POWER de teste: 4 mm/dia em 2005 e 6 mm/dia em 2006, em qualquer célula."""

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return [_season(2005, 4.0), _season(2006, 6.0)]


DAYS = [date(2027, 2, 26), date(2027, 2, 27), date(2027, 2, 28)]
VALUES = {
    DAYS[0]: {"-190_-482": 1.0, "-189_-482": 5.0, "-190_-481": 0.0, "-189_-481": 2.0},
    DAYS[1]: {"-190_-482": 2.0, "-189_-482": 5.0, "-190_-481": 0.0, "-189_-481": 2.0},
    DAYS[2]: {"-190_-482": 3.0, "-189_-482": 5.0, "-190_-481": 0.0},  # -189_-481 sem dado
}


def _run(tmp_path: Path, transport: FakeTransport, *extra: str, token: str | None = TEST_TOKEN,
         log: list[str] | None = None) -> int:  # fmt: skip
    messages = log if log is not None else []
    return run(
        ["--dias", "3", "--area=-19.0,-18.8,-48.2,-48.0",
         "--saida", str(tmp_path / "chuva.json"), "--cache", str(tmp_path / "cache"), *extra],
        transport=transport,
        load_token=lambda: token,
        load_climate_repository=FakeClimateRepository,
        now=lambda: NOW,
        sleep=lambda _: None,
        log=messages.append,
    )  # fmt: skip


def test_should_write_the_contract_file_that_the_api_reads(tmp_path: Path) -> None:
    transport = FakeTransport(DAYS, VALUES)

    assert _run(tmp_path, transport) == 0

    payload = json.loads((tmp_path / "chuva.json").read_text(encoding="utf-8"))
    assert payload["versao_dados"]["fonte"] == "imerg_late"
    assert payload["versao_dados"]["versao"] == "2027.03-imerg-late"
    params = payload["versao_dados"]["parametros"]
    assert params["produto"] == "GPM_3IMERGDL.07"
    assert (params["inicio"], params["fim"], params["dias"]) == ("2027-02-26", "2027-02-28", 3)
    assert params["media"]["fonte"] == "nasa_power"
    # -189_-481 ficou sem um dia: fora do arquivo (nada de soma pela metade).
    assert sorted(c["cell_id"] for c in payload["celulas"]) == [
        "-189_-482", "-190_-481", "-190_-482"
    ]  # fmt: skip
    # Média do POWER nos 3 dias: (12 + 18) / 2 = 15 mm; IMERG na lavoura: 1 + 2 + 3 = 6 mm.
    rain = FileRecentRainRepository(tmp_path / "chuva.json").get_recent_rain(*UFU)
    assert rain == RecentRain(chuva_mm=6.0, media_mm=15.0, dias=3, data=date(2027, 2, 28))


def test_should_send_the_token_only_to_opendap_and_end_on_the_latest_cmr_day(
    tmp_path: Path,
) -> None:
    transport = FakeTransport(DAYS, VALUES)

    assert _run(tmp_path, transport) == 0

    cmr = [r for r in transport.requests if r.url == CMR_GRANULES_URL]
    assert all(r.authorization is None for r in cmr)
    assert [r.authorization for r in transport.opendap_requests()] == [f"Bearer {TEST_TOKEN}"] * 3
    assert cmr[-1].params["temporal"] == "2027-02-26T00:00:00Z,2027-02-28T23:59:59Z"


def test_should_end_on_the_given_day_without_asking_cmr_for_the_latest(tmp_path: Path) -> None:
    transport = FakeTransport(DAYS, VALUES)

    assert _run(tmp_path, transport, "--fim", "2027-02-28") == 0

    assert [r.params.get("temporal") for r in transport.requests if r.url == CMR_GRANULES_URL] == [
        "2027-02-26T00:00:00Z,2027-02-28T23:59:59Z"
    ]


def test_should_reuse_the_cached_days_on_a_second_run(tmp_path: Path) -> None:
    assert _run(tmp_path, FakeTransport(DAYS, VALUES)) == 0
    again = FakeTransport(DAYS, VALUES, opendap_status=[500] * 20)

    assert _run(tmp_path, again) == 0

    assert again.opendap_requests() == []


def test_should_retry_a_server_error(tmp_path: Path) -> None:
    transport = FakeTransport(DAYS, VALUES, opendap_status=[503])

    assert _run(tmp_path, transport) == 0

    assert len(transport.opendap_requests()) == 4


def test_should_stop_with_a_hint_when_the_token_is_refused(tmp_path: Path) -> None:
    log: list[str] = []
    transport = FakeTransport(DAYS, VALUES, opendap_status=[401])

    assert _run(tmp_path, transport, log=log) == 1

    assert not (tmp_path / "chuva.json").exists()
    assert len(transport.opendap_requests()) == 1
    assert "EARTHDATA_TOKEN" in "\n".join(log)
    assert TEST_TOKEN not in "\n".join(log)


def test_should_stop_without_network_when_there_is_no_token(tmp_path: Path) -> None:
    log: list[str] = []
    transport = FakeTransport(DAYS, VALUES)

    assert _run(tmp_path, transport, token=None, log=log) == 1

    assert transport.requests == []
    assert "EARTHDATA_TOKEN" in "\n".join(log)


def test_should_not_overwrite_the_file_when_no_cell_has_an_average(tmp_path: Path) -> None:
    # Outubro: o POWER guardado (1/jan a 31/jul) não tem a média; o arquivo de antes fica.
    october = [date(2026, 10, 11), date(2026, 10, 12), date(2026, 10, 13)]
    values = {day: {"-190_-482": 1.0} for day in october}
    (tmp_path / "chuva.json").write_text("{}", encoding="utf-8")
    log: list[str] = []

    assert _run(tmp_path, FakeTransport(october, values), log=log) == 1

    assert (tmp_path / "chuva.json").read_text(encoding="utf-8") == "{}"
    assert "média" in "\n".join(log)


def test_should_show_the_plan_without_network_or_token_on_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    transport = FakeTransport(DAYS, VALUES)

    assert _run(tmp_path, transport, "--dry-run", "--fim", "2027-02-28", token=None) == 0

    assert transport.requests == []
    out = capsys.readouterr().out
    assert "2027-02-26 a 2027-02-28" in out
    assert "4 células" in out
    assert "3 pedidos" in out


def test_should_keep_the_cache_per_day_and_window(tmp_path: Path) -> None:
    assert _run(tmp_path, FakeTransport(DAYS, VALUES)) == 0

    names = sorted(p.name for p in (tmp_path / "cache").iterdir())
    assert names == [
        f"{day:%Y%m%d}_lat710-711_lon1318-1319.txt" for day in DAYS
    ]  # fmt: skip
