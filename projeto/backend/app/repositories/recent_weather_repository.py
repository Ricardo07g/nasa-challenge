"""NASA POWER dos últimos dias da célula (tela "Avisos", remodelagem S6, tarefa 0046).

A mesma API diária da pré-carga, sem chave, pedida pelo backend no centro da célula de 0,1°. A
resposta fica guardada por 24 horas por célula e janela (o POWER sai com ~2 dias de atraso: pedir de
novo no mesmo dia não traz nada novo). Se a API falhar ou demorar, a resposta é `None` (o aviso não
aparece), e o repository espera um pouco antes de tentar de novo, para não segurar cada visita.
"""

import logging
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from datetime import UTC, date, datetime, timedelta
from typing import Final, Protocol

from app.models.avisos import RecentDay
from app.repositories.climate_repository import cell_center
from app.repositories.external.nasa_power_client import NasaPowerClientProtocol

logger = logging.getLogger(__name__)

CACHE_TTL: Final[timedelta] = timedelta(hours=24)
FAILURE_TTL: Final[timedelta] = timedelta(minutes=15)
# Tempo total da busca (com as novas tentativas do cliente): o botão "Avisos" do cabeçalho espera
# esta resposta, então ela não pode segurar a tela.
TOTAL_TIMEOUT_SECONDS: Final[float] = 8.0
WORKERS: Final[int] = 2

CacheKey = tuple[str, date, date]


def utc_now() -> datetime:
    return datetime.now(UTC)


class RecentWeatherRepository(Protocol):
    """Contrato: chuva e máxima de cada dia de `start` a `end` na célula; None sem resposta."""

    def get_recent_days(self, cell_id: str, start: date, end: date) -> list[RecentDay] | None: ...


class PowerRecentWeatherRepository:
    """Busca no NASA POWER com cache de 24 h por célula e janela; falha vira `None`."""

    def __init__(
        self,
        client: NasaPowerClientProtocol,
        now: Callable[[], datetime] = utc_now,
        ttl: timedelta = CACHE_TTL,
        failure_ttl: timedelta = FAILURE_TTL,
        timeout_s: float = TOTAL_TIMEOUT_SECONDS,
    ) -> None:
        self._client = client
        self._now = now
        self._ttl = ttl
        self._failure_ttl = failure_ttl
        self._timeout_s = timeout_s
        self._cache: dict[CacheKey, tuple[datetime, list[RecentDay] | None]] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=WORKERS, thread_name_prefix="power-recent")

    def get_recent_days(self, cell_id: str, start: date, end: date) -> list[RecentDay] | None:
        key = (cell_id, start, end)
        now = self._now()
        with self._lock:
            cached = self._cache.get(key)
        if cached is not None:
            saved_at, days = cached
            if now - saved_at < (self._ttl if days is not None else self._failure_ttl):
                return days
        days = self._fetch(cell_id, start, end)
        with self._lock:
            self._cache[key] = (now, days)
        return days

    def _fetch(self, cell_id: str, start: date, end: date) -> list[RecentDay] | None:
        lat, lon = cell_center(cell_id)
        future = self._executor.submit(self._client.fetch_daily, lat, lon, start, end)
        try:
            series = future.result(timeout=self._timeout_s)
        except FutureTimeoutError:
            logger.warning("NASA POWER recente sem resposta em %.0f s", self._timeout_s)
            return None
        except Exception as exc:  # qualquer falha do POWER: o aviso só não aparece
            logger.warning("NASA POWER recente falhou: %s", exc)
            return None
        return [RecentDay(day.data, day.prectotcorr, day.t2m_max) for day in series.days]
