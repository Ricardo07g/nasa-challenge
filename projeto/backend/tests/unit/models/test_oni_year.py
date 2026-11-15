"""Contrato do ONI da NOAA por ano de safrinha (P1, seção "ONI" do AGENTS.md do backend)."""

import math

import pytest

from app.models.enso import OniYear


def test_should_keep_year_mean_oni_and_phase() -> None:
    ano = OniYear(ano=2016, oni=2.13, fase="el_nino")

    assert (ano.ano, ano.oni, ano.fase) == (2016, 2.13, "el_nino")


@pytest.mark.parametrize("fase", ["el_nino", "la_nina", None])
def test_should_accept_el_nino_la_nina_or_neutral(fase: str | None) -> None:
    assert OniYear(ano=2007, oni=0.23, fase=fase).fase == fase  # type: ignore[arg-type]


@pytest.mark.parametrize("fase", ["neutro", "El Niño", ""])
def test_should_refuse_a_phase_outside_the_contract(fase: str) -> None:
    with pytest.raises(ValueError, match="fase"):
        OniYear(ano=2007, oni=0.23, fase=fase)  # type: ignore[arg-type]


@pytest.mark.parametrize("oni", [-99.9, 99.9, math.nan, math.inf])
def test_should_refuse_missing_value_markers_and_non_finite_oni(oni: float) -> None:
    # O ONI é uma anomalia da temperatura do mar em °C: nunca passou de ±3. −99,9 é marca de
    # "sem valor" em tabelas da NOAA e nunca vira dado.
    with pytest.raises(ValueError, match="oni"):
        OniYear(ano=2007, oni=oni, fase=None)


def test_should_refuse_a_year_before_the_oni_table_starts() -> None:
    # A tabela do ONI começa no verão de 1950 (DJF 1950)
    with pytest.raises(ValueError, match="ano"):
        OniYear(ano=1949, oni=0.0, fase=None)
