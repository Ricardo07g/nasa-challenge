"""Climate risk simulation service across 20 historical NASA POWER seasons and CMIP6 2050."""

from datetime import date

from app.constants import (
    BASE_STRESS_LOSS_FACTOR,
    CMIP6_MODEL_SPREAD_YEARS,
    COVER_CRITICAL_WINDOW_DAYS,
    DEFAULT_INITIAL_ARM_FRACTION,
    GRAIN_CRITICAL_HALF_WINDOW_DAYS,
    HEAT_STRESS_MIN_DAYS,
    HEAT_STRESS_TEMP_C,
    ISNA_COVER_THRESHOLD,
    ISNA_GRAIN_THRESHOLD,
    MAX_YIELD_LOSS_FACTOR,
    PERCENT_DIVISOR,
)
from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.crop_option import CropParams
from app.models.recomendacao import ResultadoAno
from app.services.water_balance_calculator import WaterBalanceCalculator


class ClimateRiskService:
    """Evaluates sowing windows, 20-year water balance stress, and CMIP6 climate projections."""

    def __init__(self, wb_calculator: WaterBalanceCalculator) -> None:
        self._wb = wb_calculator

    def is_within_window(self, crop: CropParams, semeadura: date) -> bool:
        """Checks whether the sowing date respects the ZARC deadline for the crop (US-03)."""
        if crop.semeadura_limite_mes_dia is None:
            return True
        month_str, day_str = crop.semeadura_limite_mes_dia.split("-")
        limit_month, limit_day = int(month_str), int(day_str)
        return (semeadura.month, semeadura.day) <= (limit_month, limit_day)

    def simulate_historical(
        self,
        crop: CropParams,
        seasons: list[ClimateSeason],
        semeadura: date,
        cad_mm: float,
        smap_wetness: float | None = None,
    ) -> list[ResultadoAno]:
        """Simulates daily water balance across all historical seasons for a given crop (US-03).

        Args:
            crop: Agronomic parameters of the crop option.
            seasons: 20-year historical meteorological series.
            semeadura: Planned sowing date.
            cad_mm: Available water capacity of the soil in mm.
            smap_wetness: Optional NASA SMAP rootzone wetness fraction (0-1) to calibrate arm0.

        Returns:
            List of ResultadoAno outcomes for each historical year.
        """
        kc_curve = self._wb.build_kc_curve(crop.ciclo_dias, crop.kc_pico)
        wetness = smap_wetness if smap_wetness is not None else DEFAULT_INITIAL_ARM_FRACTION
        arm0 = cad_mm * max(0.20, min(1.0, wetness))

        if crop.tipo == "cobertura":
            ini_crit = 0
            fim_crit = min(COVER_CRITICAL_WINDOW_DAYS, crop.ciclo_dias)
            isna_threshold = ISNA_COVER_THRESHOLD
        else:
            ini_crit = max(0, crop.dias_florescer - GRAIN_CRITICAL_HALF_WINDOW_DAYS)
            fim_crit = min(crop.ciclo_dias, crop.dias_florescer + GRAIN_CRITICAL_HALF_WINDOW_DAYS)
            isna_threshold = ISNA_GRAIN_THRESHOLD

        resultados: list[ResultadoAno] = []
        for season in seasons:
            season_sowing = date(season.year, semeadura.month, semeadura.day)
            start_offset = max(0, (season_sowing - season.start_date).days)
            end_offset = start_offset + crop.ciclo_dias

            chuva_slice = season.rain_mm[start_offset:end_offset]
            tmax_slice = season.tmax_c[start_offset:end_offset]
            eto_slice = season.eto_mm[start_offset:end_offset]

            if not eto_slice and season.tmean_c:
                eto_computed = [
                    self._wb.calculate_eto_fao(
                        t_max=season.tmax_c[idx],
                        t_min=season.tmin_c[idx],
                        t_mean=season.tmean_c[idx],
                        solar_rad_mj=season.solar_rad_mj[idx],
                        ws2m=season.ws2m_ms[idx],
                        rh2m=season.rh2m_pct[idx],
                    )
                    for idx in range(start_offset, min(end_offset, len(season.tmax_c)))
                ]
                eto_slice = tuple(eto_computed)

            etr_l, etc_l = self._wb.simular(
                chuva=chuva_slice,
                eto=eto_slice,
                kc=kc_curve,
                cad=cad_mm,
                arm0=arm0,
            )
            isna_val = self._wb.isna(etr_l=etr_l, etc_l=etc_l, ini=ini_crit, fim=fim_crit)

            crit_tmax = tmax_slice[ini_crit : min(len(tmax_slice), fim_crit)]
            dias_calor = sum(1 for t in crit_tmax if t >= HEAT_STRESS_TEMP_C)

            aperto = (isna_val < isna_threshold) or (dias_calor >= HEAT_STRESS_MIN_DAYS)
            if aperto:
                deficit = max(0.0, isna_threshold - isna_val)
                fator_perda = min(MAX_YIELD_LOSS_FACTOR, BASE_STRESS_LOSS_FACTOR + deficit * 1.2)
            else:
                fator_perda = 0.0

            resultados.append(
                ResultadoAno(
                    ano=season.year,
                    aperto=aperto,
                    isna=isna_val,
                    dias_calor=dias_calor,
                    fator_perda=round(fator_perda, 3),
                )
            )

        return resultados

    def simulate_future_cmip6(
        self,
        crop: CropParams,
        seasons: list[ClimateSeason],
        delta: Cmip6Delta,
        semeadura: date,
        cad_mm: float,
    ) -> tuple[int, int, int]:
        """Projects favorable years under 2041-2060 NEX-GDDP-CMIP6 SSP2-4.5 climate deltas (US-09).

        Returns:
            A tuple of (futuro_anos_bons_media, futuro_anos_bons_min, futuro_anos_bons_max).
        """
        rain_factor = max(0.1, 1.0 + (delta.variacao_chuva_safrinha_pct / PERCENT_DIVISOR))
        temp_delta = delta.aumento_temperatura_media_c

        projected_seasons: list[ClimateSeason] = []
        for s in seasons:
            projected_seasons.append(
                ClimateSeason(
                    cell_id=s.cell_id,
                    year=s.year,
                    start_date=s.start_date,
                    rain_mm=tuple(round(r * rain_factor, 2) for r in s.rain_mm),
                    rain_source=s.rain_source,
                    tmax_c=tuple(round(t + temp_delta, 2) for t in s.tmax_c),
                    tmin_c=tuple(round(t + temp_delta, 2) for t in s.tmin_c),
                    eto_mm=tuple(round(e * (1.0 + 0.03 * temp_delta), 3) for e in s.eto_mm),
                    gwetroot=s.gwetroot,
                )
            )

        future_results = self.simulate_historical(
            crop=crop,
            seasons=projected_seasons,
            semeadura=semeadura,
            cad_mm=cad_mm,
        )
        total = len(future_results)
        bons_media = sum(1 for r in future_results if not r.aperto)
        bons_min = max(0, bons_media - CMIP6_MODEL_SPREAD_YEARS)
        bons_max = min(total, bons_media + 1)
        return bons_media, bons_min, bons_max
