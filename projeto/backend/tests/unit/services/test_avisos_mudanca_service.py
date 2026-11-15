"""Grupos "O que mudou na sua área" e "Fora do comum" da tela Avisos (tarefa 0046).

Séries de teste (não são do GPM IMERG nem do NASA POWER): 8 mm e 30 °C por dia, com trechos
secos ou quentes onde cada teste precisa.
"""

from collections.abc import Callable
from datetime import date

import pytest

from app.models.avisos import FIQUE_DE_OLHO, PeriodoComparado
from app.models.climate import ClimateSeason
from app.services.avisos_mudanca_service import AvisosMudancaService, cycle_deficits
from app.services.climate_risk_service import ClimateRiskService
from app.services.water_balance_calculator import WaterBalanceCalculator
from tests.avisos_fakes import YEARS, crop, option, season

RECENT = tuple(y for y in YEARS if y >= 2020)
BEFORE = tuple(y for y in YEARS if y < 2020)


@pytest.fixture
def service() -> AvisosMudancaService:
    return AvisosMudancaService()


def _dry_between(first: date, last: date) -> Callable[[date], float]:
    def rain(day: date) -> float:
        return (
            0.0
            if (first.month, first.day)
            <= (day.month, day.day)
            <= (
                last.month,
                last.day,
            )
            else 8.0
        )

    return rain


def _by_type(group_avisos: tuple, tipo: str):  # type: ignore[no-untyped-def]
    return next(a for a in group_avisos if a.tipo == tipo)


# --- O que mudou -------------------------------------------------------------------------------


def test_should_compare_the_longest_dry_spell_of_march_to_may(
    service: AvisosMudancaService,
) -> None:
    seasons = [
        season(y, _dry_between(date(y, 4, 1), date(y, 4, 15 if y >= 2020 else 5))) for y in YEARS
    ]

    result = service.changes(seasons, best=None, deficits={})

    assert result is not None
    group, periodo = result
    assert periodo == PeriodoComparado(2020, 2024, 2005, 2019)
    assert group.ultima_leitura == date(2024, 7, 30)
    assert [a.tipo for a in group.avisos] == ["mudou_veranico"]
    aviso = group.avisos[0]
    assert (aviso.nivel, aviso.fontes, aviso.data) == (
        FIQUE_DE_OLHO,
        ("gpm_imerg",),
        date(2024, 7, 30),
    )
    assert aviso.valores == {"antes": 5.0, "recente": 15.0}


def test_should_not_show_a_change_below_the_minimum(service: AvisosMudancaService) -> None:
    # 5 dias contra 9: a diferença de 4 dias fica abaixo do mínimo de 5 do regras.yaml
    seasons = [
        season(y, _dry_between(date(y, 4, 1), date(y, 4, 9 if y >= 2020 else 5))) for y in YEARS
    ]

    result = service.changes(seasons, best=None, deficits={})

    assert result is not None
    assert result[0].avisos == ()


def test_should_compare_the_median_end_of_the_rains(service: AvisosMudancaService) -> None:
    # Chove até 30/abr nos anos de antes e até 10/abr nos recentes; depois, seco.
    seasons = [
        season(
            y,
            lambda d, y=y: 8.0 if (d.month, d.day) <= ((4, 10) if y >= 2020 else (4, 30)) else 0.0,
        )
        for y in YEARS
    ]

    group, _ = service.changes(seasons, best=None, deficits={}) or (None, None)

    assert group is not None
    aviso = _by_type(group.avisos, "mudou_fim_chuvas")
    assert aviso.valores == {"antes": "04-30", "recente": "04-10", "diferenca_dias": -20}
    assert aviso.fontes == ("gpm_imerg",)


def test_should_compare_the_days_of_heat_from_march_to_may(service: AvisosMudancaService) -> None:
    hot = {date(2020, 4, 10), date(2020, 4, 11), date(2021, 4, 2)}
    seasons = [
        season(
            y,
            tmax=lambda d: (
                36.0 if d in hot or (d.year >= 2022 and d.month == 3 and d.day <= 2) else 30.0
            ),
        )
        for y in YEARS
    ]

    group, _ = service.changes(seasons, best=None, deficits={}) or (None, None)

    # Recentes: 2 + 1 + 2 + 2 + 2 = 9 dias em 5 anos (1,8 por ano); antes: nenhum.
    assert group is not None
    aviso = _by_type(group.avisos, "mudou_calor")
    assert aviso.valores == {"antes": 0.0, "recente": 1.8, "temp_c": 35.0}
    assert aviso.fontes == ("nasa_power",)


def test_should_compare_the_water_shortage_of_the_best_option(
    service: AvisosMudancaService,
) -> None:
    seasons = [season(y) for y in YEARS]
    best = option("milho_braquiaria", "Milho com braquiária")
    deficits = {y: (80.0 if y >= 2020 else 40.0) for y in YEARS}

    group, _ = service.changes(seasons, best=best, deficits=deficits) or (None, None)

    assert group is not None
    aviso = _by_type(group.avisos, "mudou_falta_agua")
    assert aviso.valores == {
        "antes": 40.0,
        "recente": 80.0,
        "cultura": "milho_braquiaria",
        "nome": "Milho com braquiária",
    }
    assert aviso.fontes == ("gpm_imerg", "nasa_power")

    small = {y: (60.0 if y >= 2020 else 40.0) for y in YEARS}
    group, _ = service.changes(seasons, best=best, deficits=small) or (None, None)
    assert group is not None
    assert all(a.tipo != "mudou_falta_agua" for a in group.avisos)


def test_should_compare_the_years_the_best_option_worked(service: AvisosMudancaService) -> None:
    seasons = [season(y) for y in YEARS]
    best = option("milho_safrinha", "Milho sozinho", bad_years=(2008, 2020, 2021, 2023))

    group, _ = service.changes(seasons, best=best, deficits={}) or (None, None)

    assert group is not None
    aviso = _by_type(group.avisos, "mudou_deu_certo")
    assert aviso.valores == {
        "antes_bons": 14,
        "antes_total": 15,
        "recente_bons": 2,
        "recente_total": 5,
        "cultura": "milho_safrinha",
        "nome": "Milho sozinho",
    }

    # 1 ano ruim em 5 (80%) contra 14 de 15 (93%): 13 pontos, abaixo do mínimo de 25
    one_bad = option("milho_safrinha", "Milho sozinho", bad_years=(2008, 2020))
    group, _ = service.changes(seasons, best=one_bad, deficits={}) or (None, None)
    assert group is not None
    assert all(a.tipo != "mudou_deu_certo" for a in group.avisos)


def test_should_not_compare_without_recent_years(service: AvisosMudancaService) -> None:
    assert service.changes([season(y) for y in BEFORE], best=None, deficits={}) is None
    assert service.changes([], best=None, deficits={}) is None


# --- Fora do comum -----------------------------------------------------------------------------


def _records_series() -> list[ClimateSeason]:
    def rain(year: int) -> Callable[[date], float]:
        if year == 2021:  # a chuva para em 4/abr
            return lambda d: 8.0 if (d.month, d.day) <= (4, 4) else 0.0
        if year == 2017:  # outono fraco: 2 mm por dia de março a maio
            return lambda d: 2.0 if 3 <= d.month <= 5 else (8.0 if d.month < 3 else 0.0)
        return lambda d: 8.0 if d.month <= 5 else 0.0

    def tmax(year: int) -> Callable[[date], float]:
        hot_days = {2010: 2, 2016: 5}.get(year, 0)
        return lambda d: 36.0 if d.month == 4 and d.day <= hot_days else 30.0

    return [season(y, rain(y), tmax(y)) for y in YEARS]


def test_should_list_the_records_of_the_20_years(service: AvisosMudancaService) -> None:
    group = service.records(_records_series())

    assert group is not None
    assert group.ultima_leitura == date(2024, 7, 30)
    assert [a.tipo for a in group.avisos] == [
        "recorde_veranico",
        "recorde_outono_seco",
        "recorde_fim_chuvas",
        "recorde_calor",
    ]
    veranico, outono, fim, calor = group.avisos
    assert veranico.valores == {"dias": 57, "ano": 2021, "inicio": "04-05"}
    assert outono.valores == {"chuva_mm": 184.0, "ano": 2017, "media_mm": 685.6}
    assert fim.valores == {"dia": "04-04", "ano": 2021}
    assert calor.valores == {"dias": 5, "ano": 2016, "temp_c": 35.0}
    assert {a.nivel for a in group.avisos} == {FIQUE_DE_OLHO}
    assert (veranico.fontes, calor.fontes) == (("gpm_imerg",), ("nasa_power",))


def test_should_leave_out_the_heat_record_when_no_year_had_heat(
    service: AvisosMudancaService,
) -> None:
    group = service.records([season(y) for y in YEARS])

    assert group is not None
    assert all(a.tipo != "recorde_calor" for a in group.avisos)


def test_should_have_no_records_without_the_series(service: AvisosMudancaService) -> None:
    assert service.records([]) is None


# --- falta de água no ciclo (o balanço do motor) -----------------------------------------------


def test_should_compute_the_cycle_water_shortage_with_the_engine_bucket() -> None:
    wb = WaterBalanceCalculator()
    risk = ClimateRiskService(wb)
    milho = crop(ciclo=100, kc=1.0)
    need = 4.0 * sum(wb.build_kc_curve(100, 1.0))  # ETo de 4 mm por dia × Kc
    dry, wet = season(2016, rain=lambda _d: 0.0), season(2017, rain=lambda _d: 100.0)

    deficits = cycle_deficits(milho, [dry, wet], date(2027, 2, 18), 60.0, risk)
    full_bucket = cycle_deficits(milho, [dry], date(2027, 2, 18), 60.0, risk, {2016: 1.0})

    # Sem chuva, a planta só usa o balde (metade da CAD de 60 mm; com o SMAP cheio, a CAD inteira)
    assert deficits == {2016: round(need - 30.0, 1), 2017: 0.0}
    assert full_bucket == {2016: round(need - 60.0, 1)}


def test_should_have_no_water_shortage_for_fallow() -> None:
    risk = ClimateRiskService(WaterBalanceCalculator())
    pousio = crop("pousio", "pousio", ciclo=0, florescer=0, kc=0.0)

    assert cycle_deficits(pousio, [season(2016)], date(2027, 2, 18), 60.0, risk) == {}
