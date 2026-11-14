"""Contrato e implementação do acesso à série de NDVI (MODIS MOD13Q1) por ponto."""

from datetime import date
from pathlib import Path
from typing import Any, Protocol

from app.models.talhao import NdviRecord
from app.repositories.point_cache import load_points, point_key


class NdviRepository(Protocol):
    """Acesso à série de NDVI de 16 dias de um ponto."""

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]: ...


class CachedNdviRepository:
    """Lê a série de NDVI de um cache JSON por ponto (valores brutos do MOD13Q1 ou já escalados).

    Ponto fora do cache (ou sem cache configurado): série vazia, e o `/talhao` devolve
    `historico: null` (plano técnico §3.1).
    """

    def __init__(self, cache_path: Path | None) -> None:
        self._cache_path = cache_path
        self._points: dict[str, dict[str, Any]] | None = None

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        if self._points is None:
            self._points = load_points(self._cache_path)
        point = self._points.get(point_key(lat, lon))
        if point is None:
            return []
        return [
            NdviRecord(data=date.fromisoformat(str(item["data"])), ndvi=float(item["ndvi"]))
            for item in point.get("serie", [])
        ]
