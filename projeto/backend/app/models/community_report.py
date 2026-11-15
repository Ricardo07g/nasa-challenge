"""Relatos da comunidade sem cadastro (seção 7 da remodelagem, tarefa 0047).

Três tipos agora: o que plantou depois da soja (`plantio`), a chuva do pluviômetro (`chuva`) e o
que aconteceu na região (`evento`). O tipo fica aberto na tabela para os tipos futuros (oferta,
troca e empréstimo de insumos e equipamentos), que não entram agora.

Privacidade: o relato guarda só a célula de 0,1° do ponto (`cell_id_for`), nunca a coordenada
exata, e o identificador do aparelho só como hash (HMAC-SHA-256 com o sal do `Settings`). Nada de
texto livre: todo valor sai de uma lista fechada ou é um número conferido.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime
from typing import Final

TIPO_PLANTIO: Final[str] = "plantio"
TIPO_CHUVA: Final[str] = "chuva"
TIPO_EVENTO: Final[str] = "evento"
REPORT_TYPES: Final[tuple[str, ...]] = (TIPO_PLANTIO, TIPO_CHUVA, TIPO_EVENTO)

# "Aconteceu aqui": fogo, granizo, geada, vendaval, enxurrada ou erosão, praga ou doença.
EVENT_TYPES: Final[tuple[str, ...]] = (
    "fogo",
    "granizo",
    "geada",
    "vendaval",
    "enxurrada_erosao",
    "praga_doenca",
)

# "O que plantei depois da soja": as culturas do culturas.yaml (o `pousio` é o "deixei parado")
# mais "outra".
OTHER_CROP: Final[str] = "outra"
IDLE_CROP: Final[str] = "pousio"
# "Como foi": foi bem, mais ou menos, perdi. Se perdeu, o motivo.
PLANTING_OUTCOMES: Final[tuple[str, ...]] = ("bem", "mais_ou_menos", "perdi")
LOST_OUTCOME: Final[str] = "perdi"
LOSS_REASONS: Final[tuple[str, ...]] = ("seca", "calor", "geada", "granizo", "praga", "outro")


@dataclass(frozen=True)
class ReportSubmission:
    """O relato como chega do produtor: o ponto ainda vem inteiro (vira célula no service)."""

    tipo: str
    subtipo: str | None
    valores: Mapping[str, object]
    lat: float
    lon: float
    data_fato: date | None
    device_id: str


@dataclass(frozen=True)
class NewCommunityReport:
    """O que vai para a tabela: a célula no lugar do ponto e o hash no lugar do aparelho."""

    tipo: str
    subtipo: str | None
    valores: Mapping[str, object]
    celula: str
    data_fato: date | None
    device_hash: str


@dataclass(frozen=True)
class CommunityReport:
    """Um relato guardado (linha de `community_report`)."""

    id: str
    tipo: str
    subtipo: str | None
    valores: Mapping[str, object]
    celula: str
    data_fato: date | None
    enviado_em: datetime
    device_hash: str


@dataclass(frozen=True)
class NearbyReport:
    """Um relato da redondeza como os vizinhos veem: a célula e o centro dela, sem o aparelho.

    `meu` diz se foi este aparelho que enviou (para poder apagar).
    """

    id: str
    tipo: str
    subtipo: str | None
    valores: Mapping[str, object]
    celula: str
    lat: float
    lon: float
    data_fato: date | None
    meu: bool


@dataclass(frozen=True)
class NearbyReports:
    """Os relatos das células cujo centro fica no raio e as últimas safras aceitas no plantio."""

    raio_km: float
    anos_safra: tuple[int, ...]
    relatos: tuple[NearbyReport, ...]
