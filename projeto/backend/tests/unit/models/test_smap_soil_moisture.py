"""Contrato da umidade do solo do SMAP L4 por ponto e data (PRD 7.2)."""

from dataclasses import fields
from datetime import date

import pytest

from app.models.climate import SmapSoilMoisture


def _smap(**overrides: object) -> SmapSoilMoisture:
    values: dict[str, object] = {
        "data": date(2024, 2, 18),
        "latitude": -18.9543,
        "longitude": -48.1993,
        "sm_rootzone_m3_m3": 0.31,
        "sm_rootzone_wetness": 0.62,
        "fonte": "smap",
    }
    values.update(overrides)
    return SmapSoilMoisture(**values)  # type: ignore[arg-type]


def test_should_carry_point_date_rootzone_and_optional_surface() -> None:
    assert [f.name for f in fields(SmapSoilMoisture)] == [
        "data",
        "latitude",
        "longitude",
        "sm_rootzone_m3_m3",
        "sm_rootzone_wetness",
        "fonte",
        "sm_surface_m3_m3",
    ]


def test_should_default_surface_moisture_to_none() -> None:
    # O balde inicial usa só a zona das raízes; a camada de 0-5 cm é opcional.
    smap = _smap()

    assert smap.sm_surface_m3_m3 is None
    assert smap.sm_rootzone_wetness == 0.62


def test_should_accept_surface_moisture_when_present() -> None:
    assert _smap(sm_surface_m3_m3=0.27).sm_surface_m3_m3 == 0.27


@pytest.mark.parametrize("wetness", [-0.01, 1.01, float("nan")])
def test_should_reject_rootzone_wetness_outside_zero_to_one(wetness: float) -> None:
    with pytest.raises(ValueError, match="sm_rootzone_wetness"):
        _smap(sm_rootzone_wetness=wetness)


@pytest.mark.parametrize("field_name", ["sm_rootzone_m3_m3", "sm_surface_m3_m3"])
@pytest.mark.parametrize("value", [-0.1, 1.1])
def test_should_reject_volumetric_moisture_outside_zero_to_one(
    field_name: str, value: float
) -> None:
    with pytest.raises(ValueError, match=field_name):
        _smap(**{field_name: value})


@pytest.mark.parametrize(("field_name", "value"), [("latitude", -90.1), ("longitude", 180.1)])
def test_should_reject_coordinates_outside_wgs84(field_name: str, value: float) -> None:
    with pytest.raises(ValueError, match=field_name):
        _smap(**{field_name: value})


def test_should_reject_blank_source() -> None:
    with pytest.raises(ValueError, match="fonte"):
        _smap(fonte="")
