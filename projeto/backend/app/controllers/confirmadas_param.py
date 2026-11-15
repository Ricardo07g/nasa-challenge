"""Parâmetro `confirmadas` de /talhao e /recomendacao: as últimas safras que o produtor confirmou.

Formato `ano:valor` separados por vírgula (ex.: `2024:plantou,2025:parado`). O controller só
confere o formato e converte em pares; os anos aceitos e os valores ("plantou" ou "parado") são
regra de negócio, conferida no `FieldHistoryService.check_confirmations` (tarefa 0039).
"""

from typing import Annotated, Final

from fastapi import Query

# Vazio vale "nenhuma confirmação". Fora do formato: 422 INVALID_REQUEST com o campo.
CONFIRMADAS_PATTERN: Final[str] = r"^(\d{4}:[a-z_]+(,\d{4}:[a-z_]+)*)?$"

ConfirmadasQuery = Annotated[
    str | None,
    Query(
        pattern=CONFIRMADAS_PATTERN,
        description="Últimas safras confirmadas pelo produtor: 2024:plantou,2025:parado",
    ),
]


def parse_confirmadas(text: str | None) -> tuple[tuple[int, str], ...]:
    """`"2024:plantou,2025:parado"` → `((2024, "plantou"), (2025, "parado"))`; vazio → `()`."""
    if not text:
        return ()
    pairs = (item.split(":") for item in text.split(","))
    return tuple((int(ano), valor) for ano, valor in pairs)
