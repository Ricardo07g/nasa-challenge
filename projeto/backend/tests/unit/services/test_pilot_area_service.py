from app.constants import PILOT_MAX_LAT, PILOT_MAX_LON, PILOT_MIN_LAT, PILOT_MIN_LON
from app.models.pilot_area import PilotArea
from app.services.pilot_area_service import PilotAreaService


def test_default_area_comes_from_the_pilot_constants() -> None:
    # Fonte única dos limites: o front lê esta resposta e não repete os números (tarefa 0041).
    area = PilotAreaService().get()

    assert area == PilotArea(
        min_lat=PILOT_MIN_LAT,
        max_lat=PILOT_MAX_LAT,
        min_lon=PILOT_MIN_LON,
        max_lon=PILOT_MAX_LON,
    )


def test_default_area_is_the_uberlandia_and_uberaba_box() -> None:
    area = PilotAreaService().get()

    assert (area.min_lat, area.max_lat, area.min_lon, area.max_lon) == (-19.9, -18.4, -49.0, -47.5)


def test_returns_the_injected_area() -> None:
    other = PilotArea(min_lat=-20.0, max_lat=-19.0, min_lon=-48.0, max_lon=-47.0)

    assert PilotAreaService(other).get() == other
