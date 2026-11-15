from app.constants import PILOT_MAX_LAT, PILOT_MAX_LON, PILOT_MIN_LAT, PILOT_MIN_LON
from app.models.pilot_area import PilotArea

DEFAULT_PILOT_AREA = PilotArea(
    min_lat=PILOT_MIN_LAT,
    max_lat=PILOT_MAX_LAT,
    min_lon=PILOT_MIN_LON,
    max_lon=PILOT_MAX_LON,
)


class PilotAreaService:
    """Limites da área piloto: os `PILOT_*` do `app/constants.py` são a fonte única (0041)."""

    def __init__(self, area: PilotArea = DEFAULT_PILOT_AREA) -> None:
        self._area = area

    def get(self) -> PilotArea:
        return self._area
