"""ISRIC SoilGrids REST client for 0-30cm clay/sand and CAD extraction (Sub-task 1.1)."""

import logging
from typing import Any, Protocol

from app.constants import (
    CAD_MEDIUM_MM,
    DEFAULT_CLAY_PCT,
    DEFAULT_SAND_PCT,
    EXTERNAL_API_TIMEOUT_SECONDS,
    SOILGRIDS_DEPTHS,
    SOILGRIDS_G_KG_TO_PCT_DIVISOR,
    SOILGRIDS_PROPERTIES,
    SOILGRIDS_QUERY_URL,
)
from app.models.talhao import SoloInfo
from app.repositories.external.http_client import (
    HttpGetter,
    default_http_get,
    get_json_with_retries,
)
from app.repositories.soil_repository import classify_soil_texture

logger = logging.getLogger(__name__)


class SoilGridsClientProtocol(Protocol):
    """Contract for fetching soil texture and water holding capacity from ISRIC SoilGrids."""

    def fetch_soil(self, lat: float, lon: float) -> SoloInfo: ...


class SoilGridsClient:
    """HTTP client for ISRIC SoilGrids v2.0 properties query API (0-5cm, 5-15cm, 15-30cm)."""

    def __init__(
        self,
        http_get: HttpGetter = default_http_get,
        timeout: float = EXTERNAL_API_TIMEOUT_SECONDS,
    ) -> None:
        self._http_get = http_get
        self._timeout = timeout

    def fetch_soil(self, lat: float, lon: float) -> SoloInfo:
        """Fetches 0-30cm clay and sand content and computes soil texture and CAD."""
        params: dict[str, Any] = {
            "lon": lon,
            "lat": lat,
            "property": list(SOILGRIDS_PROPERTIES),
            "depth": list(SOILGRIDS_DEPTHS),
            "value": "mean",
        }

        try:
            payload = get_json_with_retries(
                http_get=self._http_get,
                url=SOILGRIDS_QUERY_URL,
                params=params,
                timeout=self._timeout,
            )
            layers: list[dict[str, Any]] = payload.get("properties", {}).get("layers", [])
            clay_pct = self._extract_layer_mean_pct(layers, "clay", DEFAULT_CLAY_PCT)
            sand_pct = self._extract_layer_mean_pct(layers, "sand", DEFAULT_SAND_PCT)
            textura, cad_mm = classify_soil_texture(argila_pct=clay_pct, areia_pct=sand_pct)
            return SoloInfo(
                argila_percentual=clay_pct,
                areia_percentual=sand_pct,
                textura_solo=textura,
                cad_capacidade_agua_mm=cad_mm,
                fonte="soilgrids",
            )
        except Exception as exc:
            logger.warning(
                "SoilGrids API unavailable for (%s, %s); using medium soil fallback: %s",
                lat,
                lon,
                exc,
            )
            return SoloInfo(
                argila_percentual=DEFAULT_CLAY_PCT,
                areia_percentual=DEFAULT_SAND_PCT,
                textura_solo="medio",
                cad_capacidade_agua_mm=CAD_MEDIUM_MM,
                fonte="padrao",
            )

    def _extract_layer_mean_pct(
        self, layers: list[dict[str, Any]], prop_name: str, default_pct: float
    ) -> float:
        for layer in layers:
            if layer.get("name") == prop_name:
                depths: list[dict[str, Any]] = layer.get("depths", [])
                vals = [
                    float(d["values"]["mean"]) / SOILGRIDS_G_KG_TO_PCT_DIVISOR
                    for d in depths
                    if d.get("values", {}).get("mean") is not None
                ]
                if vals:
                    return round(sum(vals) / len(vals), 1)
        return default_pct
