"""Contrato da observação de NDVI do MODIS por ponto, com a qualidade já filtrada (PRD 7.8)."""

from dataclasses import fields
from datetime import date

import pytest

from app.models.talhao import NdviRecord


def test_should_carry_date_ndvi_quality_and_product() -> None:
    assert [f.name for f in fields(NdviRecord)] == ["data", "ndvi", "qualidade", "produto"]


def test_should_keep_quality_and_product_optional_for_the_old_cache() -> None:
    # O cache antigo tem só `data` e `ndvi`; os arquivos novos trazem os quatro campos.
    rec = NdviRecord(data=date(2016, 4, 6), ndvi=7100.0)

    assert rec.qualidade is None
    assert rec.produto is None


@pytest.mark.parametrize("produto", ["MOD13Q1", "MYD13Q1"])
@pytest.mark.parametrize("qualidade", [0, 1])
def test_should_accept_good_or_marginal_observation_from_terra_or_aqua(
    qualidade: int, produto: str
) -> None:
    rec = NdviRecord(data=date(2016, 4, 6), ndvi=0.71, qualidade=qualidade, produto=produto)

    assert (rec.qualidade, rec.produto) == (qualidade, produto)


@pytest.mark.parametrize("qualidade", [-1, 2, 3])
def test_should_reject_quality_that_the_pipeline_must_filter_out(qualidade: int) -> None:
    # pixel_reliability / SummaryQA: 2 = neve, 3 = nuvem. Nunca chegam ao model.
    with pytest.raises(ValueError, match="qualidade"):
        NdviRecord(data=date(2016, 4, 6), ndvi=0.71, qualidade=qualidade)


def test_should_reject_unknown_product() -> None:
    with pytest.raises(ValueError, match="produto"):
        NdviRecord(data=date(2016, 4, 6), ndvi=0.71, produto="MOD09GA")


@pytest.mark.parametrize("ndvi", [-0.2, 0.0, 0.71, 1.0, -2000.0, 7100.0, 10000.0])
def test_should_accept_scaled_or_raw_ndvi_inside_the_valid_range(ndvi: float) -> None:
    assert NdviRecord(data=date(2016, 4, 6), ndvi=ndvi).ndvi == ndvi


@pytest.mark.parametrize("ndvi", [-3000.0, 10001.0, float("nan")])
def test_should_reject_fill_value_or_ndvi_outside_the_valid_range(ndvi: float) -> None:
    # -3000 é o valor de preenchimento do MOD13Q1 (pixel sem dado).
    with pytest.raises(ValueError, match="ndvi"):
        NdviRecord(data=date(2016, 4, 6), ndvi=ndvi)
