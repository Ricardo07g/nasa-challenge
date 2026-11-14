from app.models.crop_option import CropOption
from app.repositories.crop_option_repository import CropOptionRepository
from app.services.errors import NotFoundError


class CropOptionService:
    """Regras de negócio das opções de entressafra. Não conhece HTTP nem FastAPI."""

    def __init__(self, repository: CropOptionRepository) -> None:
        self._repository = repository

    def list_options(self) -> list[CropOption]:
        return self._repository.list_all()

    def get_option(self, option_id: str) -> CropOption:
        option = self._repository.get_by_id(option_id)
        if option is None:
            raise NotFoundError(f"Opção de entressafra '{option_id}' não encontrada")
        return option
