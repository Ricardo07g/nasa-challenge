"""Custo do atraso da colheita (tela 3 "Quando você colhe a soja?", tarefa 0042).

"Colhendo cedo, deu certo em A de 20 anos; no meio, B de 20; tarde, C de 20." Os números são os
do motor do `/recomendacao` (a melhor opção de cada faixa e os anos sem aperto dela): nada é
calculado de novo aqui.
"""

from collections.abc import Iterable
from typing import Protocol

from app.constants import SOWING_MONTH_DAY_BY_HARVEST
from app.models.custo_atraso import CustoAtraso, CustoFaixa
from app.models.recomendacao import Recomendacao


class RecommenderProtocol(Protocol):
    """O motor do /recomendacao (`RecommendationService.recommend`)."""

    def recommend(
        self,
        lat: float,
        lon: float,
        colheita: str = "meio",
        solo_override: str | None = None,
        nematoide: bool | None = None,
        gado: bool | None = None,
        lang: str = "pt-BR",
        confirmadas: Iterable[tuple[int, str]] = (),
    ) -> Recomendacao: ...


class HarvestDelayService:
    """A melhor opção do motor em cada faixa de colheita, com os anos em que deu certo."""

    def __init__(self, recommender: RecommenderProtocol) -> None:
        self._recommender = recommender

    def delay_cost(
        self,
        lat: float,
        lon: float,
        solo_override: str | None = None,
        confirmadas: Iterable[tuple[int, str]] = (),
        lang: str = "pt-BR",
    ) -> CustoAtraso:
        """Uma recomendação por faixa (cedo, meio, tarde), com o mesmo solo e as mesmas safras.

        Raises:
            OutsideAreaError / ValidationDomainError: os mesmos do `/recomendacao`.
        """
        confirmadas = list(confirmadas)
        faixas = tuple(
            self._band(lat, lon, colheita, solo_override, confirmadas, lang)
            for colheita in SOWING_MONTH_DAY_BY_HARVEST
        )
        melhores = {faixa.melhor for faixa in faixas}
        return CustoAtraso(faixas=faixas, mesma_cultura=len(melhores) == 1 and None not in melhores)

    def _band(
        self,
        lat: float,
        lon: float,
        colheita: str,
        solo_override: str | None,
        confirmadas: list[tuple[int, str]],
        lang: str,
    ) -> CustoFaixa:
        rec = self._recommender.recommend(
            lat=lat,
            lon=lon,
            colheita=colheita,
            solo_override=solo_override,
            lang=lang,
            confirmadas=confirmadas,
        )
        melhor = next((o for o in rec.opcoes if o.id == rec.melhor), None)
        if melhor is None:
            return CustoFaixa(colheita, rec.semeadura, None, None, None, None)
        return CustoFaixa(
            colheita=colheita,
            semeadura=rec.semeadura,
            melhor=melhor.id,
            nome=melhor.nome,
            anos_bons=melhor.anos_bons_chuva,
            total_anos=melhor.total_anos,
        )
