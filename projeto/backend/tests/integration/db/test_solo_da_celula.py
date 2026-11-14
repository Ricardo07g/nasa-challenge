"""Solo do PostGIS por célula (R1.5): ponto sem solo usa o ponto gravado mais próximo da célula.

A pré-carga grava o solo no centro de cada célula de 0,1°. Sem esta regra, só o ponto exato
(chave de 0,0025°) teria solo, e o talhão clicado em outro lugar da célula ficaria com o padrão.
"""

import json
from pathlib import Path

import pytest

from app.models.talhao import SoloInfo
from app.repositories.soil_repository import CachedSoilGridsRepository, PostgisSoilRepository

pytestmark = pytest.mark.db

# Célula "-190_-482" (a da fazenda de exemplo): lat -19,0 a -18,9 e lon -48,2 a -48,1.
CENTER = (-18.95, -48.15)
CLICK = (-18.92, -48.18)

ARGILOSO = SoloInfo(
    argila_percentual=46.0,
    areia_percentual=32.0,
    textura_solo="argiloso",
    cad_capacidade_agua_mm=60.0,
    fonte="soilgrids",
)
ARENOSO = SoloInfo(
    argila_percentual=12.0,
    areia_percentual=75.0,
    textura_solo="arenoso",
    cad_capacidade_agua_mm=40.0,
    fonte="soilgrids",
)


def test_should_use_the_soil_saved_elsewhere_in_the_same_cell(db_url: str) -> None:
    repo = PostgisSoilRepository(db_url)
    repo.save_soil(*CENTER, ARGILOSO)

    soil = repo.get_soil(*CLICK)

    assert soil == ARGILOSO


def test_should_use_the_nearest_soil_point_of_the_cell(db_url: str) -> None:
    repo = PostgisSoilRepository(db_url)
    repo.save_soil(*CENTER, ARGILOSO)
    repo.save_soil(-18.91, -48.19, ARENOSO)  # a uns 1,5 km do clique

    assert repo.get_soil(*CLICK) == ARENOSO


def test_should_not_use_soil_from_a_neighbor_cell_even_when_it_is_closer(db_url: str) -> None:
    repo = PostgisSoilRepository(db_url)
    repo.save_soil(-18.899, -48.18, ARENOSO)  # célula -189_-482, a ~2 km do clique

    alone = repo.get_soil(*CLICK)
    repo.save_soil(-18.99, -48.11, ARGILOSO)  # mesma célula do clique, a ~10 km
    with_cell_soil = repo.get_soil(*CLICK)

    assert (alone.textura_solo, alone.fonte) == ("medio", "padrao")
    assert with_cell_soil == ARGILOSO


def test_should_prefer_the_exact_point_of_the_file_cache_over_the_rest_of_the_cell(
    db_url: str, tmp_path: Path
) -> None:
    farm = (-18.9543, -48.1993)
    cache = tmp_path / "solo.json"
    point = {"lat": farm[0], "lon": farm[1], "argila_pct": 12.0, "areia_pct": 75.0}
    cache.write_text(json.dumps({"pontos": [point]}), encoding="utf-8")
    repo = PostgisSoilRepository(db_url, fallback=CachedSoilGridsRepository(cache))
    repo.save_soil(*CENTER, ARGILOSO)

    assert repo.get_soil(*farm).textura_solo == "arenoso"  # o ponto exato, do arquivo
    assert repo.get_soil(*CLICK) == ARGILOSO  # o resto da célula, do banco


def test_should_tell_whether_the_exact_point_already_has_soil(db_url: str) -> None:
    repo = PostgisSoilRepository(db_url)
    repo.save_soil(*CENTER, ARGILOSO)

    assert repo.has_point(*CENTER) is True
    assert repo.has_point(-18.9501, -48.1501) is True  # mesma chave de 0,0025°
    assert repo.has_point(*CLICK) is False  # só a célula tem solo, não o ponto
