"""Fim das chuvas na célula (tela 3 "Quando você colhe a soja?", tarefa 0042).

O raio-X da seção 4 da remodelagem (bloco "Chuva de um ano típico") usa esta mesma regra.
"""

import math
from collections.abc import Sequence
from datetime import date, timedelta
from statistics import median
from typing import Final

from app.models.climate import ClimateSeason
from app.models.regras import Regras
from app.models.talhao import DiaDoAno, FimDasChuvas
from app.repositories.rules_repository import load_default_rules
from app.services.calendar_days import common_day_of_year, month_day, month_day_text

SOURCE_SEPARATOR: Final[str] = "+"


class RainEndService:
    """Em cada ano, o dia em que a chuva acabou; nos anos, a mediana, o mais cedo e o mais tarde.

    Regra (grupo `fim_das_chuvas` do regras.yaml): o primeiro dia, a partir de `inicio`, que
    começa `dias` dias seguidos com menos de `chuva_max_mm` mm somados. Se algum ano não tem esse
    dia dentro da série, não há resultado (None): sem ele, a mediana e o mais tarde sairiam
    errados.
    """

    def __init__(self, rules: Regras | None = None) -> None:
        self._regra = (rules if rules is not None else load_default_rules()).fim_das_chuvas

    def end_of_rains(self, season: ClimateSeason) -> date | None:
        """O dia em que a chuva acabou no ano da temporada; None se não acabou dentro da série."""
        regra = self._regra
        first = (date(season.year, *month_day(regra.inicio)) - season.start_date).days
        if first < 0:
            return None
        rain = season.rain_mm
        for start in range(first, len(rain) - regra.dias + 1):
            if sum(rain[start : start + regra.dias]) < regra.chuva_max_mm:
                return season.start_date + timedelta(days=start)
        return None

    def summarize(self, seasons: Sequence[ClimateSeason]) -> FimDasChuvas | None:
        """Mediana (arredondada para baixo, num ano comum), o mais cedo e o mais tarde."""
        if not seasons:
            return None
        ordered = sorted(seasons, key=lambda s: s.year)
        ends = [(season.year, self.end_of_rains(season)) for season in ordered]
        if any(end is None for _, end in ends):
            return None

        by_day = sorted((common_day_of_year(end), year) for year, end in ends if end is not None)
        earliest_doy, earliest_year = by_day[0]
        latest_doy, latest_year = by_day[-1]
        regra = self._regra
        return FimDasChuvas(
            mediana=month_day_text(math.floor(median(doy for doy, _ in by_day))),
            mais_cedo=DiaDoAno(dia=month_day_text(earliest_doy), ano=earliest_year),
            mais_tarde=DiaDoAno(dia=month_day_text(latest_doy), ano=latest_year),
            anos=tuple(season.year for season in ordered),
            fonte=SOURCE_SEPARATOR.join(sorted({season.rain_source for season in ordered})),
            inicio=regra.inicio,
            dias=regra.dias,
            chuva_max_mm=regra.chuva_max_mm,
        )
