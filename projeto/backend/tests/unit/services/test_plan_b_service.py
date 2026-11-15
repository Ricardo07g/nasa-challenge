"""Unit tests for PlanBService (Plano A / Plano B da aba "Plano de 3 anos", tarefa 0045)."""

from dataclasses import replace
from datetime import date, timedelta

import pytest

from app.models.climate import ClimateSeason
from app.models.recomendacao import AnoDetalhe, NotasOpcao, ResultadoOpcao
from app.repositories.rules_repository import load_default_rules
from app.services.plan_b_service import PlanBService

DAYS = 212
SOWING = date(2027, 2, 18)


def _season(year: int, rain_by_day: dict[date, float] | None = None) -> ClimateSeason:
    start = date(year, 1, 1)
    rain_by_day = rain_by_day or {}
    rain = tuple(rain_by_day.get(start + timedelta(days=i), 0.0) for i in range(DAYS))
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=start,
        rain_mm=rain,
        rain_source="gpm_imerg",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
    )


def _option(crop_id: str, bons: dict[int, bool], final: float = 60.0) -> ResultadoOpcao:
    detalhe = tuple(
        AnoDetalhe(
            ano=ano,
            bom=bom,
            fase_critica=date(ano, 4, 18),
            dias_sem_chuva=0,
            enso=None,
            texto="",
        )
        for ano, bom in sorted(bons.items())
    )
    notas = NotasOpcao(seguranca=final, futuro=None, solo=final, renda=final, final=final)
    return ResultadoOpcao(
        id=crop_id,
        nome=crop_id.capitalize(),
        na_janela=True,
        data_limite="2027-02-28",
        anos_bons_chuva=sum(bons.values()),
        total_anos=len(bons),
        faixa_anos=tuple(bom for _, bom in sorted(bons.items())),
        rotulo_chuva="medio",
        texto_chuva="",
        futuro=None,
        da_grao=True,
        rotulo_renda="bom",
        texto_renda="",
        texto_risco="",
        rotulo_terra="bom",
        texto_terra="",
        notas=notas,
        notas_seco=notas,
        porque=(),
        como_fazer=(),
        anos_detalhe=detalhe,
    )


# --- chuva antes da semeadura ------------------------------------------------------------------


def test_should_sum_the_rain_of_the_15_days_before_sowing_without_the_sowing_day() -> None:
    # 18/fev: os 15 dias vão de 3/fev a 17/fev. A chuva do próprio dia de plantar fica de fora.
    rain = {date(2010, 2, 3): 10.0, date(2010, 2, 17): 5.0, date(2010, 2, 18): 99.0}
    rain[date(2010, 2, 2)] = 50.0  # 16 dias antes: fora

    totals = PlanBService().pre_sowing_rain([_season(2010, rain)], SOWING)

    assert totals == {2010: 15.0}


def test_should_skip_a_season_that_does_not_cover_the_whole_window() -> None:
    late = replace(_season(2011), start_date=date(2011, 2, 10))

    assert PlanBService().pre_sowing_rain([late], SOWING) == {}


# --- limite de chuva ---------------------------------------------------------------------------


def test_should_find_the_rain_limit_that_separates_the_failed_years() -> None:
    # 10 anos; as 4 falhas são os 4 anos mais secos: o limite fica entre 40 e 60 mm.
    rain = {2005 + i: float(10 * (i + 1)) for i in range(10)}  # 10, 20, ..., 100 mm
    outcomes = {year: rain[year] > 40.0 for year in rain}

    limite = PlanBService().rain_limit(outcomes, rain)

    assert limite is not None
    assert limite.chuva_mm == 45  # entre 40 e 50 mm
    assert (limite.anos_marcados, limite.falhas_marcadas, limite.falhas) == (4, 4, 4)
    assert limite.total == 10
    assert limite.dias == 15
    assert limite.chance_pct == pytest.approx(0.5, abs=0.1)  # 1 em 210
    assert limite.separa is True
    assert limite.motivo is None


def test_should_not_give_a_number_with_too_few_failed_years() -> None:
    rain = {2005 + i: float(10 * (i + 1)) for i in range(10)}
    outcomes = {year: rain[year] > 20.0 for year in rain}  # 2 falhas, as mais secas

    limite = PlanBService().rain_limit(outcomes, rain)

    assert limite is not None
    assert limite.separa is False
    assert limite.motivo == "poucas_falhas"


def test_should_not_give_a_number_when_the_failures_are_spread_over_wet_and_dry_years() -> None:
    rain = {2005 + i: float(10 * (i + 1)) for i in range(10)}
    falhas = {2005, 2008, 2011, 2014}  # 10, 40, 70 e 100 mm
    outcomes = {year: year not in falhas for year in rain}

    limite = PlanBService().rain_limit(outcomes, rain)

    assert limite is not None
    assert limite.separa is False
    assert limite.motivo == "nao_separa"


def test_should_refuse_a_limit_that_could_come_from_chance() -> None:
    # 20 anos e 9 falhas; os 10 mais secos têm 6 falhas: pega 67% das falhas e 60% dos marcados
    # são falhas, mas marcar 10 anos ao acaso pega 6 ou mais falhas em ~18% das vezes (> 10%).
    rain = {2005 + i: float(10 * (i + 1)) for i in range(20)}
    falhas = {2005, 2006, 2007, 2008, 2009, 2010, 2016, 2019, 2023}
    outcomes = {year: year not in falhas for year in rain}

    limite = PlanBService().rain_limit(outcomes, rain)

    assert limite is not None
    assert (limite.anos_marcados, limite.falhas_marcadas) == (6, 6)
    assert limite.separa is True  # os 6 mais secos são todos falhas: aqui separa

    misturado = {2005, 2007, 2009, 2011, 2012, 2014, 2016, 2019, 2023}
    limite = PlanBService().rain_limit({y: y not in misturado for y in rain}, rain)

    assert limite is not None
    assert limite.separa is False
    assert limite.chance_pct > 10.0


def test_should_never_cut_between_two_years_with_the_same_rain() -> None:
    rain = {2005: 10.0, 2006: 10.0, 2007: 30.0, 2008: 40.0, 2009: 50.0, 2010: 60.0}
    outcomes = {2005: False, 2006: True, 2007: True, 2008: True, 2009: True, 2010: True}

    limite = PlanBService().rain_limit(outcomes, rain)

    assert limite is not None
    assert limite.anos_marcados != 1  # 2005 e 2006 têm a mesma chuva


def test_should_have_no_limit_when_the_crop_never_failed() -> None:
    rain = {2005 + i: float(i) for i in range(10)}

    assert PlanBService().rain_limit({year: True for year in rain}, rain) is None


def test_should_use_the_criterion_from_injected_rules() -> None:
    base = load_default_rules()
    rules = replace(base, plano_b=replace(base.plano_b, anos_falha_min=1))
    rain = {2005 + i: float(10 * (i + 1)) for i in range(10)}
    outcomes = {year: year != 2005 for year in rain}  # 1 falha, a mais seca

    limite = PlanBService(rules).rain_limit(outcomes, rain)

    assert limite is not None
    assert limite.separa is True
    assert limite.chuva_mm == 15


# --- Plano A / Plano B -------------------------------------------------------------------------

YEARS = list(range(2005, 2015))


def _rainy_seasons() -> list[ClimateSeason]:
    return [_season(year, {date(year, 2, 10): float(year - 2000)}) for year in YEARS]


def test_should_pick_as_plan_b_the_crop_that_worked_most_in_the_years_plan_a_failed() -> None:
    falhas_a = {2006, 2009, 2012}
    milho = _option("milho_braquiaria", {y: y not in falhas_a for y in YEARS}, final=72.0)
    sorgo = _option("sorgo", {y: y not in {2006, 2009} for y in YEARS}, final=65.0)  # 1 de 3
    crota = _option("crotalaria", {y: y != 2010 for y in YEARS}, final=64.0)  # 3 de 3
    milheto = _option("milheto", {y: y != 2011 for y in YEARS}, final=56.0)  # 3 de 3

    ab = PlanBService().plan_ab(
        "milho_braquiaria", [milho, sorgo, crota, milheto], _rainy_seasons(), SOWING
    )

    assert ab is not None
    assert (ab.cultura_a, ab.nome_a, ab.falhas_a, ab.total) == (
        "milho_braquiaria",
        "Milho_braquiaria",
        3,
        10,
    )
    assert (ab.cultura_b, ab.b_bons_nas_falhas) == ("crotalaria", 3)  # empate: a maior nota final
    assert ab.motivo is None
    assert ab.limite is not None  # a análise sai sempre que A falhou
    assert ab.limite.falhas == 3


def test_should_have_no_plan_b_when_plan_a_never_failed() -> None:
    milheto = _option("milheto", {y: True for y in YEARS})
    sorgo = _option("sorgo", {y: y % 2 == 0 for y in YEARS})

    ab = PlanBService().plan_ab("milheto", [milheto, sorgo], _rainy_seasons(), SOWING)

    assert ab is not None
    assert (ab.cultura_b, ab.motivo, ab.limite) == (None, "nunca_falhou", None)
    assert ab.falhas_a == 0


def test_should_have_no_plan_b_when_no_other_crop_worked_in_those_years() -> None:
    milho = _option("milho_safrinha", {y: y != 2007 for y in YEARS})
    sorgo = _option("sorgo", {y: y != 2007 for y in YEARS})

    ab = PlanBService().plan_ab("milho_safrinha", [milho, sorgo], _rainy_seasons(), SOWING)

    assert ab is not None
    assert (ab.cultura_b, ab.motivo) == (None, "nenhuma_melhor")


def test_should_say_plan_a_is_fallow_without_plan_b() -> None:
    milho = _option("milho_safrinha", {y: True for y in YEARS})

    ab = PlanBService().plan_ab("pousio", [milho], _rainy_seasons(), SOWING, nome_a="Deixar parado")

    assert ab is not None
    assert (ab.cultura_a, ab.nome_a, ab.cultura_b, ab.motivo) == (
        "pousio",
        "Deixar parado",
        None,
        "pousio",
    )


def test_should_have_no_plan_a_and_b_for_a_crop_out_of_the_sowing_window() -> None:
    sorgo = _option("sorgo", {y: True for y in YEARS})

    assert PlanBService().plan_ab("milho_safrinha", [sorgo], _rainy_seasons(), SOWING) is None
