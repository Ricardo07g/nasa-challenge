"""Unit tests for FileEnsoRepository: o arquivo do ONI (seção "ONI" do AGENTS.md do backend)."""

import json
from pathlib import Path
from typing import Any

import pytest

from app.models.enso import OniYear
from app.repositories.enso_repository import FileEnsoRepository

# Valores de teste no formato do contrato (não são a tabela da NOAA)
VERSAO_DADOS = {
    "fonte": "noaa_oni",
    "parametros": {"estacoes": ["DJF", "JFM", "FMA"]},
    "fim": "2026-11-14T13:00:00Z",
    "versao": "2026.11-noaa-oni",
}


def _write(tmp_path: Path, anos: list[dict[str, Any]]) -> Path:
    path = tmp_path / "oni.json"
    payload = {"versao_dados": VERSAO_DADOS, "anos": anos}
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_each_off_season_year_with_its_phase(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        [
            {"ano": 2010, "oni": 1.2, "fase": "el_nino"},
            {"ano": 2011, "oni": -1.1, "fase": "la_nina"},
            {"ano": 2013, "oni": -0.25, "fase": None},
        ],
    )

    assert FileEnsoRepository(path).get_oni_years() == [
        OniYear(ano=2010, oni=1.2, fase="el_nino"),
        OniYear(ano=2011, oni=-1.1, fase="la_nina"),
        OniYear(ano=2013, oni=-0.25, fase=None),
    ]


def test_should_read_a_missing_phase_key_as_neutral(tmp_path: Path) -> None:
    # Sem valor = campo ausente ou null (regras gerais do contrato)
    path = _write(tmp_path, [{"ano": 2013, "oni": -0.25}])

    assert FileEnsoRepository(path).get_oni_years() == [OniYear(ano=2013, oni=-0.25, fase=None)]


def test_should_return_no_year_without_oni_path() -> None:
    assert FileEnsoRepository(None).get_oni_years() == []


def test_should_return_no_year_when_the_file_does_not_exist(tmp_path: Path) -> None:
    assert FileEnsoRepository(tmp_path / "nao_existe.json").get_oni_years() == []


def test_should_refuse_a_file_outside_the_contract(tmp_path: Path) -> None:
    path = _write(tmp_path, [{"ano": 2010, "oni": 1.2, "fase": "neutro"}])

    with pytest.raises(ValueError, match="fase"):
        FileEnsoRepository(path).get_oni_years()


def test_should_read_the_file_only_once(tmp_path: Path) -> None:
    path = _write(tmp_path, [{"ano": 2010, "oni": 1.2, "fase": "el_nino"}])
    repo = FileEnsoRepository(path)
    first = repo.get_oni_years()

    path.unlink()

    assert repo.get_oni_years() == first
