"""Plano A e Plano B da aba "Plano de 3 anos" (seção 5.6 da remodelagem, tarefa 0045).

- Plano A: a cultura do 1º ano do plano, "se a chuva vier normal".
- Plano B: a cultura na janela que mais deu certo nos anos em que a do Plano A falhou (os anos do
  motor, PRD 7.2), "se secar".
- "Secar" vira número só se a série mostrar: a chuva dos `dias_antes_semeadura` dias antes da
  semeadura que melhor separa os anos bons dos ruins da cultura do Plano A, e só se essa separação
  passar no critério do grupo `plano_b` do `regras.yaml` (hipótese do time). Senão, sem número.
"""

from collections.abc import Mapping, Sequence
from datetime import date, timedelta
from math import comb
from typing import Final

from app.constants import PERCENT_DIVISOR
from app.models.climate import ClimateSeason
from app.models.plano import LimiteChuva, PlanoAB
from app.models.recomendacao import ResultadoOpcao
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules
from app.services.rotation_plan_service import FALLOW_ID

FEW_FAILURES: Final[str] = "poucas_falhas"
NO_SEPARATION: Final[str] = "nao_separa"
FALLOW_PLAN: Final[str] = "pousio"
NEVER_FAILED: Final[str] = "nunca_falhou"
NONE_BETTER: Final[str] = "nenhuma_melhor"


def _same_day(year: int, day: date) -> date:
    """O dia e o mês da semeadura no ano da temporada (29/fev vira 28/fev)."""
    try:
        return day.replace(year=year)
    except ValueError:
        return date(year, day.month, day.day - 1)


def _chance_at_least(hits: int, flagged: int, failures: int, total: int) -> float:
    """Chance de pegar `hits` falhas ou mais marcando `flagged` anos ao acaso (hipergeométrica)."""
    ways = comb(total, flagged)
    good = total - failures
    return (
        sum(
            comb(failures, k) * comb(good, flagged - k)
            for k in range(hits, min(failures, flagged) + 1)
        )
        / ways
    )


class PlanBService:
    """Escolhe o Plano B e procura o limite de chuva que define "secar" (grupo `plano_b`)."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._regras = (rules if rules is not None else load_default_rules()).plano_b

    def pre_sowing_rain(
        self, seasons: Sequence[ClimateSeason], semeadura: date
    ) -> dict[int, float]:
        """Chuva somada nos dias antes da semeadura (sem o próprio dia), em cada ano da série.

        Fica de fora a temporada que não cobre a janela inteira.
        """
        dias = self._regras.dias_antes_semeadura
        totals: dict[int, float] = {}
        for season in seasons:
            end = _same_day(season.year, semeadura)
            first = (end - timedelta(days=dias) - season.start_date).days
            last = (end - season.start_date).days
            if first < 0 or last > len(season.rain_mm):
                continue
            totals[season.year] = sum(season.rain_mm[first:last])
        return totals

    def rain_limit(
        self, outcomes: Mapping[int, bool], rain_by_year: Mapping[int, float]
    ) -> LimiteChuva | None:
        """O limite que mais acerta os anos de falha ("secou" = chuva abaixo dele).

        Marca os k anos mais secos (k de 1 ao total - 1, sem cortar entre dois anos com a mesma
        chuva); fica o k com mais acertos menos alarmes falsos (empate: o menor k). O limite é o
        meio entre o k-ésimo e o seguinte, em mm inteiros. None sem nenhum ano de falha.
        """
        rows = sorted((rain_by_year[y], y, outcomes[y]) for y in outcomes if y in rain_by_year)
        failures = sum(1 for _, _, bom in rows if not bom)
        total = len(rows)
        if failures == 0 or total < 2:
            return None

        best: tuple[int, int, int] | None = None  # (nota, k, falhas marcadas)
        hits = 0
        for k in range(1, total):
            hits += 0 if rows[k - 1][2] else 1
            if rows[k - 1][0] == rows[k][0]:
                continue
            score = hits - (k - hits)
            if best is None or score > best[0]:
                best = (score, k, hits)
        if best is None:
            return None
        _, flagged, hits = best
        limite = round((rows[flagged - 1][0] + rows[flagged][0]) / 2)
        chance = round(_chance_at_least(hits, flagged, failures, total) * PERCENT_DIVISOR, 1)

        regras = self._regras
        separates = (
            hits * PERCENT_DIVISOR >= regras.sensibilidade_min_pct * failures
            and hits * PERCENT_DIVISOR >= regras.precisao_min_pct * flagged
            and chance <= regras.chance_max_pct
        )
        if failures < regras.anos_falha_min:
            motivo: str | None = FEW_FAILURES
        elif not separates:
            motivo = NO_SEPARATION
        else:
            motivo = None
        return LimiteChuva(
            dias=regras.dias_antes_semeadura,
            chuva_mm=limite,
            anos_marcados=flagged,
            falhas_marcadas=hits,
            falhas=failures,
            total=total,
            chance_pct=chance,
            separa=motivo is None,
            motivo=motivo,
        )

    def plan_ab(
        self,
        first: str,
        opcoes: Sequence[ResultadoOpcao],
        seasons: Sequence[ClimateSeason],
        semeadura: date,
        nome_a: str | None = None,
    ) -> PlanoAB | None:
        """Plano A (a cultura `first`) e Plano B para ele; None se `first` não está na janela.

        `opcoes`: as opções na janela, do motor. `nome_a`: o nome do pousio (que não é opção).
        """
        if first == FALLOW_ID:
            return PlanoAB(
                cultura_a=FALLOW_ID,
                nome_a=nome_a or FALLOW_ID,
                falhas_a=0,
                total=0,
                cultura_b=None,
                nome_b=None,
                b_bons_nas_falhas=None,
                limite=None,
                motivo=FALLOW_PLAN,
            )
        a = next((o for o in opcoes if o.id == first), None)
        if a is None:
            return None
        outcomes = {d.ano: d.bom for d in a.anos_detalhe}
        failed = {ano for ano, bom in outcomes.items() if not bom}
        base = {
            "cultura_a": a.id,
            "nome_a": a.nome,
            "falhas_a": len(failed),
            "total": len(outcomes),
        }
        if not failed:
            return PlanoAB(
                **base,
                cultura_b=None,
                nome_b=None,
                b_bons_nas_falhas=None,
                limite=None,
                motivo=NEVER_FAILED,
            )

        def worked_when_a_failed(option: ResultadoOpcao) -> int:
            return sum(1 for d in option.anos_detalhe if d.ano in failed and d.bom)

        candidates = [o for o in opcoes if o.id not in (a.id, FALLOW_ID)]
        b = max(candidates, key=lambda o: (worked_when_a_failed(o), o.notas.final), default=None)
        b_hits = worked_when_a_failed(b) if b is not None else 0
        limite = self.rain_limit(outcomes, self.pre_sowing_rain(seasons, semeadura))
        if b is None or b_hits == 0:
            return PlanoAB(
                **base,
                cultura_b=None,
                nome_b=None,
                b_bons_nas_falhas=None,
                limite=limite,
                motivo=NONE_BETTER,
            )
        return PlanoAB(
            **base,
            cultura_b=b.id,
            nome_b=b.nome,
            b_bons_nas_falhas=b_hits,
            limite=limite,
            motivo=None,
        )
