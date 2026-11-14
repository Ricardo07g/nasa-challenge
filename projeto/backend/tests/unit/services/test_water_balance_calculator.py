"""Unit tests for WaterBalanceCalculator (FAO-56 ETo, bucket simulation, and ISNA)."""

import pytest

from app.services.water_balance_calculator import WaterBalanceCalculator


def test_should_calculate_positive_eto_when_valid_meteorological_inputs_given() -> None:
    calc = WaterBalanceCalculator()

    eto = calc.calculate_eto_fao(
        t_max=31.0,
        t_min=19.0,
        t_mean=25.0,
        solar_rad_mj=20.0,
        ws2m=2.2,
        rh2m=65.0,
    )

    assert 2.5 <= eto <= 7.0


def test_should_keep_isna_near_one_when_rainfall_exceeds_crop_demand() -> None:
    calc = WaterBalanceCalculator()
    chuva = [12.0] * 60
    eto = [4.0] * 60
    kc = [1.0] * 60

    etr_l, etc_l = calc.simular(chuva=chuva, eto=eto, kc=kc, cad=60.0, arm0=60.0)
    isna_val = calc.isna(etr_l=etr_l, etc_l=etc_l, ini=15, fim=45)

    assert isna_val == pytest.approx(1.0, abs=0.05)


def test_should_drop_isna_below_threshold_when_prolonged_drought_occurs() -> None:
    calc = WaterBalanceCalculator()
    chuva = [0.0] * 60
    eto = [5.0] * 60
    kc = [1.15] * 60

    etr_l, etc_l = calc.simular(chuva=chuva, eto=eto, kc=kc, cad=40.0, arm0=10.0)
    isna_val = calc.isna(etr_l=etr_l, etc_l=etc_l, ini=30, fim=55)

    assert isna_val < 0.30
