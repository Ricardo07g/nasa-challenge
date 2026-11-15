"""Clima de 2041-2060 e geada na célula, para a aba Sugestão (seção 5.4, tarefa 0044).

Cálculo pequeno da S5a: a seção 4 (raio-X) faz o mesmo nos cartões menores e no alerta de geada.
Os números ficam nos grupos `clima_futuro_sugestao` e `geada_sugestao` do `regras.yaml`; unificar
com o da S4 na S9.
"""

from collections import defaultdict
from collections.abc import Sequence
from datetime import timedelta
from statistics import mean
from typing import Final

from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.recomendacao import ClimaFuturoCelula, GeadaCelula
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules

DELTA_DECIMALS: Final[int] = 1


def _agreeing(values: Sequence[float], average: float) -> int:
    """Modelos que vão no mesmo sentido da média (média zero ou positiva: os que não diminuem)."""
    if average >= 0:
        return sum(1 for value in values if value >= 0)
    return sum(1 for value in values if value < 0)


class CellClimateFactsService:
    """Variação de chuva e máxima em 2041-2060 e anos com geada, na célula do ponto."""

    def __init__(self, rules: Regras | None = None) -> None:
        regras = rules if rules is not None else load_default_rules()
        self._futuro = regras.clima_futuro_sugestao
        self._geada = regras.geada_sugestao

    def future_outlook(self, deltas: Sequence[Cmip6Delta]) -> ClimaFuturoCelula | None:
        """Média dos meses de cada modelo e a média entre os modelos; None sem deltas nos meses."""
        meses = set(self._futuro.meses)
        by_model: dict[str, list[Cmip6Delta]] = defaultdict(list)
        for delta in deltas:
            if delta.month in meses:
                by_model[delta.model].append(delta)
        if not by_model:
            return None
        chuva = [mean(d.rain_pct for d in model) for model in by_model.values()]
        tmax = [mean(d.tmax_c for d in model) for model in by_model.values()]
        chuva_media, tmax_media = mean(chuva), mean(tmax)
        return ClimaFuturoCelula(
            chuva_pct=round(chuva_media, DELTA_DECIMALS),
            tmax_c=round(tmax_media, DELTA_DECIMALS),
            modelos=len(by_model),
            concordam_chuva=_agreeing(chuva, chuva_media),
            concordam_tmax=_agreeing(tmax, tmax_media),
            meses=self._futuro.meses,
            cenario=next(iter(by_model.values()))[0].scenario,
        )

    def frost_risk(self, seasons: Sequence[ClimateSeason]) -> GeadaCelula | None:
        """Em quantos anos houve mínima de `tmin_max_c` °C ou menos nos meses; None sem série."""
        if not seasons:
            return None
        return GeadaCelula(
            anos=sum(1 for season in seasons if self._had_frost(season)),
            total=len(seasons),
            tmin_max_c=self._geada.tmin_max_c,
            meses=self._geada.meses,
        )

    def _had_frost(self, season: ClimateSeason) -> bool:
        meses = set(self._geada.meses)
        return any(
            tmin <= self._geada.tmin_max_c
            for idx, tmin in enumerate(season.tmin_c)
            if (season.start_date + timedelta(days=idx)).month in meses
        )
