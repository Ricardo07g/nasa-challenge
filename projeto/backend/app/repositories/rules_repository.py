"""Contrato e leitura do `regras.yaml`: limiares, pesos e frases do motor (PRD 7)."""

from dataclasses import fields
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol, get_args, get_origin

import yaml

from app.config import DEFAULT_REGRAS_PATH
from app.models.regras import (
    FrasesPorque,
    Regras,
    RegrasClima,
    RegrasNdvi,
    RegrasNotaFinal,
    RegrasRotacao,
    RegrasRotulos,
    RegrasSinalOutono,
    RegrasSolo,
)


class RulesRepository(Protocol):
    """Contrato de acesso às regras do motor."""

    def get_rules(self) -> Regras: ...


def _value(section: dict[str, Any], path: str) -> Any:
    """`valor` de um número do YAML; recusa número sem `fonte` (cada regra diz de onde veio)."""
    item = section[path.split(".")[-1]]
    if not str(item.get("fonte") or "").strip():
        raise ValueError(f"Regra sem fonte no regras.yaml: {path}")
    return item["valor"]


def _convert(value: Any, target: Any) -> Any:
    if get_origin(target) is frozenset:
        (item_type,) = get_args(target)
        return frozenset(item_type(item) for item in value)
    if get_origin(target) is dict:
        key_type, value_type = get_args(target)
        return {key_type(key): _convert(item, value_type) for key, item in value.items()}
    return target(value)


def _group[T](raw: dict[str, Any], group: str, cls: type[T]) -> T:
    section: dict[str, Any] = raw[group]
    values = {f.name: _convert(_value(section, f"{group}.{f.name}"), f.type) for f in fields(cls)}
    return cls(**values)


class YamlRulesRepository:
    """Lê as regras do `regras.yaml` (caminho vem de Settings)."""

    def __init__(self, yaml_path: Path) -> None:
        self._yaml_path = yaml_path
        self._cache: Regras | None = None

    def get_rules(self) -> Regras:
        if self._cache is not None:
            return self._cache

        raw: dict[str, Any] = yaml.safe_load(self._yaml_path.read_text(encoding="utf-8"))
        frases: dict[str, dict[str, Any]] = raw["frases"]
        self._cache = Regras(
            clima=_group(raw, "clima", RegrasClima),
            nota_final=_group(raw, "nota_final", RegrasNotaFinal),
            rotulos=_group(raw, "rotulos", RegrasRotulos),
            solo=_group(raw, "solo", RegrasSolo),
            ndvi=_group(raw, "ndvi", RegrasNdvi),
            rotacao=_group(raw, "rotacao", RegrasRotacao),
            sinal_outono=_group(raw, "sinal_outono", RegrasSinalOutono),
            frases={
                lang: FrasesPorque(**{f.name: str(textos[f.name]) for f in fields(FrasesPorque)})
                for lang, textos in frases.items()
            },
        )
        return self._cache


@lru_cache
def load_default_rules() -> Regras:
    """Regras do `regras.yaml` que vai junto com a API, sem ler variável de ambiente.

    É o padrão dos services quando ninguém injeta as regras (testes e scripts). A API injeta as
    regras do caminho do Settings por `app/dependencies.py`.
    """
    return YamlRulesRepository(DEFAULT_REGRAS_PATH).get_rules()
