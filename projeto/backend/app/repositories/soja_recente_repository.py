"""Contrato e implementação do acesso à soja recente (RF-24, tarefa 0037): o pico do NDVI do ponto.

O arquivo é o que o `pipeline/fetch_soja_recente.py` grava (`versao_dados`, `safra`, `fonte`,
`grade` e `pico_centesimos`), no formato do "Contrato dos dados das fontes" → "Soja recente" do
`AGENTS.md` do backend. Só lê: a regra (limite da soja) fica no `SojaRecenteService`.
"""

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Protocol

from app.models.data_run import DataRun
from app.models.soja_recente import (
    SINUSOIDAL_RADIUS_M,
    GradeSinusoidal,
    MapaSojaRecente,
    PicoSojaRecente,
)
from app.repositories.data_run_repository import data_run_from_json


class SojaRecenteRepository(Protocol):
    """O pico do NDVI da safra mais recente no pixel do ponto (`None` fora da área medida)."""

    def get_pico(self, lat: float, lon: float) -> PicoSojaRecente | None: ...


def grade_from_json(item: Mapping[str, Any]) -> GradeSinusoidal:
    return GradeSinusoidal(
        x_oeste_m=float(item["x_oeste_m"]),
        y_norte_m=float(item["y_norte_m"]),
        pixel_m=float(item["pixel_m"]),
        linhas=int(item["linhas"]),
        colunas=int(item["colunas"]),
        raio_m=float(item.get("raio_m", SINUSOIDAL_RADIUS_M)),
    )


def mapa_from_json(payload: Mapping[str, Any]) -> MapaSojaRecente:
    """O arquivo inteiro como `MapaSojaRecente`. Chave faltando ou valor fora do contrato:
    `ValueError` (o model confere linhas, colunas e centésimos)."""
    try:
        return MapaSojaRecente(
            safra=str(payload["safra"]),
            fonte=str(payload["fonte"]),
            grade=grade_from_json(payload["grade"]),
            pico_centesimos=tuple(tuple(row) for row in payload["pico_centesimos"]),
        )
    except (KeyError, TypeError) as exc:
        raise ValueError(f"arquivo da soja recente fora do contrato (falta {exc})") from exc


class FileSojaRecenteRepository:
    """Lê o arquivo do `SOJA_RECENTE_PATH` uma vez. Sem caminho ou sem arquivo: nenhum pico."""

    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._payload: dict[str, Any] | None = None
        self._mapa: MapaSojaRecente | None = None

    def _load(self) -> dict[str, Any]:
        if self._payload is None:
            if self._path is None or not self._path.is_file():
                self._payload = {}
            else:
                payload = json.loads(self._path.read_text(encoding="utf-8"))
                self._mapa = mapa_from_json(payload)  # fora do contrato: erro a cada leitura
                self._payload = payload
        return self._payload

    def get_data_run(self) -> DataRun | None:
        """A execução que gerou o arquivo (`versao_dados`); None sem arquivo."""
        versao_dados = self._load().get("versao_dados")
        return None if versao_dados is None else data_run_from_json(versao_dados)

    def get_pico(self, lat: float, lon: float) -> PicoSojaRecente | None:
        self._load()
        return None if self._mapa is None else self._mapa.pico_em(lat, lon)
