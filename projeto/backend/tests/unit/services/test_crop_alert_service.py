"""Unit tests for CropAlertService: avisos de veranico e calor da safra (plano de evolução 4.4).

Séries curtas montadas à mão, dia a dia a partir da semeadura. A cultura de grão floresce no dia
60 e a janela crítica vai do dia 45 ao 74 (60 ± 15, regras.yaml, grupo clima).
"""

from dataclasses import replace
from datetime import date, timedelta

from app.models.crop_option import CropParams
from app.models.regras import Regras
from app.models.safra_passada import DailyWeather, SeasonEvent
from app.repositories.rules_repository import load_default_rules
from app.services.crop_alert_service import CropAlertService

SOWING = date(2024, 2, 18)
CYCLE_DAYS = 100
WET_MM = 8.0
DRY_MM = 0.9  # abaixo de 1 mm: conta como dia sem chuva
MILD_C = 30.0
HOT_C = 35.0


def _crop(tipo: str = "grao", dias_florescer: int = 60, ciclo_dias: int = CYCLE_DAYS) -> CropParams:
    return CropParams(
        id="milho_safrinha",
        nome="Milho",
        tipo=tipo,
        funcao="Grão",
        semeadura_limite_mes_dia="02-28",
        dias_florescer=dias_florescer,
        ciclo_dias=ciclo_dias,
        kc_pico=1.2,
        solo_palhada=20,
        solo_nitrogenio=0,
        solo_pragas=0,
        n_deixado_kg=0,
    )


def _day(offset: int) -> date:
    return SOWING + timedelta(days=offset)


def _series(
    dry: range = range(0),
    hot: tuple[int, ...] | range = (),
    days: int = CYCLE_DAYS + 30,
) -> list[DailyWeather]:
    return [
        DailyWeather(
            data=_day(i),
            chuva_mm=DRY_MM if i in dry else WET_MM,
            tmax_c=HOT_C if i in hot else MILD_C,
        )
        for i in range(days)
    ]


def _timeline(
    series: list[DailyWeather],
    crop: CropParams | None = None,
    lang: str = "pt-BR",
    rules: Regras | None = None,
) -> list[SeasonEvent]:
    service = CropAlertService(rules)
    return service.timeline(
        crop=crop or _crop(), crop_name="Milho", sowing=SOWING, days=series, lang=lang
    )


def _kinds(events: list[SeasonEvent]) -> list[tuple[date, str]]:
    return [(e.data, e.tipo) for e in events]


def test_should_mark_sowing_critical_stage_and_harvest_when_nothing_happens() -> None:
    events = _timeline(_series())

    assert events == [
        SeasonEvent(data=_day(0), tipo="semeadura", texto="Semeadura: Milho."),
        SeasonEvent(
            data=_day(60),
            tipo="fase_critica",
            texto="Floração, por volta desta data: a fase que mais precisa de água.",
        ),
        SeasonEvent(data=_day(CYCLE_DAYS), tipo="colheita", texto="Colheita: Milho."),
    ]


def test_should_warn_on_the_tenth_dry_day_inside_the_critical_stage() -> None:
    # Seca de 6/abr a 19/abr de 2024 (dias 48 a 61): o aviso sai em 15/abr, perto da floração.
    events = _timeline(_series(dry=range(48, 62)))

    assert _kinds(events) == [
        (date(2024, 2, 18), "semeadura"),
        (date(2024, 4, 6), "sem_chuva"),
        (date(2024, 4, 15), "aviso_veranico"),
        (date(2024, 4, 18), "fase_critica"),
        (date(2024, 4, 20), "voltou_chuva"),
        (_day(CYCLE_DAYS), "colheita"),
    ]
    texts = {e.tipo: e.texto for e in events}
    assert texts["sem_chuva"] == "Parou de chover."
    assert texts["aviso_veranico"] == (
        "Aviso: 10 dias sem chuva perto da fase que mais precisa de água. Converse com o agrônomo."
    )
    assert texts["voltou_chuva"] == "Voltou a chover (14 dias sem chuva no total)."


def test_should_count_only_days_below_the_dry_threshold_as_dry() -> None:
    series = _series(dry=range(48, 62))
    # 1 mm no dia 52 já é chuva: a seca quebra em duas de 4 e 9 dias, nenhuma chega a 10.
    series[52] = replace(series[52], chuva_mm=1.0)

    assert "aviso_veranico" not in {e.tipo for e in _timeline(series)}


def test_should_not_warn_for_a_dry_spell_outside_the_critical_stage() -> None:
    events = _timeline(_series(dry=range(10, 31)))

    assert [e.tipo for e in events] == ["semeadura", "fase_critica", "colheita"]


def test_should_warn_on_the_first_critical_day_when_the_dry_spell_started_before() -> None:
    events = _timeline(_series(dry=range(30, 51)))

    warning = next(e for e in events if e.tipo == "aviso_veranico")
    assert warning.data == _day(45)
    assert warning.texto.startswith("Aviso: 16 dias sem chuva")
    assert (_day(30), "sem_chuva") in _kinds(events)
    assert (_day(51), "voltou_chuva") in _kinds(events)


def test_should_not_say_the_rain_returned_after_the_harvest() -> None:
    events = _timeline(_series(dry=range(55, 200)))

    assert "voltou_chuva" not in {e.tipo for e in events}
    assert events[-1] == SeasonEvent(
        data=_day(CYCLE_DAYS), tipo="colheita", texto="Colheita: Milho."
    )


def test_should_warn_on_the_second_day_in_a_row_at_35_degrees_inside_the_critical_stage() -> None:
    # Calor fora da janela (20 e 21) e um dia quente sozinho (70) não avisam.
    events = _timeline(_series(hot=(20, 21, 64, 65, 70)))

    warnings = [e for e in events if e.tipo == "aviso_calor"]
    assert warnings == [
        SeasonEvent(
            data=_day(65),
            tipo="aviso_calor",
            texto=(
                "Aviso: 2 dias seguidos com 35 °C ou mais perto da fase que mais precisa de água. "
                "Converse com o agrônomo."
            ),
        )
    ]


def test_should_warn_once_per_hot_spell() -> None:
    events = _timeline(_series(hot=range(50, 56)))

    assert [e.data for e in events if e.tipo == "aviso_calor"] == [_day(51)]


def test_should_hold_a_third_warning_until_the_week_has_room() -> None:
    # Calor avisado nos dias 47 e 50; a seca começa no dia 43 e chega a 10 dias no dia 52.
    # Com 2 avisos nos últimos 7 dias, o de veranico espera até o dia 54 (o do 47 sai da semana).
    events = _timeline(_series(dry=range(43, 60), hot=(46, 47, 49, 50)))

    warnings = [e for e in events if e.tipo.startswith("aviso_")]
    assert [(e.data, e.tipo) for e in warnings] == [
        (_day(47), "aviso_calor"),
        (_day(50), "aviso_calor"),
        (_day(54), "aviso_veranico"),
    ]
    assert warnings[-1].texto.startswith("Aviso: 12 dias sem chuva")


def test_should_write_the_texts_in_english() -> None:
    events = _timeline(_series(dry=range(48, 62), hot=(64, 65)), lang="en-US")

    texts = {e.tipo: e.texto for e in events}
    assert texts["semeadura"] == "Sowing: Milho."
    assert texts["aviso_veranico"] == (
        "Warning: 10 days without rain close to the stage that needs water most. "
        "Talk to your agronomist."
    )
    assert texts["voltou_chuva"] == "Rain returned (14 days without rain in total)."
    assert texts["aviso_calor"].startswith("Warning: 2 days in a row at 35 °C or more")
    assert texts["colheita"] == "Harvest: Milho."


def test_should_start_the_critical_stage_of_a_cover_crop_at_sowing() -> None:
    # Cobertura: a fase crítica são os primeiros 30 dias (pegamento).
    events = _timeline(_series(dry=range(5, 20)), crop=_crop(tipo="cobertura", ciclo_dias=90))

    assert _kinds(events) == [
        (_day(0), "semeadura"),
        (_day(0), "fase_critica"),
        (_day(5), "sem_chuva"),
        (_day(14), "aviso_veranico"),
        (_day(20), "voltou_chuva"),
        (_day(90), "colheita"),
    ]
    texts = {e.tipo: e.texto for e in events}
    assert texts["fase_critica"] == (
        "Começam os 30 dias em que as plantas mais precisam de água para pegar."
    )
    assert texts["colheita"] == "Fim do ciclo: Milho. A palhada fica cobrindo a terra."


def test_should_say_the_grass_keeps_covering_the_soil_after_the_consortium_harvest() -> None:
    events = _timeline(_series(), crop=_crop(tipo="consorcio"))

    assert events[-1].texto == "Colheita do milho. O capim segue cobrindo a terra."
    assert (_day(60), "fase_critica") in _kinds(events)


def test_should_take_the_thresholds_from_the_rules() -> None:
    base = load_default_rules()
    rules = replace(
        base,
        avisos=replace(base.avisos, veranico_min_dias=5, dia_seco_abaixo_mm=5.0),
        clima=replace(base.clima, calor_temp_c=33.0),
    )
    # Com o limiar de 5 mm, os dias de 4,9 mm (50 a 54) também contam como secos.
    series = [replace(d, chuva_mm=4.9) if _day(50) <= d.data <= _day(54) else d for d in _series()]
    series[60] = replace(series[60], tmax_c=33.0)
    series[61] = replace(series[61], tmax_c=33.0)

    events = _timeline(series, rules=rules)

    warnings = [(e.data, e.tipo) for e in events if e.tipo.startswith("aviso_")]
    assert warnings == [(_day(54), "aviso_veranico"), (_day(61), "aviso_calor")]
    assert next(e for e in events if e.tipo == "aviso_calor").texto.startswith(
        "Aviso: 2 dias seguidos com 33 °C ou mais"
    )


def test_should_stop_at_the_last_day_with_data_and_still_mark_the_harvest() -> None:
    events = _timeline(_series(days=70))

    assert _kinds(events)[-1] == (_day(CYCLE_DAYS), "colheita")


# --- maior sequência seca na fase crítica (detalhe de cada ano, P1) ----------------------------


def _longest_dry_spell(
    series: list[DailyWeather], crop: CropParams | None = None, rules: Regras | None = None
) -> int:
    service = CropAlertService(rules)
    return service.longest_dry_spell(crop=crop or _crop(), sowing=SOWING, days=series)


def test_should_count_the_longest_dry_spell_inside_the_critical_stage() -> None:
    # Dias 50 a 61 sem chuva, dentro da janela crítica (dias 45 a 74)
    assert _longest_dry_spell(_series(dry=range(50, 62))) == 12


def test_should_count_no_dry_day_when_it_rained_every_day_of_the_critical_stage() -> None:
    assert _longest_dry_spell(_series()) == 0


def test_should_count_only_the_days_of_a_spell_that_fall_inside_the_critical_stage() -> None:
    # Seca dos dias 40 a 49: só os dias 45 a 49 são da fase. Seca dos dias 70 a 79: só 70 a 74.
    assert _longest_dry_spell(_series(dry=range(40, 50))) == 5
    assert _longest_dry_spell(_series(dry=range(70, 80))) == 5


def test_should_keep_the_longest_of_several_dry_spells() -> None:
    series = _series(dry=range(46, 50))
    series = [replace(d, chuva_mm=DRY_MM) if _day(55) <= d.data <= _day(62) else d for d in series]

    assert _longest_dry_spell(series) == 8


def test_should_break_the_dry_spell_on_a_day_with_rain_at_the_dry_threshold() -> None:
    # Dia seco = chuva abaixo de 1 mm, o mesmo do aviso de veranico: o dia 55 com 1 mm quebra a seca
    series = _series(dry=range(50, 62))
    series[55] = replace(series[55], chuva_mm=1.0)

    assert _longest_dry_spell(series) == 6


def test_should_take_the_dry_day_threshold_from_the_rules() -> None:
    base = load_default_rules()
    rules = replace(base, avisos=replace(base.avisos, dia_seco_abaixo_mm=5.0))
    series = [replace(d, chuva_mm=4.9) if _day(50) <= d.data <= _day(54) else d for d in _series()]

    assert _longest_dry_spell(series, rules=rules) == 5
    assert _longest_dry_spell(series) == 0


def test_should_use_the_establishment_window_for_cover_crops() -> None:
    # Cobertura: os primeiros 30 dias (dias 0 a 29). A seca dos dias 25 a 39 conta 5 dias.
    assert _longest_dry_spell(_series(dry=range(25, 40)), crop=_crop(tipo="cobertura")) == 5
