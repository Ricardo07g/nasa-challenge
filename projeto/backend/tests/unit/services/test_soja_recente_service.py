"""Regra da soja na safra mais recente (RF-24, tarefa 0037), com repository falso.

Picos de teste (não são do MODIS), com `fonte: "teste"`.
"""

from dataclasses import replace

from app.models.regras import Regras
from app.models.soja_recente import PicoSojaRecente, SojaRecente
from app.repositories.rules_repository import load_default_rules
from app.services.soja_recente_service import SojaRecenteRule, SojaRecenteService

RULES = load_default_rules()
UFU = (-18.9543, -48.1993)


class FakeSojaRecenteRepository:
    def __init__(self, pico: PicoSojaRecente | None) -> None:
        self._pico = pico
        self.calls: list[tuple[float, float]] = []

    def get_pico(self, lat: float, lon: float) -> PicoSojaRecente | None:
        self.calls.append((lat, lon))
        return self._pico


def _rules(**soja: object) -> Regras:
    return replace(RULES, soja_recente=replace(RULES.soja_recente, **soja))


def _check(ndvi_pico: float | None, rules: Regras = RULES) -> SojaRecente | None:
    repository = FakeSojaRecenteRepository(PicoSojaRecente("2025/26", "teste", ndvi_pico))
    return SojaRecenteService(repository, rules).check(*UFU)


# --- pico de cada pixel (o pipeline usa) -------------------------------------------------------


def test_should_take_the_highest_good_observation_of_the_pixel() -> None:
    assert SojaRecenteRule(RULES).pixel_peak([7200, 8650, 3100]) == 8650


def test_should_leave_a_pixel_with_fewer_than_two_good_observations_without_data() -> None:
    rule = SojaRecenteRule(RULES)

    assert rule.pixel_peak([8650]) is None
    assert rule.pixel_peak([]) is None
    assert rule.pixel_peak([8650, 2000]) == 8650


def test_should_use_the_minimum_of_observations_from_the_rules() -> None:
    assert SojaRecenteRule(_rules(min_observacoes=3)).pixel_peak([8650, 2000]) is None


def test_should_see_soybean_from_the_limit_up() -> None:
    rule = SojaRecenteRule(RULES)

    assert rule.seen(0.70) is True
    assert rule.seen(0.86) is True
    assert rule.seen(0.69) is False


# --- resposta da API ---------------------------------------------------------------------------


def test_should_say_soybean_was_seen_with_a_peak_at_the_limit_or_above() -> None:
    assert _check(0.86) == SojaRecente(safra="2025/26", vista=True, ndvi_pico=0.86, fonte="teste")
    assert _check(0.70) == SojaRecente(safra="2025/26", vista=True, ndvi_pico=0.70, fonte="teste")


def test_should_say_soybean_was_not_seen_with_a_peak_below_the_limit() -> None:
    assert _check(0.41) == SojaRecente(safra="2025/26", vista=False, ndvi_pico=0.41, fonte="teste")


def test_should_not_say_anything_about_a_pixel_without_data() -> None:
    assert _check(None) == SojaRecente(safra="2025/26", vista=None, ndvi_pico=None, fonte="teste")


def test_should_have_no_answer_outside_the_measured_area_or_without_the_file() -> None:
    repository = FakeSojaRecenteRepository(None)

    assert SojaRecenteService(repository, RULES).check(*UFU) is None
    assert repository.calls == [UFU]


def test_should_compare_with_the_limit_from_the_rules() -> None:
    soja = _check(0.86, _rules(ndvi_minimo=0.9))

    assert soja is not None
    assert soja.vista is False


def test_should_use_the_shipped_rules_by_default() -> None:
    repository = FakeSojaRecenteRepository(PicoSojaRecente("2025/26", "teste", 0.70))

    soja = SojaRecenteService(repository).check(*UFU)

    assert soja is not None
    assert soja.vista is True
