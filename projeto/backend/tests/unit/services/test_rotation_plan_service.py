"""Unit tests for RotationPlanService (3-year sequence evaluation and dry years selection)."""

from datetime import date

from app.models.climate import ClimateSeason
from app.models.recomendacao import NotasOpcao, ResultadoOpcao
from app.services.rotation_plan_service import RotationPlanService


def _make_option(
    crop_id: str,
    nome: str,
    seguranca: float,
    solo: float,
    renda: float,
    futuro: float,
) -> ResultadoOpcao:
    final = round(0.30 * seguranca + 0.25 * solo + 0.30 * renda + 0.15 * futuro, 1)
    return ResultadoOpcao(
        id=crop_id,
        nome=nome,
        na_janela=True,
        data_limite="2027-02-28",
        anos_bons_chuva=16,
        total_anos=20,
        faixa_anos=tuple([True] * 16 + [False] * 4),
        rotulo_chuva="bom",
        texto_chuva="Bom",
        futuro_anos_bons_media=14,
        futuro_anos_bons_min=12,
        futuro_anos_bons_max=15,
        margem_ha=1200.0,
        rotulo_dinheiro="bom",
        texto_dinheiro="Bom",
        rotulo_terra="bom",
        texto_terra="Bom",
        notas=NotasOpcao(
            seguranca=seguranca,
            futuro=futuro,
            solo=solo,
            renda=renda,
            final=final,
        ),
        porque=("Motivo 1",),
        como_fazer=("Passo 1",),
    )


def _make_season_with_rain(year: int, rain_val: float) -> ClimateSeason:
    return ClimateSeason(
        cell_id="-189_-483",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple([rain_val] * 180),
        rain_source="nasa_power",
        tmax_c=tuple([30.0] * 180),
        tmin_c=tuple([18.0] * 180),
        eto_mm=tuple([4.0] * 180),
        gwetroot=tuple([0.6] * 180),
    )


def test_should_select_four_driest_years_when_seasons_provided() -> None:
    service = RotationPlanService()
    seasons = [
        _make_season_with_rain(2005, 5.0),
        _make_season_with_rain(2007, 1.2),
        _make_season_with_rain(2010, 1.5),
        _make_season_with_rain(2012, 1.7),
        _make_season_with_rain(2014, 1.4),
        _make_season_with_rain(2018, 6.0),
    ]

    driest = service.select_4_driest_years(seasons)

    assert [s.year for s in driest] == [2007, 2014, 2010, 2012]


def test_should_include_nematode_suppressor_crop_in_3_year_plan_when_nematoide_is_true() -> None:
    service = RotationPlanService()
    opcoes = [
        _make_option("milho_braquiaria", "Milho + braquiária", 80.0, 90.0, 85.0, 75.0),
        _make_option("sorgo", "Sorgo granífero", 90.0, 70.0, 75.0, 85.0),
        _make_option("crotalaria", "Crotalária spectabilis", 85.0, 98.0, 55.0, 80.0),
        _make_option("milheto", "Milheto", 92.0, 88.0, 50.0, 88.0),
    ]
    seasons = [_make_season_with_rain(2005 + i, 4.0) for i in range(6)]

    plano_normal, plano_seco, plano_hoje = service.build_3_year_plans(
        opcoes=opcoes,
        seasons=seasons,
        nematoide=True,
    )

    assert len(plano_normal.anos) == 3
    assert any(c in ("crotalaria", "milheto") for c in plano_normal.anos)
    assert len(plano_seco.anos) == 3
    assert len(plano_hoje.anos) == 3
