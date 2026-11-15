"""Cartão "Clima 2041–2060" do raio-X (tela 4, remodelagem S4, tarefa 0043).

Variação da chuva (%) e da máxima (°C) de março a maio pelos deltas do NEX-GDDP-CMIP6 da célula
(`cmip6_delta`, 2041–2060 contra 1995–2014, SSP2-4.5), a média dos modelos e quantos concordam.
"""

from collections import defaultdict
from collections.abc import Sequence
from datetime import timedelta
from statistics import mean
from typing import Final

from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.raio_x import ClimaFuturo
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules

CMIP6_PERIOD: Final[str] = "2041-2060"
DECIMALS: Final[int] = 1


class FutureClimateService:
    """Os deltas de `futuro_mes_inicio` a `futuro_mes_fim`, por modelo e na média dos modelos."""

    def __init__(self, rules: Regras | None = None) -> None:
        regra = (rules if rules is not None else load_default_rules()).raio_x
        self._months = range(regra.futuro_mes_inicio, regra.futuro_mes_fim + 1)

    def _monthly_rain(self, seasons: Sequence[ClimateSeason]) -> dict[int, float]:
        """Chuva média de cada mês da janela na série guardada (o peso de cada mês)."""
        totals: dict[int, list[float]] = defaultdict(list)
        for season in seasons:
            by_month: dict[int, float] = defaultdict(float)
            for i, rain in enumerate(season.rain_mm):
                month = (season.start_date + timedelta(days=i)).month
                if month in self._months:
                    by_month[month] += rain
            for month in self._months:
                totals[month].append(by_month.get(month, 0.0))
        return {month: mean(values) for month, values in totals.items() if values}

    def summarize(
        self, deltas: Sequence[Cmip6Delta], seasons: Sequence[ClimateSeason]
    ) -> ClimaFuturo | None:
        """`None` sem deltas nos meses da janela.

        Chuva de cada modelo: a variação de cada mês pesada pela chuva média do mês na célula
        (março chove mais que maio); sem série guardada, a média simples dos meses. Máxima: a média
        simples dos meses. O cartão mostra a média dos modelos e quantos indicam menos chuva, mais
        chuva e mais calor.
        """
        by_model: dict[str, list[Cmip6Delta]] = defaultdict(list)
        for delta in deltas:
            if delta.month in self._months:
                by_model[delta.model].append(delta)
        if not by_model:
            return None
        weights = self._monthly_rain(seasons)
        rain_by_model: list[float] = []
        tmax_by_model: list[float] = []
        for model_deltas in by_model.values():
            weight = [weights.get(d.month, 0.0) for d in model_deltas]
            if sum(weight) > 0:
                rain = sum(w * d.rain_pct for w, d in zip(weight, model_deltas, strict=True))
                rain_by_model.append(rain / sum(weight))
            else:
                rain_by_model.append(mean(d.rain_pct for d in model_deltas))
            tmax_by_model.append(mean(d.tmax_c for d in model_deltas))
        return ClimaFuturo(
            chuva_pct=round(mean(rain_by_model), DECIMALS),
            tmax_c=round(mean(tmax_by_model), DECIMALS),
            modelos=len(by_model),
            modelos_menos_chuva=sum(r < 0 for r in rain_by_model),
            modelos_mais_chuva=sum(r > 0 for r in rain_by_model),
            modelos_mais_quente=sum(t > 0 for t in tmax_by_model),
            cenario=next(iter(by_model.values()))[0].scenario,
            periodo=CMIP6_PERIOD,
        )
