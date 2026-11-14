from app.models.crop_option import CropOption
from app.repositories.crop_option_repository import InMemoryCropOptionRepository


def test_list_all_returns_the_six_options_from_the_prd_in_order() -> None:
    repository = InMemoryCropOptionRepository()

    options = repository.list_all()

    assert [option.id for option in options] == [
        "pousio",
        "milho-safrinha",
        "sorgo-granifero",
        "milho-braquiaria",
        "milheto",
        "crotalaria-spectabilis",
    ]
    assert all(isinstance(option, CropOption) for option in options)


def test_get_by_id_returns_the_option() -> None:
    repository = InMemoryCropOptionRepository()

    option = repository.get_by_id("milheto")

    assert option == CropOption(id="milheto", name="Milheto", role="Cobertura")


def test_get_by_id_returns_none_when_missing() -> None:
    repository = InMemoryCropOptionRepository()

    assert repository.get_by_id("nao-existe") is None


def test_repository_can_be_created_with_custom_data() -> None:
    custom = [CropOption(id="teste", name="Teste", role="Grão")]

    repository = InMemoryCropOptionRepository(custom)

    assert repository.list_all() == custom
