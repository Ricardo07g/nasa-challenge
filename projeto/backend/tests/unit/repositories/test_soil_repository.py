"""Unit tests for CachedSoilGridsRepository and soil texture classification."""

from pathlib import Path

from app.repositories.soil_repository import CachedSoilGridsRepository, classify_soil_texture


def test_should_classify_clayey_soil_when_clay_exceeds_35_percent() -> None:
    textura, cad = classify_soil_texture(argila_pct=42.5, areia_pct=38.0)

    assert textura == "argiloso"
    assert cad == 60.0


def test_should_classify_sandy_soil_when_sand_exceeds_70_percent() -> None:
    textura, cad = classify_soil_texture(argila_pct=15.0, areia_pct=75.0)

    assert textura == "arenoso"
    assert cad == 40.0


def test_should_classify_medium_soil_when_neither_threshold_is_exceeded() -> None:
    textura, cad = classify_soil_texture(argila_pct=28.0, areia_pct=50.0)

    assert textura == "medio"
    assert cad == 50.0


def test_should_load_soil_info_from_cached_json_when_available() -> None:
    repo = CachedSoilGridsRepository(Path("/workspace/data/output/soilgrids_talhao.json"))

    soil = repo.get_soil(-18.9186, -48.2772)

    assert soil.textura_solo == "argiloso"
    assert soil.cad_capacidade_agua_mm == 60.0
    assert soil.fonte == "soilgrids"
