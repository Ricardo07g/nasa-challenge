import pytest

from app.models.crop_option import CropOption
from app.services.crop_option_service import CropOptionService
from app.services.errors import NotFoundError


class FakeCropOptionRepository:
    """Repositório falso: o service é testado sem depender de onde os dados vêm."""

    def __init__(self, options: list[CropOption]) -> None:
        self._options = options

    def list_all(self) -> list[CropOption]:
        return list(self._options)

    def get_by_id(self, option_id: str) -> CropOption | None:
        return next((option for option in self._options if option.id == option_id), None)


MILHO = CropOption(id="milho-safrinha", name="Milho safrinha", role="Grão")
MILHETO = CropOption(id="milheto", name="Milheto", role="Cobertura")


@pytest.fixture
def service() -> CropOptionService:
    return CropOptionService(FakeCropOptionRepository([MILHO, MILHETO]))


def test_list_options_returns_all_options(service: CropOptionService) -> None:
    assert service.list_options() == [MILHO, MILHETO]


def test_get_option_returns_the_option(service: CropOptionService) -> None:
    assert service.get_option("milheto") == MILHETO


def test_get_option_raises_not_found_for_unknown_id(service: CropOptionService) -> None:
    with pytest.raises(NotFoundError, match="nao-existe"):
        service.get_option("nao-existe")
