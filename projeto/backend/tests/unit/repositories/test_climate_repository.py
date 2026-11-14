"""Unit tests for DataOutputClimateRepository."""

from pathlib import Path

from app.repositories.climate_repository import DataOutputClimateRepository


def test_should_return_cell_id_when_coordinates_are_inside_pilot_area() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    cell_id = repo.find_cell_id(-18.9186, -48.2772)

    assert cell_id == "-189_-483"


def test_should_return_none_when_coordinates_are_outside_pilot_area() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    assert repo.find_cell_id(-23.5505, -46.6333) is None


def test_should_return_twenty_seasons_from_2005_to_2024_when_get_seasons_called() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    seasons = repo.get_seasons("-189_-483")

    assert len(seasons) == 20
    assert [s.year for s in seasons] == list(range(2005, 2025))
    assert all(len(s.rain_mm) > 150 for s in seasons)
    assert all(len(s.eto_mm) == len(s.rain_mm) for s in seasons)


def test_should_return_cmip6_delta_and_smap_moisture_when_queried() -> None:
    repo = DataOutputClimateRepository(Path("/workspace/data/output"))

    delta = repo.get_cmip6_delta("-189_-483")
    smap = repo.get_latest_smap(-18.9186, -48.2772)

    assert delta.cenario == "SSP2-4.5"
    assert delta.variacao_chuva_safrinha_pct == -12.5
    assert delta.aumento_temperatura_media_c == 1.8
    assert smap is not None
    assert 0.0 < smap.sm_rootzone_wetness <= 1.0
