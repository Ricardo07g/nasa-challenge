"""Contrato e implementação do acesso às séries de clima por célula e aos deltas do CMIP6."""

import json
import math
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from app.constants import GRID_CELL_SCALE_FACTOR
from app.models.climate import ClimateSeason, Cmip6Delta


class ClimateRepository(Protocol):
    """Acesso às séries de clima (por célula de 0,1°) e às projeções do CMIP6."""

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        """Id da célula do ponto, ou None quando não há dados preparados para ele."""
        ...

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]: ...

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]: ...


def cell_id_for(lat: float, lon: float) -> str:
    """Id da célula de 0,1° (plano técnico §5): "<floor(lat*10)>_<floor(lon*10)>"."""
    lat_idx = math.floor(round(lat * GRID_CELL_SCALE_FACTOR, 6))
    lon_idx = math.floor(round(lon * GRID_CELL_SCALE_FACTOR, 6))
    return f"{lat_idx}_{lon_idx}"


class FixtureClimateRepository:
    """Lê as temporadas de um arquivo JSON gerado pelo pipeline (fazenda de exemplo).

    O arquivo traz a série de um ponto e a área que ela representa (`cobertura`: a célula do
    NASA POWER, que devolve o mesmo valor para qualquer ponto dentro dela). Fora dessa área o
    repositório responde que não há dados, em vez de devolver o clima de outra região.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._payload: dict[str, Any] | None = None

    def _load(self) -> dict[str, Any]:
        if self._payload is None:
            self._payload = json.loads(self._path.read_text(encoding="utf-8"))
        return self._payload

    def _covers(self, lat: float, lon: float) -> bool:
        box = self._load()["cobertura"]
        return box["lat_min"] <= lat < box["lat_max"] and box["lon_min"] <= lon < box["lon_max"]

    def _covers_cell(self, cell_id: str) -> bool:
        try:
            lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))
        except ValueError:
            return False
        center_lat = (lat_idx + 0.5) / GRID_CELL_SCALE_FACTOR
        center_lon = (lon_idx + 0.5) / GRID_CELL_SCALE_FACTOR
        return self._covers(center_lat, center_lon)

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return cell_id_for(lat, lon) if self._covers(lat, lon) else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        if not self._covers_cell(cell_id):
            return []
        payload = self._load()
        lat = float(payload["ponto"]["lat"])
        source = str(payload["fonte"])
        return [
            ClimateSeason(
                cell_id=cell_id,
                year=int(item["ano"]),
                start_date=date.fromisoformat(item["inicio"]),
                lat=lat,
                rain_mm=tuple(float(v) for v in item["chuva_mm"]),
                rain_source=source,
                tmax_c=tuple(float(v) for v in item["tmax_c"]),
                tmin_c=tuple(float(v) for v in item["tmin_c"]),
                eto_mm=tuple(float(v) for v in item.get("eto_mm", [])),
            )
            for item in payload["temporadas"]
        ]

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        if not self._covers_cell(cell_id):
            return []
        return [
            Cmip6Delta(
                model=str(item["modelo"]),
                scenario=str(item["cenario"]),
                month=int(item["mes"]),
                rain_pct=float(item["chuva_pct"]),
                tmax_c=float(item["tmax_c"]),
            )
            for item in self._load().get("cmip6", [])
        ]
