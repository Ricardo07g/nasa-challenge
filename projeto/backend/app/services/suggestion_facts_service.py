"""Fatos da aba Sugestão tirados dos anos simulados de uma opção (seção 5.4, tarefa 0044).

- El Niño e La Niña: em quantos anos de cada fase a opção deu certo, contra os outros anos, e se a
  diferença é clara (grupo `enso_acerto` do `regras.yaml`). Só informa: não entra na conta.
- O que observar: o veranico típico da fase crítica e os anos com calor nela.

Tudo sai do `anos_detalhe` que o motor já monta (`YearDetailService`): nada é simulado de novo.
"""

from collections.abc import Sequence
from math import floor
from statistics import median
from typing import Final

from app.constants import PERCENT_DIVISOR
from app.models.enso import FaseEnso
from app.models.recomendacao import AnoDetalhe, EnsoAcerto, ObservarOpcao
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules

# Ordem das fases na resposta (a mesma da legenda da tela)
ENSO_PHASES: Final[tuple[FaseEnso, ...]] = ("el_nino", "la_nina")


class SuggestionFactsService:
    """El Niño / La Niña e o que observar, a partir do detalhe de cada ano de uma opção."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._acerto = (rules if rules is not None else load_default_rules()).enso_acerto

    def enso_hit_rates(self, anos: Sequence[AnoDetalhe]) -> tuple[EnsoAcerto, ...]:
        """Um item por fase que aparece na série (sem o arquivo do ONI, nenhum).

        "Outros anos" são todos os da série fora da fase (neutros e a outra fase).
        """
        return tuple(
            self._phase(fase, anos) for fase in ENSO_PHASES if any(a.enso == fase for a in anos)
        )

    def _phase(self, fase: FaseEnso, anos: Sequence[AnoDetalhe]) -> EnsoAcerto:
        na_fase = [a for a in anos if a.enso == fase]
        outros = [a for a in anos if a.enso != fase]
        bons = sum(1 for a in na_fase if a.bom)
        bons_outros = sum(1 for a in outros if a.bom)
        return EnsoAcerto(
            fase=fase,
            anos=len(na_fase),
            bons=bons,
            anos_outros=len(outros),
            bons_outros=bons_outros,
            clara=self._is_clear(bons, len(na_fase), bons_outros, len(outros)),
        )

    def _is_clear(self, bons: int, anos: int, bons_outros: int, anos_outros: int) -> bool:
        if anos < self._acerto.anos_fase_min or anos_outros == 0:
            return False
        diferenca = abs(bons / anos - bons_outros / anos_outros) * PERCENT_DIVISOR
        return diferenca >= self._acerto.diferenca_min_pct

    @staticmethod
    def watch_facts(anos: Sequence[AnoDetalhe]) -> ObservarOpcao | None:
        """Veranico típico (mediana para baixo) e anos com calor na fase crítica; None sem anos."""
        if not anos:
            return None
        return ObservarOpcao(
            veranico_dias=floor(median(a.dias_sem_chuva for a in anos)),
            anos_calor=sum(1 for a in anos if a.calor),
            total=len(anos),
        )
