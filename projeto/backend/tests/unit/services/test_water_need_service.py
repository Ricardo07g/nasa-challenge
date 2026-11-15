"""Unit tests for WaterNeedService (linha "Água" e selo "Sede da cultura", tarefa 0044)."""

from dataclasses import replace

import pytest

from app.models.recomendacao import ResultadoAno
from app.repositories.rules_repository import load_default_rules
from app.services.water_need_service import WaterNeedService


def _ano(ano: int, etc: float, etr: float, chuva: float) -> ResultadoAno:
    return ResultadoAno(
        ano=ano,
        aperto=False,
        isna=1.0,
        dias_calor=0,
        etc_mm=etc,
        etr_mm=etr,
        chuva_mm=chuva,
    )


def _anos(faltas: list[float], etc: float = 300.0, chuva: float = 400.0) -> list[ResultadoAno]:
    return [_ano(2005 + i, etc, etc - falta, chuva) for i, falta in enumerate(faltas)]


def test_should_take_the_median_of_need_rain_and_shortage_over_the_years() -> None:
    anos = [
        _ano(2005, etc=300.0, etr=250.0, chuva=420.0),  # falta 50
        _ano(2006, etc=320.0, etr=220.0, chuva=380.0),  # falta 100
        _ano(2007, etc=340.0, etr=330.0, chuva=500.0),  # falta 10
    ]

    agua = WaterNeedService().summarize(anos, cad_mm=60.0)

    assert agua is not None
    assert (agua.precisa_mm, agua.chove_mm, agua.falta_normal_mm) == (320, 420, 50)
    assert (agua.cad_mm, agua.anos) == (60, 3)


def test_should_give_the_dry_year_shortage_as_the_one_only_a_fifth_of_years_exceed() -> None:
    # 20 anos com falta de 0 a 190 mm: percentil 80 com interpolação linear = 152 mm. É o "ano
    # seco" da tela 3 (só 20% dos anos piores), virado para a falta (mais falta = pior).
    anos = _anos([10.0 * i for i in range(20)])

    agua = WaterNeedService().summarize(anos, cad_mm=60.0)

    assert agua is not None
    assert agua.falta_normal_mm == 95
    assert agua.falta_seco_mm == 152


def test_should_never_report_a_negative_shortage() -> None:
    anos = _anos([0.0, 0.0, 0.0])

    agua = WaterNeedService().summarize(anos, cad_mm=60.0)

    assert agua is not None
    assert (agua.falta_normal_mm, agua.falta_seco_mm) == (0, 0)


@pytest.mark.parametrize(
    ("precisa", "sede"),
    [(230.0, "pouca"), (279.9, "pouca"), (280.0, "media"), (324.9, "media"), (325.0, "muita")],
)
def test_should_label_crop_thirst_by_the_cuts_of_the_rules(precisa: float, sede: str) -> None:
    assert WaterNeedService().thirst(precisa) == sede


def test_should_use_the_thirst_cuts_from_injected_rules() -> None:
    base = load_default_rules()
    rules = replace(
        base, agua=replace(base.agua, sede_pouca_ate_mm=100.0, sede_muita_desde_mm=200.0)
    )

    agua = WaterNeedService(rules).summarize(_anos([0.0], etc=250.0), cad_mm=60.0)

    assert agua is not None
    assert agua.sede == "muita"


def test_should_show_how_the_shortage_changes_in_2041_2060_with_the_range_across_models() -> None:
    hoje = _anos([40.0, 50.0, 60.0])
    por_modelo = {
        "A": _anos([50.0, 60.0, 70.0]),  # mediana 60
        "B": _anos([70.0, 80.0, 90.0]),  # mediana 80
        "C": _anos([100.0, 100.0, 100.0]),  # mediana 100
    }

    agua = WaterNeedService().summarize(hoje, cad_mm=60.0, futuro_por_modelo=por_modelo)

    assert agua is not None and agua.futuro is not None
    futuro = agua.futuro
    assert (futuro.falta_normal_mm, futuro.falta_min_mm, futuro.falta_max_mm) == (80, 60, 100)
    assert futuro.mudanca_mm == 30  # 80 no futuro contra 50 hoje
    assert futuro.modelos == 3


def test_should_leave_the_future_out_without_cmip6_models() -> None:
    agua = WaterNeedService().summarize(_anos([10.0]), cad_mm=60.0, futuro_por_modelo={})

    assert agua is not None
    assert agua.futuro is None


def test_should_have_no_water_line_without_simulated_years() -> None:
    assert WaterNeedService().summarize([], cad_mm=60.0) is None
