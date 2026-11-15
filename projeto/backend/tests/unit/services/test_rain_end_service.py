"""Fim das chuvas na célula (tela 3, tarefa 0042).

Temporadas de teste com valores redondos (não são do GPM IMERG nem do NASA POWER): a chave de
fonte é `teste`, exceto onde o teste confere justamente a fonte.
"""

from dataclasses import replace
from datetime import date

from app.models.climate import ClimateSeason
from app.models.talhao import DiaDoAno
from app.repositories.rules_repository import load_default_rules
from app.services.rain_end_service import RainEndService

DAYS = 212  # 1/jan a 31/jul


def _season(year: int, rain: list[float], source: str = "teste") -> ClimateSeason:
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple(rain),
        rain_source=source,
        tmax_c=tuple([30.0] * len(rain)),
        tmin_c=tuple([18.0] * len(rain)),
    )


def _rains_until(year: int, last_rainy_day: str, mm: float = 5.0, source: str = "teste"):  # noqa: ANN202
    """Chove `mm` todo dia até `last_rainy_day` ("MM-DD"); depois, nada."""
    last = (date(year, *map(int, last_rainy_day.split("-"))) - date(year, 1, 1)).days
    return _season(year, [mm if day <= last else 0.0 for day in range(DAYS)], source)


def test_should_find_the_first_day_that_starts_20_days_with_less_than_10_mm_in_total() -> None:
    # 5 mm por dia até 31/mar: a janela que começa em 30/mar soma 10 mm (não é menos de 10); a de
    # 31/mar soma 5 mm. A soma é dos 20 dias, não de cada dia.
    result = RainEndService().summarize([_rains_until(2023, "03-31")])

    assert result is not None
    assert result.mediana == "03-31"


def test_should_not_look_before_the_first_of_march() -> None:
    # Sem chuva nenhuma: a chuva "acabou" no primeiro dia olhado, 1º/mar.
    result = RainEndService().summarize([_season(2023, [0.0] * DAYS)])

    assert result is not None
    assert result.mediana == "03-01"


def test_should_give_the_median_the_earliest_and_the_latest_end_with_the_year() -> None:
    seasons = [
        _rains_until(2012, "04-05"),
        _rains_until(2010, "03-10"),
        _rains_until(2011, "03-20"),
    ]

    result = RainEndService().summarize(seasons)

    assert result is not None
    assert result.mediana == "03-20"
    assert result.mais_cedo == DiaDoAno(dia="03-10", ano=2010)
    assert result.mais_tarde == DiaDoAno(dia="04-05", ano=2012)
    assert result.anos == (2010, 2011, 2012)


def test_should_round_down_the_median_of_an_even_number_of_years() -> None:
    # Dias 69 (10/mar) e 72 (13/mar): a mediana 70,5 vira 11/mar. Em metade dos anos (1 de 2),
    # a chuva acabou até esse dia.
    seasons = [_rains_until(2010, "03-10"), _rains_until(2011, "03-13")]

    result = RainEndService().summarize(seasons)

    assert result is not None
    assert result.mediana == "03-11"


def test_should_count_march_days_of_leap_years_in_the_same_calendar() -> None:
    seasons = [_rains_until(2024, "03-10"), _rains_until(2020, "03-10")]

    result = RainEndService().summarize(seasons)

    assert result is not None
    assert (result.mediana, result.mais_cedo.dia) == ("03-10", "03-10")


def test_should_take_the_numbers_from_the_rules() -> None:
    # 5 dias com menos de 1 mm, a partir de 1º/abr: 5 mm por dia até 10/abr -> 11/abr.
    rules = load_default_rules()
    regra = replace(rules.fim_das_chuvas, inicio="04-01", dias=5, chuva_max_mm=1.0)

    result = RainEndService(replace(rules, fim_das_chuvas=regra)).summarize(
        [_rains_until(2023, "04-10")]
    )

    assert result is not None
    assert result.mediana == "04-11"
    assert (result.inicio, result.dias, result.chuva_max_mm) == ("04-01", 5, 1.0)


def test_should_give_nothing_when_a_year_never_dries_inside_the_series() -> None:
    # 1 mm todo dia até 31/jul: toda janela soma 20 mm. Sem o fim daquele ano, a mediana e o mais
    # tarde ficariam errados: o elemento não aparece.
    seasons = [_season(2022, [1.0] * DAYS), _rains_until(2023, "03-31")]

    assert RainEndService().summarize(seasons) is None


def test_should_give_nothing_without_seasons() -> None:
    assert RainEndService().summarize([]) is None


def test_should_name_the_rain_sources_and_the_rule() -> None:
    seasons = [
        _rains_until(2022, "03-31", source="nasa_power"),
        _rains_until(2023, "03-31", source="gpm_imerg"),
    ]

    result = RainEndService().summarize(seasons)

    assert result is not None
    assert result.fonte == "gpm_imerg+nasa_power"
    assert (result.inicio, result.dias, result.chuva_max_mm) == ("03-01", 20, 10.0)
