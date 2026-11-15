"""Chuva que sobra depois da colheita (tela 3 "Quando você colhe a soja?", tarefa 0042)."""

import math
from collections.abc import Sequence
from datetime import date, timedelta
from itertools import accumulate
from statistics import median
from typing import Final

from app.models.climate import ClimateSeason
from app.models.regras import Regras
from app.models.talhao import ChuvaQueSobra, ChuvaQueSobraDia
from app.repositories.rules_repository import load_default_rules
from app.services.calendar_days import COMMON_YEAR, month_day

# Uma casa decimal, como os outros milímetros da API.
MM_DECIMALS: Final[int] = 1
SOURCE_SEPARATOR: Final[str] = "+"


def percentile(values: Sequence[float], pct: float) -> float:
    """Percentil com interpolação linear entre os valores ordenados (o padrão do numpy).

    A posição é (n − 1) × pct / 100: com 20 anos, o percentil 20 fica a 0,8 do caminho entre o
    4º e o 5º ano mais seco.
    """
    ordered = sorted(values)
    position = (len(ordered) - 1) * pct / 100
    lower = math.floor(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def harvest_days(start: str, end: str) -> list[tuple[int, int]]:
    """Os dias (mês, dia) de `start` a `end` ("MM-DD"), num ano comum (sem 29/fev)."""
    first = date(COMMON_YEAR, *month_day(start))
    last = date(COMMON_YEAR, *month_day(end))
    days = (last - first).days + 1
    return [((first + timedelta(d)).month, (first + timedelta(d)).day) for d in range(days)]


class RemainingRainService:
    """Para cada dia de colheita da época, a chuva do dia até o fim de junho em cada ano.

    Só entra o ano cuja série vai do primeiro dia da época até o `fim` (um ano pela metade teria
    menos chuva do que caiu). Sem nenhum ano assim, None (o elemento não aparece na tela).
    """

    def __init__(self, rules: Regras | None = None) -> None:
        regras = rules if rules is not None else load_default_rules()
        self._colheita = regras.colheita
        self._regra = regras.chuva_que_sobra

    def summarize(self, seasons: Sequence[ClimateSeason]) -> ChuvaQueSobra | None:
        """A mediana e o ano seco da chuva que sobra, dia a dia da época da colheita."""
        days = harvest_days(self._colheita.janela_inicio, self._colheita.janela_fim)
        complete = sorted((s for s in seasons if self._covers(s, days[0])), key=lambda s: s.year)
        if not complete:
            return None

        # Soma acumulada de cada ano: a chuva de um dia até o fim é uma subtração.
        per_year = [self._sums_to_end(season, days) for season in complete]
        pct = self._regra.percentil_seco
        dias = tuple(
            ChuvaQueSobraDia(
                dia=f"{month:02d}-{day:02d}",
                mediana_mm=round(median(year[idx] for year in per_year), MM_DECIMALS),
                seco_mm=round(percentile([year[idx] for year in per_year], pct), MM_DECIMALS),
            )
            for idx, (month, day) in enumerate(days)
        )
        return ChuvaQueSobra(
            fim=self._regra.fim,
            percentil_seco=pct,
            dias=dias,
            anos=tuple(season.year for season in complete),
            fonte=SOURCE_SEPARATOR.join(sorted({season.rain_source for season in complete})),
        )

    def _end_index(self, season: ClimateSeason) -> int:
        """Posição do `fim` (inclusive) na série da temporada."""
        return (date(season.year, *month_day(self._regra.fim)) - season.start_date).days

    def _covers(self, season: ClimateSeason, first_day: tuple[int, int]) -> bool:
        starts_before = season.start_date <= date(season.year, *first_day)
        return starts_before and self._end_index(season) < len(season.rain_mm)

    def _sums_to_end(self, season: ClimateSeason, days: list[tuple[int, int]]) -> list[float]:
        end = self._end_index(season)
        cumulative = [0.0, *accumulate(season.rain_mm[: end + 1])]
        return [
            cumulative[end + 1] - cumulative[(date(season.year, m, d) - season.start_date).days]
            for m, d in days
        ]
