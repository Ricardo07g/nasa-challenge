"""Grupos "O que mudou na sua área" e "Fora do comum" da tela Avisos (remodelagem S6, tarefa 0046).

Os dois olham a série guardada da célula (chuva do GPM IMERG; nos anos sem IMERG, NASA POWER;
temperatura do NASA POWER), só com as temporadas inteiras (1/jan a 31/jul).

- **O que mudou:** os anos desde `avisos_tela.ano_recente_inicio` (2020–2024) contra os de antes
  (2005–2019), em cinco números: o maior veranico de março a maio (média dos anos), o fim das chuvas
  (mediana), os dias de calor de março a maio (média por ano), a falta de água da melhor opção no
  ciclo (média, mm) e a parte dos anos em que ela deu certo. Só entra a mudança com a diferença
  mínima do `regras.yaml`. São poucos anos: mostra o que aconteceu, não uma previsão.
- **Fora do comum:** os recordes dos 20 anos, cada um com o ano.

Sem repetir regra: o veranico e o calor usam o dia seco, o calor e as janelas do raio-X
(`RaioXClimateService`, grupo `raio_x`), e o fim das chuvas é o da tela 3 (`RainEndService`).
"""

import math
from collections.abc import Mapping, Sequence
from datetime import date, timedelta
from statistics import mean, median
from typing import Final

from app.constants import CLIMATE_SEASON_DAYS
from app.models.avisos import FIQUE_DE_OLHO, FONTE_POWER, Aviso, GrupoAvisos, PeriodoComparado
from app.models.climate import ClimateSeason
from app.models.crop_option import CropParams
from app.models.recomendacao import ResultadoOpcao
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules
from app.services.calendar_days import common_day_of_year, month_day, month_day_text
from app.services.climate_risk_service import ClimateRiskService
from app.services.rain_end_service import RainEndService
from app.services.raio_x_climate_service import RaioXClimateService
from app.services.water_balance_calculator import WaterBalanceCalculator

DECIMALS: Final[int] = 1
PERCENT: Final[float] = 100.0


def _full(season: ClimateSeason) -> bool:
    """A temporada guardada inteira: 212 dias desde 1/jan (como no raio-X)."""
    return (
        season.start_date == date(season.year, 1, 1) and len(season.rain_mm) == CLIMATE_SEASON_DAYS
    )


def _window(season: ClimateSeason, inicio: str, fim: str) -> range:
    """Índices dos dias da temporada de `inicio` a `fim` ("MM-DD", inclusivos)."""
    first = (date(season.year, *month_day(inicio)) - season.start_date).days
    last = (date(season.year, *month_day(fim)) - season.start_date).days
    return range(max(first, 0), min(last, len(season.rain_mm) - 1) + 1)


def _last_day(season: ClimateSeason) -> date:
    return season.start_date + timedelta(days=len(season.rain_mm) - 1)


def _rain_sources(seasons: Sequence[ClimateSeason]) -> tuple[str, ...]:
    return tuple(sorted({season.rain_source for season in seasons}))


def _most_recent_extreme(values: Mapping[int, float], lowest: bool = False) -> tuple[int, float]:
    """O ano do maior (ou do menor) valor; empate fica com o ano mais recente (decisão D60)."""
    sign = -1 if lowest else 1
    year = max(values, key=lambda y: (sign * values[y], y))
    return year, values[year]


def cycle_deficits(
    crop: CropParams,
    seasons: Sequence[ClimateSeason],
    sowing: date,
    cad_mm: float,
    risk: ClimateRiskService,
    wetness_by_year: Mapping[int, float] | None = None,
    wb: WaterBalanceCalculator | None = None,
) -> dict[int, float]:
    """Falta de água no ciclo em cada ano (mm): ETc menos ETr do balanço diário do motor.

    O mesmo balde do `ClimateRiskService.simulate_historical` (PRD 7.2): a ETo do motor, a curva de
    Kc da cultura e o balde do dia de plantar (SMAP do ano, ou 50% da CAD). Pousio: nada.
    """
    if crop.ciclo_dias <= 0 or crop.kc_pico <= 0:
        return {}
    calculator = wb if wb is not None else WaterBalanceCalculator()
    kc = calculator.build_kc_curve(crop.ciclo_dias, crop.kc_pico)
    wetness = wetness_by_year or {}
    deficits: dict[int, float] = {}
    for season in seasons:
        start = max(0, (date(season.year, sowing.month, sowing.day) - season.start_date).days)
        end = start + crop.ciclo_dias
        etr, etc = calculator.simular(
            chuva=season.rain_mm[start:end],
            eto=risk.reference_eto(season)[start:end],
            kc=kc,
            cad=cad_mm,
            arm0=cad_mm * risk.initial_bucket_fraction(wetness.get(season.year)),
        )
        deficits[season.year] = round(max(0.0, sum(etc) - sum(etr)), DECIMALS)
    return deficits


class AvisosMudancaService:
    """O que mudou (recentes × antes) e os recordes da célula."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._rules = rules if rules is not None else load_default_rules()
        self._regra = self._rules.avisos_tela
        self._climate = RaioXClimateService(self._rules)
        self._rain_end = RainEndService(self._rules)

    def _usable(self, seasons: Sequence[ClimateSeason]) -> list[ClimateSeason]:
        return sorted((s for s in seasons if _full(s)), key=lambda s: s.year)

    # --- números de cada ano -------------------------------------------------------------------

    def _dry_spell(self, season: ClimateSeason) -> int:
        veranico = self._climate.longest_dry_spell([season])
        return veranico.dias if veranico is not None else 0

    def _hot_days(self, season: ClimateSeason) -> int:
        regra, limit = self._rules.raio_x, self._rules.clima.calor_temp_c
        return sum(
            1
            for i in _window(season, regra.calor_inicio, regra.calor_fim)
            if season.tmax_c[i] >= limit
        )

    def _autumn_rain(self, season: ClimateSeason) -> float:
        regra = self._regra
        return sum(
            season.rain_mm[i] for i in _window(season, regra.outono_inicio, regra.outono_fim)
        )

    # --- O que mudou ---------------------------------------------------------------------------

    def changes(
        self,
        seasons: Sequence[ClimateSeason],
        best: ResultadoOpcao | None,
        deficits: Mapping[int, float],
    ) -> tuple[GrupoAvisos, PeriodoComparado] | None:
        """As mudanças acima do mínimo; None sem anos recentes ou sem anos de antes."""
        usable = self._usable(seasons)
        split = self._regra.ano_recente_inicio
        recent = [s for s in usable if s.year >= split]
        before = [s for s in usable if s.year < split]
        if not recent or not before:
            return None
        last = _last_day(usable[-1])
        rain = _rain_sources(usable)
        avisos = [
            aviso
            for aviso in (
                self._dry_spell_change(recent, before, rain, last),
                self._rain_end_change(recent, before, rain, last),
                self._heat_change(recent, before, last),
                self._shortage_change(best, deficits, split, rain, last),
                self._worked_change(best, split, rain, last),
            )
            if aviso is not None
        ]
        periodo = PeriodoComparado(recent[0].year, recent[-1].year, before[0].year, before[-1].year)
        return GrupoAvisos(tuple(avisos), last), periodo

    def _mean_change(
        self,
        tipo: str,
        recent: Sequence[float],
        before: Sequence[float],
        minimum: float,
        fontes: tuple[str, ...],
        last: date,
        **extra: float | str | None,
    ) -> Aviso | None:
        if not recent or not before:
            return None
        antes, recente = round(mean(before), DECIMALS), round(mean(recent), DECIMALS)
        if abs(recente - antes) < minimum:
            return None
        return Aviso(
            tipo=tipo,
            nivel=FIQUE_DE_OLHO,
            fontes=fontes,
            data=last,
            valores={"antes": antes, "recente": recente, **extra},
        )

    def _dry_spell_change(
        self,
        recent: Sequence[ClimateSeason],
        before: Sequence[ClimateSeason],
        rain: tuple[str, ...],
        last: date,
    ) -> Aviso | None:
        return self._mean_change(
            "mudou_veranico",
            [self._dry_spell(s) for s in recent],
            [self._dry_spell(s) for s in before],
            self._regra.mudou_veranico_dias_min,
            rain,
            last,
        )

    def _rain_end_change(
        self,
        recent: Sequence[ClimateSeason],
        before: Sequence[ClimateSeason],
        rain: tuple[str, ...],
        last: date,
    ) -> Aviso | None:
        """Mediana do fim das chuvas (num ano comum); sem o fim de algum ano, não compara (D36)."""
        ends = {s.year: self._rain_end.end_of_rains(s) for s in (*recent, *before)}
        if any(end is None for end in ends.values()):
            return None

        def median_day(group: Sequence[ClimateSeason]) -> int:
            days = [common_day_of_year(end) for s in group if (end := ends[s.year]) is not None]
            return math.floor(median(days))

        antes, recente = median_day(before), median_day(recent)
        if abs(recente - antes) < self._regra.mudou_fim_chuvas_dias_min:
            return None
        return Aviso(
            tipo="mudou_fim_chuvas",
            nivel=FIQUE_DE_OLHO,
            fontes=rain,
            data=last,
            valores={
                "antes": month_day_text(antes),
                "recente": month_day_text(recente),
                "diferenca_dias": recente - antes,
            },
        )

    def _heat_change(
        self, recent: Sequence[ClimateSeason], before: Sequence[ClimateSeason], last: date
    ) -> Aviso | None:
        return self._mean_change(
            "mudou_calor",
            [self._hot_days(s) for s in recent],
            [self._hot_days(s) for s in before],
            self._regra.mudou_calor_dias_min,
            (FONTE_POWER,),
            last,
            temp_c=self._rules.clima.calor_temp_c,
        )

    def _shortage_change(
        self,
        best: ResultadoOpcao | None,
        deficits: Mapping[int, float],
        split: int,
        rain: tuple[str, ...],
        last: date,
    ) -> Aviso | None:
        if best is None:
            return None
        return self._mean_change(
            "mudou_falta_agua",
            [mm for year, mm in deficits.items() if year >= split],
            [mm for year, mm in deficits.items() if year < split],
            self._regra.mudou_falta_agua_mm_min,
            (*rain, FONTE_POWER),
            last,
            cultura=best.id,
            nome=best.nome,
        )

    def _worked_change(
        self, best: ResultadoOpcao | None, split: int, rain: tuple[str, ...], last: date
    ) -> Aviso | None:
        if best is None:
            return None
        recent = [d.bom for d in best.anos_detalhe if d.ano >= split]
        before = [d.bom for d in best.anos_detalhe if d.ano < split]
        if not recent or not before:
            return None
        share = PERCENT * (sum(recent) / len(recent) - sum(before) / len(before))
        if abs(share) < self._regra.mudou_deu_certo_pct_min:
            return None
        return Aviso(
            tipo="mudou_deu_certo",
            nivel=FIQUE_DE_OLHO,
            fontes=(*rain, FONTE_POWER),
            data=last,
            valores={
                "antes_bons": sum(before),
                "antes_total": len(before),
                "recente_bons": sum(recent),
                "recente_total": len(recent),
                "cultura": best.id,
                "nome": best.nome,
            },
        )

    # --- Fora do comum -------------------------------------------------------------------------

    def records(self, seasons: Sequence[ClimateSeason]) -> GrupoAvisos | None:
        """Maior veranico, outono mais seco, fim das chuvas mais cedo e ano com mais calor."""
        usable = self._usable(seasons)
        if not usable:
            return None
        last = _last_day(usable[-1])
        rain = _rain_sources(usable)
        avisos: list[Aviso] = []

        veranico = self._climate.longest_dry_spell(usable)
        if veranico is not None and veranico.dias > 0:
            avisos.append(
                self._record(
                    "recorde_veranico",
                    rain,
                    last,
                    dias=veranico.dias,
                    ano=veranico.ano,
                    inicio=veranico.inicio,
                )
            )

        autumn = {s.year: self._autumn_rain(s) for s in usable}
        year, lowest = _most_recent_extreme(autumn, lowest=True)
        avisos.append(
            self._record(
                "recorde_outono_seco",
                rain,
                last,
                chuva_mm=round(lowest, DECIMALS),
                ano=year,
                media_mm=round(mean(autumn.values()), DECIMALS),
            )
        )

        fim = self._rain_end.summarize(usable)
        if fim is not None:
            avisos.append(
                self._record(
                    "recorde_fim_chuvas", rain, last, dia=fim.mais_cedo.dia, ano=fim.mais_cedo.ano
                )
            )

        hot = {s.year: float(self._hot_days(s)) for s in usable}
        year, most = _most_recent_extreme(hot)
        if most > 0:
            avisos.append(
                self._record(
                    "recorde_calor",
                    (FONTE_POWER,),
                    last,
                    dias=int(most),
                    ano=year,
                    temp_c=self._rules.clima.calor_temp_c,
                )
            )
        return GrupoAvisos(tuple(avisos), last)

    @staticmethod
    def _record(
        tipo: str, fontes: tuple[str, ...], last: date, **valores: float | int | str | None
    ) -> Aviso:
        return Aviso(tipo=tipo, nivel=FIQUE_DE_OLHO, fontes=fontes, data=last, valores=valores)
