"""Risco de clima por opção: janela de plantio, 20 anos de balanço hídrico e clima de 2041-2060."""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import date, timedelta
from statistics import mean

from app.constants import (
    DEFAULT_INITIAL_ARM_FRACTION,
    MIN_INITIAL_ARM_FRACTION,
    PERCENT_DIVISOR,
)
from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.crop_option import CropParams
from app.models.recomendacao import FuturoResultado, ResultadoAno
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules
from app.services.water_balance_calculator import WaterBalanceCalculator


class ClimateRiskService:
    """Avalia a janela de plantio, o aperto de água e calor por ano e o clima futuro (CMIP6)."""

    def __init__(self, wb_calculator: WaterBalanceCalculator, rules: Regras | None = None) -> None:
        self._wb = wb_calculator
        self._clima = (rules if rules is not None else load_default_rules()).clima

    def is_within_window(self, crop: CropParams, semeadura: date) -> bool:
        """A semeadura respeita a data limite (ZARC) da cultura?"""
        if crop.semeadura_limite_mes_dia is None:
            return True
        month_str, day_str = crop.semeadura_limite_mes_dia.split("-")
        return (semeadura.month, semeadura.day) <= (int(month_str), int(day_str))

    def loss_factor(self, isna: float) -> float:
        """Perda de produtividade pelo ISNA (PRD 7.5): 0% (>= 0,65), 30% (0,55 a 0,65), 60%."""
        if isna >= self._clima.perda_isna_sem_perda:
            return 0.0
        if isna >= self._clima.perda_isna_alta_abaixo:
            return self._clima.perda_fator_media
        return self._clima.perda_fator_alta

    @staticmethod
    def initial_bucket_fraction(smap_wetness: float | None) -> float:
        """Fração da CAD no balde do dia de plantar (PRD 7.2, US-03).

        Com SMAP, a umidade relativa da zona das raízes (`sm_rootzone_wetness`, 0 a 1), com piso
        de 20% da CAD; sem SMAP, 50% da CAD.
        """
        if smap_wetness is None:
            return DEFAULT_INITIAL_ARM_FRACTION
        return max(MIN_INITIAL_ARM_FRACTION, min(1.0, smap_wetness))

    @staticmethod
    def sowing_day_wetness(series: Iterable[SmapSoilMoisture], semeadura: date) -> dict[int, float]:
        """A umidade do SMAP no dia de plantar de cada ano (dia e mês da `semeadura`).

        Outros dias da série não contam: o balde de cada ano começa com a terra daquele dia.
        """
        return {
            record.data.year: record.sm_rootzone_wetness
            for record in series
            if (record.data.month, record.data.day) == (semeadura.month, semeadura.day)
        }

    def reference_eto(self, season: ClimateSeason) -> tuple[float, ...]:
        """ETo diária da temporada: a da fonte, ou Hargreaves-Samani com a latitude da célula."""
        if season.eto_mm:
            return season.eto_mm
        return tuple(
            self._wb.hargreaves_eto(
                t_max=season.tmax_c[idx],
                t_min=season.tmin_c[idx],
                lat_deg=season.lat,
                day_of_year=(season.start_date + timedelta(days=idx)).timetuple().tm_yday,
            )
            for idx in range(min(len(season.tmax_c), len(season.tmin_c)))
        )

    def simulate_historical(
        self,
        crop: CropParams,
        seasons: list[ClimateSeason],
        semeadura: date,
        cad_mm: float,
        smap_wetness_by_year: Mapping[int, float] | None = None,
    ) -> list[ResultadoAno]:
        """Simula o balanço hídrico da cultura em cada ano da série (PRD 7.2).

        Args:
            crop: Parâmetros da cultura.
            seasons: Séries de cada ano.
            semeadura: Data de semeadura (o ano é ignorado; vale o dia e o mês).
            cad_mm: Água disponível do solo (mm).
            smap_wetness_by_year: Umidade relativa da zona das raízes (0 a 1) no dia de plantar de
                cada ano, com dado real do SMAP (`sowing_day_wetness`). Ano fora dele: 50% da CAD.

        Returns:
            Um ResultadoAno por temporada.
        """
        kc_curve = self._wb.build_kc_curve(crop.ciclo_dias, crop.kc_pico)
        wetness_by_year = smap_wetness_by_year or {}

        clima = self._clima
        if crop.tipo == "cobertura":
            ini_crit = 0
            fim_crit = min(clima.janela_cobertura_dias, crop.ciclo_dias)
            isna_threshold = clima.isna_cobertura
        else:
            ini_crit = max(0, crop.dias_florescer - clima.janela_grao_meia_dias)
            fim_crit = min(crop.ciclo_dias, crop.dias_florescer + clima.janela_grao_meia_dias)
            isna_threshold = clima.isna_grao

        resultados: list[ResultadoAno] = []
        for season in seasons:
            season_sowing = date(season.year, semeadura.month, semeadura.day)
            start = max(0, (season_sowing - season.start_date).days)
            end = start + crop.ciclo_dias
            fraction = self.initial_bucket_fraction(wetness_by_year.get(season.year))
            arm0 = cad_mm * fraction

            etr_l, etc_l = self._wb.simular(
                chuva=season.rain_mm[start:end],
                eto=self.reference_eto(season)[start:end],
                kc=kc_curve,
                cad=cad_mm,
                arm0=arm0,
            )
            isna_val = self._wb.isna(etr_l=etr_l, etc_l=etc_l, ini=ini_crit, fim=fim_crit)

            tmax_ciclo = season.tmax_c[start:end]
            dias_calor = sum(1 for t in tmax_ciclo[ini_crit:fim_crit] if t >= clima.calor_temp_c)

            falta_agua = isna_val < isna_threshold
            calor = dias_calor >= clima.calor_min_dias
            resultados.append(
                ResultadoAno(
                    ano=season.year,
                    aperto=falta_agua or calor,
                    isna=isna_val,
                    dias_calor=dias_calor,
                    fator_perda=self.loss_factor(isna_val),
                    falta_agua=falta_agua,
                    calor=calor,
                )
            )

        return resultados

    def project_season(self, season: ClimateSeason, deltas: list[Cmip6Delta]) -> ClimateSeason:
        """Aplica os deltas mensais de um modelo à temporada observada (método do delta, PRD 7.3).

        Chuva x (1 + Δ%), máxima + Δ °C e, quando o delta traz a mínima (`tmin_c`), mínima + Δ °C
        em cada mês; sem `tmin_c`, a mínima observada fica. A ETo é recalculada pela razão entre a
        Hargreaves-Samani nova e a antiga (plano técnico §4.3), que usa máxima e mínima.
        """
        by_month = {d.month: d for d in deltas}
        base_eto = self.reference_eto(season)
        rain: list[float] = []
        tmax: list[float] = []
        tmin: list[float] = []
        eto: list[float] = []
        for idx in range(len(base_eto)):
            day = season.start_date + timedelta(days=idx)
            delta = by_month.get(day.month)
            rain_pct = delta.rain_pct if delta else 0.0
            tmax_c = delta.tmax_c if delta else 0.0
            tmin_c = delta.tmin_c if delta and delta.tmin_c is not None else 0.0

            new_tmax = season.tmax_c[idx] + tmax_c
            new_tmin = season.tmin_c[idx] + tmin_c
            doy = day.timetuple().tm_yday
            hs_old = self._wb.hargreaves_eto(
                season.tmax_c[idx], season.tmin_c[idx], season.lat, doy
            )
            hs_new = self._wb.hargreaves_eto(new_tmax, new_tmin, season.lat, doy)
            ratio = hs_new / hs_old if hs_old > 0.0 else 1.0

            rain.append(max(0.0, season.rain_mm[idx] * (1.0 + rain_pct / PERCENT_DIVISOR)))
            tmax.append(new_tmax)
            tmin.append(new_tmin)
            eto.append(round(base_eto[idx] * ratio, 3))

        return ClimateSeason(
            cell_id=season.cell_id,
            year=season.year,
            start_date=season.start_date,
            lat=season.lat,
            rain_mm=tuple(rain),
            rain_source=season.rain_source,
            tmax_c=tuple(tmax),
            tmin_c=tuple(tmin),
            eto_mm=tuple(eto),
        )

    def simulate_future_cmip6(
        self,
        crop: CropParams,
        seasons: list[ClimateSeason],
        deltas: list[Cmip6Delta],
        semeadura: date,
        cad_mm: float,
        smap_wetness_by_year: Mapping[int, float] | None = None,
    ) -> FuturoResultado | None:
        """Anos sem aperto no clima de 2041-2060, por modelo do CMIP6 (PRD 7.3).

        O balde de cada ano começa igual ao da conta histórica (`smap_wetness_by_year`): o método
        do delta muda só o clima, e a diferença entre hoje e 2050 não vem da condição inicial.

        Returns:
            Média, mínimo e máximo entre os modelos, ou None quando não há deltas do CMIP6.
        """
        by_model: dict[str, list[Cmip6Delta]] = defaultdict(list)
        for delta in deltas:
            by_model[delta.model].append(delta)
        if not by_model:
            return None

        anos_bons_por_modelo: list[int] = []
        for model_deltas in by_model.values():
            projected = [self.project_season(s, model_deltas) for s in seasons]
            resultados = self.simulate_historical(
                crop=crop,
                seasons=projected,
                semeadura=semeadura,
                cad_mm=cad_mm,
                smap_wetness_by_year=smap_wetness_by_year,
            )
            anos_bons_por_modelo.append(sum(1 for r in resultados if not r.aperto))

        return FuturoResultado(
            anos_bons_media=round(mean(anos_bons_por_modelo)),
            anos_bons_min=min(anos_bons_por_modelo),
            anos_bons_max=max(anos_bons_por_modelo),
            modelos=len(by_model),
            cenario=deltas[0].scenario,
        )
