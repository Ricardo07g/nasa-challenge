"""Contrato e implementação do acesso à textura do solo (SoilGrids) por ponto."""

from pathlib import Path
from typing import Any, Protocol

from app.constants import (
    CAD_CLAYEY_MM,
    CAD_MEDIUM_MM,
    CAD_SANDY_MM,
    CLAY_THRESHOLD_PCT,
    DEFAULT_CLAY_PCT,
    DEFAULT_SAND_PCT,
    SAND_THRESHOLD_PCT,
)
from app.models.talhao import SoloInfo
from app.repositories.point_cache import load_points, point_key


class SoilRepository(Protocol):
    """Acesso à textura do solo e à água disponível (CAD) de um ponto."""

    def get_soil(self, lat: float, lon: float) -> SoloInfo: ...


def classify_soil_texture(argila_pct: float, areia_pct: float) -> tuple[str, float]:
    """Textura e CAD (mm) pela argila e areia de 0-30 cm (PRD 6.4)."""
    if argila_pct > CLAY_THRESHOLD_PCT:
        return "argiloso", CAD_CLAYEY_MM
    if areia_pct > SAND_THRESHOLD_PCT:
        return "arenoso", CAD_SANDY_MM
    return "medio", CAD_MEDIUM_MM


DEFAULT_SOIL = SoloInfo(
    argila_percentual=DEFAULT_CLAY_PCT,
    areia_percentual=DEFAULT_SAND_PCT,
    textura_solo="medio",
    cad_capacidade_agua_mm=CAD_MEDIUM_MM,
    fonte="padrao",
)


class CachedSoilGridsRepository:
    """Lê a argila e a areia do SoilGrids de um cache JSON por ponto.

    Ponto fora do cache (ou sem cache configurado) recebe solo médio com `fonte: padrao`,
    como manda o plano técnico §3.1, e nunca o solo de outro talhão.
    """

    def __init__(self, cache_path: Path | None) -> None:
        self._cache_path = cache_path
        self._points: dict[str, dict[str, Any]] | None = None

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        if self._points is None:
            self._points = load_points(self._cache_path)
        point = self._points.get(point_key(lat, lon))
        if point is None:
            return DEFAULT_SOIL
        argila = float(point["argila_pct"])
        areia = float(point["areia_pct"])
        textura, cad = classify_soil_texture(argila, areia)
        return SoloInfo(
            argila_percentual=argila,
            areia_percentual=areia,
            textura_solo=textura,
            cad_capacidade_agua_mm=cad,
            fonte="soilgrids",
        )
