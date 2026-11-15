"""Unit tests for ClimateRiskService (janela, simulação dos 20 anos e clima futuro do CMIP6)."""

from dataclasses import replace
from datetime import date

import pytest

from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.crop_option import CropParams
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules
from app.services.climate_risk_service import ClimateRiskService
from app.services.water_balance_calculator import WaterBalanceCalculator

DAYS = 212


def _make_crop(
    crop_id: str = "milho_safrinha",
    tipo: str = "grao",
    limite: str | None = "02-28",
) -> CropParams:
    return CropParams(
        id=crop_id,
        nome="Milho safrinha",
        tipo=tipo,
        funcao="Grão",
        semeadura_limite_mes_dia=limite,
        dias_florescer=50,
        ciclo_dias=90,
        kc_pico=1.15,
        solo_palhada=20,
        solo_nitrogenio=0,
        solo_pragas=0,
        n_deixado_kg=0,
        como_fazer=("Plantar no limpo",),
    )


def _make_season(
    year: int,
    daily_rain: float,
    daily_tmax: float = 30.0,
    eto: float | None = 4.2,
) -> ClimateSeason:
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=date(year, 1, 1),
        lat=-18.95,
        rain_mm=tuple([daily_rain] * DAYS),
        rain_source="nasa_power",
        tmax_c=tuple([daily_tmax] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
        eto_mm=tuple([eto] * DAYS) if eto is not None else (),
    )


def _deltas(model: str, rain_pct: float, tmax_c: float = 0.0) -> list[Cmip6Delta]:
    return [
        Cmip6Delta(model=model, scenario="ssp245", month=m, rain_pct=rain_pct, tmax_c=tmax_c)
        for m in range(1, 13)
    ]


def _rules_with_clima(**changes: float) -> Regras:
    base = load_default_rules()
    return replace(base, clima=replace(base.clima, **changes))


def test_should_accept_sowing_date_when_on_or_before_zarc_deadline() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop(limite="02-28")

    assert service.is_within_window(crop, date(2027, 2, 18)) is True
    assert service.is_within_window(crop, date(2027, 2, 28)) is True


def test_should_reject_sowing_date_when_after_zarc_deadline() -> None:
    # PRD §11: colheita tarde (semeadura 3/mar), milho até 28/fev -> fora da janela
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop(limite="02-28")

    assert service.is_within_window(crop, date(2027, 3, 3)) is False


def test_should_detect_stress_when_drought_occurs_during_flowering() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop()
    wet_season = _make_season(2020, daily_rain=8.0)
    dry_season = _make_season(2021, daily_rain=0.0)

    results = service.simulate_historical(
        crop=crop, seasons=[wet_season, dry_season], semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert [r.aperto for r in results] == [False, True]
    assert results[1].isna < 0.55


def test_should_detect_stress_when_three_hot_days_even_with_enough_water() -> None:
    # PRD §11: ISNA alto e 3 dias com 36 °C -> ano com aperto (calor)
    service = ClimateRiskService(WaterBalanceCalculator())
    hot_wet_season = _make_season(2021, daily_rain=10.0, daily_tmax=36.0)

    [result] = service.simulate_historical(
        crop=_make_crop(), seasons=[hot_wet_season], semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert result.isna >= 0.65
    assert result.dias_calor >= 3
    assert result.aperto is True


def test_should_tell_whether_the_stress_came_from_water_or_from_heat() -> None:
    # P1: o detalhe de cada ano diz por que o ano apertou, sem repetir a regra do aperto
    service = ClimateRiskService(WaterBalanceCalculator())
    seasons = [
        _make_season(2020, daily_rain=8.0),
        _make_season(2021, daily_rain=0.0),
        _make_season(2022, daily_rain=10.0, daily_tmax=36.0),
        _make_season(2023, daily_rain=0.0, daily_tmax=36.0),
    ]

    results = service.simulate_historical(
        crop=_make_crop(), seasons=seasons, semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert [(r.falta_agua, r.calor) for r in results] == [
        (False, False),
        (True, False),
        (False, True),
        (True, True),
    ]
    assert [r.aperto for r in results] == [False, True, True, True]


def test_should_judge_water_shortage_of_cover_crops_by_their_own_isna_threshold() -> None:
    # PRD 7.2 item 4: a cobertura falha com ISNA abaixo de 0,50 (o grão, abaixo de 0,55)
    rules = _rules_with_clima(isna_cobertura=0.0)
    service = ClimateRiskService(WaterBalanceCalculator(), rules)
    dry_season = _make_season(2021, daily_rain=0.0)

    [result] = service.simulate_historical(
        crop=_make_crop(tipo="cobertura"),
        seasons=[dry_season],
        semeadura=date(2027, 2, 18),
        cad_mm=60.0,
    )

    assert (result.falta_agua, result.calor, result.aperto) == (False, False, False)


def test_should_use_the_zarc_isna_of_the_crop_when_it_has_its_own() -> None:
    # Tarefa 0066: o ZARC de MG tem um ISNA por cultura (sorgo 0,45 na floração); a cultura sem
    # ISNA próprio fica com o do tipo (grão 0,55). Mesmo ano e mesmo ISNA para as duas culturas.
    base = load_default_rules()
    seasons = [_make_season(2021, daily_rain=1.3)]
    milho = _make_crop("milho_safrinha")
    sorgo = _make_crop("sorgo")
    service = ClimateRiskService(
        WaterBalanceCalculator(),
        replace(base, clima=replace(base.clima, isna_grao=0.99, isna_por_cultura={"sorgo": 0.0})),
    )

    [r_milho] = service.simulate_historical(milho, seasons, date(2027, 2, 18), cad_mm=60.0)
    [r_sorgo] = service.simulate_historical(sorgo, seasons, date(2027, 2, 18), cad_mm=60.0)

    assert r_milho.isna == pytest.approx(r_sorgo.isna)
    assert (r_milho.falta_agua, r_sorgo.falta_agua) == (True, False)


def test_should_ship_the_zarc_isna_of_each_crop() -> None:
    # Portarias do ZARC de MG: consórcio 0,50 e sorgo 0,45 na fase III; milheto 0,60 na fase I.
    clima = load_default_rules().clima

    assert clima.isna_por_cultura == {"milho_braquiaria": 0.50, "sorgo": 0.45, "milheto": 0.60}
    assert clima.isna_min("milho_safrinha", cobertura=False) == 0.55
    assert clima.isna_min("sorgo", cobertura=False) == 0.45
    assert clima.isna_min("milheto", cobertura=True) == 0.60
    assert clima.isna_min("crotalaria", cobertura=True) == 0.50


def test_should_compute_eto_from_temperatures_and_latitude_when_season_has_no_eto() -> None:
    wb = WaterBalanceCalculator()
    service = ClimateRiskService(wb)
    season = _make_season(2021, daily_rain=0.0, daily_tmax=30.0, eto=None)

    eto = service.reference_eto(season)

    assert len(eto) == DAYS
    assert eto[0] == wb.hargreaves_eto(t_max=30.0, t_min=18.0, lat_deg=-18.95, day_of_year=1)
    assert eto[59] == wb.hargreaves_eto(t_max=30.0, t_min=18.0, lat_deg=-18.95, day_of_year=60)


def test_should_keep_given_eto_when_season_already_has_it() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    season = _make_season(2021, daily_rain=0.0, eto=4.2)

    assert service.reference_eto(season) == tuple([4.2] * DAYS)


def test_should_return_none_when_no_cmip6_deltas_available() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    seasons = [_make_season(2005 + i, daily_rain=6.0) for i in range(4)]

    futuro = service.simulate_future_cmip6(
        crop=_make_crop(), seasons=seasons, deltas=[], semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert futuro is None


def test_should_report_mean_min_and_max_across_models_when_deltas_given() -> None:
    # PRD 7.3: nota = média dos modelos; mostrar a faixa entre modelos (mínimo e máximo)
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop()
    seasons = [_make_season(2005 + i, daily_rain=8.0) for i in range(10)]
    deltas = _deltas("IGUAL", rain_pct=0.0) + _deltas("SECO", rain_pct=-100.0)

    futuro = service.simulate_future_cmip6(
        crop=crop, seasons=seasons, deltas=deltas, semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert futuro is not None
    assert futuro.anos_bons_max == 10  # modelo sem mudança: igual ao passado
    assert futuro.anos_bons_min == 0  # modelo sem chuva: todo ano com aperto
    assert futuro.anos_bons_media == 5
    assert futuro.modelos == 2
    assert futuro.cenario == "ssp245"


def test_should_apply_delta_only_to_its_month_when_projecting() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop()
    seasons = [_make_season(2005 + i, daily_rain=8.0) for i in range(3)]
    # Seca só em dezembro, fora do ciclo (fev a mai): não pode mudar nada.
    deltas = [
        Cmip6Delta(
            model="M1", scenario="ssp245", month=m, rain_pct=-100.0 if m == 12 else 0.0, tmax_c=0.0
        )
        for m in range(1, 13)
    ]

    futuro = service.simulate_future_cmip6(
        crop=crop, seasons=seasons, deltas=deltas, semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert futuro is not None
    assert futuro.anos_bons_media == 3


def test_should_start_future_bucket_like_historical_when_smap_wetness_given() -> None:
    # A simulação futura precisa começar o balde igual à histórica; senão a diferença
    # entre hoje e 2050 vem da condição inicial, não do clima.
    service = ClimateRiskService(WaterBalanceCalculator())
    cover = _make_crop(crop_id="milheto", tipo="cobertura", limite="03-15")
    seasons = [_make_season(2005, daily_rain=0.0, eto=4.0)]

    [hist] = service.simulate_historical(
        crop=cover,
        seasons=seasons,
        semeadura=date(2027, 2, 18),
        cad_mm=40.0,
        smap_wetness_by_year={2005: 1.0},
    )
    futuro = service.simulate_future_cmip6(
        crop=cover,
        seasons=seasons,
        deltas=_deltas("IGUAL", rain_pct=0.0),
        semeadura=date(2027, 2, 18),
        cad_mm=40.0,
        smap_wetness_by_year={2005: 1.0},
    )

    assert hist.aperto is False
    assert futuro is not None
    assert futuro.anos_bons_media == 1


def test_should_raise_eto_when_tmax_rises_in_future_projection() -> None:
    wb = WaterBalanceCalculator()
    service = ClimateRiskService(wb)
    season = _make_season(2005, daily_rain=0.0, eto=None)

    projected = service.project_season(season, _deltas("QUENTE", rain_pct=0.0, tmax_c=2.0))

    assert projected.tmax_c[0] == pytest.approx(32.0)
    assert projected.eto_mm[0] > service.reference_eto(season)[0]
    assert projected.eto_mm[0] == pytest.approx(
        wb.hargreaves_eto(t_max=32.0, t_min=18.0, lat_deg=-18.95, day_of_year=1), abs=0.01
    )


def test_should_shift_tmin_and_use_it_in_the_eto_when_delta_has_tmin() -> None:
    # Hargreaves-Samani usa máxima e mínima: com o delta da mínima (tasmin), as duas mudam.
    wb = WaterBalanceCalculator()
    service = ClimateRiskService(wb)
    season = _make_season(2005, daily_rain=0.0, eto=None)
    deltas = [
        Cmip6Delta("MODELO-TESTE", "ssp245", m, rain_pct=0.0, tmax_c=2.0, tmin_c=3.0)
        for m in range(1, 13)
    ]

    projected = service.project_season(season, deltas)

    assert projected.tmin_c[0] == pytest.approx(21.0)
    assert projected.eto_mm[0] == pytest.approx(
        wb.hargreaves_eto(t_max=32.0, t_min=21.0, lat_deg=-18.95, day_of_year=1), abs=0.01
    )


def test_should_keep_observed_tmin_in_months_whose_delta_has_no_tmin() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    season = _make_season(2005, daily_rain=0.0, eto=None)

    projected = service.project_season(season, _deltas("QUENTE", rain_pct=0.0, tmax_c=2.0))

    assert projected.tmin_c == season.tmin_c


def test_should_use_heat_threshold_from_injected_rules() -> None:
    # regras.yaml: calor de 29 °C em vez de 35 °C -> máxima de 30 °C já conta como dia quente
    service = ClimateRiskService(
        WaterBalanceCalculator(), rules=_rules_with_clima(calor_temp_c=29.0)
    )
    wet_season = _make_season(2021, daily_rain=10.0, daily_tmax=30.0)

    [result] = service.simulate_historical(
        crop=_make_crop(), seasons=[wet_season], semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert result.dias_calor >= 3
    assert result.aperto is True


# --- balde inicial pelo SMAP (PRD 7.2, R3.3) ---------------------------------------------------


@pytest.mark.parametrize(
    ("wetness", "fraction"),
    [(None, 0.5), (0.62, 0.62), (0.05, 0.2), (1.0, 1.0)],
)
def test_should_start_the_bucket_at_half_or_at_the_smap_wetness_with_a_floor(
    wetness: float | None, fraction: float
) -> None:
    # PRD 7.2 e US-03: arm0 = CAD × sm_rootzone_wetness, com piso de 20%; sem SMAP, 50% da CAD.
    assert ClimateRiskService(WaterBalanceCalculator()).initial_bucket_fraction(wetness) == fraction


def _smap(day: date, wetness: float) -> SmapSoilMoisture:
    # Valores de teste (não do SMAP): só o dia e a umidade relativa importam aqui.
    return SmapSoilMoisture(day, -18.95, -48.15, 0.3, wetness, "teste")


def test_should_take_the_smap_wetness_of_the_sowing_day_of_each_year() -> None:
    series = [
        _smap(date(2016, 2, 8), 0.9),  # dia da faixa "cedo": não é o da semeadura pedida
        _smap(date(2016, 2, 18), 0.61),
        _smap(date(2017, 2, 18), 0.33),
        _smap(date(2017, 3, 3), 0.8),
    ]

    by_year = ClimateRiskService(WaterBalanceCalculator()).sowing_day_wetness(
        series, date(2027, 2, 18)
    )

    assert by_year == {2016: 0.61, 2017: 0.33}


def test_should_start_each_year_with_its_own_smap_and_half_without_it() -> None:
    # Sem chuva: o balde inicial decide o estabelecimento da cobertura nos primeiros 30 dias.
    service = ClimateRiskService(WaterBalanceCalculator())
    cover = _make_crop(crop_id="milheto", tipo="cobertura", limite="03-15")
    seasons = [_make_season(year, daily_rain=0.0, eto=4.0) for year in (2015, 2016, 2017)]

    resultados = service.simulate_historical(
        crop=cover,
        seasons=seasons,
        semeadura=date(2027, 2, 18),
        cad_mm=40.0,
        smap_wetness_by_year={2016: 1.0, 2017: 0.05},
    )
    sem_smap = service.simulate_historical(
        crop=cover, seasons=seasons, semeadura=date(2027, 2, 18), cad_mm=40.0
    )

    isna = {r.ano: r.isna for r in resultados}
    base = {r.ano: r.isna for r in sem_smap}
    assert isna[2015] == base[2015]  # sem SMAP no ano: 50% da CAD, como antes
    assert isna[2016] > base[2016]  # terra cheia no dia de plantar
    assert isna[2017] < base[2017]  # terra seca (piso de 20%)


def test_should_sum_crop_need_actual_use_and_rain_over_the_cycle_of_each_year() -> None:
    # Tarefa 0044 (linha "Água"): consumo da cultura (ETc = ETo x Kc), o que ela usou (ETr) e a
    # chuva, somados nos dias do ciclo. Sem chuva e com o balde vazio, ETr = 0 e falta tudo.
    wb = WaterBalanceCalculator()
    service = ClimateRiskService(wb)
    crop = _make_crop()
    dry = _make_season(2005, daily_rain=0.0, eto=4.0)
    wet = _make_season(2006, daily_rain=10.0, eto=4.0)

    seco, chuvoso = service.simulate_historical(
        crop=crop, seasons=[dry, wet], semeadura=date(2027, 2, 18), cad_mm=0.0
    )

    etc_esperado = sum(4.0 * kc for kc in wb.build_kc_curve(crop.ciclo_dias, crop.kc_pico))
    assert seco.etc_mm == pytest.approx(etc_esperado, abs=0.1)
    assert seco.etr_mm == 0.0
    assert seco.chuva_mm == 0.0
    assert chuvoso.etc_mm == pytest.approx(etc_esperado, abs=0.1)
    assert chuvoso.etr_mm == pytest.approx(etc_esperado, abs=0.1)
    assert chuvoso.chuva_mm == pytest.approx(10.0 * crop.ciclo_dias)


def test_should_give_each_model_its_own_simulated_years_for_the_future() -> None:
    # A linha "Água" de 2041-2060 precisa da falta de água de cada modelo, não só dos anos bons.
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop()
    seasons = [_make_season(2005 + i, daily_rain=8.0) for i in range(3)]
    deltas = _deltas("IGUAL", rain_pct=0.0) + _deltas("SECO", rain_pct=-100.0)

    por_modelo = service.simulate_future_by_model(
        crop=crop, seasons=seasons, deltas=deltas, semeadura=date(2027, 2, 18), cad_mm=60.0
    )

    assert set(por_modelo) == {"IGUAL", "SECO"}
    assert [r.ano for r in por_modelo["SECO"]] == [2005, 2006, 2007]
    assert all(r.chuva_mm == 0.0 for r in por_modelo["SECO"])
    assert all(not r.aperto for r in por_modelo["IGUAL"])
    futuro = service.summarize_future(por_modelo, scenario="ssp245")
    assert futuro is not None
    assert (futuro.anos_bons_min, futuro.anos_bons_max, futuro.modelos) == (0, 3, 2)
    assert service.summarize_future({}, scenario="ssp245") is None
