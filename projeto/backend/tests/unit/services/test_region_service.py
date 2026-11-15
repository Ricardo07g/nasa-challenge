"""Testes da região pelo satélite (P3): regra de cada pixel, percentuais e escolha da região.

Repository falso, sem arquivo nem rede. Os números são valores de teste, não dados do MODIS.
"""

from dataclasses import replace
from datetime import date

import pytest

from app.models.regiao import RegiaoAno, RegiaoSatelite
from app.repositories.rules_repository import load_default_rules
from app.services.errors import OutsideAreaError
from app.services.region_service import RegionClassifier, RegionService, distance_m

FARM = (-18.9543, -48.1993)
# 0,1° de latitude ≈ 11,1 km.
KM_PER_DEGREE_LAT = 111.195


def _offseason(peak: float, year: int = 2022) -> list[tuple[date, float]]:
    """Três observações boas de abril a julho, com o maior NDVI em maio."""
    return [(date(year, 4, 7), 0.22), (date(year, 5, 9), peak), (date(year, 6, 10), 0.25)]


# --- regra de cada pixel (a mesma do talhão) ----------------------------------------------


@pytest.mark.parametrize(
    ("peak", "situacao"),
    [(0.72, "plantou"), (0.30, "parado"), (0.52, "incerto"), (0.60, "incerto"), (0.45, "incerto")],
)
def test_should_classify_pixel_with_the_field_history_limits(peak: float, situacao: str) -> None:
    assert RegionClassifier().classify_pixel(2022, _offseason(peak)) == situacao


def test_should_ignore_observations_outside_the_window_or_from_another_year() -> None:
    # 15/mar ainda é a soja; 5/ago fica fora; 2021 é outro ano. Sobram 3 de 0,30: parado.
    observations = [
        (date(2022, 3, 15), 0.85),
        (date(2022, 8, 5), 0.80),
        (date(2021, 5, 9), 0.90),
        *_offseason(0.30),
    ]

    assert RegionClassifier().classify_pixel(2022, observations) == "parado"


def test_should_mark_pixel_without_enough_good_observations_as_sem_dado() -> None:
    assert RegionClassifier().classify_pixel(2022, _offseason(0.72)[:2]) == "sem_dado"


def test_should_classify_pixel_with_limits_from_injected_rules() -> None:
    # Os limites vêm do regras.yaml do talhão: as duas telas nunca discordam.
    base = load_default_rules()
    regras = replace(base, historico_ndvi=replace(base.historico_ndvi, limite_plantou=0.80))

    assert RegionClassifier(regras).classify_pixel(2022, _offseason(0.72)) == "incerto"


# --- percentuais de um ano ----------------------------------------------------------------


def test_should_compute_percentages_without_the_no_data_pixels() -> None:
    # Guia NDVI, "Testes": {'0': 30, '1': 812, '2': 120, '3': 410}
    counts = {"sem_dado": 30, "parado": 812, "incerto": 120, "plantou": 410}

    assert RegionClassifier().summarize(2025, counts) == RegiaoAno(
        ano=2025,
        n_pixels=1372,
        pct_parado=60.5,
        pct_plantou=30.6,
        pct_incerto=8.9,
        pct_sem_dado=2.2,
    )


def test_should_return_empty_year_without_division_by_zero_when_there_is_no_cropland() -> None:
    assert RegionClassifier().summarize(2025, {}) == RegiaoAno(
        ano=2025,
        n_pixels=0,
        pct_parado=None,
        pct_plantou=None,
        pct_incerto=None,
        pct_sem_dado=None,
    )


def test_should_leave_classes_empty_when_every_pixel_has_no_data() -> None:
    assert RegionClassifier().summarize(2025, {"sem_dado": 50}) == RegiaoAno(
        ano=2025,
        n_pixels=50,
        pct_parado=None,
        pct_plantou=None,
        pct_incerto=None,
        pct_sem_dado=100.0,
    )


def test_should_reject_unknown_class() -> None:
    with pytest.raises(ValueError, match="nuvem"):
        RegionClassifier().summarize(2025, {"nuvem": 3})


# --- distância ----------------------------------------------------------------------------


def test_should_measure_distance_on_the_sphere_in_meters() -> None:
    assert distance_m(-19.0, -48.0, -18.9, -48.0) == pytest.approx(11_119.5, abs=1.0)
    assert distance_m(*FARM, *FARM) == 0.0


# --- região de um ponto (API) -------------------------------------------------------------


def _year(ano: int, pct_parado: float | None = 60.0) -> RegiaoAno:
    if pct_parado is None:
        return RegiaoAno(ano, 10, None, None, None, 100.0)
    return RegiaoAno(ano, 100, pct_parado, 100.0 - pct_parado - 10.0, 10.0, 5.0)


def _region(lat: float, lon: float, anos: tuple[RegiaoAno, ...], raio_km: float = 30.0):
    return RegiaoSatelite(
        lat=lat,
        lon=lon,
        raio_km=raio_km,
        fonte="MODIS MOD13Q1 + MYD13Q1",
        mascara="MCD12Q1 LC_Type1 classe 12 (lavouras)",
        anos=anos,
    )


class FakeRegionRepository:
    def __init__(self, regions: list[RegiaoSatelite]) -> None:
        self._regions = regions

    def list_regions(self) -> list[RegiaoSatelite]:
        return list(self._regions)


def _north_of_farm(km: float) -> tuple[float, float]:
    return FARM[0] + km / KM_PER_DEGREE_LAT, FARM[1]


def test_should_return_the_region_that_contains_the_point_with_years_in_order() -> None:
    region = _region(*FARM, (_year(2025, 62.0), _year(2016, 50.0)))
    service = RegionService(FakeRegionRepository([region]))

    result = service.get_region(*_north_of_farm(29.0))

    assert [a.ano for a in result.anos] == [2016, 2025]
    assert (result.raio_km, result.fonte, result.mascara) == (
        30.0,
        "MODIS MOD13Q1 + MYD13Q1",
        "MCD12Q1 LC_Type1 classe 12 (lavouras)",
    )


def test_should_leave_out_years_without_any_classified_pixel() -> None:
    # 2018 só teve pixel sem dado: não há percentual para mostrar.
    region = _region(*FARM, (_year(2017), _year(2018, None), _year(2019)))

    result = RegionService(FakeRegionRepository([region])).get_region(*FARM)

    assert [a.ano for a in result.anos] == [2017, 2019]


def test_should_return_no_years_when_the_region_has_no_cropland() -> None:
    region = _region(*FARM, (RegiaoAno(2025, 0, None, None, None, None),))

    assert RegionService(FakeRegionRepository([region])).get_region(*FARM).anos == ()


def test_should_raise_outside_area_when_point_is_beyond_the_radius() -> None:
    service = RegionService(FakeRegionRepository([_region(*FARM, (_year(2025),))]))

    with pytest.raises(OutsideAreaError) as exc:
        service.get_region(*_north_of_farm(31.0))

    assert exc.value.code == "OUTSIDE_AREA"


def test_should_raise_outside_area_without_any_region() -> None:
    with pytest.raises(OutsideAreaError):
        RegionService(FakeRegionRepository([])).get_region(*FARM)


def test_should_pick_the_nearest_region_when_two_contain_the_point() -> None:
    near = _region(*_north_of_farm(10.0), (_year(2025, 70.0),))
    far = _region(*_north_of_farm(-20.0), (_year(2025, 40.0),))
    service = RegionService(FakeRegionRepository([far, near]))

    result = service.get_region(*_north_of_farm(5.0))

    assert result.anos[0].pct_parado == 70.0
