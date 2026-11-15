"""Custo do atraso da colheita (tela 3 "Quando você colhe a soja?", tarefa 0042)."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class CustoFaixa:
    """A melhor opção do motor (`/recomendacao`) para uma faixa de colheita.

    `melhor`, `nome`, `anos_bons` e `total_anos` são None quando nenhuma opção cabe na janela de
    plantio da faixa (o motor fica com o pousio, que não tem "deu certo").
    """

    colheita: str
    semeadura: date
    melhor: str | None
    nome: str | None
    anos_bons: int | None
    total_anos: int | None


@dataclass(frozen=True)
class CustoAtraso:
    """As três faixas (cedo, meio, tarde); `mesma_cultura` = a melhor é a mesma nas três."""

    faixas: tuple[CustoFaixa, ...]
    mesma_cultura: bool
