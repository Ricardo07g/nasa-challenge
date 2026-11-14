"""Repository contract and implementation for MODIS MOD13Q1 10-year NDVI series."""

import json
from pathlib import Path
from typing import Any, Protocol

from app.models.talhao import HistoricoAno


class NdviRepository(Protocol):
    """Data access contract for MODIS NDVI time series."""

    def get_ndvi_history(
        self, lat: float, lon: float
    ) -> tuple[list[dict[str, Any]], list[HistoricoAno]]: ...


class CachedEarthEngineNdviRepository:
    """Loads 10-year MODIS MOD13Q1 NDVI history from cached JSON."""

    def __init__(
        self,
        fallback_json_path: Path = Path("/workspace/data/output/modis_ndvi_historico_10anos.json"),
    ) -> None:
        self._fallback_json_path = fallback_json_path
        self._cache: tuple[list[dict[str, Any]], list[HistoricoAno]] | None = None

    def get_ndvi_history(
        self, lat: float, lon: float
    ) -> tuple[list[dict[str, Any]], list[HistoricoAno]]:
        if self._cache is not None:
            return list(self._cache[0]), list(self._cache[1])

        if not self._fallback_json_path.exists():
            return [], []

        payload: dict[str, Any] = json.loads(self._fallback_json_path.read_text(encoding="utf-8"))
        serie_ndvi: list[dict[str, Any]] = list(payload.get("serie_ndvi", []))
        classificacao_raw: list[dict[str, Any]] = list(payload.get("classificacao_anual", []))

        anos: list[HistoricoAno] = []
        for item in classificacao_raw:
            status = str(item.get("status_talhao", ""))
            ndvi_med = float(item.get("ndvi_medio_safrinha", 0.0))
            ndvi_max = float(item.get("ndvi_max", ndvi_med))
            situacao = str(
                item.get(
                    "situacao",
                    "parado" if status.lower() == "pousio" else "plantou",
                )
            )
            anos.append(
                HistoricoAno(
                    ano=int(item["ano"]),
                    situacao=situacao,
                    ndvi_max=ndvi_max,
                    ndvi_medio_safrinha=ndvi_med,
                    status_talhao=status,
                )
            )

        self._cache = (serie_ndvi, anos)
        return list(serie_ndvi), list(anos)
