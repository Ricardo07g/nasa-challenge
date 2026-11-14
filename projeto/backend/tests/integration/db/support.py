"""Falsos e ajudantes dos testes `db` (importados pelo conftest e pelos testes)."""

from dataclasses import dataclass
from datetime import date, timedelta

import psycopg
from fastapi.testclient import TestClient

from app.models.climate import DailyWeatherRecord, PowerDailySeries
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
    """Faz o papel do POWER com valores de teste (não é dado real) e conta as chamadas.

    Devolve a série diária bruta, como o `NasaPowerClient.fetch_daily` (tarefa 0004): a ingestão
    monta as temporadas e calcula a ETo no service.
    """

    def __init__(self) -> None:
        self.calls: list[tuple[float, float, date, date]] = []
        self.should_fail = False

    def fetch_daily(self, lat: float, lon: float, start: date, end: date) -> PowerDailySeries:
        self.calls.append((lat, lon, start, end))
        if self.should_fail:
            raise RuntimeError("POWER fora do ar (teste)")
        days = tuple(
            DailyWeatherRecord(
                data=start + timedelta(days=i),
                prectotcorr=6.0,
                t2m_max=30.0,
                t2m_min=18.0,
                rh2m=70.0,
                ws2m=2.0,
                allsky_sfc_sw_dwn=18.0,
            )
            for i in range((end - start).days + 1)
        )
        return PowerDailySeries(elevation_m=850.0, days=days)


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
