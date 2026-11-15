"""Unit tests for SuggestionFactsService (El Niño / La Niña e "o que observar", tarefa 0044)."""

from datetime import date

from app.models.recomendacao import AnoDetalhe
from app.services.suggestion_facts_service import SuggestionFactsService


def _ano(ano: int, bom: bool, enso: str | None = None, seca: int = 0, calor: bool = False):
    return AnoDetalhe(
        ano=ano,
        bom=bom,
        fase_critica=date(ano, 4, 18),
        dias_sem_chuva=seca,
        enso=enso,  # type: ignore[arg-type]
        texto="",
        calor=calor,
    )


def _serie(la_nina: list[bool], outros: list[bool]) -> list[AnoDetalhe]:
    anos = [_ano(2005 + i, bom, "la_nina") for i, bom in enumerate(la_nina)]
    inicio = 2005 + len(anos)
    return anos + [_ano(inicio + i, bom) for i, bom in enumerate(outros)]


def test_should_count_hits_in_la_nina_years_and_in_the_other_years() -> None:
    # 3 de 7 em La Niña contra 12 de 13 nos outros: 43% x 92%, diferença clara.
    anos = _serie([True] * 3 + [False] * 4, [True] * 12 + [False])

    [la_nina] = SuggestionFactsService().enso_hit_rates(anos)

    assert la_nina.fase == "la_nina"
    assert (la_nina.bons, la_nina.anos) == (3, 7)
    assert (la_nina.bons_outros, la_nina.anos_outros) == (12, 13)
    assert la_nina.clara is True


def test_should_not_call_a_small_difference_clear() -> None:
    # 5 de 7 (71%) contra 11 de 13 (85%): 13 pontos, abaixo dos 25 do regras.yaml.
    anos = _serie([True] * 5 + [False] * 2, [True] * 11 + [False] * 2)

    [la_nina] = SuggestionFactsService().enso_hit_rates(anos)

    assert la_nina.clara is False


def test_should_not_call_it_clear_with_too_few_years_of_the_phase() -> None:
    # 0 de 4 contra 16 de 16: a diferença é enorme, mas são só 4 anos (mínimo 5).
    anos = _serie([False] * 4, [True] * 16)

    [la_nina] = SuggestionFactsService().enso_hit_rates(anos)

    assert la_nina.anos == 4
    assert la_nina.clara is False


def test_should_give_one_entry_per_phase_present_el_nino_first() -> None:
    anos = [_ano(2005, True, "la_nina"), _ano(2006, False, "el_nino"), _ano(2007, True)]

    fases = [item.fase for item in SuggestionFactsService().enso_hit_rates(anos)]

    assert fases == ["el_nino", "la_nina"]


def test_should_have_no_enso_rates_without_the_oni_file() -> None:
    anos = [_ano(2005 + i, True) for i in range(20)]

    assert SuggestionFactsService().enso_hit_rates(anos) == ()


def test_should_tell_the_typical_dry_spell_and_the_hot_years_of_the_critical_stage() -> None:
    # Mediana de 4, 6, 9, 12 = 7,5 -> 7 (para baixo: em metade dos anos, 7 dias ou mais).
    anos = [
        _ano(2005, True, seca=4),
        _ano(2006, True, seca=6, calor=True),
        _ano(2007, False, seca=9),
        _ano(2008, False, seca=12, calor=True),
    ]

    observar = SuggestionFactsService().watch_facts(anos)

    assert observar is not None
    assert (observar.veranico_dias, observar.anos_calor, observar.total) == (7, 2, 4)


def test_should_have_nothing_to_watch_without_years() -> None:
    assert SuggestionFactsService().watch_facts([]) is None
