"""Gera o arquivo de clima da fazenda de exemplo a partir da série diária do NASA POWER.

Uso (a partir de projeto/backend):

    uv run python -m pipeline.export_climate_fixture \\
        --entrada ../../data/output/historico_uberlandia_20anos_diario.json \\
        --saida app/fixtures/clima_fazenda_exemplo.json

A entrada é o JSON do `data/extract_historical_20y.py` (lista de dias com PRECTOTCORR,
T2M_MAX e T2M_MIN). A saída tem uma temporada por ano, de 1/jan a 31/jul (212 dias), no mesmo
formato da tabela `climate_season` do plano técnico (§5).
"""

import argparse
import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

DAYS_PER_SEASON = 212  # 1/jan a 31/jul (plano técnico §5)
POWER_LAT_STEP = 0.5  # grade do MERRA-2 usada pelo NASA POWER
POWER_LON_STEP = 0.625
MISSING_VALUE = -999.0
FIELDS = {"chuva_mm": "PRECTOTCORR", "tmax_c": "T2M_MAX", "tmin_c": "T2M_MIN"}
# Lavoura de demonstração, perto de Uberlândia (MG): fica perto da Fazenda do Glória, mas não
# garantidamente dentro dela.
DEFAULT_LAT = -18.9543
DEFAULT_LON = -48.1993


def power_cell_bounds(lat: float, lon: float) -> dict[str, float]:
    """Limites da célula do NASA POWER que contém o ponto (o POWER devolve o valor da célula)."""
    lat_center = round(lat / POWER_LAT_STEP) * POWER_LAT_STEP
    lon_center = round(lon / POWER_LON_STEP) * POWER_LON_STEP
    return {
        "lat_min": lat_center - POWER_LAT_STEP / 2,
        "lat_max": lat_center + POWER_LAT_STEP / 2,
        "lon_min": lon_center - POWER_LON_STEP / 2,
        "lon_max": lon_center + POWER_LON_STEP / 2,
    }


def _value(record: dict[str, Any], field: str) -> float:
    raw = record.get(field)
    if raw is None or float(raw) <= MISSING_VALUE:
        raise ValueError(f"Dado ausente no NASA POWER: {field} em {record.get('date')}")
    return round(float(raw), 2)


def build_climate_fixture(
    daily_records: list[dict[str, Any]], lat: float, lon: float
) -> dict[str, Any]:
    """Agrupa a série diária em temporadas de 1/jan a 31/jul, uma por ano completo."""
    by_date = {date.fromisoformat(str(r["date"])): r for r in daily_records}
    years: dict[int, list[date]] = defaultdict(list)
    for day in by_date:
        years[day.year].append(day)

    temporadas: list[dict[str, Any]] = []
    for year in sorted(years):
        start = date(year, 1, 1)
        window = [start + timedelta(days=i) for i in range(DAYS_PER_SEASON)]
        if any(day not in by_date for day in window):
            continue
        temporada: dict[str, Any] = {"ano": year, "inicio": start.isoformat()}
        for key, field in FIELDS.items():
            temporada[key] = [_value(by_date[day], field) for day in window]
        temporadas.append(temporada)

    return {
        "fonte": "nasa_power",
        "descricao": (
            "NASA POWER diário (PRECTOTCORR, T2M_MAX, T2M_MIN), 1/jan a 31/jul de cada ano, "
            "para a célula do POWER da lavoura de demonstração, perto de Uberlândia (MG)."
        ),
        "ponto": {"lat": lat, "lon": lon},
        "cobertura": power_cell_bounds(lat, lon),
        "temporadas": temporadas,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--entrada", type=Path, required=True)
    parser.add_argument("--saida", type=Path, required=True)
    parser.add_argument("--lat", type=float, default=DEFAULT_LAT)
    parser.add_argument("--lon", type=float, default=DEFAULT_LON)
    args = parser.parse_args()

    daily = json.loads(args.entrada.read_text(encoding="utf-8"))
    fixture = build_climate_fixture(daily, lat=args.lat, lon=args.lon)
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps(fixture, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(fixture['temporadas'])} temporadas gravadas em {args.saida}")


if __name__ == "__main__":
    main()
