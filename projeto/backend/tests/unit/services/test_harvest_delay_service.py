"""Custo do atraso da colheita (tela 3, tarefa 0042): a melhor opção do motor em cada faixa.

O motor é falso (resultados de teste, não de dado real): o service só junta o que ele devolve.
"""

from datetime import date
from types import SimpleNamespace
from typing import Any

import pytest

from app.models.custo_atraso import CustoFaixa
from app.services.errors import OutsideAreaError
from app.services.harvest_delay_service import HarvestDelayService

SOWING = {"cedo": date(2027, 2, 8), "meio": date(2027, 2, 18), "tarde": date(2027, 3, 3)}


def _option(crop_id: str, anos_bons: int, total: int = 20) -> SimpleNamespace:
    return SimpleNamespace(
        id=crop_id, nome=f"nome {crop_id}", anos_bons_chuva=anos_bons, total_anos=total
    )


class FakeRecommender:
    """Melhor opção de teste por faixa; guarda os pedidos para conferir os parâmetros."""

    def __init__(self, best: dict[str, tuple[str, int] | None]) -> None:
        self._best = best
        self.calls: list[dict[str, Any]] = []

    def recommend(self, **kwargs: Any) -> SimpleNamespace:
        self.calls.append(kwargs)
        colheita = kwargs["colheita"]
        best = self._best[colheita]
        if best is None:  # nenhuma opção cabe na janela: o motor diz "pousio" e não lista opção
            return SimpleNamespace(melhor="pousio", opcoes=(), semeadura=SOWING[colheita])
        crop_id, anos_bons = best
        others = (_option("sorgo", 1),)
        return SimpleNamespace(
            melhor=crop_id,
            opcoes=(_option(crop_id, anos_bons), *others),
            semeadura=SOWING[colheita],
        )


def test_should_give_the_best_option_of_the_engine_for_each_harvest_band() -> None:
    recommender = FakeRecommender(
        {"cedo": ("milho_safrinha", 18), "meio": ("milho_safrinha", 15), "tarde": ("milheto", 17)}
    )

    custo = HarvestDelayService(recommender).delay_cost(lat=-18.95, lon=-48.2)

    assert custo.faixas == (
        CustoFaixa("cedo", date(2027, 2, 8), "milho_safrinha", "nome milho_safrinha", 18, 20),
        CustoFaixa("meio", date(2027, 2, 18), "milho_safrinha", "nome milho_safrinha", 15, 20),
        CustoFaixa("tarde", date(2027, 3, 3), "milheto", "nome milheto", 17, 20),
    )
    assert custo.mesma_cultura is False


def test_should_say_when_the_best_option_is_the_same_in_every_band() -> None:
    recommender = FakeRecommender(
        {"cedo": ("milheto", 19), "meio": ("milheto", 18), "tarde": ("milheto", 16)}
    )

    custo = HarvestDelayService(recommender).delay_cost(lat=-18.95, lon=-48.2)

    assert custo.mesma_cultura is True


def test_should_pass_the_soil_the_confirmations_and_the_language_to_the_engine() -> None:
    recommender = FakeRecommender(dict.fromkeys(("cedo", "meio", "tarde"), ("milheto", 18)))

    HarvestDelayService(recommender).delay_cost(
        lat=-18.95, lon=-48.2, solo_override="arenoso", confirmadas=[(2025, "parado")], lang="en"
    )

    assert [call["colheita"] for call in recommender.calls] == ["cedo", "meio", "tarde"]
    assert all(call["solo_override"] == "arenoso" for call in recommender.calls)
    assert all(call["confirmadas"] == [(2025, "parado")] for call in recommender.calls)
    assert all(call["lang"] == "en" for call in recommender.calls)


def test_should_leave_a_band_without_an_option_in_the_planting_window_empty() -> None:
    recommender = FakeRecommender({"cedo": ("milheto", 18), "meio": ("milheto", 18), "tarde": None})

    custo = HarvestDelayService(recommender).delay_cost(lat=-18.95, lon=-48.2)

    assert custo.faixas[2] == CustoFaixa("tarde", date(2027, 3, 3), None, None, None, None)
    assert custo.mesma_cultura is False


def test_should_let_the_outside_area_error_of_the_engine_go_up() -> None:
    class OutsideRecommender:
        def recommend(self, **kwargs: Any) -> SimpleNamespace:
            raise OutsideAreaError("sem dados")

    with pytest.raises(OutsideAreaError):
        HarvestDelayService(OutsideRecommender()).delay_cost(lat=-23.5, lon=-46.6)
