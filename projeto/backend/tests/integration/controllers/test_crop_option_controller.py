from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.dependencies import get_crop_option_repository
from app.main import app
from app.models.crop_option import CropOption
from app.repositories.crop_option_repository import (
    DEFAULT_CROP_OPTIONS,
    InMemoryCropOptionRepository,
    YamlCropOptionRepository,
)


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


def test_should_read_crop_options_from_culturas_yaml_by_default() -> None:
    # Plano técnico §3.4: o /crop-options passa a ler o culturas.yaml.
    assert isinstance(get_crop_option_repository(), YamlCropOptionRepository)


def test_should_list_shipped_crop_options_with_the_same_ids_and_roles_as_before() -> None:
    # Caminho padrão do culturas.yaml (os arquivos do repositório), sem ler variável de ambiente.
    culturas = Settings.model_fields["culturas_path"].default
    app.dependency_overrides[get_crop_option_repository] = lambda: YamlCropOptionRepository(
        culturas
    )
    try:
        response = TestClient(app).get("/api/crop-options")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert all(set(option) == {"id", "name", "role"} for option in body)
    assert [(o["id"], o["role"]) for o in body] == [(o.id, o.role) for o in DEFAULT_CROP_OPTIONS]
