"""Chuva de cada mês na região (gráfico da tela 3, "Quando você colhe a soja?")."""

from datetime import date, timedelta
from typing import Final

from app.models.climate import ClimateSeason
from app.models.talhao import ChuvaMensal, ChuvaMes

# O gráfico vai de janeiro a junho (protótipo do Lovable, tela 3): a chuva que vai acabando
# depois de março, quando a soja é colhida e a próxima planta entra.
CHART_MONTHS: Final[tuple[int, ...]] = (1, 2, 3, 4, 5, 6)
# Uma casa decimal, como os outros milímetros da API.
MM_DECIMALS: Final[int] = 1
SOURCE_SEPARATOR: Final[str] = "+"


class MonthlyRainService:
    """Total de cada mês em cada ano e a média entre os anos, de janeiro a junho.

    Só entra na média o ano cuja série cobre de 1/jan a 30/jun: um ano pela metade baixaria a
    média dos meses que faltam. Sem nenhum ano assim, não há gráfico (None).
    """

    def monthly_totals(self, season: ClimateSeason) -> dict[int, float]:
        """Chuva total (mm) de cada mês do gráfico no ano da temporada."""
        totals = dict.fromkeys(CHART_MONTHS, 0.0)
        for offset, rain in enumerate(season.rain_mm):
            day = season.start_date + timedelta(days=offset)
            if day.year == season.year and day.month in totals:
                totals[day.month] += rain
        return totals

    def summarize(self, seasons: list[ClimateSeason]) -> ChuvaMensal | None:
        """Média entre os anos do total de cada mês, com os anos usados e a fonte da chuva."""
        complete = sorted((s for s in seasons if _covers_chart_months(s)), key=lambda s: s.year)
        if not complete:
            return None
        totals = [self.monthly_totals(season) for season in complete]
        meses = tuple(
            ChuvaMes(
                mes=month,
                media_mm=round(sum(t[month] for t in totals) / len(totals), MM_DECIMALS),
            )
            for month in CHART_MONTHS
        )
        return ChuvaMensal(
            meses=meses,
            anos=tuple(season.year for season in complete),
            fonte=SOURCE_SEPARATOR.join(sorted({season.rain_source for season in complete})),
        )


def _covers_chart_months(season: ClimateSeason) -> bool:
    """A série vai do primeiro ao último dia dos meses do gráfico (1/jan a 30/jun)."""
    first_day = date(season.year, CHART_MONTHS[0], 1)
    after_last_month = date(season.year, CHART_MONTHS[-1] + 1, 1)
    last_day = season.start_date + timedelta(days=len(season.rain_mm) - 1)
    return season.start_date <= first_day and last_day >= after_last_month - timedelta(days=1)
