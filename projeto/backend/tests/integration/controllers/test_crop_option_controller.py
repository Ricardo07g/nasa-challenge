from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_crop_option_repository
from app.main import app
from app.models.crop_option import CropOption
from app.repositories.crop_option_repository import InMemoryCropOptionRepository


@pytest.fixture
def client() -> Iterator[TestClient]:
    # Troca o repositório real por um com dados controlados pelo teste
    options = [
        CropOption(id="milho-safrinha", name="Milho safrinha", role="Grão"),
        CropOption(id="milheto", name="Milheto", role="Cobertura"),
    ]
    app.dependency_overrides[get_crop_option_repository] = lambda: InMemoryCropOptionRepository(
        options
    )
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_crop_options(client: TestClient) -> None:
    response = client.get("/api/crop-options")

    assert response.status_code == 200
    assert response.json() == [
        {"id": "milho-safrinha", "name": "Milho safrinha", "role": "Grão"},
        {"id": "milheto", "name": "Milheto", "role": "Cobertura"},
    ]


def test_get_crop_option(client: TestClient) -> None:
    response = client.get("/api/crop-options/milheto")

    assert response.status_code == 200
    assert response.json() == {"id": "milheto", "name": "Milheto", "role": "Cobertura"}


def test_get_unknown_crop_option_returns_404(client: TestClient) -> None:
    response = client.get("/api/crop-options/nao-existe")

    assert response.status_code == 404
    assert "nao-existe" in response.json()["detail"]
