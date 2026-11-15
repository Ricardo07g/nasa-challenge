"""Regras da comunidade no regras.yaml (seção 7 da remodelagem, tarefa 0047)."""

from pathlib import Path
from typing import Any

import pytest
import yaml

from app.config import Settings
from app.repositories.rules_repository import YamlRulesRepository

SHIPPED = Settings.model_fields["regras_path"].default


def _shipped_raw() -> dict[str, Any]:
    return yaml.safe_load(SHIPPED.read_text(encoding="utf-8"))


def _write(tmp_path: Path, raw: dict[str, Any]) -> Path:
    path = tmp_path / "regras.yaml"
    path.write_text(yaml.safe_dump(raw, allow_unicode=True), encoding="utf-8")
    return path


def test_should_load_the_community_report_rules() -> None:
    # Pedido da seção 7: raio de 30 km, chuva de 0 a 300 mm por dia, datas de até 30 dias atrás;
    # 10 relatos por dia por aparelho (hipótese do time).
    comunidade = YamlRulesRepository(SHIPPED).get_rules().comunidade

    assert comunidade.raio_km == 30.0
    assert comunidade.raio_max_km == 50.0
    assert comunidade.chuva_max_mm == 300.0
    assert comunidade.dias_atras_max == 30
    assert comunidade.max_relatos_por_dia == 10


def test_should_refuse_a_community_number_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["comunidade"]["max_relatos_por_dia"]["fonte"]

    with pytest.raises(ValueError, match="comunidade.max_relatos_por_dia"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()
