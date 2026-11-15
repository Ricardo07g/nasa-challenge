"""Unit tests for PlanSuggestionService (sugestão em cadeia do plano de 3 anos, tarefa 0056)."""

from dataclasses import replace
from operator import attrgetter

import pytest

from app.models.recomendacao import AguaOpcao, NotasOpcao, ResultadoOpcao
from app.repositories.rules_repository import load_default_rules
from app.services.errors import ValidationDomainError
from app.services.plan_suggestion_service import PlanSuggestionService
from app.services.rotation_plan_service import RotationPlanService

NOMES = {
    "milho_braquiaria": "Milho com braquiária",
    "milho_safrinha": "Milho sozinho",
    "sorgo": "Sorgo",
    "crotalaria": "Crotalária",
    "milheto": "Milheto",
}
SEDE = {"milho_braquiaria": "muita", "milho_safrinha": "muita", "sorgo": "media"}
SEM_GRAO = {"crotalaria", "milheto"}


def _opcao(
    crop_id: str, final: float, limite: str = "2027-03-15", na_janela: bool = True
) -> ResultadoOpcao:
    notas = NotasOpcao(seguranca=final, futuro=None, solo=final, renda=final, final=final)
    return ResultadoOpcao(
        id=crop_id,
        nome=NOMES[crop_id],
        na_janela=na_janela,
        data_limite=limite,
        anos_bons_chuva=16,
        total_anos=20,
        faixa_anos=(),
        rotulo_chuva="medio",
        texto_chuva="",
        futuro=None,
        da_grao=crop_id not in SEM_GRAO,
        rotulo_renda="medio",
        texto_renda="",
        texto_risco="",
        rotulo_terra="medio",
        texto_terra="",
        notas=notas,
        notas_seco=notas,
        porque=(),
        como_fazer=(),
        agua=AguaOpcao(
            precisa_mm=300,
            chove_mm=300,
            falta_normal_mm=50,
            falta_seco_mm=80,
            sede=SEDE.get(crop_id, "pouca"),
            cad_mm=60,
            anos=20,
        ),
    )


# Notas finais da lavoura de demonstração na colheita do meio de fevereiro (15/11/2026)
MEIO = [
    _opcao("milho_braquiaria", 72.5, "2027-02-28"),
    _opcao("milho_safrinha", 65.0, "2027-02-28"),
    _opcao("sorgo", 65.0, "2027-03-20"),
    _opcao("crotalaria", 64.0, "2027-02-28"),
    _opcao("milheto", 56.5, "2027-03-15"),
]
POUSIO = NotasOpcao(seguranca=100.0, futuro=100.0, solo=0.0, renda=0.0, final=45.0)
# Colheita tarde (3/mar): só sorgo e milheto no prazo
TARDE = [_opcao("milheto", 58.8, "2027-03-15"), _opcao("sorgo", 50.0, "2027-03-20")]


def _service() -> PlanSuggestionService:
    return PlanSuggestionService(RotationPlanService())


def test_should_suggest_a_fast_cover_after_the_producer_leaves_the_soil_fallow() -> None:
    # Tela 5: "Você mudou 2027/28 para Deixar parado. Para 2028/29 agora sugerimos Milheto: a terra
    # ficou descoberta; o milheto cobre rápido e aguenta a seca."
    anos = _service().suggest(["milho_braquiaria", "pousio"], MEIO, (), POUSIO)

    assert [(a.cultura, a.fixo) for a in anos] == [
        ("milho_braquiaria", True),
        ("pousio", True),
        ("milheto", False),
    ]
    assert anos[0].motivo is None and anos[1].motivo is None
    assert anos[2].motivo == "a terra ficou descoberta; cobre rápido e aguenta a seca"


def test_should_write_the_reason_in_english() -> None:
    anos = _service().suggest(["milho_braquiaria", "pousio"], MEIO, (), POUSIO, lang="en-US")

    assert anos[2].motivo == "the soil was left bare; it covers it fast and handles drought"


def test_should_suggest_the_second_and_third_years_after_the_first() -> None:
    anos = _service().suggest(["milho_safrinha"], MEIO, (), POUSIO)

    assert [a.cultura for a in anos] == ["milho_safrinha", "crotalaria", "milho_braquiaria"]
    assert [a.fixo for a in anos] == [True, False, False]
    # A crotalária (sede pouca) quebra o nematoide logo depois do milho
    assert anos[1].motivo == ("quebra o ciclo do nematoide que o milho multiplica e aguenta a seca")
    # Milho com braquiária (sede muita): grão depois de uma cobertura, sem "aguenta a seca"
    assert anos[2].motivo == "dá grão para vender depois de um ano cuidando da terra"


def test_should_redo_the_second_and_third_years_when_the_first_changes() -> None:
    service = _service()

    com_milho = service.suggest(["milho_safrinha"], MEIO, (), POUSIO)
    com_milheto = service.suggest(["milheto"], MEIO, (), POUSIO)

    assert [a.cultura for a in com_milheto] == ["milheto", "milho_safrinha", "crotalaria"]
    assert [a.cultura for a in com_milheto[1:]] != [a.cultura for a in com_milho[1:]]
    # Milho sozinho (grão) depois do milheto (cobertura)
    assert com_milheto[1].motivo == "dá grão para vender depois de um ano cuidando da terra"


def test_should_keep_a_first_year_past_the_deadline_and_suggest_only_crops_in_time() -> None:
    # Colheita tarde: o produtor fixa milho com braquiária (passou do prazo); os anos seguintes
    # só têm culturas no prazo.
    fora = [_opcao("milho_braquiaria", 40.0, "2027-02-28", na_janela=False)]

    anos = _service().suggest(["milho_braquiaria"], TARDE, fora, POUSIO)

    assert anos[0].cultura == "milho_braquiaria" and anos[0].fixo
    assert {a.cultura for a in anos[1:]} <= {"milheto", "sorgo", "pousio"}
    assert anos[1].cultura == "milheto"
    assert anos[1].motivo == ("quebra o ciclo do nematoide que o milho multiplica e aguenta a seca")


def test_should_say_the_deadline_weighed_when_a_late_crop_would_win_without_it() -> None:
    # Sem o prazo do ZARC, a crotalária (nota de teste 90) ganharia o 2º ano; o motor sugere o
    # milheto e diz que o prazo pesou.
    fora = [_opcao("crotalaria", 90.0, "2027-02-28", na_janela=False)]

    anos = _service().suggest(["sorgo"], TARDE, fora, POUSIO)

    assert [a.cultura for a in anos] == ["sorgo", "milheto", "sorgo"]
    assert anos[1].motivo == (
        "crotalária passou do prazo do ZARC (28/02); esta cabe no prazo (até 15/03) "
        "e aguenta a seca"
    )
    assert anos[2].motivo == "dá grão para vender depois de um ano cuidando da terra"
    # Em inglês o motor já manda o nome em inglês nas opções
    fora_en = [replace(fora[0], nome="Crotalaria")]
    en = _service().suggest(["sorgo"], TARDE, fora_en, POUSIO, lang="en")
    assert en[1].motivo == (
        "crotalaria is past the ZARC deadline (Feb 28); this one fits (until Mar 15) and handles "
        "drought"
    )


def test_should_vary_the_cover_or_fall_back_to_the_best_score() -> None:
    service = _service()

    # Duas coberturas de funções diferentes: crotalária (leguminosa) depois do milheto (gramínea)
    anos = service.suggest(["milho_braquiaria", "milheto"], MEIO[3:], (), POUSIO)
    assert anos[2].cultura == "crotalaria"
    assert anos[2].motivo == "varia a função da planta na rotação e aguenta a seca"

    # Nenhuma regra da cadeia: a melhor nota (sorgo de novo, sede média)
    anos = service.suggest(["sorgo", "sorgo"], [MEIO[2]], (), POUSIO)
    assert anos[2].cultura == "sorgo"
    assert anos[2].motivo == "tem a melhor nota do motor para esta colheita"


def test_should_give_the_reason_of_the_cover_after_grain() -> None:
    anos = _service().suggest(["sorgo", "sorgo"], [MEIO[2], MEIO[4]], (), POUSIO)

    assert anos[2].cultura == "milheto"
    assert anos[2].motivo == "cuida da terra depois de um ano de grão e aguenta a seca"


def test_should_keep_the_nematode_rule_of_prd_7_7() -> None:
    anos = _service().suggest(["sorgo", "sorgo"], MEIO, (), POUSIO, nematoide=True)

    assert anos[2].cultura in {"crotalaria", "milheto"}


def test_should_take_the_phrases_from_injected_rules() -> None:
    base = load_default_rules()
    frases = {**base.frases_plano, "pt": replace(base.frases_plano["pt"], aguenta_seca="{motivo}!")}
    service = PlanSuggestionService(RotationPlanService(), rules=replace(base, frases_plano=frases))

    anos = service.suggest(["milho_braquiaria", "pousio"], MEIO, (), POUSIO)

    assert anos[2].motivo == "a terra ficou descoberta; cobre rápido!"


def test_should_choose_the_years_by_the_objective_axis_with_the_same_chain() -> None:
    # Tarefa 0065: o plano de cada objetivo do produtor sai desta mesma cadeia, com a nota do eixo
    # do objetivo. "Cuidar da terra" (solo de teste: crotalária 85, milheto 55, milho com
    # braquiária 50, sorgo 35): crotalária, milho com braquiária, crotalária (73,3 + 10 de
    # diversidade + 11 da cadeia) passa a crotalária nos 3 anos (85, sem diversidade nem cadeia).
    solo = {"milho_braquiaria": 50.0, "sorgo": 35.0, "milheto": 55.0, "crotalaria": 85.0}
    opcoes = [replace(o, notas=replace(o.notas, solo=solo[o.id])) for o in MEIO if o.id in solo]
    eixo = attrgetter("solo")

    anos = _service().suggest(["crotalaria"], opcoes, (), POUSIO, axis=eixo, allow_fallow=False)

    assert [a.cultura for a in anos] == ["crotalaria", "milho_braquiaria", "crotalaria"]
    assert tuple(a.cultura for a in anos) == RotationPlanService().best_plan_with_prefix(
        ("crotalaria",), opcoes, POUSIO, axis=eixo, allow_fallow=False
    )
    assert [a.motivo for a in anos] == [
        None,
        "dá grão para vender depois de um ano cuidando da terra",
        "quebra o ciclo do nematoide que o milho multiplica e aguenta a seca",
    ]


def test_should_leave_fallow_out_of_the_objective_plan_when_asked() -> None:
    # "Mais segurança": o pousio tem segurança 100 e ganharia os anos 2 e 3 (o plano de um
    # objetivo não tem o pousio, tarefa 0044).
    seguranca = attrgetter("seguranca")

    com_pousio = _service().suggest(["sorgo"], [MEIO[2]], (), POUSIO, axis=seguranca)
    sem_pousio = _service().suggest(
        ["sorgo"], [MEIO[2]], (), POUSIO, axis=seguranca, allow_fallow=False
    )

    assert "pousio" in [a.cultura for a in com_pousio]
    assert [a.cultura for a in sem_pousio] == ["sorgo", "sorgo", "sorgo"]


@pytest.mark.parametrize("fixos", [[], ["sorgo", "sorgo", "sorgo"]])
def test_should_refuse_other_than_one_or_two_fixed_years(fixos: list[str]) -> None:
    with pytest.raises(ValidationDomainError):
        _service().suggest(fixos, MEIO, (), POUSIO)
