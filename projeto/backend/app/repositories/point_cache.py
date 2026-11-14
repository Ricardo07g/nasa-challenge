"""Chave dos caches por ponto (plano técnico §5): lat/lon arredondados a 0,0025° (~250 m)."""

import json
from pathlib import Path
from typing import Any

from app.constants import POINT_CACHE_STEP_DEG


def point_key(lat: float, lon: float) -> str:
    def _snap(value: float) -> float:
        return round(round(value / POINT_CACHE_STEP_DEG) * POINT_CACHE_STEP_DEG, 4)

    return f"{_snap(lat):.4f}_{_snap(lon):.4f}"


def load_points(path: Path | None) -> dict[str, dict[str, Any]]:
    """Lê `{"pontos": [{"lat", "lon", ...}]}` e indexa cada ponto pela chave. Sem arquivo: vazio."""
    if path is None or not path.is_file():
        return {}
    payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return {point_key(float(p["lat"]), float(p["lon"])): p for p in payload.get("pontos", [])}
