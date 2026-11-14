"""Unit tests for RecommendationService (notas, rótulos, ranking, alternativas e frases)."""

from dataclasses import replace
from datetime import date, timedelta

import pytest

from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.crop_option import CropParams
from app.models.recomendacao import Recomendacao, ResultadoOpcao
from app.models.regras import Regras
from app.models.talhao import SoloInfo
from app.repositories.rules_repository import load_default_rules
from app.services.climate_risk_service import ClimateRiskService
from app.services.errors import OutsideAreaError, ValidationDomainError
from app.services.recommendation_service import RecommendationService
from app.services.rotation_plan_service import RotationPlanService
from app.services.water_balance_calculator import WaterBalanceCalculator

DAYS = 212
CELL_ID = "-190_-482"


def _crop(
    crop_id: str,
    tipo: str,
    limite: str | None,
    solo: tuple[int, int, int],
    economia: tuple[float, float, float] = (0.0, 0.0, 0.0),
    n_kg: int = 0,
    steps_en: tuple[str, ...] = ("Step 1",),
) -> CropParams:
    palhada, nitrogenio, pragas = solo
    produtividade, preco, custo = economia
    return CropParams(
        id=crop_id,
        nome=crop_id.replace("_", " ").title(),
        nome_en=f"{crop_id} (en)",
        tipo=tipo,
        funcao="x",
        semeadura_limite_mes_dia=limite,
        dias_florescer=0 if tipo == "pousio" else 60,
        ciclo_dias=0 if tipo == "pousio" else 100,
        kc_pico=1.0,
        solo_palhada=palhada,
        solo_nitrogenio=nitrogenio,
        solo_pragas=pragas,
        n_deixado_kg=n_kg,
        produtividade_padrao_sc_ha=produtividade,
        preco_padrao_saca=preco,
        custo_padrao_ha=custo,
        como_fazer=("Passo 1",),
        como_fazer_en=steps_en,
    )


# Pontos de solo da tabela 7.4 do PRD e dinheiro do culturas.yaml
CROPS = [
    _crop("pousio", "pousio", None, (0, 0, 0)),
    _crop("milho_safrinha", "grao", "02-28", (20, 0, 0), (80.0, 62.0, 3500.0)),
    _crop("sorgo", "grao", "03-20", (20, 0, 15), (60.0, 49.6, 2200.0)),
    _crop("milho_braquiaria", "consorcio", "02-28", (40, 0, 10), (76.0, 62.0, 3800.0)),
    # Milheto sem tradução dos passos: em inglês cai no português.
    _crop("milheto", "cobertura", "03-15", (35, 0, 20), (0.0, 0.0, 600.0), steps_en=()),
    _crop("crotalaria", "cobertura", "02-28", (25, 30, 30), (0.0, 0.0, 800.0), n_kg=80),
]


class FakeCropParamsRepository:
    def list_all(self) -> list[CropParams]:
        return list(CROPS)

    def get_by_id(self, crop_id: str) -> CropParams | None:
        return next((c for c in CROPS if c.id == crop_id), None)


def _season(year: int, dry_feb_to_jun: bool) -> ClimateSeason:
    start = date(year, 1, 1)
    rain = tuple(
        0.0 if dry_feb_to_jun and 2 <= (start + timedelta(days=i)).month <= 6 else 8.0
        for i in range(DAYS)
    )
    return ClimateSeason(
        cell_id=CELL_ID,
        year=year,
        start_date=start,
        lat=-18.95,
        rain_mm=rain,
        rain_source="nasa_power",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
        eto_mm=tuple([4.0] * DAYS),
    )


class FakeClimateRepository:
    """20 anos (2005-2024); `dry_years` ficam sem chuva de fevereiro a junho."""

    def __init__(
        self,
        dry_years: tuple[int, ...] = (),
        deltas: list[Cmip6Delta] | None = None,
        inside: bool = True,
        years: tuple[int, ...] = tuple(range(2005, 2025)),
    ) -> None:
        self._dry_years = dry_years
        self._deltas = deltas or []
        self._inside = inside
        self._years = years

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return CELL_ID if self._inside else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return [_season(y, y in self._dry_years) for y in self._years]

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        return list(self._deltas)


class FakeSoilRepository:
    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return SoloInfo(
            argila_percentual=42.5,
            areia_percentual=38.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


def _service(
    climate: FakeClimateRepository | None = None, rules: Regras | None = None
) -> RecommendationService:
    return RecommendationService(
        crop_repo=FakeCropParamsRepository(),
        climate_repo=climate or FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        risk_service=ClimateRiskService(WaterBalanceCalculator()),
        plan_service=RotationPlanService(),
        rules=rules,
    )


def _opcao(rec: Recomendacao, crop_id: str) -> ResultadoOpcao:
    return next(o for o in rec.opcoes if o.id == crop_id)


def test_should_keep_five_crops_and_never_rank_pousio_when_harvest_is_meio() -> None:
    # PRD §11: pousio nunca é a "melhor opção" nem alternativa
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert rec.semeadura == date(2027, 2, 18)
    assert rec.celula_id == CELL_ID
    assert {o.id for o in rec.opcoes} == {
        "milho_safrinha",
        "sorgo",
        "milho_braquiaria",
        "milheto",
        "crotalaria",
    }
    assert rec.melhor != "pousio"
    assert all(a.opcao not in ("pousio", rec.melhor) for a in rec.alternativas)


def test_should_move_early_deadline_crops_to_fora_da_janela_when_harvest_is_tarde() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="tarde")

    assert rec.semeadura == date(2027, 3, 3)
    assert {o.id for o in rec.opcoes} == {"sorgo", "milheto"}
    assert {o.id for o in rec.fora_da_janela} == {
        "milho_safrinha",
        "milho_braquiaria",
        "crotalaria",
    }


def test_should_raise_outside_area_instead_of_using_other_region_data() -> None:
    service = _service(FakeClimateRepository(inside=False))

    with pytest.raises(OutsideAreaError):
        service.recommend(lat=-23.55, lon=-46.63, colheita="meio")


def test_should_reject_unknown_harvest_band() -> None:
    with pytest.raises(ValidationDomainError):
        _service().recommend(lat=-18.95, lon=-48.20, colheita="ontem")


def test_should_score_soil_with_prd_table_when_nematoide_not_informed() -> None:
    # PRD 7.4: crotalária 85, milheto 55, milho + braquiária 50, sorgo 35, milho 20
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert _opcao(rec, "crotalaria").notas.solo == 85.0
    assert _opcao(rec, "milheto").notas.solo == 55.0
    assert _opcao(rec, "milho_braquiaria").notas.solo == 50.0
    assert _opcao(rec, "sorgo").notas.solo == 35.0
    assert _opcao(rec, "milho_safrinha").notas.solo == 20.0
    assert _opcao(rec, "crotalaria").rotulo_terra == "bom"
    assert _opcao(rec, "sorgo").rotulo_terra == "medio"
    assert _opcao(rec, "milho_safrinha").rotulo_terra == "medio"


def test_should_weight_pests_one_and_half_times_when_nematoide_is_true() -> None:
    # PRD 7.4: pragas x 1,5 e total reescalado para 0 a 100 (máximo 40 + 30 + 45 = 115)
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", nematoide=True)

    assert _opcao(rec, "crotalaria").notas.solo == pytest.approx(round(100 * 100 / 115, 1))
    assert _opcao(rec, "milho_safrinha").notas.solo == pytest.approx(round(100 * 20 / 115, 1))


def test_should_score_income_relative_to_best_margin_when_no_losses() -> None:
    # PRD 7.5: margem = produtividade x fator x preço - custo; nota = 100 x margem / maior margem
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    milho = _opcao(rec, "milho_safrinha")
    braquiaria = _opcao(rec, "milho_braquiaria")
    crotalaria = _opcao(rec, "crotalaria")

    assert milho.margem_ha == pytest.approx(80 * 62 - 3500)
    assert milho.notas.renda == 100.0
    assert braquiaria.notas.renda == pytest.approx(round(100 * (76 * 62 - 3800) / 1460, 1))
    assert crotalaria.margem_ha == pytest.approx(-800.0)
    assert crotalaria.notas.renda == 0.0
    assert milho.texto_dinheiro == "Sobra perto de R$ 1.460 por hectare"
    assert crotalaria.texto_dinheiro == "Custa perto de R$ 800 por hectare"
    assert milho.rotulo_dinheiro == "bom"
    assert crotalaria.rotulo_dinheiro == "fraco"


@pytest.mark.parametrize(
    ("n_dry", "anos_bons", "rotulo"),
    [(3, 17, "bom"), (4, 16, "medio"), (9, 11, "fraco")],
)
def test_should_label_rain_axis_by_good_years_when_dry_years_vary(
    n_dry: int, anos_bons: int, rotulo: str
) -> None:
    # PRD §11: 17, 16 e 11 anos sem aperto -> Bom, Médio e Fraco
    dry_years = tuple(range(2005, 2005 + n_dry))
    rec = _service(FakeClimateRepository(dry_years=dry_years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.anos_bons_chuva == anos_bons
    assert milho.total_anos == 20
    assert milho.rotulo_chuva == rotulo
    assert milho.texto_chuva == f"Deu certo em {anos_bons} de 20 anos"


def test_should_count_only_the_years_with_data_when_some_years_were_dropped() -> None:
    # Tarefa 0005: anos descartados por dia sem dado no POWER não entram no "de N anos"
    years = tuple(y for y in range(2005, 2025) if y not in (2010, 2015, 2020))
    rec = _service(FakeClimateRepository(years=years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.total_anos == 17
    assert milho.texto_chuva == "Deu certo em 17 de 17 anos"


def test_should_cite_same_number_as_the_math_when_explaining_stress_years() -> None:
    # PRD §11: resultado com 6 anos de aperto -> a frase cita "6 dos últimos 20 anos"
    dry_years = (2006, 2009, 2012, 2015, 2018, 2021)
    rec = _service(FakeClimateRepository(dry_years=dry_years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.faixa_anos == tuple(year not in dry_years for year in range(2005, 2025))
    assert any("6 dos últimos 20 anos" in frase for frase in milho.porque)


def test_should_leave_future_empty_and_reweight_final_score_when_no_cmip6_data() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    milho = _opcao(rec, "milho_safrinha")
    notas = milho.notas

    assert milho.futuro is None
    assert notas.futuro is None
    assert not any("2041" in frase for frase in milho.porque)
    expected = (0.30 * notas.seguranca + 0.25 * notas.solo + 0.30 * notas.renda) / 0.85
    assert notas.final == pytest.approx(round(expected, 1))


def test_should_include_future_range_and_weight_when_cmip6_deltas_exist() -> None:
    deltas = [
        Cmip6Delta(model=model, scenario="ssp245", month=m, rain_pct=pct, tmax_c=0.0)
        for model, pct in (("IGUAL", 0.0), ("SECO", -100.0))
        for m in range(1, 13)
    ]
    rec = _service(FakeClimateRepository(deltas=deltas)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")
    notas = milho.notas

    assert milho.futuro is not None
    assert (milho.futuro.anos_bons_min, milho.futuro.anos_bons_max) == (0, 20)
    assert notas.futuro == 50.0
    expected = 0.30 * notas.seguranca + 0.25 * notas.solo + 0.30 * notas.renda + 0.15 * 50.0
    assert notas.final == pytest.approx(round(expected, 1))
    assert any("2041" in frase for frase in milho.porque)


def test_should_score_dry_scenario_only_with_the_four_driest_years() -> None:
    dry_years = (2007, 2010, 2012, 2014)
    rec = _service(FakeClimateRepository(dry_years=dry_years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.notas.seguranca == 80.0
    assert milho.notas_seco.seguranca == 0.0
    assert "2007, 2010, 2012, 2014" in rec.plano_seco.descricao


def test_should_write_texts_in_english_when_language_is_en() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="en-US,en;q=0.9")
    milho = _opcao(rec, "milho_safrinha")

    assert milho.nome == "milho_safrinha (en)"
    assert milho.texto_chuva == "Worked in 20 of 20 years"
    assert any("NASA POWER" in frase for frase in milho.porque)


def test_should_give_how_to_steps_in_the_requested_language() -> None:
    pt = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="pt-BR")
    en = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="en-US,en;q=0.9")

    assert _opcao(pt, "milho_safrinha").como_fazer == ("Passo 1",)
    assert _opcao(en, "milho_safrinha").como_fazer == ("Step 1",)
    # Sem tradução no culturas.yaml: mostra os passos em português em vez de nada.
    assert _opcao(en, "milheto").como_fazer == ("Passo 1",)


def test_should_use_soil_override_for_water_capacity() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", solo_override="arenoso")

    assert rec.solo == "arenoso"
    assert any("40 mm" in frase for frase in _opcao(rec, "milho_safrinha").porque)


def test_should_write_soil_texture_with_accent_in_portuguese_text() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", solo_override="medio")

    assert any("solo médio" in frase for frase in _opcao(rec, "sorgo").porque)


def test_should_weight_final_score_with_injected_rules() -> None:
    # regras.yaml com peso só no solo: a nota final passa a ser a nota de solo
    base = load_default_rules()
    nota_final = replace(
        base.nota_final, peso_seguranca=0.0, peso_solo=1.0, peso_renda=0.0, peso_futuro=0.0
    )
    rec = _service(rules=replace(base, nota_final=nota_final)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert rec.melhor == "crotalaria"
    assert all(o.notas.final == o.notas.solo for o in rec.opcoes)


def test_should_label_money_with_thresholds_from_injected_rules() -> None:
    base = load_default_rules()
    rotulos = replace(base.rotulos, dinheiro_bom=101.0)
    rec = _service(rules=replace(base, rotulos=rotulos)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert _opcao(rec, "milho_safrinha").notas.renda == 100.0
    assert _opcao(rec, "milho_safrinha").rotulo_dinheiro == "medio"


def test_should_write_why_with_phrase_template_and_heat_number_from_injected_rules() -> None:
    # Plano técnico §4.8: a frase vem do modelo do regras.yaml e cita o mesmo número da conta
    base = load_default_rules()
    frases = {
        **base.frases,
        "pt": replace(base.frases["pt"], seguranca="{anos_aperto}/{total} {calor_c} °C"),
    }
    rules = replace(base, clima=replace(base.clima, calor_temp_c=33.0), frases=frases)

    rec = _service(rules=rules).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert _opcao(rec, "milho_safrinha").porque[0] == "0/20 33 °C"
