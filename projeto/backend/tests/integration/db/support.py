"""Falsos e ajudantes dos testes `db` (importados pelo conftest e pelos testes)."""

from dataclasses import dataclass
from datetime import date

import psycopg
from fastapi.testclient import TestClient

from app.models.climate import ClimateSeason
from app.models.talhao import SoloInfo

TABLES = (
    "climate_season",
    "smap_moisture",
    "cmip6_delta",
    "grid_cell",
    "soil_point",
    "ndvi_point",
    "data_run",
)
SEASON_DAYS = 212


class FakeNasaPowerClient:
    """Faz o papel do POWER com valores de teste (não é dado real) e conta as chamadas."""

    def __init__(self) -> None:
        self.calls: list[tuple[float, float, str]] = []
        self.should_fail = False

    def fetch_seasons(
        self, lat: float, lon: float, cell_id: str, start_year: int = 2005, end_year: int = 2024
    ) -> list[ClimateSeason]:
        self.calls.append((lat, lon, cell_id))
        if self.should_fail:
            raise RuntimeError("POWER fora do ar (teste)")
        return [
            ClimateSeason(
                cell_id=cell_id,
                year=year,
                start_date=date(year, 1, 1),
                rain_mm=tuple([6.0] * SEASON_DAYS),
                rain_source="teste",
                tmax_c=tuple([30.0] * SEASON_DAYS),
                tmin_c=tuple([18.0] * SEASON_DAYS),
            )
            for year in range(start_year, end_year + 1)
        ]


class FakeSoilGridsClient:
    """Faz o papel do SoilGrids. Com `should_fail`, responde o solo padrão, como o cliente real."""

    def __init__(self) -> None:
        self.calls: list[tuple[float, float]] = []
        self.should_fail = False

    def fetch_soil(self, lat: float, lon: float) -> SoloInfo:
        self.calls.append((lat, lon))
        if self.should_fail:
            return SoloInfo(
                argila_percentual=28.0,
                areia_percentual=45.0,
                textura_solo="medio",
                cad_capacidade_agua_mm=50.0,
                fonte="padrao",
            )
        return SoloInfo(
            argila_percentual=46.0,
            areia_percentual=32.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


@dataclass
class Api:
    client: TestClient
    nasa: FakeNasaPowerClient
    soil: FakeSoilGridsClient


def count_rows(url: str, table: str) -> int:
    with psycopg.connect(url) as conn:
        row = conn.execute(f"SELECT count(*) FROM {table};").fetchone()
    assert row is not None
    return int(row[0])
