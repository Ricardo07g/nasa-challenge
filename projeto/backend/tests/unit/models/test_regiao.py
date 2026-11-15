"""Contrato da região pelo satélite (P3): percentuais da lavoura na entressafra, por ano.

Os números aqui são valores de teste, não dados do MODIS.
"""

from dataclasses import fields

import pytest

from app.models.regiao import RegiaoAno, RegiaoSatelite


def _ano(**overrides: object) -> RegiaoAno:
    values: dict[str, object] = {
        "ano": 2025,
        "n_pixels": 1372,
        "pct_parado": 60.5,
        "pct_plantou": 30.6,
        "pct_incerto": 8.9,
        "pct_sem_dado": 2.2,
    }
    values.update(overrides)
    return RegiaoAno(**values)  # type: ignore[arg-type]


def _regiao(**overrides: object) -> RegiaoSatelite:
    values: dict[str, object] = {
        "lat": -18.9543,
        "lon": -48.1993,
        "raio_km": 30.0,
        "fonte": "MODIS MOD13Q1 + MYD13Q1",
        "mascara": "MCD12Q1 LC_Type1 classe 12 (lavouras)",
        "anos": (_ano(),),
    }
    values.update(overrides)
    return RegiaoSatelite(**values)  # type: ignore[arg-type]


def test_should_carry_the_fields_of_the_file_contract() -> None:
    assert [f.name for f in fields(RegiaoAno)] == [
        "ano",
        "n_pixels",
        "pct_parado",
        "pct_plantou",
        "pct_incerto",
        "pct_sem_dado",
    ]
    assert [f.name for f in fields(RegiaoSatelite)] == [
        "lat",
        "lon",
        "raio_km",
        "fonte",
        "mascara",
        "anos",
    ]


def test_should_accept_percentages_of_the_classified_pixels() -> None:
    ano = _ano()

    assert (ano.pct_parado, ano.pct_plantou, ano.pct_incerto, ano.pct_sem_dado) == (
        60.5,
        30.6,
        8.9,
        2.2,
    )


def test_should_accept_rounding_to_one_decimal_that_does_not_sum_exactly_100() -> None:
    # 1/3 de cada: 33,3 + 33,3 + 33,3 = 99,9 (arredondado a 1 casa).
    ano = _ano(pct_parado=33.3, pct_plantou=33.3, pct_incerto=33.3)

    assert ano.pct_parado == 33.3


def test_should_reject_percentages_that_do_not_add_up_to_100() -> None:
    with pytest.raises(ValueError, match="somar 100"):
        _ano(pct_parado=50.0, pct_plantou=30.0, pct_incerto=10.0)


@pytest.mark.parametrize("campo", ["pct_parado", "pct_plantou", "pct_incerto", "pct_sem_dado"])
@pytest.mark.parametrize("valor", [-0.1, 100.1, float("nan")])
def test_should_reject_percentage_outside_0_to_100(campo: str, valor: float) -> None:
    with pytest.raises(ValueError, match=campo):
        _ano(**{campo: valor})


def test_should_reject_negative_pixel_count() -> None:
    with pytest.raises(ValueError, match="n_pixels"):
        _ano(n_pixels=-1)


def test_should_leave_every_percentage_empty_when_there_is_no_cropland_pixel() -> None:
    # Região sem nenhum pixel de lavoura: nada para dividir (guia NDVI, "Testes").
    ano = _ano(n_pixels=0, pct_parado=None, pct_plantou=None, pct_incerto=None, pct_sem_dado=None)

    assert ano.n_pixels == 0


def test_should_reject_percentage_without_cropland_pixel() -> None:
    with pytest.raises(ValueError, match="sem pixel"):
        _ano(n_pixels=0, pct_sem_dado=None)


def test_should_leave_classes_empty_when_every_pixel_has_no_data() -> None:
    # Todos os pixels sem dado (nuvem o ano todo): sem percentual de parado, plantou ou incerto.
    ano = _ano(pct_parado=None, pct_plantou=None, pct_incerto=None, pct_sem_dado=100.0)

    assert ano.pct_parado is None


def test_should_reject_empty_classes_when_some_pixel_was_classified() -> None:
    with pytest.raises(ValueError, match="pct_sem_dado"):
        _ano(pct_parado=None, pct_plantou=None, pct_incerto=None, pct_sem_dado=40.0)


def test_should_reject_only_some_classes_empty() -> None:
    with pytest.raises(ValueError, match="juntos"):
        _ano(pct_incerto=None)


def test_should_reject_missing_no_data_percentage_when_there_are_pixels() -> None:
    with pytest.raises(ValueError, match="pct_sem_dado"):
        _ano(pct_sem_dado=None)


def test_should_accept_region_with_years() -> None:
    regiao = _regiao()

    assert (regiao.raio_km, regiao.anos[0].ano) == (30.0, 2025)


@pytest.mark.parametrize(
    ("campo", "valor"),
    [("lat", -90.1), ("lon", 180.5), ("raio_km", 0.0), ("raio_km", float("inf"))],
)
def test_should_reject_center_or_radius_outside_the_contract(campo: str, valor: float) -> None:
    with pytest.raises(ValueError, match=campo):
        _regiao(**{campo: valor})


@pytest.mark.parametrize("campo", ["fonte", "mascara"])
def test_should_reject_blank_source_or_mask(campo: str) -> None:
    with pytest.raises(ValueError, match=campo):
        _regiao(**{campo: " "})


def test_should_reject_repeated_year() -> None:
    with pytest.raises(ValueError, match="repetido"):
        _regiao(anos=(_ano(ano=2024), _ano(ano=2024)))
