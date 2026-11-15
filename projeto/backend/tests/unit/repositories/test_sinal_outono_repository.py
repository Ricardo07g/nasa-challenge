"""Repositories do sinal para o outono: o SMAP recente (A2.2) e as fontes que ainda não chegaram.

O arquivo do SMAP recente é o que o `pipeline/fetch_smap.py --recente` grava. Os valores e a versão
`teste-smap-recente` são de teste, não dado real.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any

from app.models.sinal_outono import RecentSoilMoisture
from app.repositories.sinal_outono_repository import (
    FileRecentSoilMoistureRepository,
    NoAutumnSignalDataRepository,
)


def test_should_have_no_forecast_soil_moisture_or_recent_rain_until_the_data_arrives() -> None:
    # Sem o dado, nada de previsão inventada: o service devolve sinal nulo (PRD 7.10, AGENTS.md).
    repo = NoAutumnSignalDataRepository()

    assert repo.get_seasonal_forecast(-18.9543, -48.1993) is None
    assert repo.get_recent_soil_moisture(-18.9543, -48.1993) is None
    assert repo.get_recent_rain(-18.9543, -48.1993) is None


def _point(lat: float, lon: float, pctl: float | None, data: str = "2026-11-10") -> dict:
    serie = [{"data": data, "sm_rootzone_wetness": 0.4, "sm_rootzone_m3_m3": 0.2}]
    return {"lat": lat, "lon": lon, "sm_rootzone_pctl": pctl, "serie": serie}


def _write(path: Path, pontos: list[dict[str, Any]]) -> Path:
    payload = {
        "versao_dados": {
            "fonte": "smap",
            "parametros": {"modo": "recente", "data": "2026-11-10"},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "teste-smap-recente",
        },
        "pontos": pontos,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_the_recent_percentile_of_the_cell_of_the_point(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "smap_recente.json",
        [_point(-19.05, -48.15, 80.0), _point(-18.95, -48.15, 12.5)],
    )

    moisture = FileRecentSoilMoistureRepository(path).get_recent_soil_moisture(-18.9543, -48.1993)

    assert moisture == RecentSoilMoisture(sm_rootzone_pctl=12.5, data=date(2026, 11, 10))


def test_should_have_no_recent_soil_moisture_for_another_cell_or_without_the_file(
    tmp_path: Path,
) -> None:
    path = _write(tmp_path / "smap_recente.json", [_point(-19.05, -48.15, 80.0)])

    assert FileRecentSoilMoistureRepository(path).get_recent_soil_moisture(-18.95, -48.15) is None
    assert FileRecentSoilMoistureRepository(None).get_recent_soil_moisture(-18.95, -48.15) is None
    missing = FileRecentSoilMoistureRepository(tmp_path / "nao-existe.json")
    assert missing.get_recent_soil_moisture(-18.95, -48.15) is None


def test_should_have_no_recent_soil_moisture_without_a_percentile(tmp_path: Path) -> None:
    # Poucos anos na climatologia: o script grava `null`, e nada de percentil inventado.
    path = _write(tmp_path / "smap_recente.json", [_point(-18.95, -48.15, None)])

    assert FileRecentSoilMoistureRepository(path).get_recent_soil_moisture(-18.95, -48.15) is None
