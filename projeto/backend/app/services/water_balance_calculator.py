"""ETo (FAO-56 Penman-Monteith e Hargreaves-Samani), balanço hídrico diário em balde e ISNA."""

import math
from collections.abc import Sequence
from typing import Final

from app.constants import (
    DEFAULT_INITIAL_ARM_FRACTION,
    KC_DEV_STAGE_FRACTION,
    KC_END_DEFAULT,
    KC_INITIAL_DEFAULT,
    KC_INITIAL_STAGE_FRACTION,
    KC_MID_STAGE_FRACTION,
    MJ_TO_MM_EVAPORATION,
    PERCENT_DIVISOR,
    SOLAR_CONSTANT_MJ_M2_MIN,
)

# FAO-56 Penman-Monteith (Allen et al., 1998, Boletim 56, cap. 3 e 4), passo diário.
SVP_COEFF_KPA: Final[float] = 0.6108  # eq. 11: e°(T) = 0,6108 exp(17,27 T / (T + 237,3))
SVP_EXP_COEFF: Final[float] = 17.27
SVP_TEMP_OFFSET_C: Final[float] = 237.3
SVP_SLOPE_COEFF: Final[float] = 4098.0  # eq. 13: inclinação da curva de pressão de vapor
SEA_LEVEL_PRESSURE_KPA: Final[float] = 101.3  # eq. 7: pressão atmosférica pela altitude
STD_ATM_TEMP_K: Final[float] = 293.0
LAPSE_RATE_K_M: Final[float] = 0.0065
PRESSURE_EXPONENT: Final[float] = 5.26
PSYCHROMETRIC_COEFF: Final[float] = 0.000665  # eq. 8: γ = 0,665 x 10^-3 P
CLEAR_SKY_RA_FRACTION: Final[float] = 0.75  # eq. 37: Rso = (0,75 + 2 x 10^-5 z) Ra
CLEAR_SKY_ELEVATION_COEFF: Final[float] = 2e-5
GRASS_ALBEDO: Final[float] = 0.23  # eq. 38: grama de referência
STEFAN_BOLTZMANN_MJ: Final[float] = 4.903e-9  # MJ K^-4 m^-2 dia^-1
KELVIN_OFFSET: Final[float] = 273.16  # eq. 39 usa K = °C + 273,16
NET_LW_EMISSIVITY_A: Final[float] = 0.34  # eq. 39: (0,34 - 0,14 √ea)
NET_LW_EMISSIVITY_B: Final[float] = 0.14
CLOUDINESS_A: Final[float] = 1.35  # eq. 39: (1,35 Rs/Rso - 0,35)
CLOUDINESS_B: Final[float] = 0.35
MAX_RELATIVE_SHORTWAVE: Final[float] = 1.0  # Rs/Rso nunca passa de 1
PM_AERO_NUMERATOR: Final[float] = 900.0  # eq. 6, grama de referência, passo diário
PM_AERO_TEMP_OFFSET_K: Final[float] = 273.0
PM_WIND_COEFF: Final[float] = 0.34
SOIL_HEAT_FLUX_DAILY_MJ: Final[float] = 0.0  # G ≈ 0 no passo diário (eq. 42)
ETO_DECIMALS: Final[int] = 3


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

    def saturation_vapour_pressure(self, t_c: float) -> float:
        """Pressão de saturação do vapor e°(T) em kPa (FAO-56 eq. 11)."""
        return SVP_COEFF_KPA * math.exp(SVP_EXP_COEFF * t_c / (t_c + SVP_TEMP_OFFSET_C))

    def actual_vapour_pressure_from_rh_mean(
        self, t_max: float, t_min: float, rh_mean_pct: float
    ) -> float:
        """Pressão real do vapor ea em kPa a partir da UR média do dia (FAO-56 eq. 19).

        Args:
            t_max: Temperatura máxima do dia (°C).
            t_min: Temperatura mínima do dia (°C).
            rh_mean_pct: Umidade relativa média do dia (%), como o RH2M do NASA POWER.

        Returns:
            ea em kPa.
        """
        return rh_mean_pct / PERCENT_DIVISOR * self._mean_saturation_vapour_pressure(t_max, t_min)

    def _mean_saturation_vapour_pressure(self, t_max: float, t_min: float) -> float:
        """es em kPa: média de e°(Tmax) e e°(Tmin) (FAO-56 eq. 12)."""
        return (
            self.saturation_vapour_pressure(t_max) + self.saturation_vapour_pressure(t_min)
        ) / 2.0

    def penman_monteith_eto(
        self,
        t_max: float,
        t_min: float,
        actual_vapour_pressure_kpa: float,
        wind_2m_ms: float,
        solar_rad_mj: float,
        lat_deg: float,
        day_of_year: int,
        elevation_m: float,
    ) -> float:
        """ETo diária (mm/dia) pelo FAO-56 Penman-Monteith (eq. 6), grama de referência.

        Args:
            t_max: Temperatura máxima do dia (°C).
            t_min: Temperatura mínima do dia (°C).
            actual_vapour_pressure_kpa: Pressão real do vapor ea (kPa). Da UR média use
                `actual_vapour_pressure_from_rh_mean`; do ponto de orvalho, e°(Tdew) (eq. 14).
            wind_2m_ms: Velocidade do vento a 2 m (m/s).
            solar_rad_mj: Radiação solar que chega à superfície Rs (MJ/m²/dia).
            lat_deg: Latitude em graus decimais (sul negativo).
            day_of_year: Dia do ano (1 a 366).
            elevation_m: Altitude do ponto (m).

        Returns:
            ETo em mm/dia (nunca negativa).
        """
        t_mean = (t_max + t_min) / 2.0  # eq. 9
        delta = (  # eq. 13
            SVP_SLOPE_COEFF
            * self.saturation_vapour_pressure(t_mean)
            / (t_mean + SVP_TEMP_OFFSET_C) ** 2
        )
        pressure = (  # eq. 7
            SEA_LEVEL_PRESSURE_KPA
            * ((STD_ATM_TEMP_K - LAPSE_RATE_K_M * elevation_m) / STD_ATM_TEMP_K)
            ** PRESSURE_EXPONENT
        )
        gamma = PSYCHROMETRIC_COEFF * pressure  # eq. 8
        vapour_deficit = (
            self._mean_saturation_vapour_pressure(t_max, t_min) - actual_vapour_pressure_kpa
        )
        net_radiation = self._net_radiation(
            t_max,
            t_min,
            actual_vapour_pressure_kpa,
            solar_rad_mj,
            lat_deg,
            day_of_year,
            elevation_m,
        )

        radiation_term = MJ_TO_MM_EVAPORATION * delta * (net_radiation - SOIL_HEAT_FLUX_DAILY_MJ)
        aerodynamic_term = (
            gamma
            * PM_AERO_NUMERATOR
            / (t_mean + PM_AERO_TEMP_OFFSET_K)
            * wind_2m_ms
            * vapour_deficit
        )
        denominator = delta + gamma * (1.0 + PM_WIND_COEFF * wind_2m_ms)
        return round(max(0.0, (radiation_term + aerodynamic_term) / denominator), ETO_DECIMALS)

    def _net_radiation(
        self,
        t_max: float,
        t_min: float,
        actual_vapour_pressure_kpa: float,
        solar_rad_mj: float,
        lat_deg: float,
        day_of_year: int,
        elevation_m: float,
    ) -> float:
        """Saldo de radiação Rn = Rns - Rnl em MJ/m²/dia (FAO-56 eq. 37 a 40)."""
        ra = self.extraterrestrial_radiation(lat_deg, day_of_year)
        rso = (CLEAR_SKY_RA_FRACTION + CLEAR_SKY_ELEVATION_COEFF * elevation_m) * ra
        relative_shortwave = min(MAX_RELATIVE_SHORTWAVE, solar_rad_mj / rso) if rso > 0 else 0.0
        rns = (1.0 - GRASS_ALBEDO) * solar_rad_mj
        mean_t4 = ((t_max + KELVIN_OFFSET) ** 4 + (t_min + KELVIN_OFFSET) ** 4) / 2.0
        rnl = (
            STEFAN_BOLTZMANN_MJ
            * mean_t4
            * (NET_LW_EMISSIVITY_A - NET_LW_EMISSIVITY_B * math.sqrt(actual_vapour_pressure_kpa))
            * (CLOUDINESS_A * relative_shortwave - CLOUDINESS_B)
        )
        return rns - rnl

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
