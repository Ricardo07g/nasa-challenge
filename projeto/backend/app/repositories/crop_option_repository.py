from collections.abc import Sequence
from typing import Protocol

from app.models.crop_option import CropOption


class CropOptionRepository(Protocol):
    """Contrato de acesso aos dados das opções de entressafra.

    O service depende só deste contrato. Hoje os dados ficam em memória; depois podem vir do
    `culturas.yaml` previsto no PRD, sem mudar o service.
    """

    def list_all(self) -> list[CropOption]: ...

    def get_by_id(self, option_id: str) -> CropOption | None: ...


# Opções da tabela da seção 5 do PRD, na mesma ordem.
DEFAULT_CROP_OPTIONS: tuple[CropOption, ...] = (
    CropOption(id="pousio", name="Pousio", role="Nenhuma"),
    CropOption(id="milho-safrinha", name="Milho safrinha", role="Grão"),
    CropOption(id="sorgo-granifero", name="Sorgo granífero", role="Grão"),
    CropOption(
        id="milho-braquiaria",
        name="Milho + braquiária ruziziensis",
        role="Grão + cobertura",
    ),
    CropOption(id="milheto", name="Milheto", role="Cobertura"),
    CropOption(
        id="crotalaria-spectabilis",
        name="Crotalária spectabilis",
        role="Cobertura leguminosa",
    ),
)


class InMemoryCropOptionRepository:
    def __init__(self, options: Sequence[CropOption] = DEFAULT_CROP_OPTIONS) -> None:
        self._options = list(options)

    def list_all(self) -> list[CropOption]:
        return list(self._options)

    def get_by_id(self, option_id: str) -> CropOption | None:
        return next((option for option in self._options if option.id == option_id), None)
