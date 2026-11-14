"""Unit tests for YamlCropParamsRepository."""

from pathlib import Path

from app.models.crop_option import CropParams
from app.repositories.crop_params_repository import YamlCropParamsRepository


def test_should_load_all_six_crop_params_when_yaml_exists() -> None:
    repo = YamlCropParamsRepository(Path("/workspace/data/culturas.yaml"))

    crops = repo.list_all()

    assert len(crops) == 6
    assert [c.id for c in crops] == [
        "pousio",
        "milho_safrinha",
        "sorgo",
        "milho_braquiaria",
        "milheto",
        "crotalaria",
    ]
    assert all(isinstance(c, CropParams) for c in crops)


def test_should_return_crop_params_when_queried_by_canonical_or_alias_id() -> None:
    repo = YamlCropParamsRepository(Path("/workspace/data/culturas.yaml"))

    sorgo = repo.get_by_id("sorgo")
    sorgo_alias = repo.get_by_id("sorgo_granifero")
    crotalaria_alias = repo.get_by_id("crotalaria-spectabilis")

    assert sorgo is not None
    assert sorgo.id == "sorgo"
    assert sorgo.semeadura_limite_mes_dia == "03-20"
    assert sorgo.nematoide_efeito == 10
    assert sorgo_alias == sorgo
    assert crotalaria_alias is not None
    assert crotalaria_alias.id == "crotalaria"
    assert crotalaria_alias.nematoide_efeito == 30


def test_should_return_none_when_crop_id_does_not_exist() -> None:
    repo = YamlCropParamsRepository(Path("/workspace/data/culturas.yaml"))

    assert repo.get_by_id("trigo_inverno") is None
