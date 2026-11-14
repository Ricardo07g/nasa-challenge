"""Unit tests for WaterBalanceCalculator (Hargreaves ETo, bucket simulation, and ISNA)."""

import pytest

from app.services.water_balance_calculator import WaterBalanceCalculator


def test_should_match_fao56_example_when_computing_extraterrestrial_radiation() -> None:
    # FAO-56, exemplo 8: 20° S em 3 de setembro (dia 246) -> Ra = 32,2 MJ/m²/dia
    calc = WaterBalanceCalculator()

    ra = calc.extraterrestrial_radiation(lat_deg=-20.0, day_of_year=246)

    assert ra == pytest.approx(32.2, abs=0.1)


def test_should_use_extraterrestrial_radiation_when_computing_hargreaves_eto() -> None:
    # FAO-56 eq. 52: 0,0023 x (Tmed + 17,8) x (Tmax - Tmin)^0,5 x 0,408 x Ra
    # Tmax 30, Tmin 18, Ra 32,2 -> 0,0023 x 41,8 x 3,464 x 0,408 x 32,2 ≈ 4,38 mm/dia
    calc = WaterBalanceCalculator()

    eto = calc.hargreaves_eto(t_max=30.0, t_min=18.0, lat_deg=-20.0, day_of_year=246)

    assert eto == pytest.approx(4.38, abs=0.05)


def test_should_give_typical_cerrado_eto_when_late_summer_in_uberlandia() -> None:
    # Meados de março em Uberlândia: a ETo fica perto de 4 a 5 mm/dia, não perto de 2.
    calc = WaterBalanceCalculator()

    eto = calc.hargreaves_eto(t_max=29.0, t_min=19.0, lat_deg=-18.95, day_of_year=75)

    assert 3.8 <= eto <= 5.5


def test_should_keep_etr_equal_to_etc_and_isna_one_when_rain_exceeds_demand() -> None:
    # PRD §11: chuva 10 mm/dia, ETo 5, Kc 1, CAD 50 -> ETr = ETc todos os dias; ISNA = 1
    calc = WaterBalanceCalculator()

    etr_l, etc_l = calc.simular(chuva=[10.0] * 10, eto=[5.0] * 10, kc=[1.0] * 10, cad=50.0)

    assert etr_l == etc_l
    assert calc.isna(etr_l=etr_l, etc_l=etc_l, ini=0, fim=10) == pytest.approx(1.0)


def test_should_empty_bucket_in_five_days_when_no_rain_and_half_full() -> None:
    # PRD §11: chuva 0, ETo 5, Kc 1, CAD 50, balde inicial 25
    # -> ETr = 5 por 5 dias, depois 0; ISNA de 10 dias = 0,5
    calc = WaterBalanceCalculator()

    etr_l, etc_l = calc.simular(
        chuva=[0.0] * 10, eto=[5.0] * 10, kc=[1.0] * 10, cad=50.0, arm0=25.0
    )

    assert etr_l == pytest.approx([5.0] * 5 + [0.0] * 5)
    assert calc.isna(etr_l=etr_l, etc_l=etc_l, ini=0, fim=10) == pytest.approx(0.5)


def test_should_start_bucket_at_half_cad_when_initial_storage_not_given() -> None:
    calc = WaterBalanceCalculator()

    etr_l, _ = calc.simular(chuva=[0.0] * 6, eto=[5.0] * 6, kc=[1.0] * 6, cad=50.0)

    assert etr_l == pytest.approx([5.0] * 5 + [0.0])


def test_should_not_store_more_than_cad_when_heavy_rain() -> None:
    calc = WaterBalanceCalculator()

    etr_l, _ = calc.simular(
        chuva=[100.0] + [0.0] * 12, eto=[5.0] * 13, kc=[1.0] * 13, cad=50.0, arm0=0.0
    )

    # Dia 1: 100 mm de chuva, ETr 5, balde cheio em 50 (o resto escorre).
    # Depois, 50 mm dão 10 dias de ETr = 5.
    assert etr_l == pytest.approx([5.0] * 11 + [0.0] * 2)
