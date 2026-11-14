"""Contrato dos dados do sinal para o outono (PRD 7.10, RF-20): GEOS-S2S, SMAP e chuva recente."""

from datetime import date

import pytest

from app.models.sinal_outono import RecentRain, RecentSoilMoisture, SeasonalForecast

DAY = date(2027, 2, 10)


def test_should_keep_chance_of_below_normal_rain_as_a_fraction() -> None:
    forecast = SeasonalForecast(chance_abaixo_normal=0.6, data=DAY)

    assert forecast.chance_abaixo_normal == 0.6
    assert forecast.data == DAY


@pytest.mark.parametrize("chance", [-0.01, 1.01, float("nan"), 60.0])
def test_should_reject_chance_outside_zero_to_one(chance: float) -> None:
    # 60 (em %) também sai: a chance vem como fração, para não confundir 60% com 0,6%.
    with pytest.raises(ValueError, match="chance_abaixo_normal"):
        SeasonalForecast(chance_abaixo_normal=chance, data=DAY)


@pytest.mark.parametrize("pctl", [-1.0, 100.5, float("inf")])
def test_should_reject_soil_moisture_percentile_outside_zero_to_hundred(pctl: float) -> None:
    with pytest.raises(ValueError, match="sm_rootzone_pctl"):
        RecentSoilMoisture(sm_rootzone_pctl=pctl, data=DAY)


def test_should_give_recent_rain_as_a_fraction_of_the_average() -> None:
    rain = RecentRain(chuva_mm=90.0, media_mm=200.0, dias=30, data=DAY)

    assert rain.fracao_da_media == pytest.approx(0.45)


@pytest.mark.parametrize(
    ("chuva", "media", "dias", "campo"),
    [(-1.0, 200.0, 30, "chuva_mm"), (90.0, 0.0, 30, "media_mm"), (90.0, 200.0, 0, "dias")],
)
def test_should_reject_negative_rain_zero_average_or_empty_window(
    chuva: float, media: float, dias: int, campo: str
) -> None:
    # Média zero não serve de comparação: sem ela não dá para dizer se choveu pouco.
    with pytest.raises(ValueError, match=campo):
        RecentRain(chuva_mm=chuva, media_mm=media, dias=dias, data=DAY)
