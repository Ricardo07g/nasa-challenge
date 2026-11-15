"""Contas do raio-X sobre a série guardada da célula (tela 4, remodelagem S4, tarefa 0043).

Temporadas de teste com valores redondos (não são do GPM IMERG nem do NASA POWER): a chave de
fonte é `teste`.
"""

from dataclasses import replace
from datetime import date, timedelta

import pytest

from app.models.climate import ClimateSeason
from app.models.crop_option import CropParams
from app.repositories.rules_repository import load_default_rules
from app.services.raio_x_climate_service import RaioXClimateService

DAYS = 212  # 1/jan a 31/jul (no bissexto, até 30/jul)


def _season(
    year: int,
    rain: float | list[float] = 5.0,
    tmax: float | list[float] = 30.0,
    tmin: float | list[float] = 18.0,
    eto: float | list[float] = 4.0,
) -> ClimateSeason:
    def series(value: float | list[float]) -> tuple[float, ...]:
        return tuple(value) if isinstance(value, list) else tuple([value] * DAYS)

    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=series(rain),
        rain_source="teste",
        tmax_c=series(tmax),
        tmin_c=series(tmin),
        eto_mm=series(eto),
    )


def _index(year: int, mmdd: str) -> int:
    month, day = map(int, mmdd.split("-"))
    return (date(year, month, day) - date(year, 1, 1)).days


def _with(year: int, values: dict[str, float], base: float) -> list[float]:
    """Série com `base` todo dia e o valor de cada "MM-DD" de `values`."""
    series = [base] * DAYS
    for mmdd, value in values.items():
        series[_index(year, mmdd)] = value
    return series


def _dry(year: int, start: str, days: int, base: float = 5.0) -> list[float]:
    """Chove `base` todo dia, menos `days` dias seguidos a partir de `start`."""
    first = _index(year, start)
    return [0.0 if first <= i < first + days else base for i in range(DAYS)]


SERVICE = RaioXClimateService()


# --- bloco 5: chuva de um ano típico -------------------------------------------------------------


def test_should_average_the_january_to_july_rain_of_the_years() -> None:
    # 2023: 5 mm × 212 dias = 1060 mm; 2022: 3 mm × 212 = 636 mm. Média: 848 mm.
    result = SERVICE.typical_rain([_season(2023, 5.0), _season(2022, 3.0)])

    assert result is not None
    assert result.media_mm == 848.0
    assert result.anos == (2022, 2023)
    assert result.fonte == "teste"


def test_should_bring_the_end_of_rains_of_the_screen_three_rule() -> None:
    # Chove até 31/mar e depois nada: pela regra do fim das chuvas (grupo fim_das_chuvas), a janela
    # de 20 dias que começa em 31/mar soma 5 mm, menos que 10 (a de 30/mar soma 10): acaba 31/mar.
    rain = [5.0 if i <= _index(2023, "03-31") else 0.0 for i in range(DAYS)]

    result = SERVICE.typical_rain([_season(2023, rain)])

    assert result is not None
    assert result.fim_das_chuvas is not None
    assert result.fim_das_chuvas.mediana == "03-31"


def test_should_leave_out_a_season_that_does_not_cover_the_stored_window() -> None:
    short = replace(_season(2022), rain_mm=tuple([1.0] * 100))

    result = SERVICE.typical_rain([_season(2023, 5.0), short])

    assert result is not None
    assert (result.anos, result.media_mm) == ((2023,), 1060.0)


def test_should_have_no_typical_rain_without_seasons() -> None:
    assert SERVICE.typical_rain([]) is None


# --- bloco 6: maior veranico ---------------------------------------------------------------------


def test_should_find_the_longest_run_of_days_under_1_mm_from_march_to_may() -> None:
    seasons = [
        _season(2021, _dry(2021, "04-01", 12)),
        _season(2022, _dry(2022, "03-10", 25)),
        _season(2023, _dry(2023, "05-01", 7)),
    ]

    result = SERVICE.longest_dry_spell(seasons)

    assert result is not None
    assert (result.dias, result.ano, result.inicio) == (25, 2022, "03-10")
    assert result.total_anos == 3


def test_should_count_only_the_days_inside_the_window() -> None:
    # Seca de 20/fev a 9/mar: só os 9 dias de março contam (o veranico é de março a maio).
    result = SERVICE.longest_dry_spell([_season(2023, _dry(2023, "02-20", 18))])

    assert result is not None
    assert (result.dias, result.inicio) == (9, "03-01")


def test_should_count_a_day_with_less_than_1_mm_as_dry() -> None:
    # 0,9 mm é dia seco (abaixo de 1 mm); 1,0 mm não é.
    rain = _with(2023, {"04-10": 0.9, "04-11": 0.9, "04-12": 1.0}, base=5.0)

    result = SERVICE.longest_dry_spell([_season(2023, rain)])

    assert result is not None
    assert result.dias == 2


def test_should_keep_the_most_recent_year_on_a_tie() -> None:
    seasons = [_season(2020, _dry(2020, "04-01", 10)), _season(2023, _dry(2023, "03-05", 10))]

    result = SERVICE.longest_dry_spell(seasons)

    assert result is not None
    assert (result.dias, result.ano) == (10, 2023)


# --- bloco 7: calor de março a maio --------------------------------------------------------------


def test_should_count_the_years_with_a_day_at_35_c_or_more_from_march_to_may() -> None:
    seasons = [
        _season(2021, tmax=_with(2021, {"04-15": 35.0}, base=30.0)),
        _season(2022, tmax=_with(2022, {"02-15": 38.0, "06-01": 36.0}, base=30.0)),
        _season(2023, tmax=_with(2023, {"05-31": 35.4}, base=30.0)),
    ]

    result = SERVICE.heat_years(seasons)

    assert result is not None
    assert (result.anos_com_calor, result.total_anos, result.anos) == (2, 3, (2021, 2023))
    assert (result.temp_c, result.fonte) == (35.0, "nasa_power")


def test_should_say_zero_years_with_heat_when_it_never_reached_35_c() -> None:
    result = SERVICE.heat_years([_season(2023, tmax=34.9)])

    assert result is not None
    assert result.anos_com_calor == 0


# --- alerta de geada -----------------------------------------------------------------------------


def test_should_list_the_years_with_a_minimum_of_3_c_or_less_from_may_to_july() -> None:
    seasons = [
        _season(2021, tmin=_with(2021, {"06-20": 2.5}, base=10.0)),
        _season(2022, tmin=_with(2022, {"04-30": 1.0}, base=10.0)),
        _season(2023, tmin=_with(2023, {"07-01": 3.0}, base=10.0)),
    ]

    result = SERVICE.frost(seasons)

    assert result is not None
    assert (result.anos, result.total_anos) == ((2021, 2023), 3)
    assert (result.temp_c, result.menor_temp_c, result.fonte) == (3.0, 2.5, "nasa_power")


def test_should_have_no_frost_alert_without_a_cold_year() -> None:
    assert SERVICE.frost([_season(2023, tmin=4.1)]) is None


# --- alerta de chuva forte -----------------------------------------------------------------------


def test_should_give_the_mean_days_per_year_with_50_mm_or_more_in_february_and_march() -> None:
    seasons = [
        _season(2021, _with(2021, {"02-10": 50.0, "03-20": 72.0, "04-01": 90.0}, base=5.0)),
        _season(2022, _with(2022, {"01-15": 80.0}, base=5.0)),
        _season(2023, _with(2023, {"03-31": 49.9}, base=5.0)),
        _season(2024, _with(2024, {"02-29": 55.0}, base=5.0)),
    ]

    result = SERVICE.heavy_rain(seasons)

    assert result is not None
    assert (result.dias, result.total_anos, result.media_dias_ano) == (3, 4, 0.75)
    assert (result.limite_mm, result.fonte) == (50.0, "teste")


def test_should_have_no_heavy_rain_alert_when_it_is_too_rare() -> None:
    # 1 dia em 20 anos = 0,05 por ano, abaixo do mínimo de 0,1 (alertas_area).
    seasons = [_season(2005, _with(2005, {"02-10": 60.0}, base=5.0))]
    seasons += [_season(year) for year in range(2006, 2025)]

    assert SERVICE.heavy_rain(seasons) is None


# --- bloco 2: água que a terra guarda ------------------------------------------------------------


def _crop(kc: float = 1.2, florescer: int = 60, tipo: str = "grao") -> CropParams:
    return CropParams(
        id="milho_safrinha",
        nome="Milho sozinho",
        tipo=tipo,
        funcao="Grão",
        semeadura_limite_mes_dia="02-28",
        dias_florescer=florescer,
        ciclo_dias=120,
        kc_pico=kc,
        solo_palhada=20,
        solo_nitrogenio=0,
        solo_pragas=0,
        n_deixado_kg=0,
    )


def test_should_divide_the_stored_water_by_the_daily_use_at_flowering() -> None:
    # Semeadura 18/fev + 60 dias = floração em 19/abr. ETo de 5 mm em toda a janela de ±15 dias
    # (4 mm fora dela) × Kc 1,2 = 6 mm/dia; 75 mm ÷ 6 = 12,5 → cerca de 12 dias.
    def eto(year: int) -> list[float]:
        flor = _index(year, "04-19")
        return [5.0 if flor - 15 <= i <= flor + 15 else 4.0 for i in range(DAYS)]

    seasons = [_season(2022, eto=eto(2022)), _season(2023, eto=eto(2023))]

    result = SERVICE.flowering_water(
        seasons, _crop(), date(2027, 2, 18), cad_mm=75.0, reference_eto=lambda s: s.eto_mm
    )

    assert result.floracao == "04-19"
    assert (result.eto_mm_dia, result.kc, result.consumo_mm_dia) == (5.0, 1.2, 6.0)
    assert (result.cad_mm, result.dias) == (75.0, 12)
    assert (result.cultura, result.nome) == ("milho_safrinha", "Milho sozinho")


def test_should_have_no_days_for_fallow() -> None:
    fallow = replace(_crop(kc=0.0, florescer=0, tipo="pousio"), id="pousio", nome="Deixar parado")

    result = SERVICE.flowering_water(
        [_season(2023)], fallow, date(2027, 2, 18), 60.0, reference_eto=lambda s: s.eto_mm
    )

    assert (result.cad_mm, result.dias, result.cultura) == (60.0, None, None)


@pytest.mark.parametrize("year", [2023, 2024])
def test_should_work_in_leap_and_common_years(year: int) -> None:
    result = SERVICE.flowering_water(
        [_season(year)], _crop(), date(2027, 3, 3), 60.0, reference_eto=lambda s: s.eto_mm
    )

    assert result.floracao == (date(2027, 3, 3) + timedelta(days=60)).strftime("%m-%d")
    assert result.dias == 12  # 60 ÷ (4 × 1,2) = 12,5: arredonda para baixo (conservador)


def test_should_use_the_rules_injected() -> None:
    rules = load_default_rules()
    strict = replace(rules, alertas_area=replace(rules.alertas_area, geada_temp_c=5.0))

    result = RaioXClimateService(strict).frost([_season(2023, tmin=4.1)])

    assert result is not None
    assert result.temp_c == 5.0
