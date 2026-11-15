"""Grava a fase do El Niño / La Niña de cada safrinha pelo ONI da NOAA (P1, tarefa 0035).

Uso (a partir de projeto/backend):

    uv run python -m pipeline.fetch_oni --dry-run   # mostra o pedido e os anos, sem rede
    uv run python -m pipeline.fetch_oni             # anos da série do motor (2005 a 2024)

Baixa a tabela pública do RONI (Relative Oceanic Niño Index, ERSST v6), o índice oficial do CPC da
NOAA desde 01/02/2026 (tarefa 0066), sem credencial: um pedido de ~15 KB, uma linha por estação de 3
meses (`SEAS YR ANOM`; a tabela antiga do ONI, `SEAS YR TOTAL ANOM`, também é lida). A NOAA rotula
cada estação pelo mês do meio: o DJF de 2016 é dez/2015 a fev/2016.

Regra do ano da safrinha (grupo `enso` do `regras.yaml`, hipótese do time, a revisar): a média do
ONI das estações DJF, JFM e FMA do ano (dezembro do ano anterior a abril), arredondada em 2 casas
como a tabela. Média de +0,5 ou mais = `el_nino`; de −0,5 ou menos = `la_nina`; entre os dois,
neutro (`null`). Ano com alguma dessas estações ainda sem valor fica de fora (a API mostra `null`).

A saída segue o contrato "ONI" do `AGENTS.md` do backend (`versao_dados` + `anos[]`), em
`data/baixados/noaa_oni/oni.json` a partir da raiz do repositório (fora do git). A API lê o
arquivo pelo `ONI_PATH`. É dado da NOAA, não da NASA, e só informa: não entra na conta.
"""

import argparse
import json
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from statistics import fmean
from typing import Any, Final

from app.constants import HISTORICAL_END_YEAR, HISTORICAL_START_YEAR
from app.models.data_run import DataRun
from app.models.enso import FaseEnso, OniYear
from app.models.regras import RegrasEnso
from app.repositories.external.http_client import (
    TextHttpGetter,
    default_http_get_text,
    get_with_retries,
)
from app.repositories.rules_repository import load_default_rules
from pipeline.fetch_cmip6_deltas import repo_root

SOURCE_KEY: Final[str] = "noaa_oni"
# Tarefa 0066: desde 01/02/2026 o índice oficial da NOAA é o RONI (Relative ONI: o Niño 3.4 menos a
# média dos trópicos, reescalado), com os mesmos ±0,5 °C (NWS Public Information Statement 26-05).
# As chances da previsão que o sinal do outono usa são verificadas por ele.
ONI_URL: Final[str] = "https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt"
ONI_PRODUCT: Final[str] = "NOAA CPC Relative Oceanic Niño Index (RONI, ERSST v6)"
ONI_TIMEOUT_SECONDS: Final[float] = 60.0
ONI_HEADER: Final[tuple[str, ...]] = ("SEAS", "YR", "TOTAL", "ANOM")
# A tabela do RONI não tem a coluna do total (`SEAS YR ANOM`); as duas são lidas.
RONI_HEADER: Final[tuple[str, ...]] = ("SEAS", "YR", "ANOM")
# As 12 estações de 3 meses da tabela, na ordem do ano.
ONI_SEASONS: Final[frozenset[str]] = frozenset(
    {"DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"}
)
ONI_DECIMALS: Final[int] = 2  # a tabela traz a anomalia com 2 casas

OniTable = Mapping[tuple[str, int], float]

DOWNLOADS_DIR = repo_root() / "data" / "baixados" / "noaa_oni"
DEFAULT_OUTPUT = DOWNLOADS_DIR / "oni.json"


def parse_oni_table(text: str) -> dict[tuple[str, int], float]:
    """Tabela do RONI (`SEAS YR ANOM`) ou do ONI (`SEAS YR TOTAL ANOM`): {(estação, ano): anomalia}.

    Raises:
        ValueError: sem o cabeçalho (ex.: página de erro) ou com linha fora do formato. Nada de
            ler pela metade: resposta estranha nunca vira dado.
    """
    lines = [line.split() for line in text.splitlines() if line.strip()]
    header = tuple(lines[0]) if lines else ()
    if header not in (ONI_HEADER, RONI_HEADER):
        raise ValueError(f"a resposta não é a tabela do ONI (cabeçalho {' '.join(RONI_HEADER)})")
    table: dict[tuple[str, int], float] = {}
    for fields in lines[1:]:
        error = f"linha fora do formato da tabela do ONI: {' '.join(fields)!r}"
        if len(fields) != len(header) or fields[0] not in ONI_SEASONS:
            raise ValueError(error)
        season, year, anomaly = fields[0], fields[1], fields[-1]
        try:
            table[(season, int(year))] = float(anomaly)
        except ValueError as exc:
            raise ValueError(error) from exc
    return table


def _phase(oni: float, rules: RegrasEnso) -> FaseEnso | None:
    if oni >= rules.el_nino_oni_min:
        return "el_nino"
    if oni <= rules.la_nina_oni_max:
        return "la_nina"
    return None


def safra_oni(table: OniTable, year: int, rules: RegrasEnso) -> OniYear | None:
    """Média do ONI das estações do `regras.yaml` no ano da safrinha e a fase do ENSO.

    A fase sai da média arredondada (a que vai no arquivo). None quando falta alguma estação.
    """
    values = [table.get((season, year)) for season in rules.estacoes]
    if any(value is None for value in values):
        return None
    oni = round(fmean(value for value in values if value is not None), ONI_DECIMALS)
    return OniYear(ano=year, oni=oni, fase=_phase(oni, rules))


def _data_run(years: range, rules: RegrasEnso, finished_at: datetime) -> DataRun:
    return DataRun(
        source=SOURCE_KEY,
        params={
            "produto": ONI_PRODUCT,
            "url": ONI_URL,
            "regra": "média do ONI das estações do ano da safrinha (regras.yaml, grupo enso)",
            "estacoes": list(rules.estacoes),
            "el_nino_oni_min": rules.el_nino_oni_min,
            "la_nina_oni_max": rules.la_nina_oni_max,
            "anos": [years[0], years[-1]],
        },
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-noaa-oni",
    )


def build_oni_file(
    text: str, years: range, rules: RegrasEnso, finished_at: datetime
) -> dict[str, Any]:
    """Arquivo do contrato do ONI: `versao_dados` e um item por ano com as estações completas.

    Raises:
        ValueError: a tabela não é a do ONI ou não tem nenhum dos anos pedidos.
    """
    table = parse_oni_table(text)
    found = [item for item in (safra_oni(table, year, rules) for year in years) if item]
    if not found:
        raise ValueError(f"a tabela do ONI não tem nenhum ano de {years[0]} a {years[-1]}")
    run = _data_run(years, rules, finished_at)
    return {
        "versao_dados": {
            "fonte": run.source,
            "parametros": dict(run.params),
            "fim": run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": run.version,
        },
        "anos": [{"ano": item.ano, "oni": item.oni, "fase": item.fase} for item in found],
    }


# --- linha de comando --------------------------------------------------------------------------


def _summary(payload: Mapping[str, Any], years: range) -> str:
    anos = payload["anos"]
    written = {item["ano"] for item in anos}
    by_phase = {
        label: [item["ano"] for item in anos if item["fase"] == fase]
        for label, fase in (("El Niño", "el_nino"), ("La Niña", "la_nina"), ("neutros", None))
    }
    parts = [f"{label}: {', '.join(map(str, found)) or '-'}" for label, found in by_phase.items()]
    missing = [year for year in years if year not in written]
    if missing:
        parts.append(f"de fora (estação sem valor): {', '.join(map(str, missing))}")
    return " | ".join(parts)


def main(
    argv: Sequence[str] | None = None,
    http_get: TextHttpGetter = default_http_get_text,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    rules: RegrasEnso | None = None,
) -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ano-inicio", type=int, default=HISTORICAL_START_YEAR)
    parser.add_argument("--ano-fim", type=int, default=HISTORICAL_END_YEAR)
    parser.add_argument("--dry-run", action="store_true", help="só mostra o pedido, sem rede")
    args = parser.parse_args(argv)
    if args.ano_fim < args.ano_inicio:
        parser.error("--ano-fim precisa ser igual ou depois de --ano-inicio")

    enso = rules if rules is not None else load_default_rules().enso
    years = range(args.ano_inicio, args.ano_fim + 1)
    if args.dry_run:
        print(
            f"Pedido: GET {ONI_URL} (1 pedido, sem credencial) | safrinhas de {years[0]} a "
            f"{years[-1]} | média das estações {', '.join(enso.estacoes)} | El Niño com "
            f"{enso.el_nino_oni_min:+g} ou mais, La Niña com {enso.la_nina_oni_max:+g} ou menos "
            f"| saída: {args.saida}"
        )
        return

    text = get_with_retries(http_get, ONI_URL, {}, timeout=ONI_TIMEOUT_SECONDS)
    payload = build_oni_file(text, years, enso, now())
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    text_out = json.dumps(payload, ensure_ascii=False, indent=1) + "\n"
    args.saida.write_text(text_out, encoding="utf-8")
    print(f"{len(payload['anos'])} safrinhas gravadas em {args.saida}")
    print(_summary(payload, years))


if __name__ == "__main__":
    main()
