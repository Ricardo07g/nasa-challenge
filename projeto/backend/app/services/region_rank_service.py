"""Bloco 8 do raio-X "Sua área e a região" (tela 4, remodelagem S4, tarefa 0043).

A chuva média da célula de março a maio comparada com as outras células da caixa piloto:
"mais seca que X% da região". Só células com a mesma fonte de chuva (GPM IMERG na caixa).
"""

from collections import Counter, defaultdict
from collections.abc import Sequence
from datetime import date
from statistics import mean, median
from typing import Final

from app.models.climate import CellRainTotal
from app.models.raio_x import RegiaoChuva
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules
from app.services.calendar_days import month_day

MM_DECIMALS: Final[int] = 1
PERCENT: Final[int] = 100


class RegionRankService:
    """Posição da célula entre as da caixa na chuva da janela `regiao_inicio` a `regiao_fim`."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._regra = (rules if rules is not None else load_default_rules()).raio_x

    def window_days(self, year: int) -> int:
        """Quantos dias tem a janela no ano (para conferir que a temporada cobre a janela)."""
        regra = self._regra
        first = date(year, *month_day(regra.regiao_inicio))
        last = date(year, *month_day(regra.regiao_fim))
        return (last - first).days + 1

    def rank(self, cell_id: str, totals: Sequence[CellRainTotal]) -> RegiaoChuva | None:
        """`None` sem a célula, ou com menos de `regiao_min_celulas` células para comparar.

        Fonte: a da maioria dos anos da própria célula; os anos de outra fonte e os que não
        cobrem a janela inteira ficam de fora. "Mais seca que X%": as outras células com mais
        chuva média, sobre as outras células.
        """
        own_sources = Counter(t.rain_source for t in totals if t.cell_id == cell_id)
        if not own_sources:
            return None
        source = own_sources.most_common(1)[0][0]
        by_cell: dict[str, list[float]] = defaultdict(list)
        for total in totals:
            if total.rain_source == source and total.dias == self.window_days(total.year):
                by_cell[total.cell_id].append(total.total_mm)
        means = {cell: mean(values) for cell, values in by_cell.items()}
        if cell_id not in means or len(means) < self._regra.regiao_min_celulas:
            return None
        own = means[cell_id]
        others = [value for cell, value in means.items() if cell != cell_id]
        return RegiaoChuva(
            chuva_mm=round(own, MM_DECIMALS),
            mediana_regiao_mm=round(median(means.values()), MM_DECIMALS),
            celulas=len(means),
            pct_mais_seca=round(PERCENT * sum(v > own for v in others) / len(others)),
            pct_mais_chuvosa=round(PERCENT * sum(v < own for v in others) / len(others)),
            fonte=source,
        )
