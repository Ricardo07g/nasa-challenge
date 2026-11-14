"""Repository contract, YAML and in-memory implementations for off-season crop options."""

from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

from app.constants import CROP_ID_ALIASES
from app.models.crop_option import CropOption, CropParams
from app.repositories.crop_params_repository import YamlCropParamsRepository


class CropOptionRepository(Protocol):
    """Data access contract for off-season crop options."""

    def list_all(self) -> list[CropOption]: ...

    def get_by_id(self, option_id: str) -> CropOption | None: ...


# Lista fixa antiga: a API agora lê o culturas.yaml (YamlCropOptionRepository). Fica como dublê
# de teste e como referência dos ids e `role` do contrato (um teste compara com o YAML).
DEFAULT_CROP_OPTIONS: tuple[CropOption, ...] = (
    CropOption(id="pousio", name="Pousio", role="Nenhuma"),
    CropOption(id="milho_safrinha", name="Milho safrinha", role="Grão"),
    CropOption(id="sorgo", name="Sorgo granífero", role="Grão"),
    CropOption(
        id="milho_braquiaria",
        name="Milho + braquiária ruziziensis",
        role="Grão + cobertura",
    ),
    CropOption(id="milheto", name="Milheto", role="Cobertura"),
    CropOption(
        id="crotalaria",
        name="Crotalária spectabilis",
        role="Cobertura leguminosa",
    ),
)


class YamlCropOptionRepository:
    """Opções lidas do `culturas.yaml` (plano técnico §3.4): `name` = `nome`, `role` = `funcao`.

    Reaproveita a leitura do `YamlCropParamsRepository`, inclusive os ids antigos (ADR-0001).
    """

    def __init__(self, yaml_path: Path) -> None:
        self._crops = YamlCropParamsRepository(yaml_path)

    @staticmethod
    def _to_option(crop: CropParams) -> CropOption:
        return CropOption(id=crop.id, name=crop.nome, role=crop.funcao)

    def list_all(self) -> list[CropOption]:
        return [self._to_option(crop) for crop in self._crops.list_all()]

    def get_by_id(self, option_id: str) -> CropOption | None:
        crop = self._crops.get_by_id(option_id)
        return None if crop is None else self._to_option(crop)


class InMemoryCropOptionRepository:
    """In-memory repository supporting canonical IDs and legacy aliases (ADR-0001)."""

    def __init__(self, options: Sequence[CropOption] = DEFAULT_CROP_OPTIONS) -> None:
        self._options = list(options)

    def list_all(self) -> list[CropOption]:
        return list(self._options)

    def get_by_id(self, option_id: str) -> CropOption | None:
        canonical_id = CROP_ID_ALIASES.get(option_id, option_id)
        return next(
            (opt for opt in self._options if opt.id in (option_id, canonical_id)),
            None,
        )
