"""Unit tests for CropOptionRepository (ADR-0001 canonical IDs and aliases)."""

from pathlib import Path

from app.models.crop_option import CropOption
from app.repositories.crop_option_repository import (
    InMemoryCropOptionRepository,
    YamlCropOptionRepository,
)

CULTURAS_YAML = """
culturas:
  milheto:
    nome: "Milheto"
    nome_en: "Pearl millet"
    tipo: "cobertura"
    funcao: "Cobertura"
    semeadura_limite_mes_dia: "03-15"
    dias_florescer: 50
    ciclo_dias: 90
    kc_pico: 1.0
    nota_solo: {palhada: 35, nitrogenio: 0, pragas: 20}
    n_deixado_kg: 0
  sorgo:
    nome: "Sorgo"
    tipo: "grao"
    funcao: "Grão"
    semeadura_limite_mes_dia: "03-20"
    dias_florescer: 65
    ciclo_dias: 115
    kc_pico: 1.05
    nota_solo: {palhada: 20, nitrogenio: 0, pragas: 15}
    n_deixado_kg: 0
"""


def _yaml_repo(tmp_path: Path) -> YamlCropOptionRepository:
    path = tmp_path / "culturas.yaml"
    path.write_text(CULTURAS_YAML, encoding="utf-8")
    return YamlCropOptionRepository(path)


def test_should_list_options_from_culturas_yaml_with_name_and_role_from_nome_and_funcao(
    tmp_path: Path,
) -> None:
    assert _yaml_repo(tmp_path).list_all() == [
        CropOption(id="milheto", name="Milheto", role="Cobertura"),
        CropOption(id="sorgo", name="Sorgo", role="Grão"),
    ]


def test_should_find_yaml_option_by_canonical_or_legacy_id(tmp_path: Path) -> None:
    repository = _yaml_repo(tmp_path)

    sorgo = CropOption(id="sorgo", name="Sorgo", role="Grão")
    assert repository.get_by_id("sorgo") == sorgo
    assert repository.get_by_id("sorgo_granifero") == sorgo
    assert repository.get_by_id("sorgo-granifero") == sorgo
    assert repository.get_by_id("nao-existe") is None


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
