"""Unit tests for pipeline/fetch_oni.py: fase do ENSO de cada safrinha pelo ONI da NOAA (P1).

Nada de rede: o HTTP é sempre falso. A amostra é um trecho real da tabela
https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt, baixada em 14/11/2026.
"""

import json
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from app.models.data_run import DataRun
from app.models.enso import OniYear
from app.repositories.enso_repository import FileEnsoRepository
from app.repositories.rules_repository import load_default_rules
from pipeline.fetch_cmip6_deltas import repo_root
from pipeline.fetch_oni import (
    DEFAULT_OUTPUT,
    ONI_URL,
    build_oni_file,
    main,
    parse_oni_table,
    safra_oni,
)

ENSO = load_default_rules().enso
FINISHED_AT = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)
SAMPLE = """ SEAS  YR   TOTAL   ANOM
  NDJ 2015  29.15   2.59
  DJF 2016  29.05   2.50
  JFM 2016  28.99   2.21
  FMA 2016  28.92   1.69
  MAM 2016  28.74   1.11
  DJF 2021  25.55  -0.99
  JFM 2021  25.92  -0.85
  FMA 2021  26.53  -0.74
  DJF 2023  26.00  -0.55
  JFM 2023  26.45  -0.33
  FMA 2023  27.12  -0.11
  DJF 2024  28.38   1.84
  JFM 2024  28.30   1.53
"""


class FakeNoaa:
    def __init__(self, text: str = SAMPLE) -> None:
        self.text = text
        self.calls: list[str] = []

    def __call__(self, url: str, params: dict[str, Any], timeout: float) -> str:
        self.calls.append(url)
        return self.text


# --- leitura da tabela -------------------------------------------------------------------------


def test_should_parse_the_real_oni_table_by_season_and_year() -> None:
    table = parse_oni_table(SAMPLE)

    assert table[("DJF", 2016)] == 2.50
    assert table[("FMA", 2021)] == -0.74
    # NDJ de 2015 é nov/2015–jan/2016: a NOAA rotula a estação pelo mês do meio
    assert table[("NDJ", 2015)] == 2.59
    assert len(table) == 13


def test_should_refuse_an_error_page_instead_of_the_oni_table() -> None:
    with pytest.raises(ValueError, match="SEAS"):
        parse_oni_table("<html><body>Service unavailable</body></html>")


@pytest.mark.parametrize("line", ["  XYZ 2016  29.05   2.50", "  DJF 2016  29.05", "  DJF ano 1 2"])
def test_should_refuse_a_line_outside_the_table_format(line: str) -> None:
    with pytest.raises(ValueError, match="linha"):
        parse_oni_table(" SEAS  YR   TOTAL   ANOM\n" + line + "\n")


# --- regra do ano da safrinha ------------------------------------------------------------------


def test_should_mark_el_nino_with_the_mean_of_djf_jfm_and_fma_of_the_off_season_year() -> None:
    # 2016: (2,50 + 2,21 + 1,69) / 3 = 2,13 (o El Niño de 2015/16 marca a safrinha de 2016)
    assert safra_oni(parse_oni_table(SAMPLE), 2016, ENSO) == OniYear(2016, 2.13, "el_nino")


def test_should_mark_la_nina_when_the_mean_is_minus_half_or_less() -> None:
    # 2021: (−0,99 − 0,85 − 0,74) / 3 = −0,86
    assert safra_oni(parse_oni_table(SAMPLE), 2021, ENSO) == OniYear(2021, -0.86, "la_nina")


def test_should_leave_the_year_neutral_between_the_thresholds() -> None:
    # 2023: o DJF ainda era de La Niña (−0,55), mas a média do verão e do outono é −0,33
    assert safra_oni(parse_oni_table(SAMPLE), 2023, ENSO) == OniYear(2023, -0.33, None)


@pytest.mark.parametrize(("anom", "fase"), [(0.5, "el_nino"), (-0.5, "la_nina")])
def test_should_count_the_exact_threshold_as_the_phase(anom: float, fase: str) -> None:
    # NOAA CPC: El Niño com ONI de +0,5 ou mais; La Niña com −0,5 ou menos
    table = {(season, 2030): anom for season in ENSO.estacoes}

    assert safra_oni(table, 2030, ENSO) == OniYear(2030, anom, fase)  # type: ignore[arg-type]


def test_should_classify_the_rounded_mean_written_in_the_file() -> None:
    # (0,50 + 0,50 + 0,49) / 3 = 0,4967, gravado como 0,50: o arquivo nunca diz 0,50 e "neutro"
    table = {("DJF", 2030): 0.50, ("JFM", 2030): 0.50, ("FMA", 2030): 0.49}

    assert safra_oni(table, 2030, ENSO) == OniYear(2030, 0.5, "el_nino")


def test_should_skip_the_year_while_a_season_has_no_value_yet() -> None:
    # 2024 só tem DJF e JFM na amostra: nada de média com estação faltando
    assert safra_oni(parse_oni_table(SAMPLE), 2024, ENSO) is None


def test_should_use_the_seasons_from_the_rules_file() -> None:
    so_djf = replace(ENSO, estacoes=("DJF",))

    assert safra_oni(parse_oni_table(SAMPLE), 2023, so_djf) == OniYear(2023, -0.55, "la_nina")


# --- arquivo do contrato -----------------------------------------------------------------------


def test_should_build_the_contract_file_read_by_the_api(tmp_path: Path) -> None:
    result = build_oni_file(SAMPLE, range(2016, 2025), ENSO, FINISHED_AT)

    versao = result["versao_dados"]
    run = DataRun(
        source=versao["fonte"],
        params=versao["parametros"],
        finished_at=datetime.fromisoformat(versao["fim"]),
        version=versao["versao"],
    )
    assert run.source == "noaa_oni"
    assert (versao["fim"], versao["versao"]) == ("2026-11-14T13:00:00Z", "2026.11-noaa-oni")
    parametros = versao["parametros"]
    assert parametros["url"] == ONI_URL
    assert parametros["estacoes"] == ["DJF", "JFM", "FMA"]
    assert (parametros["el_nino_oni_min"], parametros["la_nina_oni_max"]) == (0.5, -0.5)
    assert parametros["anos"] == [2016, 2024]
    # Só os anos com as três estações; 2024 ainda sem FMA na amostra
    assert result["anos"] == [
        {"ano": 2016, "oni": 2.13, "fase": "el_nino"},
        {"ano": 2021, "oni": -0.86, "fase": "la_nina"},
        {"ano": 2023, "oni": -0.33, "fase": None},
    ]

    path = tmp_path / "oni.json"
    path.write_text(json.dumps(result), encoding="utf-8")
    assert [y.ano for y in FileEnsoRepository(path).get_oni_years()] == [2016, 2021, 2023]


def test_should_refuse_a_table_without_any_requested_year() -> None:
    with pytest.raises(ValueError, match="2005"):
        build_oni_file(SAMPLE, range(2005, 2010), ENSO, FINISHED_AT)


# --- linha de comando --------------------------------------------------------------------------


def test_should_download_once_and_write_the_file_from_command_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    saida = tmp_path / "noaa_oni" / "oni.json"
    http = FakeNoaa()

    main(
        ["--saida", str(saida), "--ano-inicio", "2016", "--ano-fim", "2024"],
        http_get=http,
        now=lambda: FINISHED_AT,
    )

    assert http.calls == [ONI_URL]
    payload = json.loads(saida.read_text(encoding="utf-8"))
    assert [a["ano"] for a in payload["anos"]] == [2016, 2021, 2023]
    out = capsys.readouterr().out
    assert "oni.json" in out
    assert "2024" in out  # avisa o ano que ficou de fora


def test_should_not_call_noaa_in_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    def no_network(url: str, params: dict[str, Any], timeout: float) -> str:
        raise AssertionError("o --dry-run não pode chamar a NOAA")

    saida = tmp_path / "oni.json"
    main(["--dry-run", "--saida", str(saida)], http_get=no_network)

    out = capsys.readouterr().out
    assert ONI_URL in out
    assert "2005" in out and "2024" in out  # anos da série do motor
    assert not saida.exists()


def test_should_refuse_a_year_range_backwards() -> None:
    with pytest.raises(SystemExit):
        main(["--ano-inicio", "2024", "--ano-fim", "2005", "--dry-run"], http_get=FakeNoaa())


def test_should_save_in_the_team_downloads_folder_by_default() -> None:
    expected = repo_root() / "data" / "baixados" / "noaa_oni" / "oni.json"

    assert expected == DEFAULT_OUTPUT
