"""Integration tests for GET /api/talhao endpoint including on-demand ingestion (Sub-task 1.4)."""

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    get_climate_repository,
    get_nasa_power_client,
    get_soil_repository,
    get_soilgrids_client,
)
from app.main import app
from app.models.climate import ClimateSeason
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import DataOutputClimateRepository
from app.repositories.soil_repository import CachedSoilGridsRepository


class FakeNasaClientForIntegration:
    def __init__(self) -> None:
        self.calls: int = 0

    def fetch_seasons(
        self,
        lat: float,
        lon: float,
        cell_id: str,
        start_year: int = 2005,
        end_year: int = 2024,
    ) -> list[ClimateSeason]:
        self.calls += 1
        return [
            ClimateSeason(
                cell_id=cell_id,
                year=yr,
                start_date=date(yr, 1, 1),
                rain_mm=tuple([5.0] * 180),
                rain_source="nasa_power",
                tmax_c=tuple([30.0] * 180),
                tmin_c=tuple([18.0] * 180),
                eto_mm=tuple([4.0] * 180),
                gwetroot=tuple([0.65] * 180),
            )
            for yr in range(2005, 2025)
        ]


class FakeSoilClientForIntegration:
    def __init__(self) -> None:
        self.calls: int = 0

    def fetch_soil(self, lat: float, lon: float) -> SoloInfo:
        self.calls += 1
        return SoloInfo(
            argila_percentual=38.0,
            areia_percentual=42.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


@pytest.fixture
def isolated_client() -> Iterator[tuple[TestClient, FakeNasaClientForIntegration]]:
    clim_repo = DataOutputClimateRepository()
    soil_repo = CachedSoilGridsRepository()
    fake_nasa = FakeNasaClientForIntegration()
    fake_soil = FakeSoilClientForIntegration()

    app.dependency_overrides[get_climate_repository] = lambda: clim_repo
    app.dependency_overrides[get_soil_repository] = lambda: soil_repo
    app.dependency_overrides[get_nasa_power_client] = lambda: fake_nasa
    app.dependency_overrides[get_soilgrids_client] = lambda: fake_soil

    yield TestClient(app), fake_nasa
    app.dependency_overrides.clear()


def test_should_return_200_and_field_inspection_when_coordinates_inside_area(
    isolated_client: tuple[TestClient, FakeNasaClientForIntegration],
) -> None:
    client, fake_nasa = isolated_client
    response = client.get("/api/talhao", params={"lat": -18.9186, "lon": -48.2772})

    assert response.status_code == 200
    body = response.json()
    assert body["dentro_da_area"] is True
    assert body["celula_id"] == "-189_-483"
    assert body["ponto"] == {"lat": -18.9186, "lon": -48.2772}
    assert body["solo"]["textura"] == "argiloso"
    assert body["solo"]["cad_mm"] == 60.0
    assert body["colheita_sugerida"]["faixa"] in ("cedo", "meio", "tarde")
    assert body["historico"] is not None
    assert body["historico"]["total"] == 10
    assert body["historico"]["parado"] == 4
    assert body["historico"]["fonte"] == "modis_mod13q1"
    # Pilot area is already cached -> zero external NASA calls
    assert fake_nasa.calls == 0


def test_should_ingest_on_demand_and_cache_subsequent_calls_when_new_coordinate_queried(
    isolated_client: tuple[TestClient, FakeNasaClientForIntegration],
) -> None:
    client, fake_nasa = isolated_client

    # First request for Rio Verde/GO (-17.78, -50.92): Cache Miss -> ingests on-demand
    resp_miss = client.get("/api/talhao", params={"lat": -17.78, "lon": -50.92})

    assert resp_miss.status_code == 200
    body = resp_miss.json()
    assert body["dentro_da_area"] is True
    assert body["celula_id"] == "-178_-509"
    assert body["solo"]["textura"] == "argiloso"
    assert fake_nasa.calls == 1

    # Second request for the same cell: Cache Hit -> zero new external calls
    resp_hit = client.get("/api/talhao", params={"lat": -17.79, "lon": -50.91})
    assert resp_hit.status_code == 200
    assert resp_hit.json()["celula_id"] == "-178_-509"
    assert fake_nasa.calls == 1
