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


Obs = list[tuple[date, float]]


def _soy(year: int = 2022, peak: float = 0.88) -> Obs:
    """Soja de teste: cresce em janeiro, pico em fevereiro e colheita (0,30) em 6 de março."""
    return [(date(year, 1, 17), 0.80), (date(year, 2, 18), peak), (date(year, 3, 6), 0.30)]


def _after_harvest(peak: float, year: int = 2022) -> Obs:
    """Três observações boas depois da colheita, com o maior NDVI em maio."""
    return [(date(year, 4, 7), 0.22), (date(year, 5, 9), peak), (date(year, 6, 10), 0.25)]


def _pixel(peak: float, year: int = 2022) -> Obs:
    return [*_soy(year), *_after_harvest(peak, year)]


# --- soja do ano em cada pixel (pico e colheita, grupo regiao_ndvi) ------------------------


def test_should_find_the_harvest_date_after_the_soy_peak() -> None:
    assert RegionClassifier().harvest_date(2022, _pixel(0.30)) == date(2022, 3, 6)


def test_should_accept_a_peak_exactly_at_the_minimum_and_a_harvest_exactly_at_the_maximum() -> None:
    # Pico >= 0,70 e colheita <= 0,40 (regras.yaml, regiao_ndvi).
    observations = [(date(2022, 2, 18), 0.70), (date(2022, 3, 22), 0.40)]

    assert RegionClassifier().harvest_date(2022, observations) == date(2022, 3, 22)


def test_should_not_see_soy_when_the_summer_peak_is_below_the_minimum() -> None:
    # Pasto ou lavoura fraca: verde de menos no verão.
    observations = [(date(2022, 2, 18), 0.65), (date(2022, 3, 22), 0.30), *_after_harvest(0.30)]

    assert RegionClassifier().harvest_date(2022, observations) is None
    assert RegionClassifier().classify_pixel(2022, observations) is None


def test_should_look_for_the_peak_only_from_january_to_mid_march() -> None:
    # 0,85 em 22/mar fica fora da janela do pico (1/jan a 15/mar).
    observations = [(date(2022, 2, 18), 0.60), (date(2022, 3, 22), 0.85), (date(2022, 4, 7), 0.30)]

    assert RegionClassifier().harvest_date(2022, observations) is None


def test_should_not_see_soy_in_a_perennial_crop_that_never_dries() -> None:
    # Cana ou café: verde o ano todo, nenhuma observação até 0,40 depois do pico.
    observations = [
        (date(2022, 1, 17), 0.82),
        (date(2022, 2, 18), 0.85),
        (date(2022, 3, 22), 0.78),
        (date(2022, 4, 22), 0.70),
        (date(2022, 5, 8), 0.66),
        (date(2022, 6, 9), 0.58),
    ]

    assert RegionClassifier().classify_pixel(2022, observations) is None


def test_should_only_accept_a_harvest_up_to_mid_may() -> None:
    # Secou só em 24/mai: não é a soja do ano (nada até 0,40 de 18/fev a 15/mai).
    observations = [
        (date(2022, 2, 18), 0.88),
        (date(2022, 4, 7), 0.60),
        (date(2022, 5, 9), 0.50),
        (date(2022, 5, 24), 0.30),
        (date(2022, 6, 10), 0.25),
    ]

    assert RegionClassifier().harvest_date(2022, observations) is None


def test_should_ignore_low_values_before_the_peak() -> None:
    # Terra nua antes do plantio (0,25 em 1/jan) não é colheita.
    observations = [(date(2022, 1, 1), 0.25), (date(2022, 2, 18), 0.88), (date(2022, 4, 7), 0.55)]

    assert RegionClassifier().harvest_date(2022, observations) is None


def test_should_take_the_last_date_of_a_repeated_peak() -> None:
    # O mesmo pico em 17/jan e 18/fev, com uma queda no meio: a colheita vem depois do último.
    observations = [
        (date(2022, 1, 17), 0.85),
        (date(2022, 2, 2), 0.35),
        (date(2022, 2, 18), 0.85),
        (date(2022, 3, 22), 0.30),
    ]

    assert RegionClassifier().harvest_date(2022, observations) == date(2022, 3, 22)


def test_should_take_peak_and_harvest_limits_from_injected_rules() -> None:
    base = load_default_rules()
    regras = replace(base, regiao_ndvi=replace(base.regiao_ndvi, pico_min_ndvi=0.90))

    assert RegionClassifier(regras).classify_pixel(2022, _pixel(0.72)) is None


# --- entressafra de cada pixel de soja (a regra do talhão) --------------------------------


@pytest.mark.parametrize(
    ("peak", "situacao"),
    [(0.72, "plantou"), (0.30, "parado"), (0.52, "incerto"), (0.60, "incerto"), (0.45, "incerto")],
)
def test_should_classify_soy_pixel_with_the_talhao_limits(peak: float, situacao: str) -> None:
    assert RegionClassifier().classify_pixel(2022, _pixel(peak)) == situacao


def test_should_classify_only_the_observations_after_the_harvest() -> None:
    # O pico da soja (0,88) não conta como "plantou": a entressafra começa depois da colheita.
    assert RegionClassifier().classify_pixel(2022, _pixel(0.30)) == "parado"


def test_should_not_count_late_soy_still_green_in_april_as_planted() -> None:
    # Soja tardia: pico em 6/mar, ainda verde em 7/abr, colhida em 22/abr. Pela janela fixa de
    # abril a julho, o 0,75 de 7/abr daria "plantou"; depois da colheita, ficou parado.
    observations = [
        (date(2022, 2, 18), 0.70),
        (date(2022, 3, 6), 0.84),
        (date(2022, 4, 7), 0.75),
        (date(2022, 4, 22), 0.35),
        (date(2022, 5, 8), 0.30),
        (date(2022, 5, 24), 0.28),
        (date(2022, 6, 9), 0.25),
    ]

    assert RegionClassifier().classify_pixel(2022, observations) == "parado"


def test_should_see_a_second_crop_sown_right_after_an_early_harvest() -> None:
    # Colheita em 18/fev e milho safrinha logo depois: plantou, mesmo com o pico em março.
    observations = [
        (date(2022, 1, 17), 0.86),
        (date(2022, 2, 18), 0.32),
        (date(2022, 3, 22), 0.55),
        (date(2022, 4, 22), 0.78),
        (date(2022, 5, 24), 0.70),
    ]

    assert RegionClassifier().classify_pixel(2022, observations) == "plantou"


def test_should_ignore_observations_after_july_or_from_another_year() -> None:
    observations = [
        *_pixel(0.30),
        (date(2022, 8, 5), 0.80),
        (date(2021, 5, 9), 0.90),
        (date(2023, 5, 9), 0.90),
    ]

    assert RegionClassifier().classify_pixel(2022, observations) == "parado"


def test_should_mark_soy_pixel_without_enough_good_observations_after_harvest_as_sem_dado() -> None:
    # A própria observação da colheita não conta: sobram 2 depois dela.
    observations = [*_soy(), *_after_harvest(0.72)[:2]]

    assert RegionClassifier().classify_pixel(2022, observations) == "sem_dado"


def test_should_accept_observations_out_of_order() -> None:
    assert RegionClassifier().classify_pixel(2022, list(reversed(_pixel(0.72)))) == "plantou"


def test_should_classify_soy_pixel_with_limits_from_injected_rules() -> None:
    # Os limites da entressafra vêm do regras.yaml do talhão: as duas telas nunca discordam.
    base = load_default_rules()
    regras = replace(base, historico_ndvi=replace(base.historico_ndvi, limite_plantou=0.80))

    assert RegionClassifier(regras).classify_pixel(2022, _pixel(0.72)) == "incerto"


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


def test_should_carry_the_cropland_pixels_next_to_the_soy_pixels() -> None:
    counts = {"sem_dado": 30, "parado": 812, "incerto": 120, "plantou": 410}

    ano = RegionClassifier().summarize(2025, counts, n_pixels_lavoura=5000)

    assert (ano.n_pixels, ano.n_pixels_lavoura, ano.pct_parado) == (1372, 5000, 60.5)


def test_should_return_empty_year_when_the_cropland_has_no_soy_pixel() -> None:
    assert RegionClassifier().summarize(2025, {}, n_pixels_lavoura=800) == RegiaoAno(
        ano=2025,
        n_pixels=0,
        pct_parado=None,
        pct_plantou=None,
        pct_incerto=None,
        pct_sem_dado=None,
        n_pixels_lavoura=800,
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


def test_should_never_count_a_pixel_without_soybean_in_the_region() -> None:
    # Pixel sem a soja do ano fica fora dos percentuais (classify_pixel devolve None): a situação
    # "sem_soja" do talhão não entra na contagem da região.
    with pytest.raises(ValueError, match="sem_soja"):
        RegionClassifier().summarize(2022, {"parado": 3, "sem_soja": 1})


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

    result = service.get_region(*_north_of_farm(29.0)).regiao

    assert [a.ano for a in result.anos] == [2016, 2025]
    assert (result.raio_km, result.fonte, result.mascara) == (
        30.0,
        "MODIS MOD13Q1 + MYD13Q1",
        "MCD12Q1 LC_Type1 classe 12 (lavouras)",
    )


def test_should_tell_the_distance_from_the_point_to_the_center_with_one_decimal() -> None:
    # A região é o círculo em volta do centro calculado: a tela diz a distância ao produtor.
    region = _region(*FARM, (_year(2025),))
    service = RegionService(FakeRegionRepository([region]))

    result = service.get_region(*_north_of_farm(12.34))

    assert (result.regiao.lat, result.regiao.lon) == FARM
    assert result.distancia_km == 12.3
    assert service.get_region(*FARM).distancia_km == 0.0


def test_should_leave_out_years_without_any_classified_pixel() -> None:
    # 2018 só teve pixel sem dado: não há percentual para mostrar.
    region = _region(*FARM, (_year(2017), _year(2018, None), _year(2019)))

    result = RegionService(FakeRegionRepository([region])).get_region(*FARM).regiao

    assert [a.ano for a in result.anos] == [2017, 2019]


def test_should_return_no_years_when_the_region_has_no_cropland() -> None:
    region = _region(*FARM, (RegiaoAno(2025, 0, None, None, None, None),))

    assert RegionService(FakeRegionRepository([region])).get_region(*FARM).regiao.anos == ()


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

    assert result.regiao.anos[0].pct_parado == 70.0
    assert result.distancia_km == 5.0
