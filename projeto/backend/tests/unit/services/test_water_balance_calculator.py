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


def test_should_match_fao56_example_5_when_actual_vapour_pressure_comes_from_mean_rh() -> None:
    # FAO-56 (Allen et al., 1998, Boletim 56), cap. 3, exemplo 5, caso com só a UR média (eq. 19):
    # Tmax 25 °C, Tmin 18 °C, UR média 68% -> e°(Tmax) 3,168, e°(Tmin) 2,064 -> ea = 1,78 kPa
    calc = WaterBalanceCalculator()

    ea = calc.actual_vapour_pressure_from_rh_mean(t_max=25.0, t_min=18.0, rh_mean_pct=68.0)

    assert ea == pytest.approx(1.78, abs=0.005)


def test_should_match_fao56_example_18_when_computing_penman_monteith_eto() -> None:
    # FAO-56 (Allen et al., 1998, Boletim 56), cap. 4, exemplo 18: ETo diária em Bruxelas,
    # 6 de julho (dia 187), 50°48' N, 100 m de altitude, Tmax 21,5 °C, Tmin 12,3 °C.
    # As outras entradas são os valores intermediários do próprio exemplo:
    # - ea = 1,409 kPa (eq. 17, com UR máxima 84% e UR mínima 63%);
    # - u2 = 2,078 m/s (10 km/h medidos a 10 m, levados a 2 m pela eq. 47);
    # - Rs = 22,07 MJ/m²/dia (9,25 h de sol, eq. 35).
    # Resultado do boletim: ETo = 3,9 mm/dia.
    calc = WaterBalanceCalculator()

    eto = calc.penman_monteith_eto(
        t_max=21.5,
        t_min=12.3,
        actual_vapour_pressure_kpa=1.409,
        wind_2m_ms=2.078,
        solar_rad_mj=22.07,
        lat_deg=50.80,
        day_of_year=187,
        elevation_m=100.0,
    )

    assert eto == pytest.approx(3.9, abs=0.05)


def test_should_not_return_negative_eto_when_vapour_pressure_exceeds_saturation() -> None:
    # Entradas incoerentes (ea acima da saturação, ~1,19 kPa a 9-10 °C), sem sol e com vento:
    # o termo do vento fica negativo e a conta dá menos de zero. A ETo não pode ser negativa.
    calc = WaterBalanceCalculator()

    eto = calc.penman_monteith_eto(
        t_max=10.0,
        t_min=9.0,
        actual_vapour_pressure_kpa=1.6,
        wind_2m_ms=4.0,
        solar_rad_mj=0.0,
        lat_deg=-18.95,
        day_of_year=180,
        elevation_m=850.0,
    )

    assert eto == 0.0


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
