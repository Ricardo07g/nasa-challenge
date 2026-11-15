"""Contrato e leitura da previsão do ENSO (El Niño / La Niña), para o sinal para o outono (0038).

O arquivo vem do `pipeline/fetch_enso_previsao.py` (contrato "Previsão do ENSO" no `AGENTS.md` do
backend) e a API o lê pelo `ENSO_PREVISAO_PATH`. Sem arquivo, não há previsão e o `sinal` de
/recomendacao sai nulo.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast


class EnsoForecastRepository(Protocol):
    """A previsão do ENSO mais recente (uma só, a mesma para qualquer ponto)."""

    def get_enso_forecast(self) -> EnsoForecast | None: ...


class FileEnsoForecastRepository:
    """Lê o arquivo do contrato (`versao_dados`, `fonte`, `emitida_em`, `estacoes[]`) uma vez só.

    Arquivo fora do contrato: ValueError (ou KeyError), para o erro aparecer em vez de virar sinal.
    """

    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._loaded = False
        self._forecast: EnsoForecast | None = None

    def get_enso_forecast(self) -> EnsoForecast | None:
        if not self._loaded:
            self._forecast = self._read()
            self._loaded = True
        return self._forecast

    def _read(self) -> EnsoForecast | None:
        if self._path is None or not self._path.is_file():
            return None
        payload: dict[str, Any] = json.loads(self._path.read_text(encoding="utf-8"))
        return EnsoForecast(
            emitida_em=date.fromisoformat(str(payload["emitida_em"])),
            fonte=str(payload["fonte"]),
            estacoes=tuple(_season_from_json(item) for item in payload["estacoes"]),
        )


def _season_from_json(item: dict[str, Any]) -> EnsoSeasonForecast:
    return EnsoSeasonForecast(
        estacao=str(item["estacao"]),
        ano=int(item["ano"]),
        la_nina=int(item["la_nina"]),
        neutro=int(item["neutro"]),
        el_nino=int(item["el_nino"]),
    )
