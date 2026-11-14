"""Unit tests for RotationPlanService (anos mais secos e planos de 3 anos)."""

from dataclasses import replace
from datetime import date, timedelta

import pytest

from app.models.climate import ClimateSeason
from app.models.recomendacao import NotasOpcao, ResultadoOpcao
from app.repositories.rules_repository import load_default_rules
from app.services.rotation_plan_service import RotationPlanService

DAYS = 212
ALL_CROPS = ["pousio", "milho_safrinha", "sorgo", "milho_braquiaria", "milheto", "crotalaria"]


def _notas(final: float) -> NotasOpcao:
    return NotasOpcao(seguranca=final, futuro=None, solo=final, renda=final, final=final)


# Notas do pousio sem CMIP6 (PRD 7.2 e 7.6): segurança 100, solo 0, renda 0 -> 30 / 0,85 = 35,3
POUSIO = NotasOpcao(seguranca=100.0, futuro=None, solo=0.0, renda=0.0, final=35.3)


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
        opcoes=opcoes, anos_secos=[2007, 2010, 2012, 2014], pousio=POUSIO, nematoide=True
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
        opcoes=opcoes, anos_secos=[2007, 2010, 2012, 2014], pousio=POUSIO, nematoide=None
    )

    assert "milho_safrinha" in normal.anos
    assert "milho_safrinha" not in seco.anos
    # média das notas do ano seco (70, 60, 70) + 5 de diversidade (2 culturas diferentes)
    assert seco.nota == pytest.approx(round((70.0 + 60.0 + 70.0) / 3 + 5.0, 1))
    assert "2007, 2010, 2012, 2014" in seco.descricao


def test_should_not_give_diversity_bonus_when_every_year_is_a_grain_crop() -> None:
    # PRD 7.7: o bônus conta funções (grão, cobertura gramínea, cobertura leguminosa), não culturas.
    # Milho e sorgo são os dois grão: alternar entre eles não vale os +5.
    service = RotationPlanService()
    opcoes = [
        _make_option("milho_safrinha", 80.0),
        _make_option("sorgo", 80.0),
        _make_option("milheto", 50.0),
    ]

    normal, _, _ = service.build_3_year_plans(opcoes=opcoes, anos_secos=[2007], pousio=POUSIO)

    assert normal.nota == 80.0


def test_should_count_brachiaria_as_grain_and_grass_cover_for_diversity() -> None:
    # PRD 5: milho + braquiária é "grão + cobertura" (a braquiária é gramínea). Com a crotalária
    # (leguminosa), o plano tem as 3 funções: +10.
    service = RotationPlanService()
    opcoes = [_make_option("milho_braquiaria", 50.0), _make_option("crotalaria", 50.0)]

    normal, _, _ = service.build_3_year_plans(opcoes=opcoes, anos_secos=[2007], pousio=POUSIO)

    assert normal.nota == 60.0
    assert set(normal.anos) == {"milho_braquiaria", "crotalaria"}


def test_should_still_plan_and_say_so_when_nematoide_and_no_suppressor_fits_the_window() -> None:
    # Antes: com nematoide = sim e sem crotalária nem milheto na janela, todas as sequências eram
    # puladas e o plano saía com nota -1,0. Agora o plano sai e a descrição avisa.
    service = RotationPlanService()
    opcoes = [_make_option("milho_safrinha", 70.0), _make_option("sorgo", 60.0)]

    normal, seco, _ = service.build_3_year_plans(
        opcoes=opcoes, anos_secos=[2007], pousio=POUSIO, nematoide=True
    )

    assert normal.nota == 70.0
    assert seco.nota == 70.0
    assert set(normal.anos) <= {"milho_safrinha", "sorgo", "pousio"}
    assert "nematoide" in normal.descricao
    assert "nematoide" in seco.descricao


def test_should_score_today_corn_sequence_with_the_plan_formula_and_no_extra_penalty() -> None:
    # PRD 7.7: nota do plano = média das notas finais + bônus de diversidade. Antes o "hoje"
    # (milho safrinha nos 3 anos) perdia 12 pontos de uma penalidade que não está no PRD.
    service = RotationPlanService()
    opcoes = [_make_option("sorgo", 60.0), _make_option("milho_safrinha", 70.0)]

    _, _, hoje = service.build_3_year_plans(opcoes=opcoes, anos_secos=[2007], pousio=POUSIO)

    assert hoje.anos == ("milho_safrinha", "milho_safrinha", "milho_safrinha")
    assert hoje.nota == 70.0


def test_should_generate_216_sequences_with_fallow_before_any_filter() -> None:
    # PRD §11: "planos | sem restrição | 216 combinações antes do filtro" (6 x 6 x 6, com pousio)
    sequences = RotationPlanService().all_sequences(ALL_CROPS)

    assert len(sequences) == 216
    assert ("pousio", "pousio", "pousio") in sequences


def test_should_drop_only_more_than_two_fallows_in_a_row() -> None:
    # PRD 7.7: descartar mais de 2 pousios seguidos. Dois pousios ainda valem.
    sequences = RotationPlanService().candidate_sequences(ALL_CROPS, nematoide=None)

    assert len(sequences) == 215
    assert ("pousio", "pousio", "pousio") not in sequences
    assert ("pousio", "pousio", "milheto") in sequences
    assert ("pousio", "milheto", "pousio") in sequences


def test_should_keep_only_sequences_with_crotalaria_or_millet_when_nematoide_is_true() -> None:
    # PRD §11: nematoide = sim -> nenhum plano sem crotalária ou milheto nos 3 anos
    sequences = RotationPlanService().candidate_sequences(ALL_CROPS, nematoide=True)

    assert sequences
    assert all({"crotalaria", "milheto"} & set(seq) for seq in sequences)
    # 215 sem 3 pousios, menos as 63 só com pousio, milho, sorgo e milho + braquiária (4³ - 1)
    assert len(sequences) == 215 - 63


def test_should_put_fallow_in_dry_plan_when_every_crop_does_worse_than_fallow_in_dry_years() -> (
    None
):
    # O pousio entra nas combinações (PRD 7.7). No ano seco o milho vale 10 e o pousio 35,3: o
    # melhor plano usa 2 pousios, nunca 3 seguidos.
    service = RotationPlanService()
    opcoes = [_make_option("milho_safrinha", final=70.0, final_seco=10.0)]

    normal, seco, _ = service.build_3_year_plans(opcoes=opcoes, anos_secos=[2007], pousio=POUSIO)

    assert normal.anos == ("milho_safrinha", "milho_safrinha", "milho_safrinha")
    assert sorted(seco.anos) == ["milho_safrinha", "pousio", "pousio"]
    assert seco.nota == pytest.approx(round((35.3 + 35.3 + 10.0) / 3, 1))


def test_should_compare_with_fallow_today_when_corn_is_out_of_the_window() -> None:
    # PRD 7.7: a sequência de hoje é soja/milho ou soja/pousio. Sem milho na janela (colheita
    # tarde), o "hoje" é o pousio, e não a melhor opção repetida.
    service = RotationPlanService()
    opcoes = [_make_option("milheto", 51.5), _make_option("sorgo", 24.4)]

    _, _, hoje = service.build_3_year_plans(opcoes=opcoes, anos_secos=[2007], pousio=POUSIO)

    assert hoje.anos == ("pousio", "pousio", "pousio")
    assert hoje.nota == 35.3
    assert "milho" in hoje.descricao


def test_should_leave_only_fallow_when_no_crop_fits_the_window() -> None:
    service = RotationPlanService()

    planos = service.build_3_year_plans(opcoes=[], anos_secos=[2007], pousio=POUSIO, lang="en")

    for plano in planos:
        assert plano.anos == ("pousio", "pousio", "pousio")
        assert plano.nota == 35.3
        assert plano.descricao


def test_should_take_number_of_dry_years_from_injected_rules() -> None:
    base = load_default_rules()
    service = RotationPlanService(rules=replace(base, rotacao=replace(base.rotacao, anos_secos=2)))
    seasons = [
        _make_season(2005, {}),
        _make_season(2007, {2: 1.2, 3: 1.2, 4: 1.2}),
        _make_season(2010, {2: 1.5, 3: 1.5, 4: 1.5}),
        _make_season(2016, {2: 1.0, 3: 1.0, 4: 1.0}),
    ]

    assert service.select_driest_years(seasons) == [2016, 2007]
