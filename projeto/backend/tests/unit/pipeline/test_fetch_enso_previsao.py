"""Unit tests for pipeline/fetch_enso_previsao.py: previsão do ENSO da NOAA CPC (tarefa 0038).

Nada de rede: o HTTP é sempre falso. As amostras imitam a estrutura das páginas da NOAA CPC
(tabela `probabilities-table` e cabeçalho da discussão), com números e datas inventados.
"""

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.models.data_run import DataRun
from app.repositories.enso_forecast_repository import FileEnsoForecastRepository
from pipeline.fetch_cmip6_deltas import repo_root
from pipeline.fetch_enso_previsao import (
    DEFAULT_OUTPUT,
    DISCUSSION_URL,
    PROBABILITIES_URL,
    build_enso_forecast_file,
    main,
    parse_discussion_date,
    parse_probabilities,
)

FINISHED_AT = datetime(2030, 11, 15, 3, 0, tzinfo=UTC)
TOOLTIP = '<span class="tooltip tooltip-right" role="tooltip">{}</span>'
SEASON_MONTHS = {"OND": "Oct Nov Dec", "NDJ": "Nov Dec Jan", "DJF": "Dec Jan Feb",
                 "JFM": "Jan Feb Mar", "FMA": "Feb Mar Apr", "MAM": "Mar Apr May"}  # fmt: skip
ROWS = [("OND", 5, 15, 80), ("NDJ", 5, 20, 75), ("DJF", 10, 25, 65), ("JFM", 10, 35, 55),
        ("FMA", 15, 40, 45), ("MAM", 20, 45, 35)]  # fmt: skip


def _row(season: str, *pcts: int) -> str:
    cells = "".join(f"<td>{p}</td>" for p in pcts)
    abbr = f"<abbr>{season} {TOOLTIP.format(SEASON_MONTHS.get(season, ''))}</abbr>"
    return f'<tr><th scope="row">{abbr}</th>{cells}</tr>'


def _probabilities_page(
    rows: list[tuple[Any, ...]] = ROWS,
    issued: str = "November 2030",
    header: str = "<th>Season</th><th>La Ni&ntilde;a</th><th>Neutral</th><th>El Ni&ntilde;o</th>",
) -> str:
    body = "".join(_row(*row) for row in rows)
    return (
        "<html><body><h1>Official NOAA CPC ENSO Probabilities</h1>"
        f"<h2>Issued {issued}</h2>"
        '<table id="probabilities-table"><caption>ENSO Probabilities</caption><tbody>'
        f'<tr class="cell-headings">{header}</tr>{body}</tbody></table></body></html>'
    )


def _discussion_page(day: str = "13 November 2030") -> str:
    return (
        "<html><body><td>DIAGNOSTIC DISCUSSION<br>issued by<br>"
        f"CLIMATE PREDICTION CENTER/NCEP/NWS<br>\n {day} </td></body></html>"
    )


class FakeCpc:
    def __init__(self, probabilities: str | None = None, discussion: str | None = None) -> None:
        self.pages = {
            PROBABILITIES_URL: probabilities or _probabilities_page(),
            DISCUSSION_URL: discussion or _discussion_page(),
        }
        self.calls: list[str] = []

    def __call__(self, url: str, params: dict[str, Any], timeout: float) -> str:
        self.calls.append(url)
        return self.pages[url]


# --- leitura das páginas -----------------------------------------------------------------------


def test_should_read_the_issue_month_and_the_chance_of_each_season() -> None:
    issued, rows = parse_probabilities(_probabilities_page())

    assert issued == (2030, 11)
    assert rows == ROWS


def test_should_refuse_a_page_without_the_probabilities_table() -> None:
    with pytest.raises(ValueError, match="probabilities-table"):
        parse_probabilities("<html><body>Service unavailable. Issued November 2030</body></html>")


def test_should_refuse_a_page_without_the_issue_month() -> None:
    with pytest.raises(ValueError, match="Issued"):
        parse_probabilities(_probabilities_page(issued="soon"))


def test_should_refuse_a_table_with_the_columns_in_another_order() -> None:
    header = "<th>Season</th><th>El Ni&ntilde;o</th><th>Neutral</th><th>La Ni&ntilde;a</th>"

    with pytest.raises(ValueError, match="cabeçalho"):
        parse_probabilities(_probabilities_page(header=header))


@pytest.mark.parametrize(
    "rows",
    [
        [("OND", 5, 15, 80), ("NDJ", "x", 20, 75)],  # chance que não é número
        [("OND", 5, 15, 80), ("NDJ", 5, 20)],  # coluna faltando
        [("OND", 5, 15, 80), ("XYZ", 5, 20, 75)],  # estação desconhecida
    ],
)
def test_should_refuse_a_row_outside_the_table_format(rows: list[tuple[Any, ...]]) -> None:
    with pytest.raises(ValueError, match="linha"):
        parse_probabilities(_probabilities_page(rows=rows))


def test_should_refuse_seasons_out_of_order() -> None:
    with pytest.raises(ValueError, match="seguidas"):
        parse_probabilities(_probabilities_page(rows=[("OND", 5, 15, 80), ("DJF", 5, 20, 75)]))


def test_should_refuse_a_table_that_does_not_start_in_the_issue_month() -> None:
    # Emitida em novembro: a 1ª estação é a do meio em novembro (OND)
    with pytest.raises(ValueError, match="OND"):
        parse_probabilities(_probabilities_page(rows=ROWS[1:]))


def test_should_read_the_day_of_the_discussion() -> None:
    assert parse_discussion_date(_discussion_page("13 November 2030")) == date(2030, 11, 13)


def test_should_refuse_a_discussion_without_the_day() -> None:
    with pytest.raises(ValueError, match="CLIMATE PREDICTION CENTER"):
        parse_discussion_date("<html><body>Not found</body></html>")


# --- arquivo do contrato -----------------------------------------------------------------------


def test_should_build_the_contract_file_read_by_the_api(tmp_path: Path) -> None:
    result = build_enso_forecast_file(_probabilities_page(), _discussion_page(), FINISHED_AT)

    versao = result["versao_dados"]
    run = DataRun(
        source=versao["fonte"],
        params=versao["parametros"],
        finished_at=datetime.fromisoformat(versao["fim"]),
        version=versao["versao"],
    )
    assert run.source == "noaa_cpc_enso"
    assert (versao["fim"], versao["versao"]) == ("2030-11-15T03:00:00Z", "2030.11-noaa-cpc-enso")
    parametros = versao["parametros"]
    assert (parametros["url"], parametros["url_discussao"]) == (PROBABILITIES_URL, DISCUSSION_URL)
    assert parametros["emitida"] == "2030-11"
    assert parametros["indice"].startswith("RONI")
    assert result["fonte"] == "NOAA"
    assert result["emitida_em"] == "2030-11-13"
    # O ano é o do mês do meio da estação: DJF de 2031 = dez/2030 a fev/2031
    assert [(s["estacao"], s["ano"]) for s in result["estacoes"]] == [
        ("OND", 2030),
        ("NDJ", 2030),
        ("DJF", 2031),
        ("JFM", 2031),
        ("FMA", 2031),
        ("MAM", 2031),
    ]
    assert result["estacoes"][4] == {
        "estacao": "FMA",
        "ano": 2031,
        "la_nina": 15,
        "neutro": 40,
        "el_nino": 45,
    }

    path = tmp_path / "enso_previsao.json"
    path.write_text(json.dumps(result), encoding="utf-8")
    forecast = FileEnsoForecastRepository(path).get_enso_forecast()
    assert forecast is not None
    assert forecast.season("FMA") is not None
    assert forecast.emitida_em == date(2030, 11, 13)


def test_should_refuse_chances_that_do_not_add_up_to_one_hundred() -> None:
    page = _probabilities_page(rows=[("OND", 5, 15, 50)])

    with pytest.raises(ValueError, match="somar 100"):
        build_enso_forecast_file(page, _discussion_page(), FINISHED_AT)


def test_should_refuse_a_discussion_of_another_month() -> None:
    with pytest.raises(ValueError, match="mesma"):
        build_enso_forecast_file(
            _probabilities_page(), _discussion_page("9 October 2030"), FINISHED_AT
        )


# --- linha de comando --------------------------------------------------------------------------


def test_should_download_the_two_pages_and_write_the_file_from_command_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    saida = tmp_path / "noaa_enso_previsao" / "enso_previsao.json"
    http = FakeCpc()

    main(["--saida", str(saida)], http_get=http, now=lambda: FINISHED_AT)

    assert http.calls == [PROBABILITIES_URL, DISCUSSION_URL]
    payload = json.loads(saida.read_text(encoding="utf-8"))
    assert payload["emitida_em"] == "2030-11-13"
    out = capsys.readouterr().out
    assert "enso_previsao.json" in out
    assert "FMA 2031: La Niña 15%, neutro 40%, El Niño 45%" in out


def test_should_retry_a_failed_request(tmp_path: Path) -> None:
    saida = tmp_path / "enso_previsao.json"
    http = FakeCpc()
    failures = {"left": 1}

    def flaky(url: str, params: dict[str, Any], timeout: float) -> str:
        if failures["left"]:
            failures["left"] -= 1
            raise TimeoutError("timeout de teste")
        return http(url, params, timeout)

    main(["--saida", str(saida)], http_get=flaky, now=lambda: FINISHED_AT)

    assert saida.exists()


def test_should_not_write_anything_when_the_page_format_is_unexpected(tmp_path: Path) -> None:
    saida = tmp_path / "enso_previsao.json"
    saida.write_text("versão anterior", encoding="utf-8")
    http = FakeCpc(probabilities="<html><body>Página nova, sem tabela</body></html>")

    with pytest.raises(ValueError):
        main(["--saida", str(saida)], http_get=http, now=lambda: FINISHED_AT)

    assert saida.read_text(encoding="utf-8") == "versão anterior"


def test_should_not_call_noaa_in_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    def no_network(url: str, params: dict[str, Any], timeout: float) -> str:
        raise AssertionError("o --dry-run não pode chamar a NOAA")

    saida = tmp_path / "enso_previsao.json"
    main(["--dry-run", "--saida", str(saida)], http_get=no_network)

    out = capsys.readouterr().out
    assert PROBABILITIES_URL in out and DISCUSSION_URL in out
    assert not saida.exists()


def test_should_save_in_the_team_downloads_folder_by_default() -> None:
    expected = repo_root() / "data" / "baixados" / "noaa_enso_previsao" / "enso_previsao.json"

    assert expected == DEFAULT_OUTPUT
