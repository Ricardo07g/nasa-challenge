"""Unit tests for SinalOutonoService (RF-20, tarefa 0038), com repositories falsos.

Regra: previsão do El Niño / La Niña para fevereiro a abril + como a opção do 1º ano do Plano A se
saiu nos anos daquela fase; o SMAP de agora só informa. A regra antiga da data saiu na S9 (tarefa
0049). Todos os números são de teste (não são da NOAA, da NASA nem do SMAP).
"""

from collections.abc import Sequence
from dataclasses import replace
from datetime import date
from typing import Any

import pytest

from app.models.climate import ClimateSeason
from app.models.enso import FaseEnso, OniYear
from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast
from app.models.recomendacao import AnoDetalhe, NotasOpcao, ResultadoOpcao
from app.models.regras import Regras
from app.models.sinal_outono import RecentSoilMoisture, SinalOutono, SmapAgora
from app.repositories.rules_repository import load_default_rules
from app.services.sinal_outono_service import SinalOutonoService

LAT, LON = -18.9543, -48.1993
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
        da_grao=True,
        rotulo_renda="medio",
        texto_renda="",
        texto_risco="",
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
        "cultura_a": "milho_safrinha",
        "cultura_b": "sorgo",
        "opcoes": _opcoes(),
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


def test_should_be_uncertain_when_plan_a_failed_just_as_often_in_the_other_years() -> None:
    # Tarefa 0066: metade dos anos da fase ruins não basta se a cultura falhou na mesma proporção
    # nos outros anos (com 6 anos de fase, a regra da metade sozinha dispara por acaso). O seco pede
    # a fase pior que os outros anos, com o teste exato de Fisher (p de até 0,10).
    outros = (2005, 2007, 2009, 2013, 2015, 2017, 2019)  # 7 dos 14 anos fora do El Niño
    milho_bad = (2010, 2014, 2016, *outros)  # 3 dos 6 anos de El Niño

    sinal = _evaluate(_forecast((10, 20, 70)), opcoes=_opcoes(milho_bad=milho_bad))

    assert sinal is not None
    assert sinal.nivel == "incerto"
    assert sinal.motivo.endswith(
        "Nos 6 anos de El Niño desde 2005, milho sozinho deu certo em 3 e sorgo em 5. "
        "Nos outros anos, milho sozinho falhou tanto quanto: a fase não muda a conta."
    )


def test_should_explain_in_english_when_the_phase_does_not_change_the_picture() -> None:
    outros = (2005, 2007, 2009, 2013, 2015, 2017, 2019)
    opcoes = _opcoes(milho_bad=(2010, 2014, 2016, *outros), en=True)

    sinal = _evaluate(_forecast((10, 20, 70)), opcoes=opcoes, lang="en")

    assert sinal is not None
    assert sinal.motivo.endswith(
        "In the other years, corn alone failed just as often: "
        "the phase does not change the picture."
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


def test_should_be_uncertain_without_a_plan_b_when_plan_a_failed_in_the_phase() -> None:
    # S9 (tarefa 0049): o Plano B é o da tela (a cultura que mais deu certo quando a do Plano A
    # falhou). Sem Plano B, o sinal não pode marcar um plano que a tela não mostra.
    sinal = _evaluate(_forecast((10, 20, 70)), cultura_b=None)

    assert sinal is not None
    assert sinal.nivel == "incerto"
    assert sinal.motivo.endswith(
        "Nos 6 anos de El Niño desde 2005, milho sozinho deu certo em 2. "
        "Nenhuma outra cultura se saiu melhor nesses anos."
    )


def test_should_talk_about_the_plan_a_and_plan_b_crops_it_receives() -> None:
    # O Plano A que a tela mostra (o sugerido ou o editado) é o que o sinal avalia.
    sinal = _evaluate(_forecast((10, 20, 70)), cultura_a="sorgo", cultura_b="milho_safrinha")

    assert sinal is not None
    assert sinal.nivel == "normal"  # sorgo deu certo em 5 dos 6 anos de El Niño
    assert "sorgo deu certo em 5." in sinal.motivo


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


# --- fontes e o SMAP de agora ------------------------------------------------------------------


def test_should_list_only_the_forecast_as_source_without_the_rain_series() -> None:
    sinal = _evaluate(_forecast(), seasons=[])

    assert sinal is not None
    assert sinal.fonte == (SOURCE,)


def test_should_not_bring_the_old_date_rule_anymore() -> None:
    # S9 (tarefa 0049): a regra da data (regra_dia_plantar, regra_data) não tem mais tela.
    sinal = _evaluate(_forecast())

    assert sinal is not None
    assert not hasattr(sinal, "regra_dia_plantar")
    assert not hasattr(sinal, "regra_data")


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
