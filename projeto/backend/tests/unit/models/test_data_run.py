"""Contrato da execução de um script de dados (tabela `data_run`), base do `versao_dados`."""

from dataclasses import fields
from datetime import UTC, datetime

import pytest

from app.models.data_run import DataRun


def _run(**overrides: object) -> DataRun:
    values: dict[str, object] = {
        "source": "nex_gddp_cmip6",
        "params": {"cenario": "ssp245", "modelos": ["ACCESS-CM2", "MIROC6", "MRI-ESM2-0"]},
        "finished_at": datetime(2026, 11, 14, 13, 0, tzinfo=UTC),
        "version": "2026.11-nex-gddp-cmip6",
    }
    values.update(overrides)
    return DataRun(**values)  # type: ignore[arg-type]


def test_should_carry_source_params_end_and_version() -> None:
    assert [f.name for f in fields(DataRun)] == ["source", "params", "finished_at", "version"]


def test_should_keep_the_run_parameters() -> None:
    run = _run()

    assert run.source == "nex_gddp_cmip6"
    assert run.params["cenario"] == "ssp245"
    assert run.finished_at == datetime(2026, 11, 14, 13, 0, tzinfo=UTC)
    assert run.version == "2026.11-nex-gddp-cmip6"


@pytest.mark.parametrize("field_name", ["source", "version"])
def test_should_reject_blank_source_or_version(field_name: str) -> None:
    with pytest.raises(ValueError, match=field_name):
        _run(**{field_name: " "})


def test_should_reject_end_time_without_timezone() -> None:
    # finished_at é TIMESTAMPTZ no banco: hora sem fuso vira ambígua.
    with pytest.raises(ValueError, match="finished_at"):
        _run(finished_at=datetime(2026, 11, 14, 13, 0))
