"""Previsão do ENSO (El Niño / La Niña): chance de cada fase por estação de 3 meses (tarefa 0038).

É a probabilidade oficial que a NOAA CPC publica todo mês (contrato "Previsão do ENSO" no
`AGENTS.md` do backend). A estação usa o código da NOAA (ex.: FMA = fevereiro a abril) e o ano do
mês do meio, como a tabela do ONI (o DJF de 2027 é dezembro de 2026 a fevereiro de 2027). Neutro é
a fase `None`, como no `OniYear` de cada ano.
"""

import calendar
from dataclasses import dataclass
from datetime import date
from typing import Final

from app.models.enso import FaseEnso
from app.models.validation import require_between, require_non_blank

# As 12 estações de 3 meses, na ordem do mês do meio (DJF = janeiro, ..., NDJ = dezembro).
ENSO_SEASONS: Final[tuple[str, ...]] = (
    "DJF",
    "JFM",
    "FMA",
    "MAM",
    "AMJ",
    "MJJ",
    "JJA",
    "JAS",
    "ASO",
    "SON",
    "OND",
    "NDJ",
)
MONTHS_IN_YEAR: Final[int] = 12
MAX_PCT: Final[int] = 100
# A NOAA arredonda cada chance para um inteiro: a soma pode dar 98 a 102, nunca menos ou mais.
MAX_ROUNDING_GAP_PCT: Final[int] = 2


def season_middle_month(estacao: str) -> int:
    """Mês do meio da estação (1 a 12): FMA = 3 (março)."""
    return ENSO_SEASONS.index(estacao) + 1


@dataclass(frozen=True)
class EnsoSeasonForecast:
    """Chance (em %, inteira) de La Niña, neutro e El Niño numa estação de 3 meses."""

    estacao: str
    ano: int  # ano do mês do meio da estação
    la_nina: int
    neutro: int
    el_nino: int

    def __post_init__(self) -> None:
        if self.estacao not in ENSO_SEASONS:
            raise ValueError(
                f"estacao precisa ser uma das 12 da NOAA (ex.: FMA), veio {self.estacao!r}"
            )
        for name in ("la_nina", "neutro", "el_nino"):
            require_between(name, getattr(self, name), 0, MAX_PCT)
        total = self.la_nina + self.neutro + self.el_nino
        if abs(total - MAX_PCT) > MAX_ROUNDING_GAP_PCT:
            raise ValueError(f"as chances de {self.estacao} precisam somar 100%, somam {total}%")

    def chance(self, fase: FaseEnso | None) -> int:
        """Chance da fase, em %; `None` é neutro."""
        if fase == "el_nino":
            return self.el_nino
        if fase == "la_nina":
            return self.la_nina
        return self.neutro

    def most_likely(self) -> tuple[FaseEnso | None, int] | None:
        """A fase mais provável e a chance dela; None quando duas ou mais empatam no topo."""
        chances: list[tuple[FaseEnso | None, int]] = [
            ("la_nina", self.la_nina),
            (None, self.neutro),
            ("el_nino", self.el_nino),
        ]
        top = max(pct for _, pct in chances)
        leaders = [item for item in chances if item[1] == top]
        return leaders[0] if len(leaders) == 1 else None

    def last_day(self) -> date:
        """Último dia da estação (o último dia do mês depois do mês do meio)."""
        middle = season_middle_month(self.estacao)
        year, month = (self.ano + 1, 1) if middle == MONTHS_IN_YEAR else (self.ano, middle + 1)
        return date(year, month, calendar.monthrange(year, month)[1])


@dataclass(frozen=True)
class EnsoForecast:
    """Uma previsão publicada: o dia, o nome curto da fonte (vai na frase) e as estações."""

    emitida_em: date
    fonte: str
    estacoes: tuple[EnsoSeasonForecast, ...]

    def __post_init__(self) -> None:
        require_non_blank("fonte", self.fonte)
        if not self.estacoes:
            raise ValueError("estacoes não pode ficar vazia: a previsão precisa de uma estação")

    def season(self, estacao: str) -> EnsoSeasonForecast | None:
        """A estação pedida (ex.: FMA), ou None quando a previsão não chega até ela."""
        return next((item for item in self.estacoes if item.estacao == estacao), None)
