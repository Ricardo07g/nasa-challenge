"""Unit tests for ClimateRiskService (window validation, 20-year simulation, and CMIP6)."""

from datetime import date

from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.crop_option import CropParams
from app.services.climate_risk_service import ClimateRiskService
from app.services.water_balance_calculator import WaterBalanceCalculator


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
        palhada_score=55,
        n_deixado_kg=0,
        nematoide_efeito=-15,
        produtividade_padrao_sc_ha=95.0,
        preco_padrao_saca=55.0,
        custo_padrao_ha=3200.0,
        como_fazer=("Plantar no limpo",),
    )


def _make_season(year: int, daily_rain: float, daily_tmax: float = 30.0) -> ClimateSeason:
    days = 210
    return ClimateSeason(
        cell_id="-189_-483",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple([daily_rain] * days),
        rain_source="nasa_power",
        tmax_c=tuple([daily_tmax] * days),
        tmin_c=tuple([18.0] * days),
        eto_mm=tuple([4.2] * days),
        gwetroot=tuple([0.65] * days),
    )


def test_should_accept_sowing_date_when_on_or_before_zarc_deadline() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop(limite="02-28")

    assert service.is_within_window(crop, date(2027, 2, 18)) is True
    assert service.is_within_window(crop, date(2027, 2, 28)) is True


def test_should_reject_sowing_date_when_after_zarc_deadline() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop(limite="02-28")

    assert service.is_within_window(crop, date(2027, 3, 3)) is False


def test_should_detect_stress_when_drought_or_extreme_heat_occurs_during_flowering() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop()
    wet_season = _make_season(2020, daily_rain=8.0, daily_tmax=29.5)
    dry_hot_season = _make_season(2021, daily_rain=0.0, daily_tmax=36.0)

    results = service.simulate_historical(
        crop=crop,
        seasons=[wet_season, dry_hot_season],
        semeadura=date(2027, 2, 18),
        cad_mm=60.0,
        smap_wetness=0.65,
    )

    assert len(results) == 2
    assert results[0].aperto is False
    assert results[1].aperto is True
    assert results[1].dias_calor >= 3


def test_should_simulate_cmip6_future_years_when_delta_applied() -> None:
    service = ClimateRiskService(WaterBalanceCalculator())
    crop = _make_crop()
    seasons = [_make_season(2005 + i, daily_rain=6.0, daily_tmax=30.0) for i in range(10)]
    delta = Cmip6Delta(
        cell_id="-189_-483",
        cenario="SSP2-4.5",
        modelos_referencia=("ACCESS-CM2", "MIROC6"),
        aumento_temperatura_media_c=1.8,
        variacao_chuva_safrinha_pct=-12.5,
        aumento_dias_calor_extremo_ge_35c=6.4,
    )

    media, min_bons, max_bons = service.simulate_future_cmip6(
        crop=crop,
        seasons=seasons,
        delta=delta,
        semeadura=date(2027, 2, 18),
        cad_mm=60.0,
    )

    assert 0 <= min_bons <= media <= max_bons <= 10
