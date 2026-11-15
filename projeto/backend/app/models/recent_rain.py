"""Contrato do arquivo da chuva recente (A2.3): chuva dos últimos dias pelo IMERG Late, por célula.

Cada registro é uma célula de 0,1° (o pixel do IMERG coincide com a célula do `cell_id_for`) com a
soma dos últimos `dias` dias e a média dos mesmos dias nos anos da série. O sinal para o outono
(PRD 7.10) usa a fração da média; ver a seção "Chuva recente" do `AGENTS.md` do backend.
"""

import math
from dataclasses import dataclass
from datetime import date
from typing import Final

from app.models.climate import MAX_LATITUDE, MAX_LONGITUDE, MIN_LATITUDE, MIN_LONGITUDE
from app.models.sinal_outono import RecentRain
from app.models.validation import require_between, require_finite, require_non_blank

# A fração é gravada com 4 casas a partir das somas já arredondadas: a diferença para a conta das
# duas somas fica bem abaixo de 0,001. Mais do que isso é um número que não veio da conta.
FRACTION_TOLERANCE: Final[float] = 0.001


@dataclass(frozen=True)
class RecentRainRecord:
    """Uma célula do arquivo da chuva recente: soma dos últimos `dias` dias e a média deles."""

    cell_id: str
    lat: float  # centro da célula
    lon: float
    data: date  # último dia somado
    dias: int
    chuva_30d_mm: float
    media_30d_mm: float
    fracao_da_media: float
    anos_media: int  # anos da série que entraram na média

    def __post_init__(self) -> None:
        require_non_blank("cell_id", self.cell_id)
        require_between("lat", self.lat, MIN_LATITUDE, MAX_LATITUDE)
        require_between("lon", self.lon, MIN_LONGITUDE, MAX_LONGITUDE)
        if self.dias <= 0:
            raise ValueError(f"dias precisa ser maior que zero, veio {self.dias!r}")
        require_finite("chuva_30d_mm", self.chuva_30d_mm)
        if self.chuva_30d_mm < 0.0:
            raise ValueError(f"chuva_30d_mm não pode ser negativa, veio {self.chuva_30d_mm!r}")
        require_finite("media_30d_mm", self.media_30d_mm)
        if self.media_30d_mm <= 0.0:
            raise ValueError(f"media_30d_mm precisa ser maior que zero, veio {self.media_30d_mm!r}")
        if self.anos_media <= 0:
            raise ValueError(f"anos_media precisa ser maior que zero, veio {self.anos_media!r}")
        require_finite("fracao_da_media", self.fracao_da_media)
        expected = self.chuva_30d_mm / self.media_30d_mm
        if not math.isclose(self.fracao_da_media, expected, abs_tol=FRACTION_TOLERANCE):
            raise ValueError(
                f"fracao_da_media ({self.fracao_da_media!r}) não bate com chuva_30d_mm ÷ "
                f"media_30d_mm ({expected:.4f})"
            )

    def to_recent_rain(self) -> RecentRain:
        """A chuva recente que o `SinalOutonoService` usa."""
        return RecentRain(
            chuva_mm=self.chuva_30d_mm,
            media_mm=self.media_30d_mm,
            dias=self.dias,
            data=self.data,
        )
