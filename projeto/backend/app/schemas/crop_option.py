from pydantic import BaseModel, ConfigDict

from app.models.crop_option import CropOption


class CropOptionResponse(BaseModel):
    """Como uma opção de entressafra aparece no JSON da API (camada View)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: str

    @classmethod
    def from_model(cls, option: CropOption) -> "CropOptionResponse":
        return cls.model_validate(option)
