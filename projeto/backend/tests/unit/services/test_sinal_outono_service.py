"""Unit tests for SinalOutonoService (PRD 7.10, RF-20), com repositories falsos."""

from dataclasses import replace
from datetime import date
from typing import Any

import pytest

from app.models.recomendacao import NotasOpcao, PlanoRotacao, ResultadoOpcao
from app.models.regras import Regras
from app.models.sinal_outono import RecentRain, RecentSoilMoisture, SeasonalForecast, SinalOutono
from app.repositories.rules_repository import load_default_rules
from app.services.sinal_outono_service import SinalOutonoService

LAT, LON = -18.9543, -48.1993
SEMEADURA = date(2027, 2, 18)
FORECAST_DAY = date(2027, 2, 1)
SOIL_DAY = date(2027, 2, 12)
RAIN_DAY = date(2027, 2, 13)
WET_SOIL = RecentSoilMoisture(sm_rootzone_pctl=45.0, data=SOIL_DAY)
NORMAL_RAIN = RecentRain(chuva_mm=200.0, media_mm=200.0, dias=30, data=RAIN_DAY)
DRY_SOIL = RecentSoilMoisture(sm_rootzone_pctl=15.0, data=SOIL_DAY)
LOW_RAIN = RecentRain(chuva_mm=90.0, media_mm=200.0, dias=30, data=RAIN_DAY)


class FakeSignalData:
    """As três fontes num falso só; cada uma pode faltar (None)."""

    def __init__(
        self,
        forecast: SeasonalForecast | None = None,
        soil: RecentSoilMoisture | None = None,
        rain: RecentRain | None = None,
    ) -> None:
        self._forecast, self._soil, self._rain = forecast, soil, rain
        self.calls: list[tuple[float, float]] = []

    def get_seasonal_forecast(self, lat: float, lon: float) -> SeasonalForecast | None:
        self.calls.append((lat, lon))
        return self._forecast

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        return self._soil

    def get_recent_rain(self, lat: float, lon: float) -> RecentRain | None:
        return self._rain


def _forecast(chance: float) -> SeasonalForecast:
    return SeasonalForecast(chance_abaixo_normal=chance, data=FORECAST_DAY)


def _option(crop_id: str, nome: str, data_limite: str | None) -> ResultadoOpcao:
    notas = NotasOpcao(seguranca=50.0, futuro=None, solo=50.0, renda=50.0, final=50.0)
    return ResultadoOpcao(
        id=crop_id,
        nome=nome,
        na_janela=True,
        data_limite=data_limite,
        anos_bons_chuva=15,
        total_anos=20,
        faixa_anos=(),
        rotulo_chuva="medio",
        texto_chuva="",
        futuro=None,
        margem_ha=0.0,
        rotulo_dinheiro="medio",
        texto_dinheiro="",
        rotulo_terra="medio",
        texto_terra="",
        notas=notas,
        notas_seco=notas,
        porque=(),
        como_fazer=(),
    )


OPCOES = [
    _option("milho_safrinha", "Milho sozinho", "2027-02-28"),
    _option("sorgo", "Sorgo", "2027-03-20"),
    _option("crotalaria", "Crotalária", "2027-02-28"),
    _option("milheto", "Milheto", "2027-03-15"),
]
OPCOES_EN = [
    _option("milho_safrinha", "Corn alone", "2027-02-28"),
    _option("sorgo", "Sorghum", "2027-03-20"),
    _option("crotalaria", "Crotalaria", "2027-02-28"),
    _option("milheto", "Pearl millet", "2027-03-15"),
]
PLANO_A = PlanoRotacao(anos=("milho_safrinha", "crotalaria", "milheto"), nota=67.4, descricao="")
PLANO_B = PlanoRotacao(anos=("sorgo", "crotalaria", "milheto"), nota=62.4, descricao="")


def _evaluate(
    data: FakeSignalData, rules: Regras | None = None, **kwargs: Any
) -> SinalOutono | None:
    service = SinalOutonoService(data, data, data, rules=rules)
    params: dict[str, Any] = {
        "lat": LAT,
        "lon": LON,
        "plano_a": PLANO_A,
        "plano_b": PLANO_B,
        "opcoes": OPCOES,
        "semeadura": SEMEADURA,
    }
    params.update(kwargs)
    return service.evaluate(**params)


def test_should_signal_dry_when_forecast_gives_half_or_more_chance_of_less_rain() -> None:
    data = FakeSignalData(_forecast(0.60), WET_SOIL, NORMAL_RAIN)

    sinal = _evaluate(data)

    assert sinal is not None
    assert sinal.nivel == "seco"
    assert "60% de chance de chuva abaixo do normal de março a maio" in sinal.motivo
    assert sinal.fonte == ("GEOS-S2S", "SMAP", "GPM IMERG")
    assert sinal.data == FORECAST_DAY
    assert data.calls == [(LAT, LON)]


def test_should_signal_dry_when_soil_is_dry_now_even_with_a_middle_forecast() -> None:
    sinal = _evaluate(FakeSignalData(_forecast(0.40), DRY_SOIL, LOW_RAIN))

    assert sinal is not None
    assert sinal.nivel == "seco"
    assert "a terra está seca agora" in sinal.motivo
    assert "percentil 15 (SMAP)" in sinal.motivo
    assert "45% da chuva média dos últimos 30 dias (GPM IMERG)" in sinal.motivo


def test_should_signal_normal_when_low_chance_and_soil_has_water() -> None:
    sinal = _evaluate(FakeSignalData(_forecast(0.25), WET_SOIL, NORMAL_RAIN))

    assert sinal is not None
    assert sinal.nivel == "normal"
    assert sinal.motivo.startswith("A previsão da NASA (GEOS-S2S) dá 25% de chance")
    assert sinal.motivo.endswith(".")


def test_should_be_uncertain_when_forecast_is_between_the_two_limits() -> None:
    sinal = _evaluate(FakeSignalData(_forecast(0.40), WET_SOIL, NORMAL_RAIN))

    assert sinal is not None
    assert sinal.nivel == "incerto"


@pytest.mark.parametrize(
    ("chance", "nivel"),
    [(0.50, "seco"), (0.4999, "incerto"), (0.33, "incerto"), (0.3299, "normal")],
)
def test_should_apply_forecast_limits_as_in_the_prd(chance: float, nivel: str) -> None:
    # PRD 7.10: seco com chance >= 50%; normal com chance < 33%
    sinal = _evaluate(FakeSignalData(_forecast(chance), WET_SOIL, NORMAL_RAIN))

    assert sinal is not None
    assert sinal.nivel == nivel


def test_should_not_call_soil_dry_at_the_limits_but_signal_dry_just_below_them() -> None:
    # Terra seca = SMAP abaixo do percentil 20 E chuva abaixo de 60% da média (os dois)
    at_limit = FakeSignalData(
        _forecast(0.25),
        RecentSoilMoisture(sm_rootzone_pctl=20.0, data=SOIL_DAY),
        RecentRain(chuva_mm=120.0, media_mm=200.0, dias=30, data=RAIN_DAY),
    )
    below = FakeSignalData(
        _forecast(0.25),
        RecentSoilMoisture(sm_rootzone_pctl=19.9, data=SOIL_DAY),
        RecentRain(chuva_mm=119.0, media_mm=200.0, dias=30, data=RAIN_DAY),
    )

    sinal_at_limit, sinal_below = _evaluate(at_limit), _evaluate(below)
    assert sinal_at_limit is not None and sinal_at_limit.nivel == "normal"
    assert sinal_below is not None and sinal_below.nivel == "seco"


def test_should_be_uncertain_when_only_one_soil_indicator_is_dry() -> None:
    # SMAP no percentil 10 com chuva normal: não é "terra seca" (pede os dois), mas também não é
    # "terra sem falta de água". Com a previsão baixa, fica sem sinal claro (padrão a revisar).
    sinal = _evaluate(
        FakeSignalData(_forecast(0.25), RecentSoilMoisture(10.0, SOIL_DAY), NORMAL_RAIN)
    )

    assert sinal is not None
    assert sinal.nivel == "incerto"


def test_should_return_no_signal_without_any_data() -> None:
    # Não inventa previsão: sem dado nenhum, o campo `sinal` sai nulo.
    assert _evaluate(FakeSignalData()) is None


def test_should_return_no_signal_when_soil_moisture_comes_without_recent_rain() -> None:
    # A terra seca pede o SMAP e a chuva juntos; só um deles não diz nada.
    assert _evaluate(FakeSignalData(soil=DRY_SOIL)) is None


def test_should_signal_dry_from_soil_alone_when_forecast_is_missing() -> None:
    sinal = _evaluate(FakeSignalData(soil=DRY_SOIL, rain=LOW_RAIN))

    assert sinal is not None
    assert sinal.nivel == "seco"
    assert sinal.fonte == ("SMAP", "GPM IMERG")
    assert sinal.data == RAIN_DAY  # o dado mais recente da terra
    assert sinal.motivo.startswith("Ainda sem a previsão da NASA (GEOS-S2S)")


def test_should_be_uncertain_with_wet_soil_and_no_forecast() -> None:
    sinal = _evaluate(FakeSignalData(soil=WET_SOIL, rain=NORMAL_RAIN))

    assert sinal is not None
    assert sinal.nivel == "incerto"


@pytest.mark.parametrize(("chance", "nivel"), [(0.25, "incerto"), (0.60, "seco")])
def test_should_need_soil_data_to_signal_normal(chance: float, nivel: str) -> None:
    sinal = _evaluate(FakeSignalData(forecast=_forecast(chance)))

    assert sinal is not None
    assert sinal.nivel == nivel
    assert sinal.fonte == ("GEOS-S2S",)
    assert "ainda sem o dado da terra agora" in sinal.motivo


def test_should_give_planting_day_rule_with_plan_a_deadline_and_the_swap_of_plan_b() -> None:
    # PRD 7.10: no dia da semeadura (até a data limite da cultura), terra seca -> Plano B
    sinal = _evaluate(FakeSignalData(_forecast(0.40), WET_SOIL, NORMAL_RAIN))

    assert sinal is not None
    assert sinal.regra_dia_plantar.data_limite == date(2027, 2, 28)
    assert sinal.regra_dia_plantar.texto == (
        "No dia de plantar (até 28/fev), se a terra estiver seca, use o plano B: "
        "sorgo no lugar de milho sozinho."
    )


def test_should_say_first_year_stays_when_both_plans_start_with_the_same_crop() -> None:
    plano_b = PlanoRotacao(anos=("milho_safrinha", "milheto", "milheto"), nota=60.0, descricao="")

    sinal = _evaluate(FakeSignalData(_forecast(0.40), WET_SOIL, NORMAL_RAIN), plano_b=plano_b)

    assert sinal is not None
    assert sinal.regra_dia_plantar.texto == (
        "No dia de plantar (até 28/fev), se a terra estiver seca, siga o plano B; "
        "o 1º ano continua com milho sozinho."
    )


def test_should_say_plans_are_the_same_when_plan_b_equals_plan_a() -> None:
    sinal = _evaluate(FakeSignalData(_forecast(0.40), WET_SOIL, NORMAL_RAIN), plano_b=PLANO_A)

    assert sinal is not None
    assert sinal.regra_dia_plantar.texto == (
        "Os planos A e B são iguais: plante milho sozinho até 28/fev, com a terra seca ou não."
    )


def test_should_take_plan_b_deadline_when_plan_a_starts_with_fallow() -> None:
    plano_a = PlanoRotacao(anos=("pousio", "crotalaria", "milheto"), nota=50.0, descricao="")

    sinal = _evaluate(FakeSignalData(_forecast(0.40), WET_SOIL, NORMAL_RAIN), plano_a=plano_a)

    assert sinal is not None
    assert sinal.regra_dia_plantar.data_limite == date(2027, 3, 20)
    assert "sorgo no lugar de pousio" in sinal.regra_dia_plantar.texto


def test_should_write_reason_and_rule_in_english() -> None:
    data = FakeSignalData(_forecast(0.60), DRY_SOIL, LOW_RAIN)

    sinal = _evaluate(data, opcoes=OPCOES_EN, lang="en-US,en;q=0.9")

    assert sinal is not None
    assert sinal.motivo.startswith(
        "The NASA outlook (GEOS-S2S) gives a 60% chance of below-normal rain from March to May"
    )
    assert "the soil is dry now" in sinal.motivo
    assert sinal.regra_dia_plantar.texto == (
        "On sowing day (by Feb 28), if the soil is dry, use plan B: sorghum instead of corn alone."
    )


def test_should_take_limits_from_injected_rules() -> None:
    base = load_default_rules()
    rules = replace(base, sinal_outono=replace(base.sinal_outono, chance_seco_min=0.70))

    sinal = _evaluate(FakeSignalData(_forecast(0.60), WET_SOIL, NORMAL_RAIN), rules=rules)

    assert sinal is not None
    assert sinal.nivel == "incerto"
