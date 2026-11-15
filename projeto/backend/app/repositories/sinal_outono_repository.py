"""Contratos dos dados do sinal para o outono (PRD 7.10, RF-20), um por fonte.

Cada fonte chega numa tarefa do roteiro: GEOS-S2S (A2.1), SMAP recente com percentil (A2.2) e chuva
dos últimos 30 dias pelo IMERG Late (A2.3). O SMAP recente vem do arquivo que o
`pipeline/fetch_smap.py --recente` grava (`FileRecentSoilMoistureRepository`). As fontes que ainda
não chegaram usam o `NoAutumnSignalDataRepository`, que não tem dado nenhum.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from app.models.sinal_outono import RecentRain, RecentSoilMoisture, SeasonalForecast
from app.repositories.climate_repository import cell_id_for


class SeasonalForecastRepository(Protocol):
    """Previsão sazonal mais recente do GEOS-S2S para a célula do ponto (março a maio)."""

    def get_seasonal_forecast(self, lat: float, lon: float) -> SeasonalForecast | None: ...


class RecentSoilMoistureRepository(Protocol):
    """Percentil mais recente da umidade na zona das raízes (SMAP L4) no ponto."""

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None: ...


class RecentRainRepository(Protocol):
    """Chuva dos últimos dias (IMERG Late) no ponto, com a média dos mesmos dias."""

    def get_recent_rain(self, lat: float, lon: float) -> RecentRain | None: ...


class NoAutumnSignalDataRepository:
    """Sem dado de nenhuma das três fontes ainda: devolve sempre None."""

    def get_seasonal_forecast(self, lat: float, lon: float) -> SeasonalForecast | None:
        return None

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        return None

    def get_recent_rain(self, lat: float, lon: float) -> RecentRain | None:
        return None


class FileRecentSoilMoistureRepository:
    """SMAP recente do arquivo do `SMAP_RECENTE_PATH` (contrato SMAP + `sm_rootzone_pctl`, A2.2).

    O ponto do arquivo dentro da célula de 0,1° do pedido dá o percentil e a data (o dia da série).
    Sem arquivo, sem ponto na célula ou com o percentil `null`: None (nada de dado inventado).
    """

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

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        cell_id = cell_id_for(lat, lon)
        for point in self._load().get("pontos", []):
            if cell_id_for(float(point["lat"]), float(point["lon"])) != cell_id:
                continue
            pctl, serie = point.get("sm_rootzone_pctl"), point.get("serie") or []
            if pctl is None or not serie:
                return None
            return RecentSoilMoisture(
                sm_rootzone_pctl=float(pctl), data=date.fromisoformat(str(serie[-1]["data"]))
            )
        return None
