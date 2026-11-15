"""Chuva de cada mês na região e o que a lavoura gasta (tela 3, "Quando você colhe a soja?")."""

from collections.abc import Callable, Sequence
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
# A ETo das temporadas é calculada com o clima do NASA POWER (FAO-56 Penman-Monteith ou, sem as
# variáveis, Hargreaves-Samani): é a fonte da evapotranspiração, mesmo quando a chuva é do IMERG.
ETO_SOURCE: Final[str] = "nasa_power"

ReferenceEto = Callable[[ClimateSeason], Sequence[float]]


def _season_eto(season: ClimateSeason) -> Sequence[float]:
    return season.eto_mm


class MonthlyRainService:
    """Total de cada mês em cada ano e a média entre os anos, de janeiro a junho.

    Só entra na média o ano cuja série cobre de 1/jan a 30/jun: um ano pela metade baixaria a
    média dos meses que faltam. Sem nenhum ano assim, não há gráfico (None).

    Com a ETo (tarefa 0042), a média da evapotranspiração de referência de cada mês e o primeiro
    mês em que a chuva fica menor que ela. `reference_eto` é a ETo diária de uma temporada: a API
    injeta a do motor (`ClimateRiskService.reference_eto`, que calcula Hargreaves-Samani quando a
    temporada não traz); o padrão usa só a ETo gravada.
    """

    def __init__(self, reference_eto: ReferenceEto | None = None) -> None:
        self._reference_eto = reference_eto or _season_eto

    def monthly_totals(
        self, season: ClimateSeason, daily: Sequence[float] | None = None
    ) -> dict[int, float]:
        """Total (mm) de cada mês do gráfico no ano da temporada: a chuva, ou a série `daily`."""
        values = season.rain_mm if daily is None else daily
        totals = dict.fromkeys(CHART_MONTHS, 0.0)
        for offset, value in enumerate(values):
            day = season.start_date + timedelta(days=offset)
            if day.year == season.year and day.month in totals:
                totals[day.month] += value
        return totals

    def summarize(self, seasons: list[ClimateSeason]) -> ChuvaMensal | None:
        """Média entre os anos do total de cada mês, com os anos usados e a fonte da chuva."""
        complete = sorted((s for s in seasons if _covers_chart_months(s)), key=lambda s: s.year)
        if not complete:
            return None
        rain = [self.monthly_totals(season) for season in complete]
        eto = self._eto_totals(complete)

        def average(totals: list[dict[int, float]], month: int) -> float:
            return round(sum(t[month] for t in totals) / len(totals), MM_DECIMALS)

        meses = tuple(
            ChuvaMes(
                mes=month,
                media_mm=average(rain, month),
                eto_media_mm=average(eto, month) if eto else None,
            )
            for month in CHART_MONTHS
        )
        return ChuvaMensal(
            meses=meses,
            anos=tuple(season.year for season in complete),
            fonte=SOURCE_SEPARATOR.join(sorted({season.rain_source for season in complete})),
            fonte_eto=ETO_SOURCE if eto else None,
            mes_chuva_abaixo_eto=_first_month_below_demand(meses),
        )

    def _eto_totals(self, seasons: list[ClimateSeason]) -> list[dict[int, float]]:
        """ETo de cada mês em cada ano; vazio se algum ano não tem ETo para a série inteira."""
        daily = [self._reference_eto(season) for season in seasons]
        if any(len(eto) < len(season.rain_mm) for eto, season in zip(daily, seasons, strict=True)):
            return []
        return [self.monthly_totals(s, eto) for s, eto in zip(seasons, daily, strict=True)]


def _first_month_below_demand(meses: tuple[ChuvaMes, ...]) -> int | None:
    """Primeiro mês em que a chuva média fica menor que a ETo média."""
    return next(
        (m.mes for m in meses if m.eto_media_mm is not None and m.media_mm < m.eto_media_mm),
        None,
    )


def _covers_chart_months(season: ClimateSeason) -> bool:
    """A série vai do primeiro ao último dia dos meses do gráfico (1/jan a 30/jun)."""
    first_day = date(season.year, CHART_MONTHS[0], 1)
    after_last_month = date(season.year, CHART_MONTHS[-1] + 1, 1)
    last_day = season.start_date + timedelta(days=len(season.rain_mm) - 1)
    return season.start_date <= first_day and last_day >= after_last_month - timedelta(days=1)
