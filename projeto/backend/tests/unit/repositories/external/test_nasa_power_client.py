"""Unit tests for NasaPowerClient (Sub-task 1.1 of Task 0001)."""

from typing import Any

import pytest

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


def _sample_nasa_power_payload() -> dict[str, Any]:
    return {
        "properties": {
            "parameter": {
                "PRECTOTCORR": {
                    "20230101": 12.4,
                    "20230102": -999.0,
                    "20240101": 5.0,
                },
                "T2M_MAX": {
                    "20230101": 31.2,
                    "20230102": -999.0,
                    "20240101": 29.8,
                },
                "T2M_MIN": {
                    "20230101": 19.5,
                    "20230102": 18.0,
                    "20240101": 17.9,
                },
                "T2M": {
                    "20230101": 25.0,
                    "20230102": -999.0,
                    "20240101": 23.5,
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
                    "20230102": -999.0,
                    "20240101": 19.5,
                },
                "GWETROOT": {
                    "20230101": 0.68,
                    "20230102": -999.0,
                    "20240101": 0.62,
                },
            }
        }
    }


def test_should_parse_nasa_power_seasons_and_sanitize_sentinel_when_response_is_valid() -> None:
    getter = FakeHttpGetter([_sample_nasa_power_payload()])
    client = NasaPowerClient(http_get=getter)

    seasons = client.fetch_seasons(
        lat=-17.78,
        lon=-50.92,
        cell_id="-178_-509",
        start_year=2023,
        end_year=2024,
    )

    assert len(getter.calls) == 1
    assert getter.calls[0][2] <= 8.0
    assert len(seasons) == 2
    assert seasons[0].year == 2023
    assert seasons[0].cell_id == "-178_-509"
    # Day 2 had -999.0 sentinel for rain, which must be sanitized to 0.0
    assert seasons[0].rain_mm == (12.4, 0.0)
    assert all(eto > 0.0 for eto in seasons[0].eto_mm)


def test_should_retry_with_backoff_and_succeed_when_transient_timeout_occurs() -> None:
    getter = FakeHttpGetter([TimeoutError("NASA timeout"), _sample_nasa_power_payload()])
    client = NasaPowerClient(http_get=getter)

    seasons = client.fetch_seasons(
        lat=-17.78,
        lon=-50.92,
        cell_id="-178_-509",
        start_year=2023,
        end_year=2024,
    )

    assert len(getter.calls) == 2
    assert len(seasons) == 2


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
        client.fetch_seasons(lat=-17.78, lon=-50.92, cell_id="-178_-509")
