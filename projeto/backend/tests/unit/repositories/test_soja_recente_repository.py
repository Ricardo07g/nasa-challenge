"""FileSojaRecenteRepository: o arquivo da soja recente (RF-24, tarefa 0037).

Arquivos de teste com `fonte: "teste"` e picos de teste (não são do MODIS). A grade de teste fica
perto do equador, com pixels de 1 km (1 km ~ 0,009°), para os pontos caírem em pixels conhecidos.
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from app.models.soja_recente import PicoSojaRecente
from app.repositories.soja_recente_repository import FileSojaRecenteRepository


def _payload(linhas: list[list[int | None]] | None = None) -> dict[str, Any]:
    return {
        "versao_dados": {"fonte": "teste", "parametros": {"tipo": "soja_recente"},
                         "fim": "2026-11-15T12:00:00Z", "versao": "2026.11-teste"},
        "safra": "2025/26",
        "fonte": "teste",
        "grade": {"projecao": "sinusoidal_modis", "raio_m": 6371007.181, "x_oeste_m": 0.0,
                  "y_norte_m": 0.0, "pixel_m": 1000.0, "linhas": 2, "colunas": 3},
        "pico_centesimos": linhas if linhas is not None else [[86, 41, None], [12, 70, 69]],
    }  # fmt: skip


def _write(tmp_path: Path, payload: dict[str, Any]) -> Path:
    path = tmp_path / "soja_recente_2026.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_have_no_peak_without_a_path_or_without_the_file(tmp_path: Path) -> None:
    assert FileSojaRecenteRepository(None).get_pico(-0.0045, 0.0045) is None
    assert FileSojaRecenteRepository(tmp_path / "nao_existe.json").get_pico(-0.0045, 0.0045) is None


def test_should_read_the_peak_of_the_pixel_of_the_point(tmp_path: Path) -> None:
    repository = FileSojaRecenteRepository(_write(tmp_path, _payload()))

    assert repository.get_pico(-0.0045, 0.0045) == PicoSojaRecente("2025/26", "teste", 0.86)
    assert repository.get_pico(-0.0135, 0.0225) == PicoSojaRecente("2025/26", "teste", 0.69)


def test_should_read_a_pixel_without_data_as_a_null_peak(tmp_path: Path) -> None:
    repository = FileSojaRecenteRepository(_write(tmp_path, _payload()))

    assert repository.get_pico(-0.0045, 0.0225) == PicoSojaRecente("2025/26", "teste", None)


def test_should_have_no_peak_for_a_point_outside_the_grid(tmp_path: Path) -> None:
    repository = FileSojaRecenteRepository(_write(tmp_path, _payload()))

    assert repository.get_pico(0.0045, 0.0045) is None
    assert repository.get_pico(-0.0045, 0.0315) is None


def test_should_read_the_file_only_once(tmp_path: Path) -> None:
    path = _write(tmp_path, _payload())
    repository = FileSojaRecenteRepository(path)

    assert repository.get_pico(-0.0045, 0.0045) is not None
    path.unlink()
    assert repository.get_pico(-0.0045, 0.0045) == PicoSojaRecente("2025/26", "teste", 0.86)


def test_should_refuse_a_file_out_of_the_contract(tmp_path: Path) -> None:
    short_row = FileSojaRecenteRepository(_write(tmp_path, _payload([[86, 41], [12, 70, 69]])))
    with pytest.raises(ValueError, match="colunas"):
        short_row.get_pico(-0.0045, 0.0045)

    payload = _payload()
    del payload["grade"]
    without_grid = FileSojaRecenteRepository(_write(tmp_path, payload))
    with pytest.raises(ValueError, match="grade"):
        without_grid.get_pico(-0.0045, 0.0045)


def test_should_tell_which_run_made_the_file(tmp_path: Path) -> None:
    data_run = FileSojaRecenteRepository(_write(tmp_path, _payload())).get_data_run()

    assert data_run is not None
    assert data_run.source == "teste"
    assert data_run.version == "2026.11-teste"
    assert data_run.finished_at == datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
    assert FileSojaRecenteRepository(None).get_data_run() is None
