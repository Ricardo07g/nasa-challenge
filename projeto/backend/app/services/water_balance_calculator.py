"""ETo (Hargreaves-Samani, FAO-56), balanço hídrico diário em balde e ISNA."""

import math
from collections.abc import Sequence

from app.constants import (
    DEFAULT_INITIAL_ARM_FRACTION,
    KC_DEV_STAGE_FRACTION,
    KC_END_DEFAULT,
    KC_INITIAL_DEFAULT,
    KC_INITIAL_STAGE_FRACTION,
    KC_MID_STAGE_FRACTION,
    MJ_TO_MM_EVAPORATION,
    SOLAR_CONSTANT_MJ_M2_MIN,
)


class WaterBalanceCalculator:
    """Pure biophysical functions for crop water balance and drought risk analysis."""

    def extraterrestrial_radiation(self, lat_deg: float, day_of_year: int) -> float:
        """Radiação extraterrestre diária Ra em MJ/m²/dia (FAO-56, equações 21 a 25).

        Args:
            lat_deg: Latitude em graus decimais (sul negativo).
            day_of_year: Dia do ano (1 a 366).

        Returns:
            Ra em MJ/m²/dia.
        """
        phi = math.radians(lat_deg)
        dr = 1.0 + 0.033 * math.cos(2.0 * math.pi * day_of_year / 365.0)
        delta = 0.409 * math.sin(2.0 * math.pi * day_of_year / 365.0 - 1.39)
        ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(delta))))
        return (
            (24.0 * 60.0 / math.pi)
            * SOLAR_CONSTANT_MJ_M2_MIN
            * dr
            * (
                ws * math.sin(phi) * math.sin(delta)
                + math.cos(phi) * math.cos(delta) * math.sin(ws)
            )
        )

    def hargreaves_eto(self, t_max: float, t_min: float, lat_deg: float, day_of_year: int) -> float:
        """ETo diária (mm/dia) por Hargreaves-Samani com a radiação extraterrestre (FAO-56 eq. 52).

        Usa Ra (topo da atmosfera), não a radiação que chega na superfície.

        Args:
            t_max: Temperatura máxima do dia (°C).
            t_min: Temperatura mínima do dia (°C).
            lat_deg: Latitude em graus decimais.
            day_of_year: Dia do ano (1 a 366).

        Returns:
            ETo em mm/dia.
        """
        ra = self.extraterrestrial_radiation(lat_deg, day_of_year)
        t_mean = (t_max + t_min) / 2.0
        amplitude = max(0.0, t_max - t_min)
        eto = 0.0023 * (t_mean + 17.8) * math.sqrt(amplitude) * MJ_TO_MM_EVAPORATION * ra
        return round(max(0.0, eto), 3)

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
        """Balanço hídrico diário em "balde" (PRD 7.2, função `simular`).

        A cada dia: água disponível = balde + chuva; ETr = menor entre ETc e a água disponível;
        o balde guarda o que sobrou, até a CAD (o excesso escorre).

        Args:
            chuva: Chuva diária em mm.
            eto: ETo diária em mm.
            kc: Kc diário da cultura.
            cad: Capacidade de água disponível do solo (mm).
            arm0: Água no balde no primeiro dia (mm). Sem valor, começa em 50% da CAD.

        Returns:
            Tupla (etr_l, etc_l): evapotranspiração real e máxima da cultura, por dia.
        """
        n_days = min(len(chuva), len(eto), len(kc))
        safe_cad = max(0.0, cad)
        arm = safe_cad * DEFAULT_INITIAL_ARM_FRACTION if arm0 is None else arm0
        arm = max(0.0, min(safe_cad, arm))

        etr_l: list[float] = []
        etc_l: list[float] = []
        for idx in range(n_days):
            etc_day = max(0.0, float(kc[idx]) * float(eto[idx]))
            disponivel = arm + max(0.0, float(chuva[idx]))
            etr_day = min(etc_day, disponivel)
            arm = min(safe_cad, disponivel - etr_day)
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
