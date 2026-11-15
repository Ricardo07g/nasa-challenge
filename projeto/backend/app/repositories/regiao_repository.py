"""Contrato e implementação do acesso à região pelo satélite (P3): percentuais por ano, por região.

O arquivo é o que o `pipeline/fetch_regiao_ndvi.py` grava (`versao_dados` + `regioes[]`), no
formato do "Contrato dos dados das fontes" → "Região pelo satélite" do `AGENTS.md` do backend.
"""

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Protocol

from app.models.data_run import DataRun
from app.models.regiao import RegiaoAno, RegiaoSatelite
from app.repositories.data_run_repository import data_run_from_json


class RegionRepository(Protocol):
    """As regiões já calculadas pelo pipeline (cada uma com centro, raio e anos)."""

    def list_regions(self) -> list[RegiaoSatelite]: ...


def _optional_float(value: Any) -> float | None:
    return None if value is None else float(value)


def regiao_ano_from_json(item: Mapping[str, Any]) -> RegiaoAno:
    """Um ano do arquivo (chaves em português); percentual ausente ou `null` vira None."""
    return RegiaoAno(
        ano=int(item["ano"]),
        n_pixels=int(item["n_pixels"]),
        pct_parado=_optional_float(item.get("pct_parado")),
        pct_plantou=_optional_float(item.get("pct_plantou")),
        pct_incerto=_optional_float(item.get("pct_incerto")),
        pct_sem_dado=_optional_float(item.get("pct_sem_dado")),
    )


def regiao_from_json(item: Mapping[str, Any]) -> RegiaoSatelite:
    """Uma região do arquivo. O model recusa o que sai do contrato (`ValueError`)."""
    return RegiaoSatelite(
        lat=float(item["lat"]),
        lon=float(item["lon"]),
        raio_km=float(item["raio_km"]),
        fonte=str(item["fonte"]),
        mascara=str(item["mascara"]),
        anos=tuple(regiao_ano_from_json(ano) for ano in item.get("anos", [])),
    )


class FileRegionRepository:
    """Lê as regiões do arquivo do `REGIAO_PATH`. Sem caminho ou sem arquivo: nenhuma região."""

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
        """A execução que gerou o arquivo (`versao_dados`); None sem arquivo."""
        versao_dados = self._load().get("versao_dados")
        return None if versao_dados is None else data_run_from_json(versao_dados)

    def list_regions(self) -> list[RegiaoSatelite]:
        return [regiao_from_json(item) for item in self._load().get("regioes", [])]
