"""Testes do script que gera os deltas mensais do NEX-GDDP-CMIP6 (R2.1, tarefa 0014).

Nada de rede: o THREDDS é um getter falso. Os CSVs falsos usam o modelo `MODELO-TESTE` e valores
redondos de teste. O único trecho de dado real é `REAL_NCSS_CSV_SAMPLE`, copiado de uma resposta
de verdade do NCSS.
"""

import json
import math
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from app.constants import PILOT_MAX_LAT, PILOT_MAX_LON, PILOT_MIN_LAT, PILOT_MIN_LON
from app.models.climate import Cmip6Delta
from app.models.data_run import DataRun
from pipeline.export_climate_fixture import power_cell_bounds
from pipeline.fetch_cmip6_deltas import (
    DEFAULT_CACHE_DIR,
    DEFAULT_MODELS,
    DEFAULT_OUTPUT,
    CachedNcssFetcher,
    ModelFiles,
    NcssRequest,
    Point,
    build_cmip6_deltas,
    main,
    monthly_deltas,
    monthly_means,
    ncss_params,
    ncss_url,
    parse_ncss_csv,
    parse_points,
    pilot_box_points,
    plan_requests,
    repo_root,
    to_daily_unit,
    to_thredds_longitude,
)

# Trecho real: ACCESS-CM2, historical, pr, 2000, ponto -19,0 / 311,875, pedido em 14/11/2026 a
# https://ds.nccs.nasa.gov/thredds/ncss/grid/AMES/NEX/GDDP-CMIP6/ (as 3 primeiras linhas de dados).
REAL_NCSS_CSV_SAMPLE = (
    'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],'
    'pr[unit="kg m-2 s-1"]\n'
    "2000-01-01T12:00:00Z,GridPointRequestedAt[19.000S_48.125W],-18.875,-48.125,5.391618E-5\n"
    "2000-01-02T12:00:00Z,GridPointRequestedAt[19.000S_48.125W],-18.875,-48.125,6.737662E-5\n"
    "2000-01-03T12:00:00Z,GridPointRequestedAt[19.000S_48.125W],-18.875,-48.125,1.2897026E-4\n"
)

TEST_MODEL = "MODELO-TESTE"
TEST_FILES = ModelFiles(variant="r1i1p1f1", grid="gn", version="v2.0")
TEST_MODELS = {TEST_MODEL: TEST_FILES}
UNITS = {"pr": "kg m-2 s-1", "tasmax": "K", "tasmin": "K"}
POINT = Point(lat=-19.0, lon=-48.125)
FINISHED_AT = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)


def _csv(variable: str, rows: list[tuple[date, str]], unit: str | None = None) -> str:
    header = (
        'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],'
        f'{variable}[unit="{unit or UNITS[variable]}"]'
    )
    lines = [header] + [
        f"{day.isoformat()}T12:00:00Z,GridPointRequestedAt[19.000S_48.125W],-18.875,-48.125,{v}"
        for day, v in rows
    ]
    return "\n".join(lines) + "\n"


def _test_value(variable: str, experiment: str, month: int) -> float:
    """Valores redondos de teste (unidade nativa do NEX-GDDP), sem relação com dado real.

    Chuva base de 2 mm/dia e futuro com +10% × mês; máxima base 30 °C com +0,5 °C × mês; mínima
    base 18 °C com +0,25 °C × mês.
    """
    future = experiment == "ssp245"
    if variable == "pr":
        mm_day = 2.0 * (1 + month / 10) if future else 2.0
        return mm_day / 86_400
    if variable == "tasmax":
        return 303.15 + (0.5 * month if future else 0.0)
    return 291.15 + (0.25 * month if future else 0.0)


def _year_csv(variable: str, experiment: str, year: int) -> str:
    start = date(year, 1, 1)
    days = [start + timedelta(days=i) for i in range((date(year, 8, 1) - start).days)]
    return _csv(variable, [(d, repr(_test_value(variable, experiment, d.month))) for d in days])


class FakeThredds:
    """Getter de texto falso: devolve o CSV de teste do arquivo pedido e conta os pedidos."""

    def __init__(self, fail_after: int | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any], float]] = []
        self._fail_after = fail_after

    def __call__(self, url: str, params: dict[str, Any], timeout: float) -> str:
        if self._fail_after is not None and len(self.calls) >= self._fail_after:
            raise ConnectionError("THREDDS fora do ar (teste)")
        self.calls.append((url, params, timeout))
        file_name = url.rsplit("/", 1)[-1]
        variable, _, _model, experiment = file_name.split("_")[:4]
        year = int(params["time_start"][:4])
        return _year_csv(variable, experiment, year)


def _fetcher(tmp_path: Path, http: FakeThredds) -> CachedNcssFetcher:
    return CachedNcssFetcher(
        cache_dir=tmp_path / "cache",
        http_get=http,
        pause_seconds=0.0,
        sleep=lambda _s: None,
        max_retries=0,
        backoff_seconds=0.0,
    )


# --- longitude e pedido ao NCSS ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("lon", "expected"),
    [(-48.2, 311.8), (-48.125, 311.875), (-47.5, 312.5), (10.0, 10.0), (0.0, 0.0)],
)
def test_should_convert_longitude_to_thredds_0_360(lon: float, expected: float) -> None:
    assert to_thredds_longitude(lon) == expected


def test_should_build_ncss_url_for_one_yearly_file_with_grid_and_version() -> None:
    request = NcssRequest("ACCESS-CM2", "ssp245", "tasmin", 2050, POINT, TEST_FILES)

    assert ncss_url(request) == (
        "https://ds.nccs.nasa.gov/thredds/ncss/grid/AMES/NEX/GDDP-CMIP6/ACCESS-CM2/ssp245/"
        "r1i1p1f1/tasmin/tasmin_day_ACCESS-CM2_ssp245_r1i1p1f1_gn_2050_v2.0.nc"
    )


def test_should_ask_ncss_for_january_to_july_of_the_year_at_the_point_as_csv() -> None:
    request = NcssRequest("ACCESS-CM2", "historical", "pr", 2000, Point(-18.95, -48.2), TEST_FILES)

    assert ncss_params(request) == {
        "var": "pr",
        "latitude": -18.95,
        "longitude": 311.8,
        "time_start": "2000-01-01T12:00:00Z",
        "time_end": "2000-07-31T12:00:00Z",
        "accept": "csv",
    }


# --- CSV do NCSS ------------------------------------------------------------------------------


def test_should_parse_real_ncss_csv_sample() -> None:
    assert parse_ncss_csv(REAL_NCSS_CSV_SAMPLE, "pr") == [
        (date(2000, 1, 1), 5.391618e-5),
        (date(2000, 1, 2), 6.737662e-5),
        (date(2000, 1, 3), 1.2897026e-4),
    ]


def test_should_reject_csv_without_the_requested_variable() -> None:
    with pytest.raises(ValueError, match="tasmax"):
        parse_ncss_csv(REAL_NCSS_CSV_SAMPLE, "tasmax")


def test_should_reject_csv_with_unexpected_unit() -> None:
    text = _csv("pr", [(date(2000, 1, 1), "1.0")], unit="mm/day")

    with pytest.raises(ValueError, match="unidade"):
        parse_ncss_csv(text, "pr")


def test_should_reject_error_page_instead_of_csv() -> None:
    with pytest.raises(ValueError, match="pr"):
        parse_ncss_csv("<html><body>Error 500</body></html>", "pr")


def test_should_reject_csv_without_data_rows() -> None:
    with pytest.raises(ValueError, match="sem dados"):
        parse_ncss_csv(_csv("pr", []), "pr")


def test_should_skip_fill_value_and_nan_instead_of_inventing_data() -> None:
    text = _csv(
        "tasmax",
        [(date(2000, 1, 1), "1.0E20"), (date(2000, 1, 2), "NaN"), (date(2000, 1, 3), "300.0")],
    )

    assert parse_ncss_csv(text, "tasmax") == [(date(2000, 1, 3), 300.0)]


# --- conversões, médias e delta ---------------------------------------------------------------


def test_should_convert_pr_to_mm_per_day_and_kelvin_to_celsius() -> None:
    assert to_daily_unit("pr", 1.0 / 86_400) == pytest.approx(1.0)
    assert to_daily_unit("tasmax", 303.15) == pytest.approx(30.0)
    assert to_daily_unit("tasmin", 273.15) == pytest.approx(0.0)


def test_should_average_daily_values_by_month_over_all_years() -> None:
    daily = [
        (date(1995, 1, 1), 1.0),
        (date(1995, 1, 2), 3.0),
        (date(1996, 1, 1), 5.0),
        (date(1995, 2, 1), 10.0),
        (date(1995, 8, 1), 99.0),  # agosto fica fora (MVP: jan–jul)
    ]
    for month in range(3, 8):
        daily.append((date(1995, month, 1), float(month)))

    means = monthly_means(daily)

    assert means == {1: 3.0, 2: 10.0, 3: 3.0, 4: 4.0, 5: 5.0, 6: 6.0, 7: 7.0}


def test_should_refuse_monthly_means_when_a_month_has_no_data() -> None:
    with pytest.raises(ValueError, match="mês 2"):
        monthly_means([(date(1995, 1, 1), 1.0)])


def _means(value_by_month: dict[int, float]) -> dict[int, float]:
    return {month: value_by_month.get(month, 1.0) for month in range(1, 8)}


def test_should_compute_rain_delta_in_percent_and_temperatures_as_difference() -> None:
    base = {
        "pr": _means({3: 4.0}),
        "tasmax": _means({3: 30.0}),
        "tasmin": _means({3: 18.0}),
    }
    future = {
        "pr": _means({3: 3.66}),
        "tasmax": _means({3: 31.6}),
        "tasmin": _means({3: 19.2}),
    }

    deltas = monthly_deltas(TEST_MODEL, base, future)

    assert [d.month for d in deltas] == [1, 2, 3, 4, 5, 6, 7]
    march = deltas[2]
    assert march == Cmip6Delta(
        model=TEST_MODEL, scenario="ssp245", month=3, rain_pct=-8.5, tmax_c=1.6, tmin_c=1.2
    )
    assert deltas[0].rain_pct == 0.0


def test_should_refuse_rain_delta_when_baseline_rain_is_zero() -> None:
    base = {"pr": _means({7: 0.0}), "tasmax": _means({}), "tasmin": _means({})}
    future = {"pr": _means({7: 0.1}), "tasmax": _means({}), "tasmin": _means({})}

    with pytest.raises(ValueError, match="mês 7"):
        monthly_deltas(TEST_MODEL, base, future)


# --- pontos -----------------------------------------------------------------------------------


def test_should_list_power_cell_centers_covering_the_pilot_box() -> None:
    points = pilot_box_points()

    assert len(points) == 12
    assert sorted({p.lat for p in points}) == [-20.0, -19.5, -19.0, -18.5]
    assert sorted({p.lon for p in points}) == [-48.75, -48.125, -47.5]
    coverages = [power_cell_bounds(p.lat, p.lon) for p in points]
    for corner in [
        (PILOT_MIN_LAT, PILOT_MIN_LON),
        (PILOT_MIN_LAT, PILOT_MAX_LON),
        (PILOT_MAX_LAT, PILOT_MIN_LON),
        (PILOT_MAX_LAT, PILOT_MAX_LON),
        (-18.9543, -48.1993),  # fazenda de exemplo
    ]:
        assert power_cell_bounds(*corner) in coverages


def test_should_parse_points_from_command_line() -> None:
    assert parse_points("-18.9543,-48.1993; -19.5,-48.75") == [
        Point(-18.9543, -48.1993),
        Point(-19.5, -48.75),
    ]


@pytest.mark.parametrize("text", ["-18.9", "abc,def", "-95,-48", "-18,-190"])
def test_should_reject_invalid_points(text: str) -> None:
    with pytest.raises(ValueError):
        parse_points(text)


# --- plano de pedidos, cache e retomada -------------------------------------------------------


def test_should_plan_one_request_per_model_variable_year_and_point() -> None:
    requests = plan_requests([POINT, Point(-19.5, -48.75)], TEST_MODELS)

    assert len(requests) == 2 * 1 * 3 * 40
    years = {(r.experiment, r.year) for r in requests}
    assert years == {("historical", y) for y in range(1995, 2015)} | {
        ("ssp245", y) for y in range(2041, 2061)
    }
    assert {r.variable for r in requests} == {"pr", "tasmax", "tasmin"}


def test_should_use_the_three_models_confirmed_in_the_thredds_catalog_by_default() -> None:
    assert {
        "ACCESS-CM2": ModelFiles("r1i1p1f1", "gn", "v2.0"),
        "MPI-ESM1-2-HR": ModelFiles("r1i1p1f1", "gn", "v2.0"),
        "MRI-ESM2-0": ModelFiles("r1i1p1f1", "gn", "v2.0"),
    } == DEFAULT_MODELS


def test_should_cache_downloaded_csv_and_not_request_it_again(tmp_path: Path) -> None:
    http = FakeThredds()
    request = NcssRequest(TEST_MODEL, "historical", "pr", 1995, POINT, TEST_FILES)

    first = _fetcher(tmp_path, http).fetch(request)
    second = _fetcher(tmp_path, http).fetch(request)

    assert first == second
    assert len(http.calls) == 1
    assert _fetcher(tmp_path, http).is_cached(request)


def test_should_not_cache_an_invalid_response(tmp_path: Path) -> None:
    def broken(url: str, params: dict[str, Any], timeout: float) -> str:
        return "<html>Error</html>"

    fetcher = CachedNcssFetcher(
        cache_dir=tmp_path / "cache",
        http_get=broken,
        pause_seconds=0.0,
        sleep=lambda _s: None,
        max_retries=0,
        backoff_seconds=0.0,
    )
    request = NcssRequest(TEST_MODEL, "historical", "pr", 1995, POINT, TEST_FILES)

    with pytest.raises(ValueError):
        fetcher.fetch(request)
    assert not fetcher.is_cached(request)
    assert list((tmp_path / "cache").rglob("*.*")) == []


def test_should_pause_between_real_requests_only(tmp_path: Path) -> None:
    pauses: list[float] = []
    fetcher = CachedNcssFetcher(
        cache_dir=tmp_path / "cache",
        http_get=FakeThredds(),
        pause_seconds=0.5,
        sleep=pauses.append,
        max_retries=0,
        backoff_seconds=0.0,
    )
    request = NcssRequest(TEST_MODEL, "historical", "pr", 1995, POINT, TEST_FILES)

    fetcher.fetch(request)
    fetcher.fetch(request)  # do cache: sem pausa

    assert pauses == [0.5]


def test_should_resume_after_interruption_requesting_only_missing_files(tmp_path: Path) -> None:
    total = len(plan_requests([POINT], TEST_MODELS))
    interrupted = FakeThredds(fail_after=50)

    with pytest.raises(ConnectionError):
        build_cmip6_deltas(
            [POINT], TEST_MODELS, _fetcher(tmp_path, interrupted), lambda: FINISHED_AT
        )

    resumed = FakeThredds()
    build_cmip6_deltas([POINT], TEST_MODELS, _fetcher(tmp_path, resumed), lambda: FINISHED_AT)

    assert len(interrupted.calls) == 50
    assert len(resumed.calls) == total - 50


# --- arquivo final ----------------------------------------------------------------------------


def test_should_build_contract_json_validated_by_the_models(tmp_path: Path) -> None:
    result = build_cmip6_deltas(
        [POINT], TEST_MODELS, _fetcher(tmp_path, FakeThredds()), lambda: FINISHED_AT
    )

    versao = result["versao_dados"]
    run = DataRun(
        source=versao["fonte"],
        params=versao["parametros"],
        finished_at=datetime.fromisoformat(versao["fim"]),
        version=versao["versao"],
    )
    assert run.source == "nex_gddp_cmip6"
    assert versao["fim"] == "2026-11-14T13:00:00Z"
    assert versao["versao"] == "2026.11-nex-gddp-cmip6"
    assert versao["parametros"]["cenario"] == "ssp245"
    assert versao["parametros"]["modelos"] == [
        {"modelo": TEST_MODEL, "variante": "r1i1p1f1", "grade": "gn", "versao_arquivo": "v2.0"}
    ]
    assert versao["parametros"]["periodo_base"] == [1995, 2014]
    assert versao["parametros"]["periodo_futuro"] == [2041, 2060]

    [ponto] = result["pontos"]
    assert (ponto["lat"], ponto["lon"]) == (-19.0, -48.125)
    assert ponto["cobertura"] == power_cell_bounds(-19.0, -48.125)
    deltas = [
        Cmip6Delta(
            model=item["modelo"],
            scenario=item["cenario"],
            month=item["mes"],
            rain_pct=item["chuva_pct"],
            tmax_c=item["tmax_c"],
            tmin_c=item["tmin_c"],
        )
        for item in ponto["cmip6"]
    ]
    assert [d.month for d in deltas] == [1, 2, 3, 4, 5, 6, 7]
    for d in deltas:
        assert d.model == TEST_MODEL
        assert d.rain_pct == pytest.approx(10.0 * d.month)
        assert d.tmax_c == pytest.approx(0.5 * d.month)
        assert d.tmin_c == pytest.approx(0.25 * d.month)
    json.dumps(result)  # serializável


def test_should_write_output_file_from_command_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    saida = tmp_path / "saida" / "cmip6.json"
    http = FakeThredds()

    main(
        [
            "--saida",
            str(saida),
            "--pontos=-19.0,-48.125",
            "--modelos",
            TEST_MODEL,
            "--cache",
            str(tmp_path / "cache"),
            "--pausa",
            "0",
        ],
        http_get=http,
        now=lambda: FINISHED_AT,
        known_models=TEST_MODELS,  # dado de teste nunca sai com nome de modelo real
    )

    payload = json.loads(saida.read_text(encoding="utf-8"))
    assert [p["lat"] for p in payload["pontos"]] == [-19.0]
    assert {d["modelo"] for d in payload["pontos"][0]["cmip6"]} == {TEST_MODEL}
    assert len(http.calls) == 120
    assert "cmip6.json" in capsys.readouterr().out


def test_should_only_count_requests_in_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    def no_network(url: str, params: dict[str, Any], timeout: float) -> str:
        raise AssertionError("o --dry-run não pode chamar o THREDDS")

    main(["--dry-run", "--cache", str(tmp_path / "cache")], http_get=no_network)

    out = capsys.readouterr().out
    assert "4320" in out  # 12 células × 3 modelos × 3 variáveis × 40 anos
    assert not (tmp_path / "cache").exists()


def test_should_find_repo_root_from_the_script_path() -> None:
    script = Path("/repo/projeto/backend/pipeline/fetch_cmip6_deltas.py")

    assert repo_root(script) == Path("/repo")


def test_should_use_the_backend_folder_as_root_inside_the_container() -> None:
    # No Dockerfile o backend vira /app e não existe projeto/backend acima dele
    assert repo_root(Path("/app/pipeline/fetch_cmip6_deltas.py")) == Path("/app")


def test_should_save_output_and_cache_in_the_team_downloads_folder_by_default(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = repo_root()
    monkeypatch.chdir(tmp_path)  # a pasta de onde o script roda não muda nada

    assert repo_root() == root
    # vale no repositório (<raiz>/projeto/backend) e no container (/app)
    backend = Path(__file__).parents[3]
    assert repo_root(backend / "pipeline" / "fetch_cmip6_deltas.py") == root
    folder = root / "data" / "baixados" / "nasa_nex_gddp_cmip6"
    assert folder / "cmip6_deltas_nex_gddp.json" == DEFAULT_OUTPUT
    assert folder / "cache_ncss" == DEFAULT_CACHE_DIR


def test_should_reject_unknown_model_on_command_line(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        main(["--dry-run", "--modelos", "MODELO-INEXISTENTE", "--cache", str(tmp_path)])


def test_should_never_produce_non_finite_delta(tmp_path: Path) -> None:
    result = build_cmip6_deltas(
        [POINT], TEST_MODELS, _fetcher(tmp_path, FakeThredds()), lambda: FINISHED_AT
    )

    for item in result["pontos"][0]["cmip6"]:
        for key in ("chuva_pct", "tmax_c", "tmin_c"):
            assert math.isfinite(item[key])


def test_should_stamp_finished_time_after_all_downloads(tmp_path: Path) -> None:
    http = FakeThredds()
    downloads_when_stamped: list[int] = []

    def clock() -> datetime:
        downloads_when_stamped.append(len(http.calls))
        return FINISHED_AT

    build_cmip6_deltas([POINT], TEST_MODELS, _fetcher(tmp_path, http), clock)

    assert downloads_when_stamped == [120]


def test_should_write_zero_delta_without_negative_sign() -> None:
    base = {"pr": _means({}), "tasmax": _means({1: 30.0}), "tasmin": _means({})}
    future = {"pr": _means({}), "tasmax": _means({1: 29.999}), "tasmin": _means({})}

    january = monthly_deltas(TEST_MODEL, base, future)[0]

    assert json.dumps([january.rain_pct, january.tmax_c, january.tmin_c]) == "[0.0, 0.0, 0.0]"
