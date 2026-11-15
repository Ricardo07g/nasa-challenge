"""Fase do ENSO (El Niño / La Niña) de cada safrinha pelo ONI da NOAA (P1, plano de evolução 4.1).

É dado da NOAA, não da NASA, e só informa: a marca aparece no detalhe de cada ano e não entra na
conta. O formato do arquivo está na seção "ONI" do `AGENTS.md` do backend.
"""

from dataclasses import dataclass
from typing import Final, Literal, get_args

from app.models.validation import require_between

FaseEnso = Literal["el_nino", "la_nina"]
ENSO_PHASES: Final[frozenset[str]] = frozenset(get_args(FaseEnso))
# A tabela do ONI (ERSST v5) começa no verão de 1950 (DJF 1950).
FIRST_ONI_YEAR: Final[int] = 1950
# O ONI é a anomalia da temperatura do mar no Niño 3.4, em °C, e nunca passou de ±3. O limite
# folgado recusa marcas de "sem valor" (como −99,9) sem recusar um evento forte.
MAX_ABS_ONI_C: Final[float] = 5.0


@dataclass(frozen=True)
class OniYear:
    """Um ano de safrinha: a média do ONI nas estações do `regras.yaml` e a fase do ENSO.

    `fase` é `None` quando o ano é neutro (nem El Niño nem La Niña).
    """

    ano: int
    oni: float
    fase: FaseEnso | None

    def __post_init__(self) -> None:
        if self.ano < FIRST_ONI_YEAR:
            raise ValueError(f"ano precisa ser {FIRST_ONI_YEAR} ou depois, veio {self.ano!r}")
        require_between("oni", self.oni, -MAX_ABS_ONI_C, MAX_ABS_ONI_C)
        if self.fase is not None and self.fase not in ENSO_PHASES:
            raise ValueError(f"fase precisa ser el_nino, la_nina ou null, veio {self.fase!r}")
