"""Linha do tempo de uma safra: eventos e avisos de veranico e calor (plano de evolução 4.4).

O replay de uma safra passada (P4) e o acompanhamento diário (P6) usam as mesmas entidades.
Os nomes dos campos seguem o contrato do front (`projeto/frontend/src/models/pastSeason.ts`).
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal

EventType = Literal[
    "semeadura",
    "sem_chuva",
    "aviso_veranico",
    "fase_critica",
    "voltou_chuva",
    "aviso_calor",
    "colheita",
]


@dataclass(frozen=True)
class DailyWeather:
    """Chuva e máxima de um dia no ponto (NASA POWER no replay)."""

    data: date
    chuva_mm: float
    tmax_c: float


@dataclass(frozen=True)
class SeasonEvent:
    """Um evento da linha do tempo, com o texto já na língua pedida."""

    data: date
    tipo: EventType
    texto: str


@dataclass(frozen=True)
class PastSeason:
    """Replay de uma safrinha passada: a opção recomendada e os eventos daquele ano."""

    ano: int
    opcao: str
    eventos: tuple[SeasonEvent, ...]
