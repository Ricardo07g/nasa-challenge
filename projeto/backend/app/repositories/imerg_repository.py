"""Leitura do arquivo do contrato IMERG: a chuva diária do GPM IMERG Final por célula de 0,1°.

O arquivo é a saída do `pipeline/fetch_imerg.py` (R2.4). A carga dos arquivos no banco
(`pipeline/load_files_to_db.py --imerg`, R3.4) leva a série para o `climate_season`.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from app.models.climate import ImergCellSeries, ImergSeason
from app.models.data_run import DataRun
from app.repositories.data_run_repository import data_run_from_json


class ImergRepository(Protocol):
    """A série do IMERG de cada célula e a execução que gerou o arquivo."""

    def get_data_run(self) -> DataRun | None: ...

    def list_cell_series(self) -> list[ImergCellSeries]: ...


def _rain(values: list[Any]) -> tuple[float | None, ...]:
    return tuple(None if value is None else float(value) for value in values)


def imerg_series_from_json(item: dict[str, Any]) -> ImergCellSeries:
    """Uma célula do contrato IMERG (chaves em português). O model valida o resto."""
    return ImergCellSeries(
        cell_id=str(item["celula"]),
        latitude=float(item["lat"]),
        longitude=float(item["lon"]),
        seasons=tuple(
            ImergSeason(
                year=int(season["ano"]),
                start_date=date.fromisoformat(season["inicio"]),
                rain_mm=_rain(season["chuva_mm"]),
            )
            for season in item["temporadas"]
        ),
    )


class FileImergRepository:
    """Lê o arquivo do contrato IMERG (`versao_dados` + `celulas[]`). Sem arquivo: nada."""

    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._payload: dict[str, Any] | None = None

    def _load(self) -> dict[str, Any]:
        if self._payload is None:
            if self._path is None or not self._path.is_file():
                self._payload = {}
            else:
                self._payload = json.loads(self._path.read_text(encoding="utf-8"))
        return self._payload

    def get_data_run(self) -> DataRun | None:
        """A execução que gerou o arquivo (`versao_dados`); None sem arquivo ou sem a chave."""
        versao_dados = self._load().get("versao_dados")
        return None if versao_dados is None else data_run_from_json(versao_dados)

    def list_cell_series(self) -> list[ImergCellSeries]:
        """A série de cada célula, validada pelos models (ValueError fora do contrato)."""
        return [imerg_series_from_json(item) for item in self._load().get("celulas", [])]
