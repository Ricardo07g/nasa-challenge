"""Dias do ano num calendário só, para comparar datas de anos diferentes (tarefa 0042).

O dia sugerido da colheita e o fim das chuvas são a mediana de datas de anos diferentes. Em ano
bissexto, 5 de março é o dia 65; nos outros, o 64. Contando todos num ano comum (29/fev vira
28/fev), a mesma data do calendário é sempre o mesmo número.
"""

from datetime import date, timedelta
from typing import Final

# Um ano que não é bissexto: só serve de calendário.
COMMON_YEAR: Final[int] = 2023


def month_day(text: str) -> tuple[int, int]:
    """'04-01' -> (4, 1), para comparar datas de anos diferentes sem montar `date`."""
    month, day = text.split("-")
    return int(month), int(day)


def common_day_of_year(day: date) -> int:
    """Dia do ano de `day` num ano comum (29/fev conta como 28/fev)."""
    dom = min(day.day, 28) if day.month == 2 else day.day
    return date(COMMON_YEAR, day.month, dom).timetuple().tm_yday


def month_day_text(day_of_year: int) -> str:
    """'MM-DD' do dia do ano num ano comum (o contrário de `common_day_of_year`)."""
    day = date(COMMON_YEAR, 1, 1) + timedelta(days=day_of_year - 1)
    return f"{day.month:02d}-{day.day:02d}"
