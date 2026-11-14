"""Repository contract and implementation for SoilGrids 250m soil properties."""

import json
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


class SoilRepository(Protocol):
    """Data access contract for soil texture and water holding capacity (CAD)."""

    def get_soil(self, lat: float, lon: float) -> SoloInfo: ...


def classify_soil_texture(argila_pct: float, areia_pct: float) -> tuple[str, float]:
    """Classifies soil texture and available water capacity (CAD in mm) from clay and sand %.

    Args:
        argila_pct: Clay content percentage (0-100) in the 0-30cm layer.
        areia_pct: Sand content percentage (0-100) in the 0-30cm layer.

    Returns:
        A tuple of (textura_solo, cad_capacidade_agua_mm).
    """
    if argila_pct > CLAY_THRESHOLD_PCT:
        return "argiloso", CAD_CLAYEY_MM
    if areia_pct > SAND_THRESHOLD_PCT:
        return "arenoso", CAD_SANDY_MM
    return "medio", CAD_MEDIUM_MM


class CachedSoilGridsRepository:
    """Reads SoilGrids soil properties from local cache JSON with safe fallback."""

    def __init__(
        self,
        fallback_json_path: Path = Path("/workspace/data/output/soilgrids_talhao.json"),
    ) -> None:
        self._fallback_json_path = fallback_json_path
        self._cached_soil: SoloInfo | None = None

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        if self._cached_soil is not None:
            return self._cached_soil

        if self._fallback_json_path.exists():
            payload: dict[str, Any] = json.loads(
                self._fallback_json_path.read_text(encoding="utf-8")
            )
            argila = float(payload.get("argila_percentual", DEFAULT_CLAY_PCT))
            areia = float(payload.get("areia_percentual", DEFAULT_SAND_PCT))
            textura, cad = classify_soil_texture(argila, areia)
            self._cached_soil = SoloInfo(
                argila_percentual=argila,
                areia_percentual=areia,
                textura_solo=str(payload.get("textura_solo", textura)),
                cad_capacidade_agua_mm=float(payload.get("cad_capacidade_agua_mm", cad)),
                fonte=str(payload.get("fonte", "soilgrids")),
            )
            return self._cached_soil

        return SoloInfo(
            argila_percentual=DEFAULT_CLAY_PCT,
            areia_percentual=DEFAULT_SAND_PCT,
            textura_solo="medio",
            cad_capacidade_agua_mm=CAD_MEDIUM_MM,
            fonte="padrao",
        )
