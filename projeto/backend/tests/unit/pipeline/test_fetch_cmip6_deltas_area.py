"""Testes do modo por área do script dos deltas do NEX-GDDP-CMIP6 (tarefa 0023).

Nada de rede: o THREDDS (NCSS e OPeNDAP) é um getter falso que serve a mesma grade de teste nos
dois modos. A grade usa o modelo `MODELO-TESTE` e valores redondos de teste, diferentes em cada
pixel. Os únicos trechos de dado real são os `REAL_*`, copiados de respostas de verdade da NCCS
em 14/11/2026 (marcados como tal).
"""

import json
import re
import urllib.parse
from datetime import UTC, date, datetime, timedelta
from fractions import Fraction
from pathlib import Path
from typing import Any

import pytest

from app.models.climate import Cmip6Delta
from app.models.data_run import DataRun
from pipeline.fetch_cmip6_deltas import (
    PILOT_BOX,
    AreaRequest,
    Box,
    CachedNcssFetcher,
    CachedOpendapFetcher,
    ModelFiles,
    Pixel,
    PixelWindow,
    Point,
    box_points,
    build_cmip6_deltas,
    build_cmip6_deltas_by_area,
    daily_values,
    grid_dates,
    main,
    ncss_pixel,
    opendap_ascii_url,
    opendap_das_url,
    parse_box,
    parse_das,
    parse_opendap_ascii,
    pilot_box_points,
    pixel_window,
)

# --- trechos reais (NCCS, 14/11/2026) ---------------------------------------------------------

# OPeNDAP ASCII de ACCESS-CM2, historical, pr, 2000: pr[0:1:1][164:1:165][1247:1:1248] (resposta
# inteira). O pixel (164, 1247) é o mesmo que o NCSS devolveu para a fazenda de exemplo, com os
# mesmos valores (5.391618E-5 e 6.737662E-5).
REAL_OPENDAP_ASCII_SAMPLE = (
    "Dataset {\n"
    "    Grid {\n"
    "     ARRAY:\n"
    "        Float32 pr[time = 2][lat = 2][lon = 2];\n"
    "     MAPS:\n"
    "        Float64 time[time = 2];\n"
    "        Float64 lat[lat = 2];\n"
    "        Float64 lon[lon = 2];\n"
    "    } pr;\n"
    "} AMES/NEX/GDDP-CMIP6/ACCESS-CM2/historical/r1i1p1f1/pr/"
    "pr_day_ACCESS-CM2_historical_r1i1p1f1_gn_2000_v2.0.nc;\n"
    "---------------------------------------------\n"
    "pr.pr[2][2][2]\n"
    "[0][0], 5.391618E-5, 4.932583E-5\n"
    "[0][1], 4.7671096E-5, 4.2142627E-5\n"
    "[1][0], 6.737662E-5, 5.8172525E-5\n"
    "[1][1], 6.59286E-5, 5.5436718E-5\n"
    "\n"
    "pr.time[2]\n"
    "54786.5, 54787.5\n"
    "\n"
    "pr.lat[2]\n"
    "-18.875, -18.625\n"
    "\n"
    "pr.lon[2]\n"
    "311.875, 312.125\n"
    "\n"
    "\n"
)
REAL_SAMPLE_WINDOW = PixelWindow(lat_first=164, lat_last=165, lon_first=1247, lon_last=1248)

# Erro do OPeNDAP (HTTP 400) para um recorte fora da grade (resposta inteira).
REAL_OPENDAP_ERROR_SAMPLE = (
    "Error {\n"
    "    code = 3;\n"
    '    message = "Invalid Parameter Exception: DArrayDimension.setProjection: Bad Projection '
    'Request: stop >= size: 1448:1440";\n'
    "};\n"
)

# Começo do DAS de ACCESS-CM2, historical, pr, 2000 (as primeiras 27 linhas, fechado com "}").
REAL_DAS_SAMPLE = (
    "Attributes {\n"
    "    lat {\n"
    '        String units "degrees_north";\n'
    '        String long_name "latitude";\n'
    '        String standard_name "latitude";\n'
    '        String axis "Y";\n'
    "        UInt32 _ChunkSizes 600;\n"
    "    }\n"
    "    pr {\n"
    "        Float32 _FillValue 1.0E20;\n"
    '        String standard_name "precipitation_flux";\n'
    '        String long_name "Precipitation";\n'
    '        String units "kg m-2 s-1";\n'
    '        String comment "includes both liquid and solid phases";\n'
    '        String cell_methods "area: time: mean";\n'
    '        String cell_measures "area: areacella";\n'
    "        Float32 missing_value 1.0E20;\n"
    "        UInt32 _ChunkSizes 1, 600, 1440;\n"
    "    }\n"
    "    time {\n"
    '        String axis "T";\n'
    '        String calendar "proleptic_gregorian";\n'
    '        String units "days since 1850-01-01";\n'
    '        String long_name "time";\n'
    '        String standard_name "time";\n'
    "        UInt32 _ChunkSizes 512;\n"
    "    }\n"
    "}\n"
)

# Trecho do DAS de MPI-ESM1-2-HR, ssp245, tasmin, 2050: unidade do tempo escrita de outro jeito.
REAL_DAS_SAMPLE_MPI = (
    "Attributes {\n"
    "    tasmin {\n"
    "        Float32 _FillValue 1.0E20;\n"
    '        String units "K";\n'
    "        UInt32 _ChunkSizes 1, 600, 1440;\n"
    "    }\n"
    "    time {\n"
    '        String bounds "time_bnds";\n'
    '        String standard_name "time";\n'
    '        String long_name "time";\n'
    '        String units "days since 1850-1-1 00:00:00";\n'
    '        String calendar "proleptic_gregorian";\n'
    '        String axis "T";\n'
    "        UInt32 _ChunkSizes 512;\n"
    "    }\n"
    "}\n"
)

# Pixel (lat, lon em −180..180) que o NCSS devolveu para cada ponto pedido (um dia de pr de 2000 do
# ACCESS-CM2). Os pontos da caixa piloto caem na borda entre dois pixels: o NCSS fica com o de
# coordenada maior.
REAL_NCSS_PIXELS = {
    Point(-20.0, -48.75): (-19.875, -48.625),
    Point(-20.0, -48.125): (-19.875, -48.125),
    Point(-20.0, -47.5): (-19.875, -47.375),
    Point(-19.5, -48.75): (-19.375, -48.625),
    Point(-19.5, -48.125): (-19.375, -48.125),
    Point(-19.5, -47.5): (-19.375, -47.375),
    Point(-19.0, -48.75): (-18.875, -48.625),
    Point(-19.0, -48.125): (-18.875, -48.125),
    Point(-19.0, -47.5): (-18.875, -47.375),
    Point(-18.5, -48.75): (-18.375, -48.625),
    Point(-18.5, -48.125): (-18.375, -48.125),
    Point(-18.5, -47.5): (-18.375, -47.375),
    Point(-18.9543, -48.1993): (-18.875, -48.125),  # fazenda de exemplo (cache real do modo ponto)
}

# --- grade de teste ---------------------------------------------------------------------------

TEST_MODEL = "MODELO-TESTE"
TEST_FILES = ModelFiles(variant="r1i1p1f1", grid="gn", version="v2.0")
TEST_MODELS = {TEST_MODEL: TEST_FILES}
UNITS = {"pr": "kg m-2 s-1", "tasmax": "K", "tasmin": "K"}
FINISHED_AT = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)
TIME_ORIGIN = date(1850, 1, 1)
PILOT_WINDOW = PixelWindow(lat_first=160, lat_last=166, lon_first=1245, lon_last=1250)
FILL = 1.0e20


def _grid_value(
    variable: str, experiment: str, month: int, lat_index: int, lon_index: int
) -> float:
    """Valor redondo de teste (unidade nativa), diferente em cada pixel, sem relação com dado real.

    `k` numera os pixels da região. Base: chuva 2 mm/dia, máxima 30 °C, mínima 18 °C. Futuro: chuva
    × (1 + mês/10 + k/1000), máxima + 0,5 × mês + 0,01 × k, mínima + 0,25 × mês + 0,01 × k.
    """
    k = (lat_index - 150) * 20 + (lon_index - 1240)
    future = experiment == "ssp245"
    if variable == "pr":
        mm_day = 2.0 * (1 + month / 10 + k / 1000) if future else 2.0
        return mm_day / 86_400
    if variable == "tasmax":
        return 303.15 + (0.5 * month + 0.01 * k if future else 0.0)
    return 291.15 + (0.25 * month + 0.01 * k if future else 0.0)


def _season(year: int) -> list[date]:
    start = date(year, 1, 1)
    return [start + timedelta(days=i) for i in range((date(year, 8, 1) - start).days)]


def _nearest(target: float, start: float, count: int) -> int:
    """Centro mais perto, em conta exata; empate fica com o de coordenada maior (como o NCSS)."""
    step = Fraction(1, 4)
    return min(
        range(count),
        key=lambda i: (abs(Fraction(start) + step * i - Fraction(target)), -i),
    )


def _ascii(
    variable: str,
    times: list[float],
    window: PixelWindow,
    value: Any,
    row_text: Any = None,
) -> str:
    """Resposta no formato do OPeNDAP ASCII (como `REAL_OPENDAP_ASCII_SAMPLE`).

    `value(t, lat_index, lon_index)` dá cada valor; `row_text(t, lat_index)`, se vier, dá a linha
    inteira já pronta (mais rápido para a grade grande).
    """
    lats = list(range(window.lat_first, window.lat_last + 1))
    lons = list(range(window.lon_first, window.lon_last + 1))
    if row_text is None:

        def row_text(t: int, lat_index: int) -> str:
            return ", ".join(repr(value(t, lat_index, lon_index)) for lon_index in lons)

    shape = f"[time = {len(times)}][lat = {len(lats)}][lon = {len(lons)}]"
    lines = [
        "Dataset {",
        "    Grid {",
        "     ARRAY:",
        f"        Float32 {variable}{shape};",
        "     MAPS:",
        f"        Float64 time[time = {len(times)}];",
        f"        Float64 lat[lat = {len(lats)}];",
        f"        Float64 lon[lon = {len(lons)}];",
        f"    }} {variable};",
        "} AMES/NEX/GDDP-CMIP6/teste.nc;",
        "-" * 45,
        f"{variable}.{variable}[{len(times)}][{len(lats)}][{len(lons)}]",
    ]
    for t in range(len(times)):
        for y, lat_index in enumerate(lats):
            lines.append(f"[{t}][{y}], {row_text(t, lat_index)}")
    lines += ["", f"{variable}.time[{len(times)}]", ", ".join(repr(t) for t in times)]
    lines += ["", f"{variable}.lat[{len(lats)}]", ", ".join(repr(-59.875 + 0.25 * i) for i in lats)]
    lines += ["", f"{variable}.lon[{len(lons)}]", ", ".join(repr(0.125 + 0.25 * j) for j in lons)]
    return "\n".join(lines) + "\n\n\n"


def _das(variable: str, unit: str | None = None, calendar: str = "proleptic_gregorian") -> str:
    return (
        "Attributes {\n"
        f"    {variable} {{\n"
        "        Float32 _FillValue 1.0E20;\n"
        f'        String units "{unit or UNITS[variable]}";\n'
        "    }\n"
        "    time {\n"
        f'        String calendar "{calendar}";\n'
        '        String units "days since 1850-01-01";\n'
        "    }\n"
        "}\n"
    )


_FILE = re.compile(r"/(\w+)_day_([\w-]+?)_(historical|ssp245)_r1i1p1f1_gn_(\d{4})_v2\.0\.nc")
_CONSTRAINT = re.compile(r"(\w+)\[0:1:(\d+)\]\[(\d+):1:(\d+)\]\[(\d+):1:(\d+)\]")


class FakeGridThredds:
    """THREDDS falso: a mesma grade de teste pelo NCSS (um ponto, CSV) e pelo OPeNDAP (ASCII, DAS).

    `fill_pixels` saem como valor de preenchimento (1,0E20), como o mar no arquivo real.
    """

    def __init__(self, fail_after: int | None = None, fill_pixels: frozenset = frozenset()) -> None:
        self.calls: list[str] = []
        self._fail_after = fail_after
        self._fill_pixels = fill_pixels
        self._pixel_of: dict[tuple[float, float], tuple[int, int]] = {}

    def _value(self, variable: str, experiment: str, day: date, lat_i: int, lon_i: int) -> float:
        if (lat_i, lon_i) in self._fill_pixels:
            return FILL
        return _grid_value(variable, experiment, day.month, lat_i, lon_i)

    def __call__(self, url: str, params: dict[str, Any], timeout: float) -> str:
        if self._fail_after is not None and len(self.calls) >= self._fail_after:
            raise ConnectionError("THREDDS fora do ar (teste)")
        self.calls.append(url)
        variable, _model, experiment, year_text = _FILE.search(url).groups()
        year = int(year_text)
        days = _season(year)
        if "/ncss/grid/" in url:
            return self._ncss_csv(variable, experiment, days, params)
        if url.endswith(".das"):
            return _das(variable)
        constraint = urllib.parse.unquote(url.split(".ascii?", 1)[1])
        name, last_t, lat0, lat1, lon0, lon1 = _CONSTRAINT.fullmatch(constraint).groups()
        assert name == variable
        assert int(last_t) == len(days) - 1
        window = PixelWindow(int(lat0), int(lat1), int(lon0), int(lon1))
        times = [(d - TIME_ORIGIN).days + 0.5 for d in days]
        rows: dict[tuple[int, int], str] = {}  # o valor de teste só muda com o mês

        def row_text(t: int, lat_i: int) -> str:
            key = (days[t].month, lat_i)
            if key not in rows:
                rows[key] = ", ".join(
                    repr(self._value(variable, experiment, days[t], lat_i, lon_i))
                    for lon_i in window.lon_indexes
                )
            return rows[key]

        return _ascii(variable, times, window, None, row_text=row_text)

    def _ncss_csv(
        self, variable: str, experiment: str, days: list[date], params: dict[str, Any]
    ) -> str:
        key = (params["latitude"], params["longitude"])
        if key not in self._pixel_of:
            self._pixel_of[key] = (
                _nearest(params["latitude"], -59.875, 600),
                _nearest(params["longitude"], 0.125, 1440),
            )
        lat_i, lon_i = self._pixel_of[key]
        header = (
            'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],'
            f'{variable}[unit="{UNITS[variable]}"]'
        )
        lat, lon = -59.875 + 0.25 * lat_i, 0.125 + 0.25 * lon_i - 360.0
        rows = [
            f"{d.isoformat()}T12:00:00Z,GridPointRequestedAt[teste],{lat},{lon},"
            f"{self._value(variable, experiment, d, lat_i, lon_i)!r}"
            for d in days
        ]
        return "\n".join([header, *rows]) + "\n"


def _opendap(tmp_path: Path, http: Any, pause: float = 0.0, sleep: Any = None) -> Any:
    return CachedOpendapFetcher(
        cache_dir=tmp_path / "cache",
        http_get=http,
        pause_seconds=pause,
        sleep=sleep or (lambda _s: None),
        max_retries=0,
        backoff_seconds=0.0,
    )


def _ncss(tmp_path: Path, http: Any) -> CachedNcssFetcher:
    return CachedNcssFetcher(
        cache_dir=tmp_path / "cache",
        http_get=http,
        pause_seconds=0.0,
        sleep=lambda _s: None,
        max_retries=0,
        backoff_seconds=0.0,
    )


def _request(year: int = 2000, variable: str = "pr", window: PixelWindow = PILOT_WINDOW) -> Any:
    return AreaRequest(TEST_MODEL, "historical", variable, year, window, TEST_FILES)


# --- pixel do NEX-GDDP (o mesmo do modo por ponto) --------------------------------------------


@pytest.mark.parametrize(("point", "expected"), list(REAL_NCSS_PIXELS.items()))
def test_should_pick_the_same_pixel_the_ncss_returned_for_the_point(
    point: Point, expected: tuple[float, float]
) -> None:
    pixel = ncss_pixel(point)

    assert (pixel.lat, pixel.lon - 360.0) == expected


def test_should_refuse_point_outside_the_nex_gddp_grid() -> None:
    with pytest.raises(ValueError, match="grade"):
        ncss_pixel(Point(-70.0, -48.0))


def test_should_download_only_the_smallest_window_covering_the_pixels_of_the_points() -> None:
    assert pixel_window(pilot_box_points()) == PILOT_WINDOW
    assert pixel_window([Point(-18.9543, -48.1993)]) == PixelWindow(164, 164, 1247, 1247)


# --- caixa ------------------------------------------------------------------------------------


def test_should_use_the_power_cells_of_the_pilot_box_by_default() -> None:
    assert box_points(PILOT_BOX) == pilot_box_points()


def test_should_list_power_cells_covering_a_custom_box() -> None:
    assert box_points(parse_box("-19.2,-18.8,-48.3,-48.0")) == [Point(-19.0, -48.125)]


@pytest.mark.parametrize("text", ["-19,-18", "-18,-19,-48,-47", "a,b,c,d", "-95,-18,-48,-47"])
def test_should_reject_invalid_box(text: str) -> None:
    with pytest.raises(ValueError):
        parse_box(text)


def test_should_parse_box_from_command_line() -> None:
    assert parse_box("-19.9, -18.4, -49, -47.5") == Box(-19.9, -18.4, -49.0, -47.5)


# --- pedido ao OPeNDAP ------------------------------------------------------------------------


def test_should_build_opendap_ascii_url_for_the_window_from_january_to_july() -> None:
    request = AreaRequest("ACCESS-CM2", "historical", "pr", 2000, PILOT_WINDOW, TEST_FILES)

    assert opendap_ascii_url(request) == (
        "https://ds.nccs.nasa.gov/thredds/dodsC/AMES/NEX/GDDP-CMIP6/ACCESS-CM2/historical/"
        "r1i1p1f1/pr/pr_day_ACCESS-CM2_historical_r1i1p1f1_gn_2000_v2.0.nc.ascii?"
        "pr%5B0:1:212%5D%5B160:1:166%5D%5B1245:1:1250%5D"
    )


def test_should_ask_one_day_less_in_a_year_that_is_not_leap() -> None:
    request = AreaRequest("ACCESS-CM2", "ssp245", "tasmax", 2050, PILOT_WINDOW, TEST_FILES)

    assert opendap_ascii_url(request).endswith(
        "tasmax%5B0:1:211%5D%5B160:1:166%5D%5B1245:1:1250%5D"
    )


def test_should_build_das_url_of_the_same_file() -> None:
    request = AreaRequest("ACCESS-CM2", "ssp245", "tasmin", 2041, PILOT_WINDOW, TEST_FILES)

    assert opendap_das_url(request) == (
        "https://ds.nccs.nasa.gov/thredds/dodsC/AMES/NEX/GDDP-CMIP6/ACCESS-CM2/ssp245/r1i1p1f1/"
        "tasmin/tasmin_day_ACCESS-CM2_ssp245_r1i1p1f1_gn_2041_v2.0.nc.das"
    )


# --- resposta ASCII ---------------------------------------------------------------------------


def test_should_parse_real_opendap_ascii_sample() -> None:
    grid = parse_opendap_ascii(REAL_OPENDAP_ASCII_SAMPLE, "pr", REAL_SAMPLE_WINDOW)

    assert grid.times == (54786.5, 54787.5)
    assert grid.values[Pixel(164, 1247)] == (5.391618e-5, 6.737662e-5)
    assert grid.values[Pixel(164, 1248)] == (4.932583e-5, 5.8172525e-5)
    assert grid.values[Pixel(165, 1248)] == (4.2142627e-5, 5.5436718e-5)
    assert grid_dates(grid, TIME_ORIGIN) == [date(2000, 1, 1), date(2000, 1, 2)]


@pytest.mark.parametrize(
    "text",
    [REAL_OPENDAP_ERROR_SAMPLE, "<html><body>Error 500</body></html>", ""],
)
def test_should_reject_error_instead_of_opendap_data(text: str) -> None:
    with pytest.raises(ValueError):
        parse_opendap_ascii(text, "pr", REAL_SAMPLE_WINDOW)


def test_should_reject_response_of_another_variable() -> None:
    with pytest.raises(ValueError, match="tasmax"):
        parse_opendap_ascii(REAL_OPENDAP_ASCII_SAMPLE, "tasmax", REAL_SAMPLE_WINDOW)


def test_should_reject_response_with_other_pixels_than_requested() -> None:
    shifted = PixelWindow(lat_first=165, lat_last=166, lon_first=1247, lon_last=1248)

    with pytest.raises(ValueError, match="lat"):
        parse_opendap_ascii(REAL_OPENDAP_ASCII_SAMPLE, "pr", shifted)


def test_should_reject_truncated_response() -> None:
    truncated = REAL_OPENDAP_ASCII_SAMPLE.replace("[1][1], 6.59286E-5, 5.5436718E-5\n", "")

    with pytest.raises(ValueError):
        parse_opendap_ascii(truncated, "pr", REAL_SAMPLE_WINDOW)


def _season_grid(year: int, value: Any, origin: date = TIME_ORIGIN) -> Any:
    times = [(d - origin).days + 0.5 for d in _season(year)]
    window = PixelWindow(164, 164, 1247, 1248)
    return parse_opendap_ascii(_ascii("tasmax", times, window, value), "tasmax", window)


def test_should_return_daily_values_of_each_pixel_skipping_fill_values() -> None:
    grid = _season_grid(2001, lambda t, _y, x: FILL if (x == 1248 and t == 0) else 300.0)

    daily = daily_values(grid, TIME_ORIGIN, 2001)

    assert len(daily[Pixel(164, 1247)]) == 212
    assert daily[Pixel(164, 1247)][0] == (date(2001, 1, 1), 300.0)
    assert daily[Pixel(164, 1248)][0] == (date(2001, 1, 2), 300.0)  # 1/jan era preenchimento
    assert len(daily[Pixel(164, 1248)]) == 211


def test_should_refuse_days_that_are_not_january_to_july_of_the_year() -> None:
    # Ex.: calendário de 365 dias lido como gregoriano: as datas escorregam
    grid = _season_grid(2001, lambda *_: 300.0, origin=date(1850, 1, 3))

    with pytest.raises(ValueError, match="dias"):
        daily_values(grid, TIME_ORIGIN, 2001)


# --- atributos (DAS) --------------------------------------------------------------------------


def test_should_read_time_origin_from_real_das_after_checking_the_unit() -> None:
    assert parse_das(REAL_DAS_SAMPLE, "pr") == date(1850, 1, 1)


def test_should_read_time_origin_written_with_hour_in_real_das() -> None:
    assert parse_das(REAL_DAS_SAMPLE_MPI, "tasmin") == date(1850, 1, 1)


def test_should_reject_das_with_unexpected_unit() -> None:
    with pytest.raises(ValueError, match="unidade"):
        parse_das(_das("pr", unit="mm/day"), "pr")


def test_should_reject_das_with_calendar_other_than_gregorian() -> None:
    with pytest.raises(ValueError, match="calendário"):
        parse_das(_das("tasmax", calendar="noleap"), "tasmax")


@pytest.mark.parametrize("text", [REAL_OPENDAP_ERROR_SAMPLE, _das("tasmin"), ""])
def test_should_reject_das_without_the_variable(text: str) -> None:
    with pytest.raises(ValueError):
        parse_das(text, "pr")


# --- cache e retomada -------------------------------------------------------------------------


def test_should_cache_area_response_and_das_and_not_request_them_again(tmp_path: Path) -> None:
    http = FakeGridThredds()
    request = _request()

    first = _opendap(tmp_path, http).fetch(request)
    second = _opendap(tmp_path, http).fetch(request)
    das = _opendap(tmp_path, http).fetch_attributes(request)
    _opendap(tmp_path, http).fetch_attributes(request)

    assert first == second
    assert parse_das(das, "pr") == TIME_ORIGIN
    assert len(http.calls) == 2
    assert _opendap(tmp_path, http).is_cached(request)
    assert _opendap(tmp_path, http).attributes_cached(request)


def test_should_not_cache_an_error_response(tmp_path: Path) -> None:
    def broken(url: str, params: dict[str, Any], timeout: float) -> str:
        return REAL_OPENDAP_ERROR_SAMPLE

    fetcher = _opendap(tmp_path, broken)
    request = _request()

    with pytest.raises(ValueError):
        fetcher.fetch(request)
    with pytest.raises(ValueError):
        fetcher.fetch_attributes(request)
    assert not fetcher.is_cached(request)
    assert not fetcher.attributes_cached(request)
    assert list((tmp_path / "cache").rglob("*.*")) == []


def test_should_not_cache_area_response_with_days_missing(tmp_path: Path) -> None:
    def short(url: str, params: dict[str, Any], timeout: float) -> str:
        return _ascii("pr", [54786.5, 54787.5], PILOT_WINDOW, lambda *_: 1.0e-5)

    fetcher = _opendap(tmp_path, short)

    with pytest.raises(ValueError, match="dias"):
        fetcher.fetch(_request())
    assert not fetcher.is_cached(_request())


def test_should_pause_between_real_area_requests_only(tmp_path: Path) -> None:
    pauses: list[float] = []
    fetcher = _opendap(tmp_path, FakeGridThredds(), pause=0.5, sleep=pauses.append)

    fetcher.fetch(_request())
    fetcher.fetch(_request())  # do cache: sem pausa

    assert pauses == [0.5]


def test_should_resume_area_download_requesting_only_missing_files(tmp_path: Path) -> None:
    points = pilot_box_points()
    interrupted = FakeGridThredds(fail_after=50)

    with pytest.raises(ConnectionError):
        build_cmip6_deltas_by_area(
            points, TEST_MODELS, _opendap(tmp_path, interrupted), lambda: FINISHED_AT
        )

    resumed = FakeGridThredds()
    build_cmip6_deltas_by_area(
        points, TEST_MODELS, _opendap(tmp_path, resumed), lambda: FINISHED_AT
    )

    assert len(interrupted.calls) == 50
    assert len(resumed.calls) == 120 + 6 - 50


# --- deltas por área --------------------------------------------------------------------------


def test_should_request_each_yearly_file_once_for_the_whole_box(tmp_path: Path) -> None:
    http = FakeGridThredds()

    build_cmip6_deltas_by_area(
        pilot_box_points(), TEST_MODELS, _opendap(tmp_path, http), lambda: FINISHED_AT
    )

    data = [url for url in http.calls if ".ascii?" in url]
    attributes = [url for url in http.calls if url.endswith(".das")]
    assert len(data) == 3 * 40  # 1 modelo × 3 variáveis × 40 anos, para os 12 pontos juntos
    assert len(attributes) == 3 * 2  # 1 por variável e período
    assert len(set(data)) == len(data)


def test_should_give_each_point_exactly_the_deltas_of_the_point_mode(tmp_path: Path) -> None:
    points = pilot_box_points()

    by_point = build_cmip6_deltas(
        points, TEST_MODELS, _ncss(tmp_path / "ponto", FakeGridThredds()), lambda: FINISHED_AT
    )
    by_area = build_cmip6_deltas_by_area(
        points, TEST_MODELS, _opendap(tmp_path / "area", FakeGridThredds()), lambda: FINISHED_AT
    )

    assert by_area["pontos"] == by_point["pontos"]
    # a grade de teste muda em cada pixel: pixel trocado não passaria despercebido
    assert len({json.dumps(p["cmip6"]) for p in by_area["pontos"]}) == 12


def test_should_ignore_pixel_without_data_that_no_point_uses(tmp_path: Path) -> None:
    # os pontos usam as latitudes 160, 162, 164 e 166 e as longitudes 1245, 1247 e 1250
    http = FakeGridThredds(fill_pixels=frozenset({(161, 1246), (165, 1249)}))

    result = build_cmip6_deltas_by_area(
        pilot_box_points(), TEST_MODELS, _opendap(tmp_path, http), lambda: FINISHED_AT
    )

    assert len(result["pontos"]) == 12


def test_should_build_contract_json_by_area_validated_by_the_models(tmp_path: Path) -> None:
    result = build_cmip6_deltas_by_area(
        pilot_box_points(), TEST_MODELS, _opendap(tmp_path, FakeGridThredds()), lambda: FINISHED_AT
    )

    versao = result["versao_dados"]
    DataRun(
        source=versao["fonte"],
        params=versao["parametros"],
        finished_at=datetime.fromisoformat(versao["fim"]),
        version=versao["versao"],
    )
    assert versao["fonte"] == "nex_gddp_cmip6"
    assert versao["versao"] == "2026.11-nex-gddp-cmip6"
    assert "OPeNDAP" in versao["parametros"]["servico"]
    assert versao["parametros"]["pontos"] == 12
    for ponto in result["pontos"]:
        assert set(ponto) == {"lat", "lon", "cobertura", "cmip6"}
        for item in ponto["cmip6"]:
            Cmip6Delta(
                model=item["modelo"],
                scenario=item["cenario"],
                month=item["mes"],
                rain_pct=item["chuva_pct"],
                tmax_c=item["tmax_c"],
                tmin_c=item["tmin_c"],
            )
    json.dumps(result)


def test_should_stamp_finished_time_after_all_area_downloads(tmp_path: Path) -> None:
    http = FakeGridThredds()
    downloads_when_stamped: list[int] = []

    def clock() -> datetime:
        downloads_when_stamped.append(len(http.calls))
        return FINISHED_AT

    build_cmip6_deltas_by_area(pilot_box_points(), TEST_MODELS, _opendap(tmp_path, http), clock)

    assert downloads_when_stamped == [126]


# --- linha de comando -------------------------------------------------------------------------


def test_should_write_the_whole_pilot_box_with_area_flag(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    saida = tmp_path / "saida" / "cmip6.json"
    http = FakeGridThredds()

    main(
        ["--area", "--saida", str(saida), "--cache", str(tmp_path / "cache"), "--pausa", "0"],
        http_get=http,
        now=lambda: FINISHED_AT,
        known_models=TEST_MODELS,  # dado de teste nunca sai com nome de modelo real
    )

    payload = json.loads(saida.read_text(encoding="utf-8"))
    assert [(p["lat"], p["lon"]) for p in payload["pontos"]] == [
        (p.lat, p.lon) for p in pilot_box_points()
    ]
    assert len(http.calls) == 126
    assert "cmip6.json" in capsys.readouterr().out


def test_should_accept_a_custom_box_with_area_flag(tmp_path: Path) -> None:
    saida = tmp_path / "cmip6.json"

    main(
        [
            "--area=-19.2,-18.8,-48.3,-48.0",
            "--saida",
            str(saida),
            "--cache",
            str(tmp_path / "c"),
            "--pausa",
            "0",
        ],
        http_get=FakeGridThredds(),
        now=lambda: FINISHED_AT,
        known_models=TEST_MODELS,
    )

    payload = json.loads(saida.read_text(encoding="utf-8"))
    assert [(p["lat"], p["lon"]) for p in payload["pontos"]] == [(-19.0, -48.125)]


def test_should_not_mix_area_and_points_on_command_line(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        main(["--dry-run", "--area", "--pontos=-19.0,-48.125", "--cache", str(tmp_path)])


def test_should_show_requests_and_time_of_both_modes_in_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    def no_network(url: str, params: dict[str, Any], timeout: float) -> str:
        raise AssertionError("o --dry-run não pode chamar o THREDDS")

    main(["--dry-run", "--area", "--cache", str(tmp_path / "cache")], http_get=no_network)

    out = capsys.readouterr().out
    point_line = next(line for line in out.splitlines() if line.startswith("Por ponto"))
    area_line = next(line for line in out.splitlines() if line.startswith("Por área"))
    assert "4320 pedidos" in point_line and "~7,8 h" in point_line
    assert "378 pedidos" in area_line  # 3 modelos × 3 variáveis × (40 anos + 2 DAS)
    assert "7 × 6 pixels" in area_line and "~45 min" in area_line
    mode_line = next(line for line in out.splitlines() if line.startswith("Modo desta execução"))
    assert "por área" in mode_line
    assert not (tmp_path / "cache").exists()


def test_should_count_area_files_already_in_cache_in_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cache = tmp_path / "cache"
    fetcher = _opendap(tmp_path, FakeGridThredds())
    fetcher.fetch(_request(year=1995))
    fetcher.fetch_attributes(_request(year=1995))

    main(["--dry-run", "--area", "--cache", str(cache)], known_models=TEST_MODELS)

    area_line = next(line for line in capsys.readouterr().out.splitlines() if "Por área" in line)
    assert "126 pedidos" in area_line
    assert "já no cache: 2; faltam: 124" in area_line
