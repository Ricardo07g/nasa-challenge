"""Unit tests for CachedEarthEngineNdviRepository."""

from pathlib import Path

from app.repositories.ndvi_repository import CachedEarthEngineNdviRepository


def test_should_load_10_year_ndvi_series_and_annual_classification_when_json_exists() -> None:
    repo = CachedEarthEngineNdviRepository(
        Path("/workspace/data/output/modis_ndvi_historico_10anos.json")
    )

    serie_ndvi, classificacao = repo.get_ndvi_history(-18.9186, -48.2772)

    assert len(serie_ndvi) > 50
    assert len(classificacao) == 10
    assert classificacao[0].ano == 2015
    assert classificacao[-1].ano == 2024
