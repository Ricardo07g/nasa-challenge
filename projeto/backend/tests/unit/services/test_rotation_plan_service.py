"""Unit tests for RotationPlanService (anos mais secos e planos de 3 anos)."""

from datetime import date, timedelta

import pytest

from app.models.climate import ClimateSeason
from app.models.recomendacao import NotasOpcao, ResultadoOpcao
from app.services.rotation_plan_service import RotationPlanService

DAYS = 212


def _notas(final: float) -> NotasOpcao:
    return NotasOpcao(seguranca=final, futuro=None, solo=final, renda=final, final=final)


def _make_option(crop_id: str, final: float, final_seco: float | None = None) -> ResultadoOpcao:
    return ResultadoOpcao(
        id=crop_id,
        nome=crop_id,
        na_janela=True,
        data_limite="2027-02-28",
        anos_bons_chuva=16,
        total_anos=20,
        faixa_anos=tuple([True] * 16 + [False] * 4),
        rotulo_chuva="medio",
        texto_chuva="Deu certo em 16 de 20 anos",
        futuro=None,
        margem_ha=1200.0,
        rotulo_dinheiro="bom",
        texto_dinheiro="Sobra perto de R$ 1.200 por hectare",
        rotulo_terra="bom",
        texto_terra="Deixa palhada alta",
        notas=_notas(final),
        notas_seco=_notas(final if final_seco is None else final_seco),
        porque=("Motivo 1",),
        como_fazer=("Passo 1",),
    )


def _make_season(year: int, rain_by_month: dict[int, float]) -> ClimateSeason:
    start = date(year, 1, 1)
    rain = tuple(rain_by_month.get((start + timedelta(days=i)).month, 5.0) for i in range(DAYS))
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=start,
        lat=-18.95,
        rain_mm=rain,
        rain_source="nasa_power",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
        eto_mm=tuple([4.0] * DAYS),
    )


def test_should_select_four_driest_years_by_february_to_april_rain() -> None:
    service = RotationPlanService()
    seasons = [
        _make_season(2005, {}),
        _make_season(2007, {2: 1.2, 3: 1.2, 4: 1.2}),
        _make_season(2010, {2: 1.5, 3: 1.5, 4: 1.5}),
        _make_season(2012, {2: 1.7, 3: 1.7, 4: 1.7}),
        _make_season(2014, {2: 1.4, 3: 1.4, 4: 1.4}),
        # Fevereiro a abril seco, mas maio muito chuvoso: continua entre os mais secos.
        _make_season(2016, {2: 1.0, 3: 1.0, 4: 1.0, 5: 40.0}),
        # Maio seco não conta (PRD 7.7: chuva de fevereiro a abril).
        _make_season(2018, {5: 0.0}),
    ]

    assert service.select_driest_years(seasons) == [2016, 2007, 2014, 2010]


def test_should_include_nematode_suppressor_crop_in_3_year_plan_when_nematoide_is_true() -> None:
    # PRD §11: nematoide = sim -> nenhum plano sem crotalária ou milheto nos 3 anos
    service = RotationPlanService()
    opcoes = [
        _make_option("milho_braquiaria", 90.0),
        _make_option("sorgo", 85.0),
        _make_option("crotalaria", 40.0),
        _make_option("milheto", 30.0),
    ]

    normal, seco, hoje = service.build_3_year_plans(
        opcoes=opcoes, anos_secos=[2007, 2010, 2012, 2014], nematoide=True
    )

    assert any(c in ("crotalaria", "milheto") for c in normal.anos)
    assert any(c in ("crotalaria", "milheto") for c in seco.anos)
    assert len(hoje.anos) == 3


def test_should_build_dry_plan_from_dry_year_scores_when_they_differ_from_normal() -> None:
    # PRD 7.7 / plano técnico §4.6: cenário seco = mesma conta usando só os 4 anos mais secos
    service = RotationPlanService()
    opcoes = [
        _make_option("milho_safrinha", final=90.0, final_seco=10.0),
        _make_option("sorgo", final=60.0, final_seco=70.0),
        _make_option("milheto", final=50.0, final_seco=60.0),
    ]

    normal, seco, _ = service.build_3_year_plans(
        opcoes=opcoes, anos_secos=[2007, 2010, 2012, 2014], nematoide=None
    )

    assert "milho_safrinha" in normal.anos
    assert "milho_safrinha" not in seco.anos
    # média das notas do ano seco (70, 60, 70) + 5 de diversidade (2 culturas diferentes)
    assert seco.nota == pytest.approx(round((70.0 + 60.0 + 70.0) / 3 + 5.0, 1))
    assert "2007, 2010, 2012, 2014" in seco.descricao
