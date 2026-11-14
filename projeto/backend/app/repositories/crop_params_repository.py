"""Repository contract and YAML implementation for agronomic crop parameters."""

from pathlib import Path
from typing import Any, Protocol

import yaml

from app.constants import CROP_ID_ALIASES
from app.models.crop_option import CropParams


class CropParamsRepository(Protocol):
    """Data access contract for detailed crop parameters."""

    def list_all(self) -> list[CropParams]: ...

    def get_by_id(self, crop_id: str) -> CropParams | None: ...


class YamlCropParamsRepository:
    """Loads agronomic crop parameters from data/culturas.yaml."""

    def __init__(self, yaml_path: Path = Path("/workspace/data/culturas.yaml")) -> None:
        self._yaml_path = yaml_path
        self._crops_cache: list[CropParams] | None = None

    def _load(self) -> list[CropParams]:
        if self._crops_cache is not None:
            return self._crops_cache

        raw_content: dict[str, Any] = yaml.safe_load(self._yaml_path.read_text(encoding="utf-8"))
        culturas_map: dict[str, dict[str, Any]] = raw_content.get("culturas", {})

        loaded: list[CropParams] = []
        for raw_id, data in culturas_map.items():
            canonical_id = CROP_ID_ALIASES.get(raw_id, raw_id)
            loaded.append(
                CropParams(
                    id=canonical_id,
                    nome=str(data["nome"]),
                    nome_en=str(data.get("nome_en", data["nome"])),
                    tipo=str(data["tipo"]),
                    funcao=str(data["funcao"]),
                    semeadura_limite_mes_dia=(
                        str(data["semeadura_limite_mes_dia"])
                        if data.get("semeadura_limite_mes_dia") is not None
                        else None
                    ),
                    dias_florescer=int(data["dias_florescer"]),
                    ciclo_dias=int(data["ciclo_dias"]),
                    kc_pico=float(data["kc_pico"]),
                    palhada_score=int(data["palhada_score"]),
                    n_deixado_kg=int(data["n_deixado_kg"]),
                    nematoide_efeito=int(data["nematoide_efeito"]),
                    produtividade_padrao_sc_ha=float(data["produtividade_padrao_sc_ha"]),
                    preco_padrao_saca=float(data["preco_padrao_saca"]),
                    custo_padrao_ha=float(data["custo_padrao_ha"]),
                    como_fazer=tuple(str(item) for item in data.get("como_fazer", [])),
                )
            )

        self._crops_cache = loaded
        return loaded

    def list_all(self) -> list[CropParams]:
        return list(self._load())

    def get_by_id(self, crop_id: str) -> CropParams | None:
        canonical_id = CROP_ID_ALIASES.get(crop_id, crop_id)
        return next(
            (crop for crop in self._load() if crop.id == canonical_id),
            None,
        )
