"""Contrato do delta mensal do NEX-GDDP-CMIP6 por modelo (PRD 7.3, plano técnico §5)."""

import math
from dataclasses import fields

import pytest

from app.models.climate import Cmip6Delta


def _delta(**overrides: object) -> Cmip6Delta:
    values: dict[str, object] = {
        "model": "ACCESS-CM2",
        "scenario": "ssp245",
        "month": 3,
        "rain_pct": -8.5,
        "tmax_c": 1.6,
    }
    values.update(overrides)
    return Cmip6Delta(**values)  # type: ignore[arg-type]


def test_should_keep_only_monthly_fields_per_model() -> None:
    # Os agregados da safrinha (aumento médio, variação da chuva, dias de calor) saíram do model:
    # o motor usa só o delta mensal de cada modelo.
    assert [f.name for f in fields(Cmip6Delta)] == [
        "model",
        "scenario",
        "month",
        "rain_pct",
        "tmax_c",
        "tmin_c",
    ]


def test_should_default_tmin_delta_to_none_when_source_has_no_tasmin() -> None:
    delta = _delta()

    assert delta.tmin_c is None
    assert (delta.model, delta.scenario, delta.month) == ("ACCESS-CM2", "ssp245", 3)
    assert (delta.rain_pct, delta.tmax_c) == (-8.5, 1.6)


def test_should_accept_tmin_delta_when_present() -> None:
    assert _delta(tmin_c=1.2).tmin_c == 1.2


def test_should_require_model_scenario_month_and_both_deltas() -> None:
    with pytest.raises(TypeError):
        Cmip6Delta()  # type: ignore[call-arg]


@pytest.mark.parametrize("month", [0, 13])
def test_should_reject_month_outside_one_to_twelve(month: int) -> None:
    with pytest.raises(ValueError, match="month"):
        _delta(month=month)


@pytest.mark.parametrize("field_name", ["model", "scenario"])
def test_should_reject_blank_model_or_scenario(field_name: str) -> None:
    with pytest.raises(ValueError, match=field_name):
        _delta(**{field_name: "  "})


def test_should_reject_rain_drop_greater_than_one_hundred_percent() -> None:
    with pytest.raises(ValueError, match="rain_pct"):
        _delta(rain_pct=-100.1)


def test_should_accept_rain_drop_of_exactly_one_hundred_percent() -> None:
    assert _delta(rain_pct=-100.0).rain_pct == -100.0


@pytest.mark.parametrize("field_name", ["rain_pct", "tmax_c", "tmin_c"])
def test_should_reject_non_finite_deltas(field_name: str) -> None:
    with pytest.raises(ValueError, match=field_name):
        _delta(**{field_name: math.nan})
