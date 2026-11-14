"""Sinal para o outono (PRD 7.10, RF-20): os dados de agora e a resposta que vai para a tela 7.

Entradas, uma por fonte (tarefas A2.1 a A2.3 do roteiro):
- `SeasonalForecast`: chance de chuva abaixo do normal de março a maio pelo GEOS-S2S (NASA GMAO);
- `RecentSoilMoisture`: percentil da umidade na zona das raízes pelo SMAP L4 (`sm_rootzone_pctl`);
- `RecentRain`: chuva dos últimos dias pelo GPM IMERG, com a média dos mesmos dias.
"""

from dataclasses import dataclass
from datetime import date

from app.models.validation import require_between, require_finite

MAX_PERCENTILE = 100.0


@dataclass(frozen=True)
class SeasonalForecast:
    """Previsão sazonal do GEOS-S2S para a célula: chance (0 a 1) de chuva abaixo do normal."""

    chance_abaixo_normal: float
    data: date  # dia em que a previsão foi feita

    def __post_init__(self) -> None:
        require_between("chance_abaixo_normal", self.chance_abaixo_normal, 0.0, 1.0)


@dataclass(frozen=True)
class RecentSoilMoisture:
    """Umidade na zona das raízes agora, como percentil da climatologia do SMAP (0 a 100)."""

    sm_rootzone_pctl: float
    data: date

    def __post_init__(self) -> None:
        require_between("sm_rootzone_pctl", self.sm_rootzone_pctl, 0.0, MAX_PERCENTILE)


@dataclass(frozen=True)
class RecentRain:
    """Chuva acumulada nos últimos `dias` dias e a média dos mesmos dias nos anos da série."""

    chuva_mm: float
    media_mm: float
    dias: int
    data: date  # último dia somado

    def __post_init__(self) -> None:
        require_finite("chuva_mm", self.chuva_mm)
        if self.chuva_mm < 0.0:
            raise ValueError(f"chuva_mm não pode ser negativa, veio {self.chuva_mm!r}")
        require_finite("media_mm", self.media_mm)
        if self.media_mm <= 0.0:
            raise ValueError(f"media_mm precisa ser maior que zero, veio {self.media_mm!r}")
        if self.dias <= 0:
            raise ValueError(f"dias precisa ser maior que zero, veio {self.dias!r}")

    @property
    def fracao_da_media(self) -> float:
        return self.chuva_mm / self.media_mm


@dataclass(frozen=True)
class RegraDiaPlantar:
    """Regra do dia de plantar: até `data_limite`, terra seca no dia -> Plano B."""

    data_limite: date
    texto: str


@dataclass(frozen=True)
class SinalOutono:
    """Sinal para o outono: `seco`, `normal` ou `incerto`, com o motivo e as fontes (RF-20)."""

    nivel: str
    motivo: str
    fonte: tuple[str, ...]
    data: date  # data do dado mais importante usado (a previsão, ou o dado da terra sem ela)
    regra_dia_plantar: RegraDiaPlantar
