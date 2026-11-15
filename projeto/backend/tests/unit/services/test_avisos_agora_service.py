"""Grupo "Agora" da tela Avisos (tarefa 0046): terra seca, dias sem chuva, calor, ENSO e safrinha.

Números de teste (não são do SMAP, do NASA POWER nem da NOAA).
"""

from datetime import date, timedelta

import pytest

from app.models.avisos import ATENCAO, FIQUE_DE_OLHO, RecentDay
from app.models.enso import OniYear
from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast
from app.models.sinal_outono import RecentSoilMoisture
from app.services.avisos_agora_service import AvisosAgoraService
from tests.avisos_fakes import YEARS, crop, option

TODAY = date(2026, 11, 15)
SOWING = date(2027, 2, 18)  # dia e mês da semeadura do motor (o ano não conta)


@pytest.fixture
def service() -> AvisosAgoraService:
    return AvisosAgoraService(today=lambda: TODAY)


# --- terra seca (SMAP) -------------------------------------------------------------------------


def test_should_warn_dry_soil_with_the_smap_percentile_at_20_or_less(
    service: AvisosAgoraService,
) -> None:
    aviso = service.dry_soil(RecentSoilMoisture(sm_rootzone_pctl=15.3, data=date(2026, 11, 10)))

    assert aviso is not None
    assert (aviso.tipo, aviso.nivel, aviso.fontes) == ("terra_seca", ATENCAO, ("smap",))
    assert aviso.data == date(2026, 11, 10)
    # "A terra está mais seca que em 85% dos anos nesta época."
    assert aviso.valores == {"percentil": 15.3, "mais_seca_que_pct": 85}
    assert aviso.antiga is False


def test_should_not_warn_when_the_soil_is_not_dry(service: AvisosAgoraService) -> None:
    assert service.dry_soil(RecentSoilMoisture(20.1, date(2026, 11, 10))) is None
    assert service.dry_soil(None) is None
    assert service.dry_soil(RecentSoilMoisture(20.0, date(2026, 11, 10))) is not None


def test_should_mark_a_reading_older_than_15_days(service: AvisosAgoraService) -> None:
    fifteen = service.dry_soil(RecentSoilMoisture(10.0, TODAY - timedelta(days=15)))
    sixteen = service.dry_soil(RecentSoilMoisture(10.0, TODAY - timedelta(days=16)))

    assert fifteen is not None and fifteen.antiga is False
    assert sixteen is not None and sixteen.antiga is True


# --- dias sem chuva e calor (NASA POWER recente) ---------------------------------------------


def _days(
    rain: list[float | None], tmax: list[float | None] | None = None, end: date = date(2026, 11, 13)
) -> list[RecentDay]:
    temps = tmax if tmax is not None else [30.0] * len(rain)
    start = end - timedelta(days=len(rain) - 1)
    return [
        RecentDay(start + timedelta(days=i), r, t)
        for i, (r, t) in enumerate(zip(rain, temps, strict=True))
    ]


def test_should_warn_10_dry_days_in_a_row_up_to_the_last_reading(
    service: AvisosAgoraService,
) -> None:
    # 20 dias com chuva e os 10 últimos abaixo de 1 mm; os 2 dias que a API não tem ficam de fora
    days = _days([5.0] * 20 + [0.9] * 10 + [None, None])

    avisos, ultima = service.recent_weather(days)

    assert ultima == date(2026, 11, 11)
    assert [a.tipo for a in avisos] == ["dias_sem_chuva"]
    aviso = avisos[0]
    assert (aviso.nivel, aviso.fontes, aviso.data) == (ATENCAO, ("nasa_power",), ultima)
    assert aviso.valores == {"dias": 10, "desde": "2026-11-02", "no_minimo": False}


def test_should_not_warn_9_dry_days_or_a_dry_spell_that_already_ended(
    service: AvisosAgoraService,
) -> None:
    nine, _ = service.recent_weather(_days([5.0] * 21 + [0.0] * 9))
    ended, _ = service.recent_weather(_days([5.0] * 10 + [0.0] * 15 + [3.0] * 5))

    assert nine == []
    assert ended == []


def test_should_say_at_least_when_the_whole_window_was_dry(service: AvisosAgoraService) -> None:
    avisos, _ = service.recent_weather(_days([0.0] * 30))

    assert avisos[0].valores == {"dias": 30, "desde": "2026-10-15", "no_minimo": True}


def test_should_stop_the_dry_count_at_a_day_without_data(service: AvisosAgoraService) -> None:
    # Dia sem dado no meio: não dá para dizer que foi seco, a contagem para nele.
    avisos, _ = service.recent_weather(_days([0.0] * 15 + [None] + [0.0] * 9, end=TODAY))

    assert avisos == []


def test_should_warn_3_hot_days_in_the_last_10(service: AvisosAgoraService) -> None:
    temps: list[float | None] = [36.0] * 5 + [30.0] * 22 + [35.0, 30.0, 35.4]
    avisos, _ = service.recent_weather(_days([5.0] * 30, temps))

    # Os 5 dias quentes do começo estão fora dos últimos 10; o 3º dia quente não chega.
    assert avisos == []

    temps[-2] = 35.0
    avisos, ultima = service.recent_weather(_days([5.0] * 30, temps))
    assert [a.tipo for a in avisos] == ["calor"]
    assert avisos[0].valores == {"dias": 3, "janela_dias": 10, "temp_c": 35.0}
    assert avisos[0].data == ultima


def test_should_give_nothing_without_readings(service: AvisosAgoraService) -> None:
    assert service.recent_weather([]) == ([], None)
    assert service.recent_weather(_days([None, None])) == ([], None)


# --- El Niño / La Niña -------------------------------------------------------------------------

ISSUED = date(2026, 11, 12)
EL_NINO = (2005, 2010, 2015, 2016, 2019, 2020, 2024)
ONI = [OniYear(y, 0.9 if y in EL_NINO else 0.0, "el_nino" if y in EL_NINO else None) for y in YEARS]


def _forecast(pct: tuple[int, int, int] = (0, 2, 98), ano: int = 2027) -> EnsoForecast:
    season = EnsoSeasonForecast("FMA", ano, la_nina=pct[0], neutro=pct[1], el_nino=pct[2])
    return EnsoForecast(emitida_em=ISSUED, fonte="NOAA", estacoes=(season,))


def test_should_show_the_forecast_and_how_the_best_option_did_in_similar_years(
    service: AvisosAgoraService,
) -> None:
    best = option("milho_braquiaria", "Milho com braquiária", bad_years=(2005, 2016, 2007))

    aviso = service.enso(_forecast(), ONI, best, rain_sources=("gpm_imerg",))

    assert aviso is not None
    assert (aviso.tipo, aviso.nivel, aviso.data) == ("enso", FIQUE_DE_OLHO, ISSUED)
    assert aviso.fontes == ("noaa", "gpm_imerg")
    assert aviso.valores == {
        "fase": "el_nino",
        "chance_pct": 98,
        "estacao": "FMA",
        "ano": 2027,
        "cultura": "milho_braquiaria",
        "nome": "Milho com braquiária",
        "anos_fase": 7,
        "bons_fase": 5,
        "anos_outros": 13,
        "bons_outros": 12,
        "ano_inicio": 2005,
        "ano_fim": 2024,
    }


def test_should_show_only_the_forecast_without_the_oni_of_each_year(
    service: AvisosAgoraService,
) -> None:
    aviso = service.enso(_forecast(), [], option(), rain_sources=("gpm_imerg",))

    assert aviso is not None
    assert aviso.fontes == ("noaa",)
    assert aviso.valores["anos_fase"] is None
    assert aviso.valores["bons_fase"] is None


@pytest.mark.parametrize(
    "forecast",
    [
        None,
        _forecast((10, 70, 20)),  # neutro é o mais provável
        _forecast((30, 25, 45)),  # nenhuma fase com 50%
        _forecast(ano=2026),  # o outono de 2026 já passou
    ],
)
def test_should_not_show_the_enso_without_a_clear_el_nino_or_la_nina_ahead(
    service: AvisosAgoraService, forecast: EnsoForecast | None
) -> None:
    assert service.enso(forecast, ONI, option(), rain_sources=("gpm_imerg",)) is None


# --- safrinha em andamento ---------------------------------------------------------------------


def test_should_say_the_safrinha_is_not_running_in_november() -> None:
    service = AvisosAgoraService(today=lambda: TODAY)

    safrinha = service.safrinha(crop(ciclo=120), "Milho sozinho", SOWING, explorar_ano=2024)

    assert safrinha.em_andamento is False
    # A próxima safrinha: semeadura em 18/fev/2027 e colheita 120 dias depois.
    assert (safrinha.semeadura, safrinha.colheita) == (date(2027, 2, 18), date(2027, 6, 18))
    assert (safrinha.cultura, safrinha.nome, safrinha.explorar_ano) == (
        "milho_safrinha",
        "Milho sozinho",
        2024,
    )


@pytest.mark.parametrize(
    ("today", "running"),
    [
        (date(2027, 2, 17), False),
        (date(2027, 2, 18), True),
        (date(2027, 6, 18), True),
        (date(2027, 6, 19), False),
    ],
)
def test_should_run_between_sowing_and_harvest(today: date, running: bool) -> None:
    service = AvisosAgoraService(today=lambda: today)

    safrinha = service.safrinha(crop(ciclo=120), "Milho sozinho", SOWING, explorar_ano=2024)

    assert safrinha.em_andamento is running


def test_should_have_no_safrinha_crop_for_fallow() -> None:
    service = AvisosAgoraService(today=lambda: TODAY)

    safrinha = service.safrinha(crop("pousio", "pousio", ciclo=0), "Pousio", SOWING, 2024)

    assert safrinha.em_andamento is False
    assert (safrinha.cultura, safrinha.semeadura, safrinha.colheita) == (None, None, None)
    assert safrinha.explorar_ano == 2024


def test_should_apply_the_replay_alerts_to_the_recent_days_during_the_safrinha() -> None:
    # Milho com floração aos 60 dias: fase crítica do dia 45 ao 75 (18/fev + 45 = 4/abr).
    today = date(2027, 4, 20)
    service = AvisosAgoraService(today=lambda: today)
    safrinha = service.safrinha(crop(ciclo=120), "Milho sozinho", SOWING, explorar_ano=2024)
    # 30 dias até 18/abr: chove até 3/abr e para (15 dias secos, 10 deles na fase crítica)
    days = _days([6.0] * 15 + [0.0] * 15, end=date(2027, 4, 18))

    avisos = service.safrinha_alerts(crop(ciclo=120), "Milho sozinho", safrinha, days)

    assert [a.tipo for a in avisos] == ["safrinha_veranico"]
    aviso = avisos[0]
    assert (aviso.nivel, aviso.fontes) == (ATENCAO, ("nasa_power",))
    assert aviso.data == date(2027, 4, 13)
    assert aviso.valores == {"dias": 10, "cultura": "milho_safrinha", "nome": "Milho sozinho"}


def test_should_have_no_safrinha_alerts_outside_the_safrinha(service: AvisosAgoraService) -> None:
    safrinha = service.safrinha(crop(ciclo=120), "Milho sozinho", SOWING, explorar_ano=2024)

    assert service.safrinha_alerts(crop(), "Milho", safrinha, _days([0.0] * 30)) == []
