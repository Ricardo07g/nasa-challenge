"""Contratos dos dados do sinal para o outono (PRD 7.10, RF-20), um por fonte.

Cada fonte chega numa tarefa do roteiro: GEOS-S2S (A2.1), SMAP recente com percentil (A2.2) e chuva
dos últimos 30 dias pelo IMERG Late (A2.3). Até lá, a API usa o `NoAutumnSignalDataRepository`, que
não tem dado nenhum, e o `sinal` sai nulo.
"""

from typing import Protocol

from app.models.sinal_outono import RecentRain, RecentSoilMoisture, SeasonalForecast


class SeasonalForecastRepository(Protocol):
    """Previsão sazonal mais recente do GEOS-S2S para a célula do ponto (março a maio)."""

    def get_seasonal_forecast(self, lat: float, lon: float) -> SeasonalForecast | None: ...


class RecentSoilMoistureRepository(Protocol):
    """Percentil mais recente da umidade na zona das raízes (SMAP L4) no ponto."""

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None: ...


class RecentRainRepository(Protocol):
    """Chuva dos últimos dias (IMERG Late) no ponto, com a média dos mesmos dias."""

    def get_recent_rain(self, lat: float, lon: float) -> RecentRain | None: ...


class NoAutumnSignalDataRepository:
    """Sem dado de nenhuma das três fontes ainda: devolve sempre None."""

    def get_seasonal_forecast(self, lat: float, lon: float) -> SeasonalForecast | None:
        return None

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        return None

    def get_recent_rain(self, lat: float, lon: float) -> RecentRain | None:
        return None
