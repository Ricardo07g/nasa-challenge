"""Chuva de cada mês na região (tela 3): total de cada mês em cada ano e a média entre os anos.

Temporadas de teste com valores redondos (não são do NASA POWER): a chave de fonte usada é
`teste`, exceto onde o teste confere justamente a fonte.
"""

from datetime import date

from app.models.climate import ClimateSeason
from app.models.talhao import ChuvaMensal, ChuvaMes
from app.services.monthly_rain_service import MonthlyRainService

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


def test_should_sum_each_month_of_a_season_from_january_to_june() -> None:
    # 1 mm por dia: o total de cada mês é o número de dias (2024 é bissexto).
    totals = MonthlyRainService().monthly_totals(_season(2024, 1.0))

    assert totals == {1: 31.0, 2: 29.0, 3: 31.0, 4: 30.0, 5: 31.0, 6: 30.0}


def test_should_put_each_day_in_its_own_month() -> None:
    # 10 mm só em 31/jan e 1/fev: um vai para janeiro e o outro para fevereiro.
    rain = [0.0] * DAYS
    rain[30] = 10.0
    rain[31] = 10.0

    totals = MonthlyRainService().monthly_totals(_season(2023, rain))

    assert totals == {1: 10.0, 2: 10.0, 3: 0.0, 4: 0.0, 5: 0.0, 6: 0.0}


def test_should_average_each_month_between_the_years() -> None:
    # 2 mm/dia em 2021 e 4 mm/dia em 2022: janeiro = (62 + 124) / 2 = 93.
    chuva = MonthlyRainService().summarize([_season(2021, 2.0), _season(2022, 4.0)])

    assert chuva == ChuvaMensal(
        meses=(
            ChuvaMes(mes=1, media_mm=93.0),
            ChuvaMes(mes=2, media_mm=84.0),
            ChuvaMes(mes=3, media_mm=93.0),
            ChuvaMes(mes=4, media_mm=90.0),
            ChuvaMes(mes=5, media_mm=93.0),
            ChuvaMes(mes=6, media_mm=90.0),
        ),
        anos=(2021, 2022),
        fonte="teste",
    )


def test_should_round_the_average_to_one_decimal() -> None:
    # Fevereiro: (28 + 29 + 28) / 3 = 28,333... -> 28,3
    chuva = MonthlyRainService().summarize(
        [_season(2023, 1.0), _season(2024, 1.0), _season(2025, 1.0)]
    )

    assert chuva is not None
    assert chuva.meses[1] == ChuvaMes(mes=2, media_mm=28.3)


def test_should_list_the_years_in_order() -> None:
    chuva = MonthlyRainService().summarize([_season(2024, 1.0), _season(2005, 1.0)])

    assert chuva is not None
    assert chuva.anos == (2005, 2024)


def test_should_keep_the_rain_source_of_the_seasons() -> None:
    chuva = MonthlyRainService().summarize([_season(2005, 1.0, source="nasa_power")])

    assert chuva is not None
    assert chuva.fonte == "nasa_power"


def test_should_list_every_source_when_years_come_from_different_sources() -> None:
    seasons = [
        _season(2005, 1.0, source="nasa_power"),
        _season(2006, 1.0, source="gpm_imerg"),
        _season(2007, 1.0, source="nasa_power"),
    ]

    chuva = MonthlyRainService().summarize(seasons)

    assert chuva is not None
    assert chuva.fonte == "gpm_imerg+nasa_power"


def test_should_leave_out_a_year_that_does_not_cover_january_to_june() -> None:
    # 2022 para em 31/mai (151 dias): fica de fora, para não baixar a média de junho.
    chuva = MonthlyRainService().summarize([_season(2021, 2.0), _season(2022, 9.0, days=151)])

    assert chuva is not None
    assert chuva.anos == (2021,)
    assert chuva.meses[5] == ChuvaMes(mes=6, media_mm=60.0)


def test_should_count_a_season_that_ends_on_june_30() -> None:
    chuva = MonthlyRainService().summarize([_season(2023, 1.0, days=181)])

    assert chuva is not None
    assert chuva.anos == (2023,)


def test_should_return_none_without_seasons() -> None:
    assert MonthlyRainService().summarize([]) is None


def test_should_return_none_when_no_season_covers_january_to_june() -> None:
    assert MonthlyRainService().summarize([_season(2023, 1.0, days=1)]) is None
