"""Contas do raio-X sobre a série guardada da célula (tela 4, remodelagem S4, tarefa 0043).

Blocos "Água que a terra guarda", "Chuva de um ano típico", "Maior veranico" e "Calor", e os
alertas de geada e chuva forte. A chuva é a da temporada guardada (GPM IMERG; nos anos sem IMERG,
NASA POWER); temperatura e ETo são do NASA POWER. Os números ficam no `regras.yaml` (grupos
`raio_x` e `alertas_area`); o dia seco é o dos avisos, o calor é o do motor e o fim das chuvas é
o da tela 3 (`RainEndService`), sem repetir regra.
"""

import math
from collections.abc import Callable, Sequence
from datetime import date, timedelta
from statistics import mean
from typing import Final

from app.constants import CLIMATE_SEASON_DAYS
from app.models.climate import ClimateSeason
from app.models.crop_option import CropParams
from app.models.raio_x import (
    AguaTerra,
    AlertaChuvaForte,
    AlertaGeada,
    CalorOutono,
    ChuvaTipica,
    Veranico,
)
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules
from app.services.calendar_days import month_day
from app.services.rain_end_service import RainEndService

SOURCE_SEPARATOR: Final[str] = "+"
# Temperatura e ETo da temporada vêm sempre do NASA POWER (a carga do IMERG só troca a chuva).
POWER_SOURCE: Final[str] = "nasa_power"
MM_DECIMALS: Final[int] = 1
MEAN_DAYS_DECIMALS: Final[int] = 2

ReferenceEto = Callable[[ClimateSeason], Sequence[float]]


def _full(season: ClimateSeason) -> bool:
    """A temporada guardada inteira: 212 dias desde 1/jan (no bissexto, até 30/jul)."""
    return (
        season.start_date == date(season.year, 1, 1) and len(season.rain_mm) == CLIMATE_SEASON_DAYS
    )


def _window(season: ClimateSeason, inicio: str, fim: str) -> range:
    """Índices dos dias da temporada de `inicio` a `fim` ("MM-DD", inclusivos) que estão nela."""
    first = (date(season.year, *month_day(inicio)) - season.start_date).days
    last = (date(season.year, *month_day(fim)) - season.start_date).days
    return range(max(first, 0), min(last, len(season.rain_mm) - 1) + 1)


def _sources(seasons: Sequence[ClimateSeason]) -> str:
    return SOURCE_SEPARATOR.join(sorted({season.rain_source for season in seasons}))


class RaioXClimateService:
    """Contas por ano na série guardada da célula, com os anos em ordem."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._rules = rules if rules is not None else load_default_rules()
        self._raio_x = self._rules.raio_x
        self._alertas = self._rules.alertas_area
        self._rain_end = RainEndService(self._rules)

    def _usable(self, seasons: Sequence[ClimateSeason]) -> list[ClimateSeason]:
        return sorted((s for s in seasons if _full(s)), key=lambda s: s.year)

    def typical_rain(self, seasons: Sequence[ClimateSeason]) -> ChuvaTipica | None:
        """Bloco 5: média da chuva somada de `chuva_inicio` a `chuva_fim` e o fim das chuvas."""
        usable = self._usable(seasons)
        if not usable:
            return None
        regra = self._raio_x
        totals = [
            sum(s.rain_mm[i] for i in _window(s, regra.chuva_inicio, regra.chuva_fim))
            for s in usable
        ]
        return ChuvaTipica(
            media_mm=round(mean(totals), MM_DECIMALS),
            anos=tuple(s.year for s in usable),
            fonte=_sources(usable),
            fim_das_chuvas=self._rain_end.summarize(usable),
        )

    def longest_dry_spell(self, seasons: Sequence[ClimateSeason]) -> Veranico | None:
        """Bloco 6: a maior sequência de dias com chuva abaixo do dia seco dos avisos na janela.

        Empate entre anos: vale o mais recente (o que o produtor mais lembra).
        """
        usable = self._usable(seasons)
        if not usable:
            return None
        regra = self._raio_x
        dry_below = self._rules.avisos.dia_seco_abaixo_mm
        best: tuple[int, int, int] | None = None  # (dias, ano, índice do começo)
        for season in usable:
            run = start = 0
            for i in _window(season, regra.veranico_inicio, regra.veranico_fim):
                if season.rain_mm[i] < dry_below:
                    start = i if run == 0 else start
                    run += 1
                    if best is None or (run, season.year) >= (best[0], best[1]):
                        best = (run, season.year, start)
                else:
                    run = 0
        if best is None:
            return None
        dias, ano, start = best
        season = next(s for s in usable if s.year == ano)
        first_day = season.start_date + timedelta(days=start)
        return Veranico(
            dias=dias,
            ano=ano,
            inicio=f"{first_day:%m-%d}",
            total_anos=len(usable),
            fonte=_sources(usable),
        )

    def heat_years(self, seasons: Sequence[ClimateSeason]) -> CalorOutono | None:
        """Bloco 7: anos com algum dia de máxima no calor do motor (ou acima) na janela."""
        usable = self._usable(seasons)
        if not usable:
            return None
        regra = self._raio_x
        limit = self._rules.clima.calor_temp_c
        hot = tuple(
            s.year
            for s in usable
            if any(s.tmax_c[i] >= limit for i in _window(s, regra.calor_inicio, regra.calor_fim))
        )
        return CalorOutono(
            anos_com_calor=len(hot),
            total_anos=len(usable),
            temp_c=limit,
            anos=hot,
            fonte=POWER_SOURCE,
        )

    def frost(self, seasons: Sequence[ClimateSeason]) -> AlertaGeada | None:
        """Alerta de geada: anos com a mínima no limite, ou abaixo, na janela; só com risco."""
        usable = self._usable(seasons)
        regra = self._alertas
        lows = {
            s.year: min(s.tmin_c[i] for i in _window(s, regra.geada_inicio, regra.geada_fim))
            for s in usable
        }
        cold = tuple(year for year, low in lows.items() if low <= regra.geada_temp_c)
        if len(cold) < regra.geada_anos_min or not cold:
            return None
        return AlertaGeada(
            anos=cold,
            total_anos=len(usable),
            temp_c=regra.geada_temp_c,
            menor_temp_c=round(min(lows.values()), MM_DECIMALS),
            fonte=POWER_SOURCE,
        )

    def heavy_rain(self, seasons: Sequence[ClimateSeason]) -> AlertaChuvaForte | None:
        """Alerta de chuva forte: média de dias por ano com chuva no limite, ou mais, na janela."""
        usable = self._usable(seasons)
        if not usable:
            return None
        regra = self._alertas
        days = sum(
            1
            for s in usable
            for i in _window(s, regra.chuva_forte_inicio, regra.chuva_forte_fim)
            if s.rain_mm[i] >= regra.chuva_forte_mm
        )
        per_year = days / len(usable)
        if per_year < regra.chuva_forte_media_min_dias:
            return None
        return AlertaChuvaForte(
            media_dias_ano=round(per_year, MEAN_DAYS_DECIMALS),
            dias=days,
            total_anos=len(usable),
            limite_mm=regra.chuva_forte_mm,
            fonte=_sources(usable),
        )

    def flowering_water(
        self,
        seasons: Sequence[ClimateSeason],
        crop: CropParams,
        semeadura: date,
        cad_mm: float,
        reference_eto: ReferenceEto,
    ) -> AguaTerra:
        """Bloco 2: a CAD e quantos dias ela dura no consumo da cultura na floração.

        Floração = semeadura (dia e mês da faixa) + `dias_florescer`; o consumo é a ETo média do
        motor (`reference_eto`) nos dias da janela do aperto em volta da floração
        (`clima.janela_grao_meia_dias`), em todos os anos, × `kc_pico`. Sem cultura (pousio), só
        a CAD.
        """
        if crop.dias_florescer <= 0 or crop.kc_pico <= 0:
            return AguaTerra(cad_mm, None, None, None, None, None, None, None)
        half = self._rules.clima.janela_grao_meia_dias
        values: list[float] = []
        for season in self._usable(seasons):
            sowing = date(season.year, semeadura.month, semeadura.day)
            flowering = sowing + timedelta(days=crop.dias_florescer)
            eto = reference_eto(season)
            center = (flowering - season.start_date).days
            values += [eto[i] for i in range(center - half, center + half + 1) if 0 <= i < len(eto)]
        flowering_day = semeadura + timedelta(days=crop.dias_florescer)
        if not values:
            return AguaTerra(
                cad_mm, None, crop.id, crop.nome, f"{flowering_day:%m-%d}", None, None, None
            )
        eto_day = round(mean(values), MM_DECIMALS)
        use = round(eto_day * crop.kc_pico, MM_DECIMALS)
        return AguaTerra(
            cad_mm=cad_mm,
            dias=math.floor(cad_mm / use) if use > 0 else None,
            cultura=crop.id,
            nome=crop.nome,
            floracao=f"{flowering_day:%m-%d}",
            eto_mm_dia=eto_day,
            kc=crop.kc_pico,
            consumo_mm_dia=use,
        )
