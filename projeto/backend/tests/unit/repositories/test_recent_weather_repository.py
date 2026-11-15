"""NASA POWER dos últimos dias da célula, com cache de 24 h (tela "Avisos", tarefa 0046).

O cliente do POWER é falso: nada de rede.
"""

import threading
from datetime import UTC, date, datetime, timedelta

from app.models.avisos import RecentDay
from app.models.climate import DailyWeatherRecord, PowerDailySeries
from app.repositories.recent_weather_repository import PowerRecentWeatherRepository

NOW = datetime(2026, 11, 15, 15, 0, tzinfo=UTC)
START, END = date(2026, 10, 15), date(2026, 11, 13)
CELL = "-190_-482"


def _record(day: date, rain: float | None, tmax: float | None) -> DailyWeatherRecord:
    return DailyWeatherRecord(
        data=day,
        prectotcorr=rain,
        t2m_max=tmax,
        t2m_min=18.0,
        rh2m=None,
        ws2m=None,
        allsky_sfc_sw_dwn=None,
    )


class FakePowerClient:
    def __init__(self, fail: bool = False, block: threading.Event | None = None) -> None:
        self.calls: list[tuple[float, float, date, date]] = []
        self._fail = fail
        self._block = block

    def fetch_daily(self, lat: float, lon: float, start: date, end: date) -> PowerDailySeries:
        self.calls.append((lat, lon, start, end))
        if self._block is not None:
            self._block.wait(5)
        if self._fail:
            raise RuntimeError("POWER fora do ar")
        return PowerDailySeries(
            elevation_m=870.0,
            days=(
                _record(date(2026, 11, 11), 3.87, 30.31),
                _record(date(2026, 11, 12), 0.44, 27.01),
                _record(date(2026, 11, 13), None, None),
            ),
        )


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now


def test_should_ask_power_for_the_cell_center_and_keep_missing_days_as_none() -> None:
    client = FakePowerClient()
    repo = PowerRecentWeatherRepository(client, now=Clock())

    days = repo.get_recent_days(CELL, START, END)

    assert client.calls == [(-18.95, -48.15, START, END)]
    assert days == [
        RecentDay(date(2026, 11, 11), 3.87, 30.31),
        RecentDay(date(2026, 11, 12), 0.44, 27.01),
        RecentDay(date(2026, 11, 13), None, None),
    ]


def test_should_keep_the_answer_for_24_hours() -> None:
    client, clock = FakePowerClient(), Clock()
    repo = PowerRecentWeatherRepository(client, now=clock)

    repo.get_recent_days(CELL, START, END)
    clock.now = NOW + timedelta(hours=23, minutes=59)
    repo.get_recent_days(CELL, START, END)
    assert len(client.calls) == 1

    clock.now = NOW + timedelta(hours=24, minutes=1)
    repo.get_recent_days(CELL, START, END)
    assert len(client.calls) == 2


def test_should_keep_one_answer_per_cell_and_window() -> None:
    client = FakePowerClient()
    repo = PowerRecentWeatherRepository(client, now=Clock())

    repo.get_recent_days(CELL, START, END)
    repo.get_recent_days("-189_-483", START, END)
    repo.get_recent_days(CELL, START, END + timedelta(days=1))

    assert len(client.calls) == 3


def test_should_give_none_when_power_fails_and_wait_before_asking_again() -> None:
    client, clock = FakePowerClient(fail=True), Clock()
    repo = PowerRecentWeatherRepository(client, now=clock)

    assert repo.get_recent_days(CELL, START, END) is None
    clock.now = NOW + timedelta(minutes=5)
    assert repo.get_recent_days(CELL, START, END) is None
    assert len(client.calls) == 1

    clock.now = NOW + timedelta(minutes=16)
    repo.get_recent_days(CELL, START, END)
    assert len(client.calls) == 2


def test_should_give_none_when_power_takes_too_long() -> None:
    block = threading.Event()
    repo = PowerRecentWeatherRepository(FakePowerClient(block=block), now=Clock(), timeout_s=0.05)

    try:
        assert repo.get_recent_days(CELL, START, END) is None
    finally:
        block.set()
