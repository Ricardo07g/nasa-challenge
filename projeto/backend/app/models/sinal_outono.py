"""Sinal para o outono (PRD 7.10, RF-20): os dados de agora e a resposta que vai para a tela 7.

Desde a tarefa 0038, o sinal vem da previsão do El Niño / La Niña (`app/models/enso_forecast.py`)
e do histórico da opção nos anos daquela fase; o SMAP de agora (`RecentSoilMoisture`) só informa.
Entradas que ficaram no repositório, sem uso no sinal (decisão de 15/11/2026):
- `SeasonalForecast`: chance de chuva abaixo do normal de março a maio pelo GEOS-S2S (NASA GMAO);
- `RecentRain`: chuva dos últimos dias pelo GPM IMERG Late, com a média dos mesmos dias.
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal

from app.models.validation import require_between, require_finite

MAX_PERCENTILE = 100.0

NivelSinal = Literal["normal", "seco", "incerto"]


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
    """Regra do dia de plantar: até `data_limite`, a frase diz quando ir de Plano B.

    Com a série de chuva, a frase é a regra da data (`RegraData`, tarefa 0038).
    """

    data_limite: date
    texto: str


@dataclass(frozen=True)
class RegraData:
    """Regra da data (tarefa 0038): chuva de `inicio` até a véspera de `data_limite` (`dias` dias)
    abaixo de `chuva_min_mm` -> Plano B. `media_mm` é a média desses dias na série da célula."""

    data_limite: date
    inicio: date
    dias: int
    chuva_min_mm: int
    media_mm: int


@dataclass(frozen=True)
class SmapAgora:
    """A umidade da terra agora pelo SMAP, só para informar (não decide o plano)."""

    percentil: int
    data: date
    texto: str


@dataclass(frozen=True)
class SinalOutono:
    """Sinal para o outono: `seco`, `normal` ou `incerto`, com o motivo e as fontes (RF-20)."""

    nivel: NivelSinal
    motivo: str
    fonte: tuple[str, ...]  # a 1ª é a da previsão do ENSO
    data: date  # dia em que a previsão do ENSO foi publicada
    regra_dia_plantar: RegraDiaPlantar
    regra_data: RegraData | None = None  # None sem a série de chuva da célula
    smap_agora: SmapAgora | None = None  # None sem o SMAP recente do ponto
