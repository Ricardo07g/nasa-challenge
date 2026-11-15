"""Unit tests for FileEnsoForecastRepository: o arquivo da previsão do ENSO (tarefa 0038)."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast
from app.repositories.enso_forecast_repository import (
    EnsoForecastRepository,
    FileEnsoForecastRepository,
)

# Valores de teste no formato do contrato (não são a previsão da NOAA)
VERSAO_DADOS = {
    "fonte": "noaa_cpc_enso",
    "parametros": {"emitida": "2030-11"},
    "fim": "2030-11-15T03:00:00Z",
    "versao": "teste-enso-previsao",
}
ESTACOES = [
    {"estacao": "JFM", "ano": 2031, "la_nina": 5, "neutro": 25, "el_nino": 70},
    {"estacao": "FMA", "ano": 2031, "la_nina": 10, "neutro": 30, "el_nino": 60},
]


def _write(tmp_path: Path, **overrides: Any) -> Path:
    payload: dict[str, Any] = {
        "versao_dados": VERSAO_DADOS,
        "fonte": "Fonte de teste",
        "emitida_em": "2030-11-14",
        "estacoes": ESTACOES,
    }
    payload.update(overrides)
    path = tmp_path / "enso_previsao.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_the_forecast_with_each_season(tmp_path: Path) -> None:
    repo: EnsoForecastRepository = FileEnsoForecastRepository(_write(tmp_path))

    assert repo.get_enso_forecast() == EnsoForecast(
        emitida_em=date(2030, 11, 14),
        fonte="Fonte de teste",
        estacoes=(
            EnsoSeasonForecast(estacao="JFM", ano=2031, la_nina=5, neutro=25, el_nino=70),
            EnsoSeasonForecast(estacao="FMA", ano=2031, la_nina=10, neutro=30, el_nino=60),
        ),
    )


def test_should_have_no_forecast_without_enso_previsao_path() -> None:
    # Sem o arquivo, o sinal para o outono sai nulo ("Ainda não conectado" na tela 7)
    assert FileEnsoForecastRepository(None).get_enso_forecast() is None


def test_should_have_no_forecast_when_the_file_does_not_exist(tmp_path: Path) -> None:
    assert FileEnsoForecastRepository(tmp_path / "nao_existe.json").get_enso_forecast() is None


def test_should_refuse_a_file_outside_the_contract(tmp_path: Path) -> None:
    # Chances que não somam 100%: o erro aparece em vez de virar sinal
    estacoes = [{"estacao": "FMA", "ano": 2031, "la_nina": 10, "neutro": 10, "el_nino": 10}]

    with pytest.raises(ValueError, match="somar 100"):
        FileEnsoForecastRepository(_write(tmp_path, estacoes=estacoes)).get_enso_forecast()


def test_should_read_the_file_only_once(tmp_path: Path) -> None:
    path = _write(tmp_path)
    repo = FileEnsoForecastRepository(path)
    first = repo.get_enso_forecast()

    path.unlink()

    assert repo.get_enso_forecast() == first
