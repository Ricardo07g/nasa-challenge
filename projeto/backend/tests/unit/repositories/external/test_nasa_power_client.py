"""Unit tests for NasaPowerClient (Sub-task 1.1 of Task 0001; tarefa 0004)."""

from datetime import date
from typing import Any

import pytest

from app.models.climate import DailyWeatherRecord
from app.repositories.external.nasa_power_client import NasaPowerClient
from app.services.errors import DomainError


class FakeHttpGetter:
    """Fake HTTP getter to test NasaPowerClient without real network requests."""

    def __init__(self, responses: list[dict[str, Any] | Exception]) -> None:
        self._responses = list(responses)
        self.calls: list[tuple[str, dict[str, Any], float]] = []

    def __call__(self, url: str, params: dict[str, Any], timeout: float) -> dict[str, Any]:
        self.calls.append((url, params, timeout))
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _sample_nasa_power_payload(with_geometry: bool = True) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "properties": {
            "parameter": {
                "PRECTOTCORR": {
                    "20230101": 12.4,
                    "20230102": -999.0,
                    "20240101": 5.0,
                },
                "T2M_MAX": {
                    "20230101": 31.2,
                    "20230102": 30.4,
                    "20240101": 29.8,
                },
                "T2M_MIN": {
                    "20230101": 19.5,
                    "20230102": 18.0,
                    "20240101": 17.9,
                },
                "RH2M": {
                    "20230101": 70.0,
                    "20230102": 65.0,
                    "20240101": 68.0,
                },
                "WS2M": {
                    "20230101": 2.1,
                    "20230102": 2.0,
                    "20240101": 2.4,
                },
                "ALLSKY_SFC_SW_DWN": {
                    "20230101": 21.0,
                    "20230102": 20.1,
                    "20240101": 19.5,
                },
            }
        }
    }
    if with_geometry:
        payload["geometry"] = {"type": "Point", "coordinates": [-50.92, -17.78, 748.3]}
    return payload


def test_should_request_only_raw_variables_for_the_given_date_range() -> None:
    getter = FakeHttpGetter([_sample_nasa_power_payload()])
    client = NasaPowerClient(http_get=getter)

    client.fetch_daily(lat=-17.78, lon=-50.92, start=date(2023, 1, 1), end=date(2024, 1, 1))

    assert len(getter.calls) == 1
    _, params, timeout = getter.calls[0]
    assert timeout <= 8.0
    assert params["parameters"] == "PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M,WS2M,ALLSKY_SFC_SW_DWN"
    assert (params["start"], params["end"]) == ("20230101", "20240101")
    assert (params["latitude"], params["longitude"]) == (-17.78, -50.92)


def test_should_return_raw_daily_series_with_elevation_and_no_eto() -> None:
    getter = FakeHttpGetter([_sample_nasa_power_payload()])
    client = NasaPowerClient(http_get=getter)

    series = client.fetch_daily(
        lat=-17.78, lon=-50.92, start=date(2023, 1, 1), end=date(2024, 1, 1)
    )

    assert series.elevation_m == 748.3
    assert [d.data for d in series.days] == [date(2023, 1, 1), date(2023, 1, 2), date(2024, 1, 1)]
    assert series.days[0] == DailyWeatherRecord(
        data=date(2023, 1, 1),
        prectotcorr=12.4,
        t2m_max=31.2,
        t2m_min=19.5,
        rh2m=70.0,
        ws2m=2.1,
        allsky_sfc_sw_dwn=21.0,
    )
    # Dia 2 tinha a sentinela -999 na chuva
    assert series.days[1].prectotcorr == 0.0


def test_should_leave_elevation_empty_when_response_has_no_geometry() -> None:
    getter = FakeHttpGetter([_sample_nasa_power_payload(with_geometry=False)])
    client = NasaPowerClient(http_get=getter)

    series = client.fetch_daily(
        lat=-17.78, lon=-50.92, start=date(2023, 1, 1), end=date(2024, 1, 1)
    )

    assert series.elevation_m is None


def test_should_retry_with_backoff_and_succeed_when_transient_timeout_occurs() -> None:
    getter = FakeHttpGetter([TimeoutError("NASA timeout"), _sample_nasa_power_payload()])
    client = NasaPowerClient(http_get=getter)

    series = client.fetch_daily(
        lat=-17.78, lon=-50.92, start=date(2023, 1, 1), end=date(2024, 1, 1)
    )

    assert len(getter.calls) == 2
    assert len(series.days) == 3


def test_should_raise_domain_error_when_all_retries_exhausted() -> None:
    getter = FakeHttpGetter(
        [
            TimeoutError("Attempt 1 failed"),
            TimeoutError("Attempt 2 failed"),
            TimeoutError("Attempt 3 failed"),
        ]
    )
    client = NasaPowerClient(http_get=getter)

    with pytest.raises(DomainError, match="NASA POWER"):
        client.fetch_daily(lat=-17.78, lon=-50.92, start=date(2005, 1, 1), end=date(2024, 7, 30))
