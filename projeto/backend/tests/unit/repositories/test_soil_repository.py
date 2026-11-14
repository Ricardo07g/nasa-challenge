"""Unit tests for CachedSoilGridsRepository and soil texture classification."""

import json
from pathlib import Path

from app.repositories.soil_repository import CachedSoilGridsRepository, classify_soil_texture


def test_should_classify_clayey_soil_when_clay_exceeds_35_percent() -> None:
    assert classify_soil_texture(argila_pct=42.5, areia_pct=38.0) == ("argiloso", 60.0)


def test_should_classify_sandy_soil_when_sand_exceeds_70_percent() -> None:
    assert classify_soil_texture(argila_pct=15.0, areia_pct=75.0) == ("arenoso", 40.0)


def test_should_classify_medium_soil_when_neither_threshold_is_exceeded() -> None:
    assert classify_soil_texture(argila_pct=28.0, areia_pct=50.0) == ("medio", 50.0)


def _cache(tmp_path: Path) -> Path:
    path = tmp_path / "solo.json"
    payload = {
        "pontos": [{"lat": -18.9543, "lon": -48.1993, "argila_pct": 42.5, "areia_pct": 38.0}]
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_return_cached_soilgrids_soil_when_point_is_in_cache(tmp_path: Path) -> None:
    repo = CachedSoilGridsRepository(_cache(tmp_path))

    soil = repo.get_soil(-18.9543, -48.1993)

    assert (soil.textura_solo, soil.cad_capacidade_agua_mm, soil.fonte) == (
        "argiloso",
        60.0,
        "soilgrids",
    )


def test_should_reuse_cached_soil_for_point_less_than_250_m_away(tmp_path: Path) -> None:
    repo = CachedSoilGridsRepository(_cache(tmp_path))

    assert repo.get_soil(-18.9549, -48.1999).fonte == "soilgrids"


def test_should_return_default_soil_for_other_points_instead_of_cached_one(tmp_path: Path) -> None:
    # O cache é por ponto: outro talhão não pode herdar o solo da fazenda de exemplo.
    repo = CachedSoilGridsRepository(_cache(tmp_path))
    repo.get_soil(-18.9543, -48.1993)

    soil = repo.get_soil(-19.50, -48.60)

    assert (soil.textura_solo, soil.fonte) == ("medio", "padrao")


def test_should_return_default_soil_when_no_cache_configured() -> None:
    soil = CachedSoilGridsRepository(None).get_soil(-18.9543, -48.1993)

    assert (soil.textura_solo, soil.cad_capacidade_agua_mm, soil.fonte) == ("medio", 50.0, "padrao")
