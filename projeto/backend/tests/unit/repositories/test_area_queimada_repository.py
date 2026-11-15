"""Leitura do arquivo da área queimada (MODIS MCD64A1 pela ORNL DAAC, tarefa 0043).

Arquivos de teste pequenos, em `tmp_path`, com valores inventados: a grade é a do MODIS de 500 m,
mas os pixels queimados não são de nenhum dado real.
"""

import json
import math
from pathlib import Path
from typing import Any

import pytest

from app.models.area_queimada import MODIS_500M_PIXEL_M
from app.models.soja_recente import SINUSOIDAL_RADIUS_M
from app.repositories.area_queimada_repository import FileAreaQueimadaRepository

LAT, LON = -18.9543, -48.1993


def _xy(lat: float, lon: float) -> tuple[float, float]:
    phi = math.radians(lat)
    return SINUSOIDAL_RADIUS_M * math.radians(lon) * math.cos(phi), SINUSOIDAL_RADIUS_M * phi


def _payload(queimadas: list[list[Any]], linhas: int = 41, colunas: int = 41) -> dict[str, Any]:
    """Grade de 41 × 41 pixels de 500 m com o ponto de teste no pixel (20, 20)."""
    x, y = _xy(LAT, LON)
    return {
        "versao_dados": {
            "fonte": "modis_mcd64a1",
            "parametros": {"produto": "MCD64A1"},
            "fim": "2026-11-15T13:00:00Z",
            "versao": "2026.11-modis-mcd64a1",
        },
        "fonte": "MODIS MCD64A1",
        "anos": [2016, 2025],
        "grade": {
            "projecao": "sinusoidal_modis",
            "raio_m": SINUSOIDAL_RADIUS_M,
            "x_oeste_m": x - 20.5 * MODIS_500M_PIXEL_M,
            "y_norte_m": y + 20.5 * MODIS_500M_PIXEL_M,
            "pixel_m": MODIS_500M_PIXEL_M,
            "linhas": linhas,
            "colunas": colunas,
        },
        "queimadas": queimadas,
    }


def _write(tmp_path: Path, payload: dict[str, Any]) -> Path:
    path = tmp_path / "area_queimada.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_give_the_burned_pixels_around_the_point_with_their_centers(
    tmp_path: Path,
) -> None:
    # (20, 20) é o pixel do ponto; (20, 24) fica a 4 pixels (~1,9 km) a leste; (0, 0) fica longe.
    repo = FileAreaQueimadaRepository(
        _write(tmp_path, _payload([[20, 20, [2017]], [20, 24, [2019, 2021]], [0, 0, [2020]]]))
    )

    near = repo.get_burned_near(LAT, LON, km=3.0)

    assert near is not None
    assert (near.ano_inicio, near.ano_fim, near.fonte) == (2016, 2025, "MODIS MCD64A1")
    assert sorted(p.anos for p in near.pixels) == [(2017,), (2019, 2021)]
    own = next(p for p in near.pixels if p.anos == (2017,))
    assert (own.lat, own.lon) == pytest.approx((LAT, LON), abs=0.005)


def test_should_answer_none_for_a_point_outside_the_grid(tmp_path: Path) -> None:
    repo = FileAreaQueimadaRepository(_write(tmp_path, _payload([[20, 20, [2017]]])))

    assert repo.get_burned_near(-23.55, -46.63, km=5.0) is None


def test_should_answer_none_without_the_file(tmp_path: Path) -> None:
    assert FileAreaQueimadaRepository(None).get_burned_near(LAT, LON, km=5.0) is None
    assert FileAreaQueimadaRepository(tmp_path / "nao.json").get_burned_near(LAT, LON, 5.0) is None


@pytest.mark.parametrize(
    "queimadas",
    [
        [[41, 0, [2017]]],  # linha fora da grade
        [[0, 0, [2015]]],  # ano fora do período do arquivo
        [[0, 0, []]],  # pixel sem ano
    ],
)
def test_should_refuse_a_file_out_of_the_contract(tmp_path: Path, queimadas: list[Any]) -> None:
    repo = FileAreaQueimadaRepository(_write(tmp_path, _payload(queimadas)))

    with pytest.raises(ValueError):
        repo.get_burned_near(LAT, LON, km=5.0)


def test_should_refuse_a_file_of_another_source(tmp_path: Path) -> None:
    payload = _payload([])
    payload["versao_dados"]["fonte"] = "modis_mod13q1"

    with pytest.raises(ValueError, match="modis_mcd64a1"):
        FileAreaQueimadaRepository(_write(tmp_path, payload)).get_burned_near(LAT, LON, 5.0)
