"""Grava a previsão oficial do El Niño / La Niña da NOAA CPC para o sinal para o outono (0038).

Uso (a partir de projeto/backend):

    uv run python -m pipeline.fetch_enso_previsao --dry-run   # mostra os pedidos, sem rede
    uv run python -m pipeline.fetch_enso_previsao             # baixa e grava o arquivo

Faz 2 pedidos públicos à NOAA CPC, sem credencial:
- a página "Official NOAA CPC ENSO Probabilities" (HTML com uma tabela simples, ~28 KB): o mês da
  emissão ("Issued November 2026") e a chance (%) de La Niña, neutro e El Niño em 9 estações de
  3 meses seguidas, a partir da estação do meio no mês da emissão (em novembro, OND);
- a "ENSO Diagnostic Discussion" (~13 KB): só o dia da emissão ("12 November 2026"), que precisa
  ser do mesmo mês da tabela.
A NOAA publica as duas na 2ª quinta-feira de cada mês. As chances são verificadas pelo RONI
(Niño 3.4 relativo, El Niño com +0,5 °C ou mais e La Niña com −0,5 °C ou menos).

A saída segue o contrato "Previsão do ENSO" do `AGENTS.md` do backend (`versao_dados`, `fonte`,
`emitida_em` e `estacoes[]`, com o ano do mês do meio de cada estação), em
`data/baixados/noaa_enso_previsao/enso_previsao.json` a partir da raiz do repositório (fora do
git). A API lê o arquivo pelo `ENSO_PREVISAO_PATH`. Formato inesperado (página de erro, coluna
trocada, estação fora de ordem, chances que não somam 100%): erro, e nada é gravado.
"""

import argparse
import json
import re
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, date, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Final

from app.models.data_run import DataRun
from app.models.enso_forecast import (
    ENSO_SEASONS,
    MONTHS_IN_YEAR,
    EnsoForecast,
    EnsoSeasonForecast,
    season_middle_month,
)
from app.repositories.external.http_client import (
    TextHttpGetter,
    default_http_get_text,
    get_with_retries,
)
from pipeline.fetch_cmip6_deltas import repo_root

SOURCE_KEY: Final[str] = "noaa_cpc_enso"
# Nome curto da fonte que vai na frase do sinal ("El Niño (98%, NOAA)")
SOURCE_LABEL: Final[str] = "NOAA"
PRODUCT: Final[str] = "Official NOAA CPC ENSO Probabilities"
PROBABILITIES_URL: Final[str] = (
    "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/"
)
DISCUSSION_URL: Final[str] = (
    "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml"
)
INDEX: Final[str] = (
    "RONI (Niño 3.4 relativo; El Niño com +0,5 °C ou mais, La Niña com −0,5 °C ou menos)"
)
TIMEOUT_SECONDS: Final[float] = 60.0
TABLE_ID: Final[str] = "probabilities-table"
HEADER: Final[tuple[str, ...]] = ("Season", "La Niña", "Neutral", "El Niño")
MONTHS_EN: Final[tuple[str, ...]] = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)
_MONTH_PATTERN = "|".join(MONTHS_EN)
ISSUED_PATTERN: Final[re.Pattern[str]] = re.compile(rf"Issued\s+({_MONTH_PATTERN})\s+(\d{{4}})")
DISCUSSION_PATTERN: Final[re.Pattern[str]] = re.compile(
    rf"CLIMATE PREDICTION CENTER/NCEP/NWS\s+(\d{{1,2}})\s+({_MONTH_PATTERN})\s+(\d{{4}})"
)

DOWNLOADS_DIR = repo_root() / "data" / "baixados" / "noaa_enso_previsao"
DEFAULT_OUTPUT = DOWNLOADS_DIR / "enso_previsao.json"

SeasonRow = tuple[str, int, int, int]


class _TableParser(HTMLParser):
    """Texto das células de cada linha da tabela `probabilities-table` (só ela)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.found = False
        self.rows: list[list[str]] = []
        self._depth = 0  # tabelas abertas desde a das probabilidades (0 = fora dela)
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            if self._depth:
                self._depth += 1
            elif dict(attrs).get("id") == TABLE_ID:
                self.found, self._depth = True, 1
        elif self._depth == 1 and tag == "tr":
            self.rows.append([])
        elif self._depth == 1 and tag in ("th", "td") and self.rows:
            self._cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._depth:
            self._depth -= 1
        elif tag in ("th", "td") and self._cell is not None:
            self.rows[-1].append(" ".join("".join(self._cell).split()))
            self._cell = None

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)


def parse_probabilities(html: str) -> tuple[tuple[int, int], list[SeasonRow]]:
    """O mês da emissão (ano, mês) e as linhas (estação, La Niña, neutro, El Niño), em %.

    Raises:
        ValueError: sem o mês da emissão, sem a tabela, com o cabeçalho diferente, com linha fora
            do formato, estações fora de ordem ou a 1ª estação fora do mês da emissão.
    """
    issued = ISSUED_PATTERN.search(html)
    if issued is None:
        raise ValueError("a página não diz o mês da emissão ('Issued <mês> <ano>')")
    year, month = int(issued.group(2)), MONTHS_EN.index(issued.group(1)) + 1

    parser = _TableParser()
    parser.feed(html)
    parser.close()
    if not parser.found or not parser.rows:
        raise ValueError(f"a resposta não tem a tabela das probabilidades ({TABLE_ID})")
    header, *lines = parser.rows
    if tuple(header) != HEADER:
        raise ValueError(f"cabeçalho da tabela diferente de {' | '.join(HEADER)}: {header!r}")
    if not lines:
        raise ValueError("a tabela das probabilidades não tem nenhuma linha")

    rows: list[SeasonRow] = []
    for cells in lines:
        error = f"linha fora do formato da tabela das probabilidades: {cells!r}"
        season = cells[0].split()[0] if cells and cells[0] else ""
        if len(cells) != len(HEADER) or season not in ENSO_SEASONS:
            raise ValueError(error)
        try:
            la_nina, neutro, el_nino = (int(value) for value in cells[1:])
        except ValueError as exc:
            raise ValueError(error) from exc
        rows.append((season, la_nina, neutro, el_nino))

    middles = [season_middle_month(row[0]) for row in rows]
    if middles[0] != month:
        expected = ENSO_SEASONS[month - 1]
        raise ValueError(f"emitida em {month:02d}/{year}, a tabela devia começar em {expected}")
    if any(b != a % MONTHS_IN_YEAR + 1 for a, b in zip(middles, middles[1:], strict=False)):
        raise ValueError("as estações da tabela precisam vir seguidas, de mês em mês")
    return (year, month), rows


def parse_discussion_date(html: str) -> date:
    """O dia da emissão no cabeçalho da discussão ("CLIMATE PREDICTION CENTER/NCEP/NWS 12 ...").

    Raises:
        ValueError: sem o dia no cabeçalho (ex.: página de erro).
    """
    text = " ".join(re.sub(r"<[^>]+>", " ", html).split())
    found = DISCUSSION_PATTERN.search(text)
    if found is None:
        raise ValueError("a discussão não tem o dia ('CLIMATE PREDICTION CENTER/NCEP/NWS <dia>')")
    day, month_name, year = found.groups()
    return date(int(year), MONTHS_EN.index(month_name) + 1, int(day))


def _data_run(issued: tuple[int, int], rows: Sequence[SeasonRow], finished_at: datetime) -> DataRun:
    year, month = issued
    return DataRun(
        source=SOURCE_KEY,
        params={
            "produto": PRODUCT,
            "url": PROBABILITIES_URL,
            "url_discussao": DISCUSSION_URL,
            "indice": INDEX,
            "emitida": f"{year}-{month:02d}",
            "estacoes": [rows[0][0], rows[-1][0]],
        },
        finished_at=finished_at,
        version=f"{year}.{month:02d}-noaa-cpc-enso",
    )


def build_enso_forecast_file(
    probabilities_html: str, discussion_html: str, finished_at: datetime
) -> dict[str, Any]:
    """Arquivo do contrato da previsão do ENSO, com o ano do mês do meio de cada estação.

    Raises:
        ValueError: página fora do formato, chances que não somam 100% ou a discussão de outro
            mês (as duas páginas precisam ser da mesma emissão).
    """
    (year, month), rows = parse_probabilities(probabilities_html)
    issued_on = parse_discussion_date(discussion_html)
    if (issued_on.year, issued_on.month) != (year, month):
        raise ValueError(
            f"a discussão ({issued_on:%d/%m/%Y}) e a tabela ({month:02d}/{year}) não são da "
            "mesma emissão: rode de novo mais tarde"
        )
    seasons = tuple(
        EnsoSeasonForecast(
            estacao=season,
            ano=year + (month - 1 + idx) // MONTHS_IN_YEAR,
            la_nina=la_nina,
            neutro=neutro,
            el_nino=el_nino,
        )
        for idx, (season, la_nina, neutro, el_nino) in enumerate(rows)
    )
    forecast = EnsoForecast(emitida_em=issued_on, fonte=SOURCE_LABEL, estacoes=seasons)
    run = _data_run((year, month), rows, finished_at)
    return {
        "versao_dados": {
            "fonte": run.source,
            "parametros": dict(run.params),
            "fim": run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": run.version,
        },
        "fonte": forecast.fonte,
        "emitida_em": forecast.emitida_em.isoformat(),
        "estacoes": [
            {
                "estacao": s.estacao,
                "ano": s.ano,
                "la_nina": s.la_nina,
                "neutro": s.neutro,
                "el_nino": s.el_nino,
            }
            for s in forecast.estacoes
        ],
    }


# --- linha de comando --------------------------------------------------------------------------


def _summary(payload: Mapping[str, Any]) -> str:
    estacoes = payload["estacoes"]
    first, last = estacoes[0], estacoes[-1]
    parts = [
        f"emitida em {date.fromisoformat(payload['emitida_em']):%d/%m/%Y}",
        f"{len(estacoes)} estações, de {first['estacao']} {first['ano']} a "
        f"{last['estacao']} {last['ano']}",
    ]
    parts += [
        f"{s['estacao']} {s['ano']}: La Niña {s['la_nina']}%, neutro {s['neutro']}%, "
        f"El Niño {s['el_nino']}%"
        for s in estacoes
        if s["estacao"] in ("FMA", "MAM")
    ]
    return " | ".join(parts)


def main(
    argv: Sequence[str] | None = None,
    http_get: TextHttpGetter = default_http_get_text,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true", help="só mostra os pedidos, sem rede")
    args = parser.parse_args(argv)

    if args.dry_run:
        print(
            f"Pedidos: GET {PROBABILITIES_URL} (tabela das chances) e GET {DISCUSSION_URL} "
            f"(dia da emissão) | 2 pedidos, sem credencial | saída: {args.saida}"
        )
        return

    probabilities = get_with_retries(http_get, PROBABILITIES_URL, {}, timeout=TIMEOUT_SECONDS)
    discussion = get_with_retries(http_get, DISCUSSION_URL, {}, timeout=TIMEOUT_SECONDS)
    payload = build_enso_forecast_file(probabilities, discussion, now())
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", "utf-8")
    print(f"Previsão do ENSO gravada em {args.saida}")
    print(_summary(payload))


if __name__ == "__main__":
    main()
