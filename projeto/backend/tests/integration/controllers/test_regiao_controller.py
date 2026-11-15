"""Rota GET /api/regiao (P3), no contrato do front (`projeto/frontend/src/models/region.ts`).

O arquivo da região é de teste (`fonte: "teste"`), com valores de teste, não dado do MODIS.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_region_repository
from app.main import app
from app.repositories.regiao_repository import FileRegionRepository

FARM = {"lat": -18.9543, "lon": -48.1993}
# ~55 km ao norte da fazenda: fora do raio de 30 km.
FAR_AWAY = {"lat": -18.45, "lon": -48.1993}
# 0,1° ao norte da fazenda: ~11,1 km do centro, dentro do raio.
NORTH_11_KM = {"lat": -18.8543, "lon": -48.1993}


def _year(ano: int, parado: float, plantou: float, incerto: float, sem_dado: float = 2.0) -> dict:
    return {
        "ano": ano,
        "n_pixels": 1000,
        "n_pixels_lavoura": 4000,
        "pct_parado": parado,
        "pct_plantou": plantou,
        "pct_incerto": incerto,
        "pct_sem_dado": sem_dado,
    }


def _write_region_file(path: Path) -> Path:
    so_nuvem = {
        "ano": 2018,
        "n_pixels": 1000,
        "pct_parado": None,
        "pct_plantou": None,
        "pct_incerto": None,
        "pct_sem_dado": 100.0,
    }
    payload = {
        "versao_dados": {
            "fonte": "teste",
            "parametros": {},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "2026.11-teste",
        },
        "regioes": [
            {
                **FARM,
                "raio_km": 30,
                "fonte": "teste",
                "mascara": "máscara de teste",
                "anos": [_year(2025, 62.0, 29.0, 9.0), so_nuvem, _year(2016, 50.0, 40.0, 10.0)],
            }
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


@pytest.fixture
def region_file(tmp_path: Path, client: TestClient) -> TestClient:
    path = _write_region_file(tmp_path / "regiao.json")
    app.dependency_overrides[get_region_repository] = lambda: FileRegionRepository(path)
    return client


def test_should_return_the_region_in_the_front_contract(region_file: TestClient) -> None:
    response = region_file.get("/api/regiao", params=FARM)

    assert response.status_code == 200
    assert response.json() == {
        "raio_km": 30.0,
        "fonte": "teste",
        "mascara": "máscara de teste",
        "centro": FARM,
        "distancia_km": 0.0,
        "anos": [
            {
                "ano": 2016,
                "pct_parado": 50.0,
                "pct_plantou": 40.0,
                "pct_incerto": 10.0,
                "n_pixels": 1000,
                "n_pixels_lavoura": 4000,
                "pct_sem_dado": 2.0,
            },
            {
                "ano": 2025,
                "pct_parado": 62.0,
                "pct_plantou": 29.0,
                "pct_incerto": 9.0,
                "n_pixels": 1000,
                "n_pixels_lavoura": 4000,
                "pct_sem_dado": 2.0,
            },
        ],
    }


def test_should_tell_the_center_of_the_region_and_how_far_the_point_is(
    region_file: TestClient,
) -> None:
    body = region_file.get("/api/regiao", params=NORTH_11_KM).json()

    assert body["centro"] == FARM
    assert body["distancia_km"] == 11.1


def test_should_send_null_cropland_pixels_for_an_old_region_file(
    tmp_path: Path, client: TestClient
) -> None:
    # Arquivo de antes da tarefa 0036: sem n_pixels_lavoura.
    path = _write_region_file(tmp_path / "regiao.json")
    payload = json.loads(path.read_text(encoding="utf-8"))
    for ano in payload["regioes"][0]["anos"]:
        ano.pop("n_pixels_lavoura", None)
    path.write_text(json.dumps(payload), encoding="utf-8")
    app.dependency_overrides[get_region_repository] = lambda: FileRegionRepository(path)

    body = client.get("/api/regiao", params=FARM).json()

    assert [ano["n_pixels_lavoura"] for ano in body["anos"]] == [None, None]


def test_should_answer_outside_area_in_problem_json_for_a_point_beyond_the_radius(
    region_file: TestClient,
) -> None:
    response = region_file.get("/api/regiao", params=FAR_AWAY)

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == "OUTSIDE_AREA"
    assert body["status"] == 404


def test_should_answer_outside_area_without_the_region_file(client: TestClient) -> None:
    app.dependency_overrides[get_region_repository] = lambda: FileRegionRepository(None)

    response = client.get("/api/regiao", params=FARM)

    assert (response.status_code, response.json()["code"]) == (404, "OUTSIDE_AREA")


def test_should_reject_latitude_out_of_range(region_file: TestClient) -> None:
    response = region_file.get("/api/regiao", params={"lat": 91, "lon": -48.1993})

    assert (response.status_code, response.json()["code"]) == (422, "INVALID_REQUEST")
