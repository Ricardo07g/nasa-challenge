"""Unit tests for PlanEvaluationService (avaliar um plano de 3 anos qualquer, tarefa 0045)."""

from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from app.config import APP_DIR
from app.models.climate import ClimateSeason
from app.models.recomendacao import (
    AguaOpcao,
    AnoDetalhe,
    ForaDaJanelaOpcao,
    FuturoResultado,
    NotasOpcao,
    ResultadoOpcao,
)
from app.models.sinal_outono import SinalOutono
from app.repositories.crop_params_repository import YamlCropParamsRepository
from app.services.errors import OutsideAreaError, ValidationDomainError
from app.services.plan_evaluation_service import PlanEvaluationService
from app.services.rotation_plan_service import RotationPlanService

CROPS = YamlCropParamsRepository(APP_DIR / "config_data" / "culturas.yaml")
YEARS = list(range(2005, 2015))
SOWING = date(2027, 2, 18)
DAYS = 212


def _option(
    crop_id: str,
    nome: str,
    seguranca: float,
    solo: float,
    usa_mm: int,
    falhas: set[int] | None = None,
    futuro: float | None = None,
    sede: str = "media",
) -> ResultadoOpcao:
    falhas = falhas or set()
    detalhe = tuple(
        AnoDetalhe(
            ano=y,
            bom=y not in falhas,
            fase_critica=date(y, 4, 18),
            dias_sem_chuva=0,
            enso=None,
            texto="",
        )
        for y in YEARS
    )
    futuro_nota = seguranca if futuro is None else futuro
    notas = NotasOpcao(
        seguranca=seguranca, futuro=futuro_nota, solo=solo, renda=0.0, final=seguranca
    )
    return ResultadoOpcao(
        id=crop_id,
        nome=nome,
        na_janela=True,
        data_limite="2027-02-28",
        anos_bons_chuva=len(YEARS) - len(falhas),
        total_anos=len(YEARS),
        faixa_anos=tuple(d.bom for d in detalhe),
        rotulo_chuva="medio",
        texto_chuva="",
        futuro=FuturoResultado(
            anos_bons_media=round(futuro_nota * len(YEARS) / 100),
            anos_bons_min=0,
            anos_bons_max=10,
            modelos=3,
            cenario="ssp245",
        ),
        da_grao=True,
        rotulo_renda="bom",
        texto_renda="",
        texto_risco="",
        rotulo_terra="bom",
        texto_terra="",
        notas=notas,
        notas_seco=notas,
        porque=(),
        como_fazer=(),
        anos_detalhe=detalhe,
        agua=AguaOpcao(
            precisa_mm=300,
            chove_mm=400,
            falta_normal_mm=50,
            falta_seco_mm=80,
            sede=sede,
            cad_mm=60,
            anos=len(YEARS),
            usa_mm=usa_mm,
        ),
    )


MILHO_BRAQ = _option(
    "milho_braquiaria", "Milho com braquiária", 80.0, 50.0, 230, {2006, 2009, 2012}
)
CROTALARIA = _option("crotalaria", "Crotalária", 95.0, 85.0, 200, {2010}, sede="pouca")
SORGO = _option("sorgo", "Sorgo", 70.0, 35.0, 210, {2006, 2009, 2011})


def _recommendation(**over: Any) -> SimpleNamespace:
    base = {
        "celula_id": "-190_-482",
        "colheita": "meio",
        "semeadura": SOWING,
        "opcoes": (MILHO_BRAQ, CROTALARIA, SORGO),
        "fora_da_janela": (),
    }
    return SimpleNamespace(**(base | over))


class FakeRecommender:
    def __init__(self, rec: SimpleNamespace) -> None:
        self.rec = rec
        self.calls: list[dict[str, Any]] = []

    def recommend(self, **kwargs: Any) -> SimpleNamespace:
        self.calls.append(kwargs)
        return self.rec


def _season(year: int, rain_per_day: float = 0.0, source: str = "gpm_imerg") -> ClimateSeason:
    start = date(year, 1, 1)
    # 2 mm por dia a partir da semeadura (18/fev) até o fim; antes, nada
    rain = tuple(
        rain_per_day if start + timedelta(days=i) >= date(year, 2, 18) else 0.0 for i in range(DAYS)
    )
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=start,
        rain_mm=rain,
        rain_source=source,
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
    )


class FakeClimate:
    def __init__(self, seasons: list[ClimateSeason]) -> None:
        self.seasons = seasons
        self.cells: list[str] = []

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        self.cells.append(cell_id)
        return self.seasons


class SpySinal:
    """O sinal do outono falso: guarda o pedido e devolve um sinal de teste."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def evaluate(self, **kwargs: Any) -> SinalOutono:
        self.calls.append(kwargs)
        return SinalOutono(nivel="normal", motivo="Sinal de teste.", fonte=("teste",), data=SOWING)


def _service(
    rec: SimpleNamespace | None = None,
    seasons: list[ClimateSeason] | None = None,
    sinal: SpySinal | None = None,
) -> tuple[PlanEvaluationService, FakeRecommender, FakeClimate]:
    recommender = FakeRecommender(rec or _recommendation())
    climate = FakeClimate(seasons if seasons is not None else [_season(y, 2.0) for y in YEARS])
    service = PlanEvaluationService(
        recommender=recommender,
        climate_repo=climate,
        crop_repo=CROPS,
        plan_service=RotationPlanService(),
        sinal_service=sinal,
    )
    return service, recommender, climate


def test_should_give_the_facts_of_the_engine_for_each_year_of_the_plan() -> None:
    service, _, _ = _service()

    plano = service.evaluate(-18.95, -48.2, ["milho_braquiaria", "milho_braquiaria", "crotalaria"])

    first, _, third = plano.anos
    assert (first.cultura, first.nome, first.na_janela) == (
        "milho_braquiaria",
        "Milho com braquiária",
        True,
    )
    assert (first.anos_bons, first.total_anos, first.futuro_anos_bons) == (7, 10, 8)
    assert (first.sede, first.usa_mm) == ("media", 230)
    # Fatos da terra do culturas.yaml e do regras.yaml (supressoras do nematoide do PRD 7.7)
    assert (first.cobre_terra, first.deixa_nitrogenio, first.quebra_nematoide) == (
        True,
        False,
        False,
    )
    assert (third.cobre_terra, third.deixa_nitrogenio, third.quebra_nematoide) == (True, True, True)
    assert (plano.colheita, plano.semeadura) == ("meio", SOWING)


def test_should_average_the_engine_scores_and_add_the_diversity_bonus_to_soil_health() -> None:
    service, _, _ = _service()

    plano = service.evaluate(-18.95, -48.2, ["milho_braquiaria", "milho_braquiaria", "crotalaria"])

    assert plano.notas.seguranca == pytest.approx(85.0)  # (80 + 80 + 95) / 3
    assert plano.notas.futuro == pytest.approx(85.0)
    # (50 + 50 + 85) / 3 = 61,7; grão, cobertura gramínea e leguminosa = 3 funções: +10 (PRD 7.7)
    assert plano.notas.solo == pytest.approx(71.7)
    assert plano.terra.bonus_diversidade == 10.0


def test_should_leave_fallow_out_of_safety_but_count_it_as_bare_soil() -> None:
    service, _, _ = _service()

    plano = service.evaluate(-18.95, -48.2, ["sorgo", "pousio", "crotalaria"])

    pousio = plano.anos[1]
    assert (pousio.cultura, pousio.nome, pousio.na_janela) == ("pousio", "Deixar parado", True)
    assert (pousio.anos_bons, pousio.usa_mm, pousio.cobre_terra) == (None, None, False)
    assert plano.notas.seguranca == pytest.approx(82.5)  # só sorgo (70) e crotalária (95)
    # (35 + 0 + 85) / 3 = 40; sorgo grão + crotalária leguminosa = 2 funções: +5
    assert plano.notas.solo == pytest.approx(45.0)


def test_should_have_no_safety_score_for_a_plan_that_is_all_fallow() -> None:
    service, _, _ = _service()

    plano = service.evaluate(-18.95, -48.2, ["pousio", "pousio", "pousio"], lang="en")

    assert plano.anos[0].nome == "Leave it fallow"
    assert (plano.notas.seguranca, plano.notas.futuro, plano.notas.solo) == (None, None, 0.0)


def test_should_mark_a_crop_out_of_the_sowing_window_without_numbers() -> None:
    fora = ForaDaJanelaOpcao(id="milho_safrinha", nome="Milho sozinho", texto="")
    service, _, _ = _service(_recommendation(fora_da_janela=(fora,)))

    plano = service.evaluate(-18.95, -48.2, ["milho_safrinha", "milho_safrinha", "crotalaria"])

    milho = plano.anos[0]
    assert (milho.nome, milho.na_janela, milho.anos_bons, milho.usa_mm) == (
        "Milho sozinho",
        False,
        None,
        None,
    )
    assert milho.cobre_terra is True  # a palhada do milho é fato do culturas.yaml
    assert plano.notas.seguranca == pytest.approx(95.0)  # só a crotalária tem a conta
    assert plano.chuva is not None and plano.chuva.usa_media_mm is None


def test_should_count_the_soil_health_facts_of_the_whole_rotation() -> None:
    service, _, _ = _service()

    plano = service.evaluate(-18.95, -48.2, ["milho_braquiaria", "milho_braquiaria", "pousio"])

    terra = plano.terra
    assert (terra.anos_cobertos, terra.anos_nitrogenio, terra.anos_nematoide, terra.total) == (
        2,
        0,
        0,
        3,
    )
    assert terra.repetidas == ("milho_braquiaria",)


def test_should_not_call_fallow_a_repeated_crop() -> None:
    service, _, _ = _service()

    plano = service.evaluate(-18.95, -48.2, ["pousio", "crotalaria", "pousio"])

    assert plano.terra.repetidas == ()


def test_should_give_the_rain_from_sowing_to_the_end_of_july_and_what_the_plan_uses() -> None:
    service, _, climate = _service()

    plano = service.evaluate(-18.95, -48.2, ["milho_braquiaria", "pousio", "crotalaria"])

    chuva = plano.chuva
    assert chuva is not None
    # 2 mm por dia de 18/fev a 31/jul (164 dias; 30/jul em 2008 e 2012, bissextos): mediana 328 mm
    assert chuva.chuva_mm == 328
    assert chuva.usa_media_mm == 143  # (230 + 0 + 200) / 3
    assert (chuva.inicio, chuva.fim, chuva.anos, chuva.fonte) == (SOWING, "07-31", 10, "gpm_imerg")
    assert climate.cells == ["-190_-482"]


def test_should_join_the_rain_sources_of_the_series() -> None:
    seasons = [_season(y, 2.0, "nasa_power" if y < 2008 else "gpm_imerg") for y in YEARS]
    service, _, _ = _service(seasons=seasons)

    plano = service.evaluate(-18.95, -48.2, ["crotalaria", "crotalaria", "crotalaria"])

    assert plano.chuva is not None and plano.chuva.fonte == "gpm_imerg+nasa_power"


def test_should_have_no_rain_block_without_the_series() -> None:
    service, _, _ = _service(seasons=[])

    plano = service.evaluate(-18.95, -48.2, ["crotalaria", "crotalaria", "crotalaria"])

    assert plano.chuva is None


def test_should_give_plan_a_and_plan_b_for_the_first_year() -> None:
    service, _, _ = _service()

    plano = service.evaluate(-18.95, -48.2, ["milho_braquiaria", "sorgo", "crotalaria"])

    ab = plano.plano_ab
    assert ab is not None
    assert (ab.cultura_a, ab.falhas_a, ab.total) == ("milho_braquiaria", 3, 10)
    assert ab.cultura_b == "crotalaria"  # deu certo em 2006, 2009 e 2012; o sorgo, em 1


def test_should_give_the_autumn_signal_of_the_plan_a_and_plan_b_on_screen() -> None:
    # S9 (tarefa 0049): com o plano editado (sorgo no ano 1), o sinal fala do sorgo e do Plano B
    # dele, os mesmos do cartão "Plano A e Plano B".
    spy = SpySinal()
    service, _, climate = _service(sinal=spy)

    plano = service.evaluate(-18.95, -48.2, ["sorgo", "crotalaria", "milho_braquiaria"], lang="en")

    assert plano.sinal is not None and plano.sinal.motivo == "Sinal de teste."
    assert plano.plano_ab is not None
    (call,) = spy.calls
    assert (call["cultura_a"], call["cultura_b"]) == ("sorgo", plano.plano_ab.cultura_b)
    assert call["seasons"] == climate.seasons
    assert (call["lat"], call["lon"], call["lang"]) == (-18.95, -48.2, "en")


def test_should_have_no_signal_when_the_plan_starts_with_fallow_or_without_the_service() -> None:
    spy = SpySinal()
    service, _, _ = _service(sinal=spy)

    assert service.evaluate(-18.95, -48.2, ["pousio", "sorgo", "crotalaria"]).sinal is None
    assert spy.calls == []
    no_service, _, _ = _service()
    assert no_service.evaluate(-18.95, -48.2, ["sorgo", "sorgo", "sorgo"]).sinal is None


def test_should_pass_the_harvest_the_soil_and_the_language_to_the_engine() -> None:
    service, recommender, _ = _service()

    service.evaluate(
        -18.95,
        -48.2,
        ["sorgo", "sorgo", "sorgo"],
        colheita="tarde",
        solo_override="arenoso",
        lang="en",
    )

    assert recommender.calls == [
        {"lat": -18.95, "lon": -48.2, "colheita": "tarde", "solo_override": "arenoso", "lang": "en"}
    ]


@pytest.mark.parametrize(
    "anos",
    [["sorgo", "sorgo"], ["sorgo", "sorgo", "sorgo", "sorgo"], ["sorgo", "trigo", "sorgo"], []],
)
def test_should_refuse_a_plan_without_three_known_crops(anos: list[str]) -> None:
    service, recommender, _ = _service()

    with pytest.raises(ValidationDomainError):
        service.evaluate(-18.95, -48.2, anos)
    assert recommender.calls == []


def test_should_let_the_outside_area_error_of_the_engine_go_up() -> None:
    class Outside:
        def recommend(self, **kwargs: Any) -> SimpleNamespace:
            raise OutsideAreaError("fora")

    service = PlanEvaluationService(
        recommender=Outside(),
        climate_repo=FakeClimate([]),
        crop_repo=CROPS,
        plan_service=RotationPlanService(),
    )

    with pytest.raises(OutsideAreaError):
        service.evaluate(-18.95, -48.2, ["sorgo", "sorgo", "sorgo"])
