"""Unit tests for SinalOutonoService (RF-20, tarefa 0038), com repositories falsos.

Regra: previsão do El Niño / La Niña para fevereiro a abril + como a opção do 1º ano do Plano A se
saiu nos anos daquela fase; regra da data com a chuva dos 30 dias antes da data limite; o SMAP de
agora só informa. Todos os números são de teste (não são da NOAA, da NASA nem do SMAP).
"""

from collections.abc import Sequence
from dataclasses import replace
from datetime import date, timedelta
from typing import Any

import pytest

from app.models.climate import ClimateSeason
from app.models.enso import FaseEnso, OniYear
from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast
from app.models.recomendacao import AnoDetalhe, NotasOpcao, PlanoRotacao, ResultadoOpcao
from app.models.regras import Regras
from app.models.sinal_outono import RecentSoilMoisture, RegraData, SinalOutono, SmapAgora
from app.repositories.rules_repository import load_default_rules
from app.services.sinal_outono_service import SinalOutonoService

LAT, LON = -18.9543, -48.1993
SEMEADURA = date(2027, 2, 18)
ISSUED = date(2026, 11, 14)
TODAY = date(2026, 11, 15)
SOURCE = "Fonte de teste"
YEARS = range(2005, 2025)
# Fases de teste: 6 anos de El Niño, 3 de La Niña e 11 neutros
EL_NINO_YEARS = (2010, 2012, 2014, 2016, 2018, 2020)
LA_NINA_YEARS = (2006, 2008, 2011)


def _phase(year: int) -> FaseEnso | None:
    if year in EL_NINO_YEARS:
        return "el_nino"
    return "la_nina" if year in LA_NINA_YEARS else None


ONI_YEARS = [OniYear(ano=y, oni=0.0, fase=_phase(y)) for y in YEARS]


class FakeEnsoForecast:
    def __init__(self, forecast: EnsoForecast | None) -> None:
        self._forecast = forecast

    def get_enso_forecast(self) -> EnsoForecast | None:
        return self._forecast


class FakeOni:
    def __init__(self, years: Sequence[OniYear] = tuple(ONI_YEARS)) -> None:
        self._years = list(years)

    def get_oni_years(self) -> list[OniYear]:
        return list(self._years)


class FakeSmap:
    def __init__(self, moisture: RecentSoilMoisture | None = None) -> None:
        self._moisture = moisture
        self.calls: list[tuple[float, float]] = []

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        self.calls.append((lat, lon))
        return self._moisture


def _forecast(
    pct: tuple[int, int, int] = (10, 20, 70), estacao: str = "FMA", ano: int = 2027
) -> EnsoForecast:
    la_nina, neutro, el_nino = pct
    season = EnsoSeasonForecast(estacao, ano, la_nina=la_nina, neutro=neutro, el_nino=el_nino)
    return EnsoForecast(emitida_em=ISSUED, fonte=SOURCE, estacoes=(season,))


def _option(
    crop_id: str, nome: str, data_limite: str | None, bad_years: Sequence[int] = ()
) -> ResultadoOpcao:
    notas = NotasOpcao(seguranca=50.0, futuro=None, solo=50.0, renda=50.0, final=50.0)
    detalhe = tuple(
        AnoDetalhe(
            ano=y,
            bom=y not in bad_years,
            fase_critica=date(y, 4, 18),
            dias_sem_chuva=0,
            enso=None,
            texto="",
        )
        for y in YEARS
    )
    return ResultadoOpcao(
        id=crop_id,
        nome=nome,
        na_janela=True,
        data_limite=data_limite,
        anos_bons_chuva=20 - len(bad_years),
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
        anos_detalhe=detalhe,
    )


# Milho deu errado em 4 dos 6 anos de El Niño; sorgo, em 1
MILHO_BAD = (2010, 2014, 2016, 2020, 2007)
SORGO_BAD = (2016, 2007)


def _opcoes(milho_bad: Sequence[int] = MILHO_BAD, sorgo_bad: Sequence[int] = SORGO_BAD, en=False):
    return [
        _option("milho_safrinha", "Corn alone" if en else "Milho sozinho", "2027-02-28", milho_bad),
        _option("sorgo", "Sorghum" if en else "Sorgo", "2027-03-20", sorgo_bad),
        _option("crotalaria", "Crotalaria" if en else "Crotalária", "2027-02-28"),
        _option("milheto", "Pearl millet" if en else "Milheto", "2027-03-15"),
    ]


PLANO_A = PlanoRotacao(anos=("milho_safrinha", "crotalaria", "milheto"), nota=67.4, descricao="")
PLANO_B = PlanoRotacao(anos=("sorgo", "crotalaria", "milheto"), nota=62.4, descricao="")


def _season(year: int, rain: Sequence[float], source: str = "nasa_power") -> ClimateSeason:
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple(rain),
        rain_source=source,
        tmax_c=tuple([30.0] * len(rain)),
        tmin_c=tuple([18.0] * len(rain)),
    )


def _flat_seasons(mm_per_day: float = 5.0, source: str = "nasa_power") -> list[ClimateSeason]:
    return [_season(y, [mm_per_day] * 212, source) for y in YEARS]


def _evaluate(
    forecast: EnsoForecast | None = None,
    oni: FakeOni | None = None,
    smap: FakeSmap | None = None,
    rules: Regras | None = None,
    today: date = TODAY,
    **kwargs: Any,
) -> SinalOutono | None:
    service = SinalOutonoService(
        FakeEnsoForecast(forecast),
        oni or FakeOni(),
        smap or FakeSmap(),
        rules=rules,
        today=lambda: today,
    )
    params: dict[str, Any] = {
        "lat": LAT,
        "lon": LON,
        "plano_a": PLANO_A,
        "plano_b": PLANO_B,
        "opcoes": _opcoes(),
        "semeadura": SEMEADURA,
        "seasons": _flat_seasons(),
    }
    params.update(kwargs)
    return service.evaluate(**params)


# --- o nível e o motivo ------------------------------------------------------------------------


def test_should_mark_plan_b_when_plan_a_failed_in_most_years_of_the_forecast_phase() -> None:
    sinal = _evaluate(_forecast((10, 20, 70)))

    assert sinal is not None
    assert sinal.nivel == "seco"
    assert sinal.motivo == (
        "Previsão para fevereiro a abril de 2027: El Niño (70%, Fonte de teste). "
        "Nos 6 anos de El Niño desde 2005, milho sozinho deu certo em 2 e sorgo em 5."
    )
    assert sinal.data == ISSUED


def test_should_mark_plan_a_when_plan_a_did_well_in_the_years_of_the_forecast_phase() -> None:
    sinal = _evaluate(_forecast((10, 20, 70)), opcoes=_opcoes(milho_bad=(2016,)))

    assert sinal is not None
    assert sinal.nivel == "normal"
    assert sinal.motivo.endswith("Nos 6 anos de El Niño desde 2005, milho sozinho deu certo em 5.")


@pytest.mark.parametrize(
    ("milho_bad", "nivel"),
    [((2010, 2014, 2016), "seco"), ((2010, 2014), "normal")],
)
def test_should_signal_dry_from_half_of_the_phase_years_with_problem(
    milho_bad: tuple[int, ...], nivel: str
) -> None:
    # Hipótese do time (regras.yaml, sinal_enso.fracao_anos_ruins_seco): metade ou mais = seco
    sinal = _evaluate(_forecast((10, 20, 70)), opcoes=_opcoes(milho_bad=milho_bad))

    assert sinal is not None
    assert sinal.nivel == nivel


@pytest.mark.parametrize("pct", [(30, 45, 25), (0, 50, 50)])
def test_should_be_uncertain_when_no_phase_stands_out(pct: tuple[int, int, int]) -> None:
    sinal = _evaluate(_forecast(pct))

    assert sinal is not None
    assert sinal.nivel == "incerto"
    la_nina, neutro, el_nino = pct
    assert sinal.motivo == (
        "Previsão para fevereiro a abril de 2027 (Fonte de teste): nenhuma fase se destaca "
        f"(La Niña {la_nina}%, neutro {neutro}%, El Niño {el_nino}%)."
    )


def test_should_be_uncertain_with_few_years_of_the_forecast_phase() -> None:
    # Só 3 anos de La Niña na série de teste (o mínimo é 5)
    sinal = _evaluate(_forecast((60, 30, 10)))

    assert sinal is not None
    assert sinal.nivel == "incerto"
    assert sinal.motivo == (
        "Previsão para fevereiro a abril de 2027: La Niña (60%, Fonte de teste). "
        "Só 3 anos de La Niña desde 2005: pouco para dizer como milho sozinho se sai."
    )


@pytest.mark.parametrize(
    ("lang", "texto"),
    [
        ("pt", "Nenhum ano de La Niña desde 2005: pouco para dizer como milho sozinho se sai."),
        ("en", "No La Niña year since 2005: too few to tell how milho sozinho does."),
    ],
)
def test_should_say_when_the_series_has_no_year_of_the_forecast_phase(
    lang: str, texto: str
) -> None:
    oni = FakeOni([y for y in ONI_YEARS if y.fase != "la_nina"])

    sinal = _evaluate(_forecast((60, 30, 10)), oni=oni, lang=lang)

    assert sinal is not None
    assert sinal.nivel == "incerto"
    assert sinal.motivo.endswith(texto)


def test_should_count_neutral_years_when_neutral_is_the_most_likely_phase() -> None:
    # 11 anos neutros; milho deu errado só em 2007 entre eles
    sinal = _evaluate(_forecast((10, 60, 30)))

    assert sinal is not None
    assert sinal.nivel == "normal"
    assert sinal.motivo == (
        "Previsão para fevereiro a abril de 2027: neutro, sem El Niño nem La Niña "
        "(60%, Fonte de teste). Nos 11 anos neutros desde 2005, milho sozinho deu certo em 10."
    )


def test_should_not_count_a_year_without_oni_as_neutral() -> None:
    # Sem a fase de 2013 a 2024 no arquivo do ONI: só 2005, 2007 e 2009 contam como neutros
    oni = FakeOni([y for y in ONI_YEARS if y.ano < 2013])

    sinal = _evaluate(_forecast((10, 60, 30)), oni=oni)

    assert sinal is not None
    assert sinal.nivel == "incerto"
    assert "Só 3 anos neutros desde 2005" in sinal.motivo


def test_should_be_uncertain_without_the_phase_of_each_year() -> None:
    sinal = _evaluate(_forecast((10, 20, 70)), oni=FakeOni([]))

    assert sinal is not None
    assert sinal.nivel == "incerto"
    assert sinal.motivo.endswith(
        "Ainda sem a fase do El Niño / La Niña de cada ano da série para comparar."
    )


def test_should_be_uncertain_when_plan_b_did_not_do_better_in_those_years() -> None:
    # Milho e sorgo deram certo em 2 dos 6 anos de El Niño: trocar não ajuda
    sinal = _evaluate(_forecast((10, 20, 70)), opcoes=_opcoes(sorgo_bad=(2010, 2014, 2016, 2020)))

    assert sinal is not None
    assert sinal.nivel == "incerto"
    assert sinal.motivo.endswith(
        "Nos 6 anos de El Niño desde 2005, milho sozinho deu certo em 2 e sorgo em 2. "
        "O plano B não foi melhor nesses anos."
    )


def test_should_mark_plan_b_when_both_plans_start_with_the_same_crop() -> None:
    plano_b = PlanoRotacao(anos=("milho_safrinha", "milheto", "milheto"), nota=60.0, descricao="")

    sinal = _evaluate(_forecast((10, 20, 70)), plano_b=plano_b)

    assert sinal is not None
    assert sinal.nivel == "seco"
    assert sinal.motivo.endswith("Nos 6 anos de El Niño desde 2005, milho sozinho deu certo em 2.")


def test_should_take_the_limits_from_the_injected_rules() -> None:
    base = load_default_rules()
    rules = replace(base, sinal_enso=replace(base.sinal_enso, fase_chance_min_pct=80))

    sinal = _evaluate(_forecast((10, 20, 70)), rules=rules)

    assert sinal is not None
    assert sinal.nivel == "incerto"


def test_should_write_the_reason_in_english() -> None:
    sinal = _evaluate(_forecast((10, 20, 70)), opcoes=_opcoes(en=True), lang="en-US,en;q=0.9")

    assert sinal is not None
    assert sinal.motivo == (
        "Forecast for February to April 2027: El Niño (70%, Fonte de teste). "
        "In the 6 El Niño years since 2005, corn alone worked in 2 and sorghum in 5."
    )


# --- sem previsão, sem sinal -------------------------------------------------------------------


def test_should_return_no_signal_without_the_forecast_even_with_smap() -> None:
    # O SMAP de agora sozinho não liga o sinal (decisão de 15/11/2026)
    smap = FakeSmap(RecentSoilMoisture(sm_rootzone_pctl=5.0, data=date(2026, 11, 10)))

    assert _evaluate(None, smap=smap) is None


def test_should_return_no_signal_when_the_forecast_does_not_reach_the_autumn_season() -> None:
    assert _evaluate(_forecast(estacao="AMJ")) is None


def test_should_return_no_signal_when_the_forecast_season_is_already_over() -> None:
    # Previsão velha: o FMA de 2027 acabou em 30/abr/2027
    assert _evaluate(_forecast(), today=date(2027, 5, 1)) is None
    assert _evaluate(_forecast(), today=date(2027, 4, 30)) is not None


# --- regra da data -----------------------------------------------------------------------------


def test_should_give_the_date_rule_with_a_fraction_of_the_30_day_average_rain() -> None:
    # 5 mm/dia em todos os anos: 150 mm nos 30 dias antes de 28/fev; 60% = 90 mm
    sinal = _evaluate(_forecast())

    assert sinal is not None
    assert sinal.regra_data == RegraData(
        data_limite=date(2027, 2, 28),
        inicio=date(2027, 1, 29),
        dias=30,
        chuva_min_mm=90,
        media_mm=150,
    )
    assert sinal.regra_dia_plantar.data_limite == date(2027, 2, 28)
    assert sinal.regra_dia_plantar.texto == (
        "Se nos 30 dias antes de 28/fev chover menos que 90 mm (60% da média de 150 mm), "
        "vá de plano B: sorgo no lugar de milho sozinho."
    )


def test_should_sum_only_the_30_days_before_the_deadline_in_each_year() -> None:
    # 1 mm em cada dia de 29/jan a 27/fev; 50 mm em 28/jan e em 28/fev (fora da janela)
    def rain(year: int) -> list[float]:
        start = date(year, 1, 1)
        days = [start + timedelta(days=i) for i in range(212)]
        window = (date(year, 1, 29), date(year, 2, 27))
        return [
            1.0 if window[0] <= d <= window[1] else 50.0 if d.day == 28 and d.month < 3 else 0.0
            for d in days
        ]

    sinal = _evaluate(_forecast(), seasons=[_season(y, rain(y)) for y in YEARS])

    assert sinal is not None
    assert sinal.regra_data is not None
    assert sinal.regra_data.media_mm == 30
    assert sinal.regra_data.chuva_min_mm == 18


def test_should_average_the_window_over_the_years() -> None:
    seasons = [_season(2005, [4.0] * 212), _season(2006, [6.0] * 212)]

    sinal = _evaluate(_forecast(), seasons=seasons)

    assert sinal is not None
    assert sinal.regra_data is not None
    assert (sinal.regra_data.media_mm, sinal.regra_data.chuva_min_mm) == (150, 90)


def test_should_say_the_first_year_stays_when_both_plans_start_with_the_same_crop() -> None:
    plano_b = PlanoRotacao(anos=("milho_safrinha", "milheto", "milheto"), nota=60.0, descricao="")

    sinal = _evaluate(_forecast(), plano_b=plano_b)

    assert sinal is not None
    assert sinal.regra_dia_plantar.texto == (
        "Se nos 30 dias antes de 28/fev chover menos que 90 mm (60% da média de 150 mm), "
        "siga o plano B; o 1º ano continua com milho sozinho."
    )


def test_should_say_plans_are_the_same_when_plan_b_equals_plan_a() -> None:
    sinal = _evaluate(_forecast(), plano_b=PLANO_A)

    assert sinal is not None
    assert sinal.regra_dia_plantar.texto == (
        "Os planos A e B são iguais: plante milho sozinho até 28/fev, chova ou não."
    )


def test_should_write_the_date_rule_in_english() -> None:
    sinal = _evaluate(_forecast(), opcoes=_opcoes(en=True), lang="en")

    assert sinal is not None
    assert sinal.regra_dia_plantar.texto == (
        "If less than 90 mm of rain falls in the 30 days before Feb 28 (60% of the 150 mm "
        "average), go with plan B: sorghum instead of corn alone."
    )


def test_should_take_plan_b_deadline_when_plan_a_starts_with_fallow() -> None:
    plano_a = PlanoRotacao(anos=("pousio", "crotalaria", "milheto"), nota=50.0, descricao="")

    sinal = _evaluate(_forecast(), plano_a=plano_a)

    assert sinal is not None
    assert sinal.regra_dia_plantar.data_limite == date(2027, 3, 20)
    assert "sorgo no lugar de pousio" in sinal.regra_dia_plantar.texto
    # Pousio não tem histórico na faixa de chuva: sem como comparar
    assert sinal.nivel == "incerto"


def test_should_keep_the_planting_day_rule_without_the_rain_series() -> None:
    sinal = _evaluate(_forecast(), seasons=[])

    assert sinal is not None
    assert sinal.regra_data is None
    assert sinal.regra_dia_plantar.texto == (
        "No dia de plantar (até 28/fev), se a terra estiver seca, use o plano B: "
        "sorgo no lugar de milho sozinho."
    )
    assert sinal.fonte == (SOURCE,)


# --- fontes e o SMAP de agora ------------------------------------------------------------------


def test_should_list_the_forecast_and_the_rain_series_as_sources() -> None:
    seasons = _flat_seasons()
    seasons[3] = replace(seasons[3], rain_source="gpm_imerg")

    sinal = _evaluate(_forecast(), seasons=seasons)

    assert sinal is not None
    assert sinal.fonte == (SOURCE, "NASA POWER", "GPM IMERG")
    assert sinal.smap_agora is None


def test_should_show_the_smap_of_now_without_changing_the_plan() -> None:
    wet = FakeSmap(RecentSoilMoisture(sm_rootzone_pctl=59.4, data=date(2026, 11, 10)))
    dry = FakeSmap(RecentSoilMoisture(sm_rootzone_pctl=5.0, data=date(2026, 11, 10)))

    sinal = _evaluate(_forecast(), smap=wet, opcoes=_opcoes(milho_bad=(2016,)))
    sinal_dry = _evaluate(_forecast(), smap=dry, opcoes=_opcoes(milho_bad=(2016,)))

    assert sinal is not None and sinal_dry is not None
    assert sinal.smap_agora == SmapAgora(
        percentil=59,
        data=date(2026, 11, 10),
        texto=(
            "Sua terra está um pouco mais úmida que o normal agora "
            "(SMAP, percentil 59, 10/11/2026)."
        ),
    )
    assert sinal.fonte == (SOURCE, "NASA POWER", "SMAP")
    assert sinal.nivel == sinal_dry.nivel == "normal"
    assert wet.calls == [(LAT, LON)]


@pytest.mark.parametrize(
    ("pctl", "faixa"),
    [
        (19.9, "mais seca que o normal"),
        (20.0, "um pouco mais seca que o normal"),
        (45.0, "com a umidade perto do normal"),
        (55.0, "um pouco mais úmida que o normal"),
        (80.0, "mais úmida que o normal"),
    ],
)
def test_should_describe_the_smap_percentile_in_five_bands(pctl: float, faixa: str) -> None:
    smap = FakeSmap(RecentSoilMoisture(sm_rootzone_pctl=pctl, data=date(2026, 11, 10)))

    sinal = _evaluate(_forecast(), smap=smap)

    assert sinal is not None and sinal.smap_agora is not None
    assert sinal.smap_agora.texto.startswith(f"Sua terra está {faixa} agora")


def test_should_write_the_smap_line_in_english() -> None:
    smap = FakeSmap(RecentSoilMoisture(sm_rootzone_pctl=59.4, data=date(2026, 11, 10)))

    sinal = _evaluate(_forecast(), smap=smap, lang="en")

    assert sinal is not None and sinal.smap_agora is not None
    assert sinal.smap_agora.texto == (
        "Your soil is a little wetter than normal right now (SMAP, percentile 59, Nov 10, 2026)."
    )
