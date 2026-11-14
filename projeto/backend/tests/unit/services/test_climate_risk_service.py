"""Unit tests for ClimateRiskService (janela, simulação dos 20 anos e clima futuro do CMIP6)."""

from dataclasses import replace
from datetime import date

import pytest

from app.models.climate import ClimateSeason, Cmip6Delta
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
        produtividade_padrao_sc_ha=95.0,
        preco_padrao_saca=55.0,
        custo_padrao_ha=3200.0,
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


@pytest.mark.parametrize(
    ("isna", "expected"),
    [(0.80, 0.0), (0.65, 0.0), (0.64, 0.30), (0.55, 0.30), (0.54, 0.60), (0.10, 0.60)],
)
def test_should_use_loss_steps_from_prd_when_computing_loss_factor(
    isna: float, expected: float
) -> None:
    # PRD 7.5: 0% com ISNA >= 0,65; 30% entre 0,55 e 0,65; 60% abaixo de 0,55
    service = ClimateRiskService(WaterBalanceCalculator())

    assert service.loss_factor(isna) == expected


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
        crop=cover, seasons=seasons, semeadura=date(2027, 2, 18), cad_mm=40.0, smap_wetness=1.0
    )
    futuro = service.simulate_future_cmip6(
        crop=cover,
        seasons=seasons,
        deltas=_deltas("IGUAL", rain_pct=0.0),
        semeadura=date(2027, 2, 18),
        cad_mm=40.0,
        smap_wetness=1.0,
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


def test_should_use_loss_steps_from_injected_rules() -> None:
    service = ClimateRiskService(
        WaterBalanceCalculator(), rules=_rules_with_clima(perda_fator_alta=0.90)
    )

    assert service.loss_factor(0.10) == 0.90
