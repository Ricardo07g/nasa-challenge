"""Contrato da previsão do ENSO (tarefa 0038): chance de La Niña, neutro e El Niño por estação.

Valores de teste (não são a previsão da NOAA).
"""

from datetime import date

import pytest

from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast

ISSUED = date(2030, 11, 14)


def _season(estacao: str = "FMA", ano: int = 2031, pct: tuple[int, int, int] = (10, 30, 60)):
    la_nina, neutro, el_nino = pct
    return EnsoSeasonForecast(
        estacao=estacao, ano=ano, la_nina=la_nina, neutro=neutro, el_nino=el_nino
    )


def test_should_keep_the_three_chances_of_a_season_in_percent() -> None:
    season = _season(pct=(10, 30, 60))

    assert (season.la_nina, season.neutro, season.el_nino) == (10, 30, 60)


@pytest.mark.parametrize(
    ("pct", "fase", "chance"),
    [((10, 30, 60), "el_nino", 60), ((70, 20, 10), "la_nina", 70), ((20, 55, 25), None, 55)],
)
def test_should_name_the_most_likely_phase_with_its_chance(
    pct: tuple[int, int, int], fase: str | None, chance: int
) -> None:
    # Neutro é a fase `None`, como no ONI de cada ano (`OniYear.fase`)
    assert _season(pct=pct).most_likely() == (fase, chance)


def test_should_have_no_most_likely_phase_when_two_phases_tie_at_the_top() -> None:
    assert _season(pct=(10, 45, 45)).most_likely() is None


def test_should_give_the_chance_of_a_phase() -> None:
    season = _season(pct=(10, 30, 60))

    assert [season.chance(f) for f in ("la_nina", None, "el_nino")] == [10, 30, 60]


@pytest.mark.parametrize("pct", [(-1, 41, 60), (0, 0, 101)])
def test_should_refuse_a_chance_outside_zero_to_one_hundred(pct: tuple[int, int, int]) -> None:
    with pytest.raises(ValueError, match="entre 0 e 100"):
        _season(pct=pct)


@pytest.mark.parametrize("pct", [(10, 30, 50), (40, 40, 40)])
def test_should_refuse_chances_that_do_not_add_up_to_one_hundred(
    pct: tuple[int, int, int],
) -> None:
    # A NOAA arredonda cada chance: a soma pode dar 99 ou 101, mas nunca 90 ou 120
    with pytest.raises(ValueError, match="somar 100"):
        _season(pct=pct)


@pytest.mark.parametrize("pct", [(0, 2, 98), (33, 33, 33), (34, 34, 33)])
def test_should_accept_the_rounding_of_each_chance(pct: tuple[int, int, int]) -> None:
    assert sum(_season(pct=pct).chance(f) for f in ("la_nina", None, "el_nino")) == sum(pct)


def test_should_refuse_an_unknown_season_code() -> None:
    with pytest.raises(ValueError, match="estacao"):
        _season(estacao="XYZ")


def test_should_find_a_season_of_the_forecast_by_its_code() -> None:
    forecast = EnsoForecast(
        emitida_em=ISSUED,
        fonte="Fonte de teste",
        estacoes=(_season("JFM", 2031), _season("FMA", 2031)),
    )

    assert forecast.season("FMA") == _season("FMA", 2031)
    assert forecast.season("MAM") is None


def test_should_refuse_a_forecast_without_seasons_or_without_source() -> None:
    with pytest.raises(ValueError, match="estacoes"):
        EnsoForecast(emitida_em=ISSUED, fonte="Fonte de teste", estacoes=())
    with pytest.raises(ValueError, match="fonte"):
        EnsoForecast(emitida_em=ISSUED, fonte=" ", estacoes=(_season(),))


def test_should_give_the_last_day_of_a_season() -> None:
    # FMA de 2031 = fevereiro a abril de 2031; NDJ de 2030 = novembro de 2030 a janeiro de 2031
    assert _season("FMA", 2031).last_day() == date(2031, 4, 30)
    assert _season("NDJ", 2030).last_day() == date(2031, 1, 31)
    assert _season("DJF", 2031).last_day() == date(2031, 2, 28)
