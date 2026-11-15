"""Bloco 8 do raio-X: a célula entre as da caixa em chuva de março a maio (tarefa 0043).

Totais de teste com valores redondos (não são do GPM IMERG): a chave de fonte é `teste`.
"""

from dataclasses import replace

from app.models.climate import CellRainTotal
from app.repositories.rules_repository import load_default_rules
from app.services.region_rank_service import RegionRankService

MAM_DAYS = 92  # 1/mar a 31/mai


def _totals(cell: str, mm: float, years: tuple[int, ...] = (2023, 2024)) -> list[CellRainTotal]:
    return [CellRainTotal(cell, year, mm, MAM_DAYS, "teste") for year in years]


def _region(mms: list[float], own: float) -> list[CellRainTotal]:
    rows = _totals("-190_-482", own)
    for i, mm in enumerate(mms):
        rows += _totals(f"-19{i}_-480", mm)
    return rows


def test_should_say_how_much_of_the_region_is_wetter_than_the_cell() -> None:
    # 10 outras células: 7 mais chuvosas que 300 mm, 2 mais secas e 1 igual.
    others = [400.0] * 7 + [200.0] * 2 + [300.0]

    result = RegionRankService().rank("-190_-482", _region(others, own=300.0))

    assert result is not None
    assert (result.pct_mais_seca, result.pct_mais_chuvosa) == (70, 20)
    assert (result.celulas, result.chuva_mm, result.fonte) == (11, 300.0, "teste")
    assert result.mediana_regiao_mm == 400.0


def test_should_average_the_years_of_each_cell() -> None:
    rows = [
        CellRainTotal("-190_-482", 2023, 200.0, MAM_DAYS, "teste"),
        CellRainTotal("-190_-482", 2024, 400.0, MAM_DAYS, "teste"),
    ]
    rows += _region([350.0] * 10, own=0.0)[2:]

    result = RegionRankService().rank("-190_-482", rows)

    assert result is not None
    assert (result.chuva_mm, result.pct_mais_seca) == (300.0, 100)


def test_should_leave_out_a_year_without_the_whole_window() -> None:
    rows = _region([350.0] * 10, own=300.0)
    rows.append(CellRainTotal("-190_-482", 2025, 10.0, 40, "teste"))

    result = RegionRankService().rank("-190_-482", rows)

    assert result is not None
    assert result.chuva_mm == 300.0


def test_should_compare_only_cells_with_the_same_rain_source() -> None:
    # As células da caixa têm a chuva do IMERG; uma célula com a do POWER fica de fora.
    rows = _region([350.0] * 10, own=300.0)
    rows += [CellRainTotal("-185_-470", 2023, 900.0, MAM_DAYS, "nasa_power")]

    result = RegionRankService().rank("-190_-482", rows)

    assert result is not None
    assert result.celulas == 11


def test_should_need_enough_cells_to_compare() -> None:
    assert RegionRankService().rank("-190_-482", _region([350.0] * 8, own=300.0)) is None


def test_should_need_the_cell_itself() -> None:
    assert RegionRankService().rank("-150_-450", _region([350.0] * 10, own=300.0)) is None


def test_should_use_the_minimum_from_the_rules() -> None:
    rules = load_default_rules()
    loose = replace(rules, raio_x=replace(rules.raio_x, regiao_min_celulas=3))

    assert RegionRankService(loose).rank("-190_-482", _region([350.0] * 2, own=300.0)) is not None
