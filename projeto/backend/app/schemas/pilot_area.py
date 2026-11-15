from pydantic import BaseModel, ConfigDict

from app.models.pilot_area import PilotArea


class PilotAreaResponse(BaseModel):
    """`GET /api/area-piloto`: os limites da área piloto em graus (WGS 84)."""

    model_config = ConfigDict(from_attributes=True)

    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float

    @classmethod
    def from_model(cls, area: PilotArea) -> "PilotAreaResponse":
        return cls.model_validate(area)
