from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.constants import PILOT_MAX_LAT, PILOT_MAX_LON, PILOT_MIN_LAT, PILOT_MIN_LON
from app.dependencies import get_pilot_area_service
from app.main import app
from app.models.pilot_area import PilotArea
from app.services.pilot_area_service import PilotAreaService


@pytest.fixture
def client() -> Iterator[TestClient]:
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_returns_the_pilot_area_bounds(client: TestClient) -> None:
    response = client.get("/api/area-piloto")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "min_lat": PILOT_MIN_LAT,
        "max_lat": PILOT_MAX_LAT,
        "min_lon": PILOT_MIN_LON,
        "max_lon": PILOT_MAX_LON,
    }


def test_uses_the_service_area(client: TestClient) -> None:
    other = PilotArea(min_lat=-20.0, max_lat=-19.0, min_lon=-48.0, max_lon=-47.0)
    app.dependency_overrides[get_pilot_area_service] = lambda: PilotAreaService(other)

    response = client.get("/api/area-piloto")

    assert response.json() == {
        "min_lat": -20.0,
        "max_lat": -19.0,
        "min_lon": -48.0,
        "max_lon": -47.0,
    }
