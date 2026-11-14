"""FAO-56 reference evapotranspiration, daily bucket water balance, and ISNA calculator."""

import math
from collections.abc import Sequence

from app.constants import (
    ALBEDO_CANOPY,
    DEFAULT_INITIAL_ARM_FRACTION,
    KC_DEV_STAGE_FRACTION,
    KC_END_DEFAULT,
    KC_INITIAL_DEFAULT,
    KC_INITIAL_STAGE_FRACTION,
    KC_MID_STAGE_FRACTION,
    MAX_DAILY_ETO_MM,
    MIN_DAILY_ETO_MM,
    PSYCHROMETRIC_CONSTANT_KPA_C,
)


class WaterBalanceCalculator:
    """Pure biophysical functions for crop water balance and drought risk analysis."""

    def calculate_eto_fao(
        self,
        t_max: float,
        t_min: float,
        t_mean: float,
        solar_rad_mj: float,
        ws2m: float,
        rh2m: float,
    ) -> float:
        """Calculates daily reference evapotranspiration (ETo in mm/day) via FAO-56.

        Args:
            t_max: Daily maximum air temperature at 2m in degrees Celsius.
            t_min: Daily minimum air temperature at 2m in degrees Celsius.
            t_mean: Daily mean air temperature at 2m in degrees Celsius.
            solar_rad_mj: Downward shortwave solar radiation (ALLSKY_SFC_SW_DWN) in MJ/m2/day.
            ws2m: Wind speed at 2m in m/s.
            rh2m: Relative humidity at 2m in percentage (0-100).

        Returns:
            Daily reference evapotranspiration in millimeters per day.
        """
        es_tmax = 0.6108 * math.exp((17.27 * t_max) / (t_max + 237.3))
        es_tmin = 0.6108 * math.exp((17.27 * t_min) / (t_min + 237.3))
        es = (es_tmax + es_tmin) / 2.0
        ea = es * max(0.10, min(1.0, rh2m / 100.0))

        delta = (4098.0 * (0.6108 * math.exp((17.27 * t_mean) / (t_mean + 237.3)))) / (
            (t_mean + 237.3) ** 2
        )
        rn = (1.0 - ALBEDO_CANOPY) * max(1.0, solar_rad_mj) * 0.75

        numerator = 0.408 * delta * rn + PSYCHROMETRIC_CONSTANT_KPA_C * (
            900.0 / (t_mean + 273.0)
        ) * ws2m * (es - ea)
        denominator = delta + PSYCHROMETRIC_CONSTANT_KPA_C * (1.0 + 0.34 * ws2m)
        eto = numerator / denominator if denominator > 0.0 else MIN_DAILY_ETO_MM
        return round(max(MIN_DAILY_ETO_MM, min(MAX_DAILY_ETO_MM, eto)), 3)

    def build_kc_curve(self, ciclo_dias: int, kc_pico: float) -> list[float]:
        """Generates a daily crop coefficient (Kc) curve across phenological stages.

        Args:
            ciclo_dias: Total crop cycle duration in days.
            kc_pico: Peak crop coefficient during flowering / mid-season.

        Returns:
            List of daily Kc values of length ciclo_dias.
        """
        if ciclo_dias <= 0:
            return []

        ini_end = int(ciclo_dias * KC_INITIAL_STAGE_FRACTION)
        dev_end = int(ciclo_dias * KC_DEV_STAGE_FRACTION)
        mid_end = int(ciclo_dias * KC_MID_STAGE_FRACTION)

        kc_curve: list[float] = []
        for day in range(ciclo_dias):
            if day < ini_end:
                kc = KC_INITIAL_DEFAULT
            elif day < dev_end:
                span = max(1, dev_end - ini_end)
                frac = (day - ini_end) / span
                kc = KC_INITIAL_DEFAULT + frac * (kc_pico - KC_INITIAL_DEFAULT)
            elif day < mid_end:
                kc = kc_pico
            else:
                span = max(1, ciclo_dias - mid_end)
                frac = (day - mid_end) / span
                kc = kc_pico - frac * (kc_pico - KC_END_DEFAULT)
            kc_curve.append(round(kc, 3))
        return kc_curve

    def simular(
        self,
        chuva: Sequence[float],
        eto: Sequence[float],
        kc: Sequence[float],
        cad: float,
        arm0: float | None = None,
    ) -> tuple[list[float], list[float]]:
        """Simulates a daily Thornthwaite-Mather / FAO-56 soil water bucket.

        Args:
            chuva: Daily precipitation sequence in mm.
            eto: Daily reference evapotranspiration sequence in mm.
            kc: Daily crop coefficient sequence.
            cad: Soil available water capacity (CAD) in mm.
            arm0: Initial soil water storage in mm (defaults to 50% of CAD).

        Returns:
            A tuple of (etr_list, etc_list) representing actual and maximum crop evapotranspiration.
        """
        n_days = min(len(chuva), len(eto), len(kc))
        safe_cad = max(1.0, cad)
        arm = (
            max(0.0, min(safe_cad, arm0))
            if arm0 is not None
            else safe_cad * DEFAULT_INITIAL_ARM_FRACTION
        )

        etr_l: list[float] = []
        etc_l: list[float] = []

        for idx in range(n_days):
            p_day = max(0.0, float(chuva[idx]))
            etc_day = max(0.0, float(eto[idx]) * float(kc[idx]))
            saldo = p_day - etc_day

            if saldo >= 0.0:
                arm_novo = min(safe_cad, arm + saldo)
                etr_day = etc_day
            else:
                arm_novo = arm * math.exp(saldo / safe_cad)
                etr_day = min(etc_day, p_day + (arm - arm_novo))

            arm = max(0.0, min(safe_cad, arm_novo))
            etr_l.append(round(etr_day, 4))
            etc_l.append(round(etc_day, 4))

        return etr_l, etc_l

    def isna(
        self,
        etr_l: Sequence[float],
        etc_l: Sequence[float],
        ini: int,
        fim: int,
    ) -> float:
        """Computes the Water Requirement Satisfaction Index (ISNA = sum(ETr) / sum(ETc)).

        Args:
            etr_l: Daily actual evapotranspiration sequence.
            etc_l: Daily maximum crop evapotranspiration sequence.
            ini: Start day index of the critical phenological window (inclusive).
            fim: End day index of the critical phenological window (exclusive).

        Returns:
            Normalized ISNA ratio in [0.0, 1.0].
        """
        start_idx = max(0, ini)
        end_idx = min(len(etr_l), len(etc_l), max(start_idx + 1, fim))
        sum_etc = sum(etc_l[start_idx:end_idx])
        if sum_etc <= 0.0:
            return 1.0
        sum_etr = sum(etr_l[start_idx:end_idx])
        return round(max(0.0, min(1.0, sum_etr / sum_etc)), 4)
