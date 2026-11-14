"""Repository contract and in-memory implementation for off-season crop options."""

from collections.abc import Sequence
from typing import Protocol

from app.constants import CROP_ID_ALIASES
from app.models.crop_option import CropOption


class CropOptionRepository(Protocol):
    """Data access contract for off-season crop options."""

    def list_all(self) -> list[CropOption]: ...

    def get_by_id(self, option_id: str) -> CropOption | None: ...


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
