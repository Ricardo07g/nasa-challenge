"""Contrato e leitura do arquivo da área queimada (MODIS MCD64A1, tarefa 0043).

O arquivo é o que o `pipeline/fetch_area_queimada.py` grava (`versao_dados`, `fonte`, `anos`,
`grade` e `queimadas`), no formato do "Contrato dos dados das fontes" → "Área queimada" do
`AGENTS.md` do backend. Só lê: o raio e a contagem dos anos ficam no `BurnedAreaService`.
"""

import json
import math
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Final, Protocol

from app.models.area_queimada import MapaAreaQueimada, PixelQueimado, QueimadasPerto, pixel_center
from app.models.data_run import DataRun
from app.repositories.data_run_repository import data_run_from_json
from app.repositories.soja_recente_repository import grade_from_json

SOURCE_KEY: Final[str] = "modis_mcd64a1"


class AreaQueimadaRepository(Protocol):
    """Os pixels queimados no quadrado de ±`km` em volta do ponto (`None` fora da área medida)."""

    def get_burned_near(self, lat: float, lon: float, km: float) -> QueimadasPerto | None: ...


def mapa_from_json(payload: Mapping[str, Any]) -> MapaAreaQueimada:
    """O arquivo inteiro como `MapaAreaQueimada`. Fora do contrato: `ValueError`."""
    versao = payload.get("versao_dados") or {}
    if versao.get("fonte") != SOURCE_KEY:
        raise ValueError(
            f"arquivo da área queimada precisa de versao_dados.fonte = {SOURCE_KEY}, "
            f"veio {versao.get('fonte')!r}"
        )
    try:
        inicio, fim = (int(ano) for ano in payload["anos"])
        return MapaAreaQueimada(
            fonte=str(payload["fonte"]),
            ano_inicio=inicio,
            ano_fim=fim,
            grade=grade_from_json(payload["grade"]),
            queimadas=tuple(
                (int(row), int(col), tuple(sorted(int(ano) for ano in anos)))
                for row, col, anos in payload["queimadas"]
            ),
        )
    except (KeyError, TypeError) as exc:
        raise ValueError(f"arquivo da área queimada fora do contrato (falta {exc})") from exc


class FileAreaQueimadaRepository:
    """Lê o arquivo do `AREA_QUEIMADA_PATH` uma vez. Sem caminho ou sem arquivo: nenhum dado."""

    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._payload: dict[str, Any] | None = None
        self._mapa: MapaAreaQueimada | None = None
        self._by_pixel: dict[tuple[int, int], tuple[int, ...]] = {}

    def _load(self) -> MapaAreaQueimada | None:
        if self._payload is None:
            if self._path is None or not self._path.is_file():
                self._payload = {}
            else:
                payload = json.loads(self._path.read_text(encoding="utf-8"))
                self._mapa = mapa_from_json(payload)  # fora do contrato: erro a cada leitura
                self._by_pixel = {(row, col): anos for row, col, anos in self._mapa.queimadas}
                self._payload = payload
        return self._mapa

    def get_data_run(self) -> DataRun | None:
        """A execução que gerou o arquivo (`versao_dados`); None sem arquivo."""
        self._load()
        versao_dados = (self._payload or {}).get("versao_dados")
        return None if versao_dados is None else data_run_from_json(versao_dados)

    def get_burned_near(self, lat: float, lon: float, km: float) -> QueimadasPerto | None:
        mapa = self._load()
        if mapa is None:
            return None
        pixel = mapa.grade.pixel_at(lat, lon)
        if pixel is None:
            return None
        reach = math.ceil(km * 1000.0 / mapa.grade.pixel_m) + 1
        row0, col0 = pixel
        pixels = tuple(
            PixelQueimado(*pixel_center(mapa.grade, row, col), anos)
            for (row, col), anos in self._by_pixel.items()
            if abs(row - row0) <= reach and abs(col - col0) <= reach
        )
        return QueimadasPerto(mapa.ano_inicio, mapa.ano_fim, mapa.fonte, pixels)
