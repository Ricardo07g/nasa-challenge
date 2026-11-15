"""Contrato da soja na safra mais recente (RF-24, tarefa 0037).

Os picos aqui são valores de teste (não são do MODIS) e a fonte é "teste". O único número real é
o cabeçalho de um recorte de 9 × 9 pixels da ORNL em volta da fazenda de exemplo, usado para
conferir a conta da projeção.
"""

import pytest

from app.models.soja_recente import (
    MODIS_250M_PIXEL_M,
    GradeSinusoidal,
    MapaSojaRecente,
    PicoSojaRecente,
    SojaRecente,
    safra_label,
)

# Cabeçalho real da ORNL (MOD13Q1, ±1 km na fazenda de exemplo): canto de baixo à esquerda.
XLL, YLL = -5070031.09, -2108767.79
GRADE_9X9 = GradeSinusoidal(
    x_oeste_m=XLL, y_norte_m=YLL + 9 * MODIS_250M_PIXEL_M, pixel_m=MODIS_250M_PIXEL_M,
    linhas=9, colunas=9,
)  # fmt: skip
FAZENDA = (-18.9543, -48.1993)


def test_should_write_the_season_of_the_harvest_year() -> None:
    # A soja colhida em fevereiro de 2026 é a safra 2025/26.
    assert safra_label(2026) == "2025/26"
    assert safra_label(2000) == "1999/00"


def test_should_keep_the_recent_soybean_of_a_point() -> None:
    soja = SojaRecente(safra="2025/26", vista=True, ndvi_pico=0.86, fonte="teste")

    assert (soja.safra, soja.vista, soja.ndvi_pico, soja.fonte) == ("2025/26", True, 0.86, "teste")


def test_should_have_neither_seen_nor_peak_without_data() -> None:
    assert SojaRecente(safra="2025/26", vista=None, ndvi_pico=None, fonte="teste").vista is None
    with pytest.raises(ValueError, match="juntos"):
        SojaRecente(safra="2025/26", vista=False, ndvi_pico=None, fonte="teste")
    with pytest.raises(ValueError, match="juntos"):
        SojaRecente(safra="2025/26", vista=None, ndvi_pico=0.5, fonte="teste")


@pytest.mark.parametrize("pico", [-0.21, 1.01, float("nan")])
def test_should_refuse_a_peak_outside_the_ndvi_range(pico: float) -> None:
    with pytest.raises(ValueError, match="ndvi_pico"):
        SojaRecente(safra="2025/26", vista=False, ndvi_pico=pico, fonte="teste")


@pytest.mark.parametrize("safra", ["", "2026", "25/26", "2025-26"])
def test_should_refuse_a_season_out_of_the_format(safra: str) -> None:
    with pytest.raises(ValueError, match="safra"):
        SojaRecente(safra=safra, vista=True, ndvi_pico=0.8, fonte="teste")


def test_should_refuse_a_blank_source() -> None:
    with pytest.raises(ValueError, match="fonte"):
        SojaRecente(safra="2025/26", vista=True, ndvi_pico=0.8, fonte=" ")


# --- grade na projeção sinusoidal do MODIS -----------------------------------------------------


def test_should_find_the_pixel_of_a_point_in_the_modis_sinusoidal_grid() -> None:
    # A fazenda de exemplo é o pixel do meio do recorte de 9 × 9 que a ORNL centrou nela.
    assert GRADE_9X9.pixel_at(*FAZENDA) == (4, 4)


def test_should_count_rows_from_the_top_and_columns_from_the_left() -> None:
    grade = GradeSinusoidal(x_oeste_m=0.0, y_norte_m=0.0, pixel_m=1000.0, linhas=2, colunas=3)
    # Perto do equador, 1 km ~ 0,009°: o ponto 1,5 km a leste e 0,5 km ao sul.
    assert grade.pixel_at(-0.0045, 0.0135) == (0, 1)
    assert grade.pixel_at(-0.0135, 0.0225) == (1, 2)


def test_should_find_no_pixel_outside_the_grid() -> None:
    assert GRADE_9X9.pixel_at(-18.90, -48.1993) is None  # ~6 km ao norte
    assert GRADE_9X9.pixel_at(-18.9543, -48.25) is None  # ~5 km a oeste
    assert GRADE_9X9.pixel_at(-19.00, -48.1993) is None
    assert GRADE_9X9.pixel_at(-18.9543, -48.15) is None


@pytest.mark.parametrize(
    ("campo", "valor"),
    [("pixel_m", 0.0), ("linhas", 0), ("colunas", -1), ("x_oeste_m", float("inf"))],
)
def test_should_refuse_a_grid_out_of_the_contract(campo: str, valor: float) -> None:
    dados = {"x_oeste_m": 0.0, "y_norte_m": 0.0, "pixel_m": 231.0, "linhas": 2, "colunas": 2}

    with pytest.raises(ValueError, match=campo):
        GradeSinusoidal(**{**dados, campo: valor})


# --- mapa do pico (o arquivo) ------------------------------------------------------------------

GRADE_2X3 = GradeSinusoidal(x_oeste_m=0.0, y_norte_m=0.0, pixel_m=1000.0, linhas=2, colunas=3)


def _mapa(linhas: tuple[tuple[int | None, ...], ...]) -> MapaSojaRecente:
    return MapaSojaRecente(safra="2025/26", fonte="teste", grade=GRADE_2X3, pico_centesimos=linhas)


def test_should_read_the_peak_of_the_point_in_hundredths() -> None:
    mapa = _mapa(((86, 41, None), (-5, 100, 70)))

    assert mapa.pico_em(-0.0045, 0.0045) == PicoSojaRecente("2025/26", "teste", 0.86)
    assert mapa.pico_em(-0.0045, 0.0135) == PicoSojaRecente("2025/26", "teste", 0.41)
    assert mapa.pico_em(-0.0135, 0.0045) == PicoSojaRecente("2025/26", "teste", -0.05)
    assert mapa.pico_em(-0.0135, 0.0225) == PicoSojaRecente("2025/26", "teste", 0.7)


def test_should_read_a_pixel_without_data_as_a_null_peak() -> None:
    assert _mapa(((86, 41, None), (1, 2, 3))).pico_em(-0.0045, 0.0225) == PicoSojaRecente(
        "2025/26", "teste", None
    )


def test_should_have_no_peak_outside_the_grid() -> None:
    assert _mapa(((86, 41, None), (1, 2, 3))).pico_em(0.0045, 0.0045) is None


def test_should_refuse_rows_that_do_not_match_the_grid() -> None:
    with pytest.raises(ValueError, match="linhas"):
        _mapa(((1, 2, 3),))
    with pytest.raises(ValueError, match="colunas"):
        _mapa(((1, 2, 3), (1, 2)))


@pytest.mark.parametrize("valor", [101, -21, 0.5, True])
def test_should_refuse_a_peak_that_is_not_hundredths_of_ndvi(valor: object) -> None:
    with pytest.raises(ValueError, match="pico_centesimos"):
        _mapa(((1, 2, 3), (1, 2, valor)))  # type: ignore[arg-type]
