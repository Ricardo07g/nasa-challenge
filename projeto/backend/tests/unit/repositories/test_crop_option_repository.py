"""Unit tests for CropOptionRepository (ADR-0001 canonical IDs and aliases)."""

from app.models.crop_option import CropOption
from app.repositories.crop_option_repository import InMemoryCropOptionRepository


def test_should_return_six_canonical_options_in_order_when_list_all_called() -> None:
    repository = InMemoryCropOptionRepository()

    options = repository.list_all()

    assert [option.id for option in options] == [
        "pousio",
        "milho_safrinha",
        "sorgo",
        "milho_braquiaria",
        "milheto",
        "crotalaria",
    ]
    assert all(isinstance(option, CropOption) for option in options)


def test_should_return_option_when_queried_by_canonical_id() -> None:
    repository = InMemoryCropOptionRepository()

    option = repository.get_by_id("sorgo")

    assert option == CropOption(id="sorgo", name="Sorgo granífero", role="Grão")


def test_should_resolve_legacy_aliases_when_queried_by_kebab_or_long_snake_id() -> None:
    repository = InMemoryCropOptionRepository()

    assert repository.get_by_id("sorgo-granifero") == CropOption(
        id="sorgo", name="Sorgo granífero", role="Grão"
    )
    assert repository.get_by_id("sorgo_granifero") == CropOption(
        id="sorgo", name="Sorgo granífero", role="Grão"
    )
    assert repository.get_by_id("crotalaria-spectabilis") == CropOption(
        id="crotalaria", name="Crotalária spectabilis", role="Cobertura leguminosa"
    )
    assert repository.get_by_id("milho-safrinha") == CropOption(
        id="milho_safrinha", name="Milho safrinha", role="Grão"
    )


def test_should_return_none_when_option_id_is_unknown() -> None:
    repository = InMemoryCropOptionRepository()

    assert repository.get_by_id("nao-existe") is None


def test_should_allow_custom_options_when_initialized_explicitly() -> None:
    custom = [CropOption(id="teste", name="Teste", role="Grão")]

    repository = InMemoryCropOptionRepository(custom)

    assert repository.list_all() == custom
