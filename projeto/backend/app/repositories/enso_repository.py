"""Contrato e leitura da fase do ENSO de cada safrinha (ONI da NOAA, P1).

O arquivo vem do `pipeline/fetch_oni.py` (seção "ONI" do `AGENTS.md` do backend) e a API o lê pelo
`ONI_PATH`. Sem arquivo, nenhum ano tem fase e o detalhe de cada ano sai com `enso: null`.
"""

import json
from pathlib import Path
from typing import Any, Protocol

from app.models.enso import OniYear


class EnsoRepository(Protocol):
    """Fase do ENSO por ano de safrinha."""

    def get_oni_years(self) -> list[OniYear]: ...


class FileEnsoRepository:
    """Lê o arquivo do contrato do ONI (`versao_dados` + `anos[]`). Lê o arquivo uma vez só."""

    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._years: list[OniYear] | None = None

    def get_oni_years(self) -> list[OniYear]:
        if self._years is None:
            self._years = [_oni_year_from_json(item) for item in self._load().get("anos", [])]
        return list(self._years)

    def _load(self) -> dict[str, Any]:
        if self._path is None or not self._path.is_file():
            return {}
        payload: dict[str, Any] = json.loads(self._path.read_text(encoding="utf-8"))
        return payload


def _oni_year_from_json(item: dict[str, Any]) -> OniYear:
    return OniYear(ano=int(item["ano"]), oni=float(item["oni"]), fase=item.get("fase"))
