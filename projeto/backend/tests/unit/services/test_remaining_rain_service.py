"""Chuva que sobra depois da colheita (tela 3, tarefa 0042).

Temporadas de teste com valores redondos (não são do GPM IMERG nem do NASA POWER): a chave de
fonte é `teste`, exceto onde o teste confere justamente a fonte.
"""

from dataclasses import replace
from datetime import date

import pytest

from app.models.climate import ClimateSeason
from app.models.talhao import ChuvaQueSobraDia
from app.repositories.rules_repository import load_default_rules
from app.services.remaining_rain_service import RemainingRainService, percentile

DAYS = 212  # 1/jan a 31/jul


def _season(
    year: int, rain: float | list[float], days: int = DAYS, source: str = "teste"
) -> ClimateSeason:
    rain_mm = tuple(rain) if isinstance(rain, list) else tuple([rain] * days)
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=rain_mm,
        rain_source=source,
        tmax_c=tuple([30.0] * len(rain_mm)),
        tmin_c=tuple([18.0] * len(rain_mm)),
    )


def _day(result, dia: str) -> ChuvaQueSobraDia:  # noqa: ANN001
    return next(item for item in result.dias if item.dia == dia)


def test_should_list_every_harvest_day_of_the_season() -> None:
    # Época da colheita da tela 3: 15/jan a 31/mar (76 dias num ano comum).
    result = RemainingRainService().summarize([_season(2023, 1.0)])

    assert result is not None
    assert (result.dias[0].dia, result.dias[-1].dia, len(result.dias)) == ("01-15", "03-31", 76)
    assert (result.fim, result.percentil_seco) == ("06-30", 20)


def test_should_sum_the_rain_from_the_harvest_day_to_the_end_of_june() -> None:
    # 1 mm por dia: de 31/mar a 30/jun são 92 dias (o dia da colheita conta).
    result = RemainingRainService().summarize([_season(2023, 1.0)])

    assert result is not None
    assert _day(result, "03-31") == ChuvaQueSobraDia(dia="03-31", mediana_mm=92.0, seco_mm=92.0)
    assert _day(result, "01-15").mediana_mm == 167.0


def test_should_count_february_29_in_a_leap_year() -> None:
    # De 28/fev a 30/jun: 124 dias em 2024 (bissexto) e 123 em 2023.
    service = RemainingRainService()

    leap = service.summarize([_season(2024, 1.0)])
    common = service.summarize([_season(2023, 1.0)])

    assert leap is not None and common is not None
    assert _day(leap, "02-28").mediana_mm == 124.0
    assert _day(common, "02-28").mediana_mm == 123.0


def test_should_take_the_median_and_the_dry_year_between_the_years() -> None:
    # 1 a 5 mm por dia: de 31/mar a 30/jun, 92, 184, 276, 368 e 460 mm. Mediana 276; percentil 20
    # na posição 0,8 entre os anos ordenados: 92 + 0,8 x 92 = 165,6.
    seasons = [_season(2018 + rain, float(rain)) for rain in (3, 1, 5, 2, 4)]

    result = RemainingRainService().summarize(seasons)

    assert result is not None
    assert _day(result, "03-31") == ChuvaQueSobraDia(dia="03-31", mediana_mm=276.0, seco_mm=165.6)
    assert result.anos == (2019, 2020, 2021, 2022, 2023)


def test_should_take_the_percentile_from_the_rules() -> None:
    rules = load_default_rules()
    rules = replace(rules, chuva_que_sobra=replace(rules.chuva_que_sobra, percentil_seco=50))
    seasons = [_season(2018 + rain, float(rain)) for rain in (1, 2, 3, 4, 5)]

    result = RemainingRainService(rules).summarize(seasons)

    assert result is not None
    assert _day(result, "03-31").seco_mm == _day(result, "03-31").mediana_mm


def test_should_stop_at_the_end_day_from_the_rules() -> None:
    rules = load_default_rules()
    rules = replace(rules, chuva_que_sobra=replace(rules.chuva_que_sobra, fim="05-31"))

    result = RemainingRainService(rules).summarize([_season(2023, 1.0)])

    assert result is not None
    assert result.fim == "05-31"
    assert _day(result, "03-31").mediana_mm == 62.0


def test_should_round_to_one_decimal() -> None:
    result = RemainingRainService().summarize([_season(2023, 0.33)])

    assert result is not None
    assert _day(result, "03-31").mediana_mm == 30.4  # 92 x 0,33 = 30,36


def test_should_leave_out_a_year_that_does_not_reach_the_end_of_june() -> None:
    # A temporada de 2022 para em 31/mai: entraria com menos chuva do que de fato caiu.
    seasons = [_season(2022, 1.0, days=151), _season(2023, 2.0)]

    result = RemainingRainService().summarize(seasons)

    assert result is not None
    assert result.anos == (2023,)


def test_should_return_none_without_a_complete_year() -> None:
    assert RemainingRainService().summarize([_season(2022, 1.0, days=151)]) is None
    assert RemainingRainService().summarize([]) is None


def test_should_name_the_rain_sources_of_the_years_used() -> None:
    seasons = [_season(2022, 1.0, source="nasa_power"), _season(2023, 1.0, source="gpm_imerg")]

    result = RemainingRainService().summarize(seasons)

    assert result is not None
    assert result.fonte == "gpm_imerg+nasa_power"


@pytest.mark.parametrize(
    ("values", "pct", "expected"),
    [
        ([10.0], 20, 10.0),
        ([1.0, 2.0, 3.0, 4.0, 5.0], 20, 1.8),
        ([5.0, 1.0, 4.0, 2.0, 3.0], 50, 3.0),
        ([1.0, 2.0], 0, 1.0),
        ([1.0, 2.0], 100, 2.0),
    ],
)
def test_should_interpolate_the_percentile_between_the_sorted_values(
    values: list[float], pct: int, expected: float
) -> None:
    assert percentile(values, pct) == pytest.approx(expected)
