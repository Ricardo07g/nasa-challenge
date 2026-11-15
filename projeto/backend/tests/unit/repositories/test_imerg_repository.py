"""Leitura do arquivo do contrato IMERG (saída do pipeline/fetch_imerg.py, tarefa 0027).

Valores de teste (1.5, 2.25) e versão `teste-imerg`: nada é dado real. O `versao_dados` usa a
chave de fonte real porque é ela que a carga confere.
"""

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.models.data_run import DataRun
from app.repositories.imerg_repository import FileImergRepository


def _season(year: int, rain: list[Any] | None = None) -> dict[str, Any]:
    return {"ano": year, "inicio": f"{year}-01-01", "chuva_mm": rain or [1.5] * 212}


def _file(tmp_path: Path, celulas: list[dict[str, Any]], **versao: Any) -> Path:
    path = tmp_path / "imerg.json"
    payload: dict[str, Any] = {"celulas": celulas}
    if versao.get("with_version", True):
        payload["versao_dados"] = {
            "fonte": "gpm_imerg",
            "parametros": {"produto": "GPM_3IMERGDF", "anos": [2005, 2006]},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "teste-imerg",
        }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


FARM = {"celula": "-190_-482", "lat": -18.95, "lon": -48.15}


def test_should_read_the_data_run_of_the_file(tmp_path: Path) -> None:
    repo = FileImergRepository(_file(tmp_path, []))

    assert repo.get_data_run() == DataRun(
        source="gpm_imerg",
        params={"produto": "GPM_3IMERGDF", "anos": [2005, 2006]},
        finished_at=datetime(2026, 11, 14, 13, 0, tzinfo=UTC),
        version="teste-imerg",
    )


def test_should_return_no_data_run_without_versao_dados(tmp_path: Path) -> None:
    assert FileImergRepository(_file(tmp_path, [], with_version=False)).get_data_run() is None


def test_should_read_each_cell_with_its_seasons_and_keep_null_days(tmp_path: Path) -> None:
    rain = [None, 2.25, *[0.0] * 210]
    repo = FileImergRepository(
        _file(tmp_path, [{**FARM, "temporadas": [_season(2005, rain), _season(2006)]}])
    )

    [series] = repo.list_cell_series()

    assert (series.cell_id, series.latitude, series.longitude) == ("-190_-482", -18.95, -48.15)
    assert [s.year for s in series.seasons] == [2005, 2006]
    first = series.seasons[0]
    assert first.start_date == date(2005, 1, 1)
    assert first.rain_mm[:3] == (None, 2.25, 0.0)
    assert first.complete is False
    assert series.seasons[1].complete is True


@pytest.mark.parametrize(
    "celula",
    [
        {**FARM, "lat": -18.9543, "temporadas": []},  # não é o centro da célula
        {**FARM, "temporadas": [_season(2005, [1.5] * 211)]},  # 211 dias
        {**FARM, "temporadas": [_season(2005, [-1.0] * 212)]},  # chuva negativa
        {"celula": "-190_-482", "lat": -18.95, "temporadas": []},  # sem lon
    ],
)
def test_should_refuse_a_cell_outside_the_contract(tmp_path: Path, celula: dict[str, Any]) -> None:
    repo = FileImergRepository(_file(tmp_path, [celula]))

    with pytest.raises((KeyError, ValueError)):
        repo.list_cell_series()


def test_should_have_nothing_without_a_file(tmp_path: Path) -> None:
    repo = FileImergRepository(tmp_path / "nao-existe.json")

    assert repo.get_data_run() is None
    assert repo.list_cell_series() == []
