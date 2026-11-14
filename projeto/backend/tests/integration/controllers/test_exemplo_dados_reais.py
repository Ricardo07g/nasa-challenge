"""A fazenda de exemplo com os arquivos que vão junto com a API (culturas.yaml e clima).

Não usa rede, banco nem variáveis da máquina: os repositórios são montados com os caminhos
padrão do Settings. É o teste que pegaria o HTTP 500 de arquivo em formato errado.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.dependencies import (
    get_climate_repository,
    get_crop_params_repository,
    get_ndvi_repository,
    get_soil_repository,
)
from app.main import app
from app.repositories.climate_repository import FixtureClimateRepository
from app.repositories.crop_params_repository import YamlCropParamsRepository
from app.repositories.ndvi_repository import CachedNdviRepository
from app.repositories.soil_repository import CachedSoilGridsRepository


@pytest.fixture
def real_data_client() -> Iterator[TestClient]:
    # Caminhos padrão (os arquivos do repositório), sem ler variável de ambiente.
    clima = Settings.model_fields["clima_path"].default
    culturas = Settings.model_fields["culturas_path"].default
    app.dependency_overrides[get_crop_params_repository] = lambda: YamlCropParamsRepository(
        culturas
    )
    app.dependency_overrides[get_climate_repository] = lambda: FixtureClimateRepository(clima)
    app.dependency_overrides[get_soil_repository] = lambda: CachedSoilGridsRepository(None)
    app.dependency_overrides[get_ndvi_repository] = lambda: CachedNdviRepository(None)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_should_answer_example_farm_with_twenty_years_of_nasa_power(
    real_data_client: TestClient,
) -> None:
    response = real_data_client.get("/api/exemplo")

    assert response.status_code == 200
    body = response.json()
    assert body["talhao"]["dados"][0] == {
        "fonte": "nasa_power",
        "periodo": "2005-2024",
        "cenario": None,
        "modelos": None,
    }
    rec = body["recomendacao"]
    assert len(rec["opcoes"]) == 5
    assert all(o["chuva"]["anos"] == 20 for o in rec["opcoes"])
    assert rec["melhor"] != "pousio"
