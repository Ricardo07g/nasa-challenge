"""A tela Avisos do ponto junta os grupos e o contador (tarefas 0046 e 0065).

Repositories e motor falsos, com valores de teste (não são de nenhuma fonte real). As regras de
cada grupo têm teste próprio; aqui fica a montagem: de onde vem cada dado, o que some sem dado e
o que conta no botão "Avisos". Desde a tarefa 0065, o "Perto de você" (relatos dos vizinhos) fica
desligado: só volta com o `AvisosVizinhosService` injetado.
"""

from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from app.models.avisos import RecentDay
from app.models.community_report import NearbyReport, NearbyReports
from app.models.enso import OniYear
from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast
from app.models.sinal_outono import RecentSoilMoisture
from app.models.talhao import SoloInfo
from app.services.avisos_service import AvisosService
from app.services.avisos_vizinhos_service import AvisosVizinhosService
from app.services.climate_risk_service import ClimateRiskService
from app.services.errors import (
    CommunityUnavailableError,
    OutsideAreaError,
    ValidationDomainError,
)
from app.services.water_balance_calculator import WaterBalanceCalculator
from tests.avisos_fakes import CELL, YEARS, crop, option, season

LAT, LON = -18.9543, -48.1993
TODAY = date(2026, 11, 15)
MILHO = crop("milho_safrinha", ciclo=120, kc=1.2)
SORGO = crop("sorgo", ciclo=90, kc=0.8)
BRAQUIARIA = crop("milho_braquiaria", ciclo=120, kc=1.2)
POUSIO = crop("pousio", tipo="pousio", ciclo=0, florescer=0, kc=0.0)
CROPS = {c.id: c for c in (MILHO, SORGO, BRAQUIARIA, POUSIO)}


class FakeRecommender:
    def __init__(self, outside: bool = False, sinal: str | None = None) -> None:
        self.outside = outside
        self.sinal = sinal
        self.calls: list[dict[str, object]] = []

    def recommend(self, **kwargs: object) -> SimpleNamespace:
        self.calls.append(kwargs)
        if self.outside:
            raise OutsideAreaError("fora")
        best = option("milho_safrinha", "Milho sozinho", bad_years=(2020, 2021, 2023))
        sorgo = option("sorgo", "Sorgo", bad_years=(2006, 2008, 2010, 2012))
        # Passou do prazo do ZARC (tarefa 0056): vem com a conta do motor, fora das opções
        braquiaria = option("milho_braquiaria", "Milho com braquiária", bad_years=(2022, 2024))
        return SimpleNamespace(
            celula_id=CELL,
            semeadura=date(2027, 2, 18),
            melhor="milho_safrinha",
            solo="argiloso",
            opcoes=(best, sorgo),
            opcoes_fora_do_prazo=(braquiaria,),
            sinal=None if self.sinal is None else SimpleNamespace(nivel=self.sinal),
        )


class FakeClimate:
    def get_seasons(self, cell_id: str) -> list:  # type: ignore[type-arg]
        return [season(y) for y in YEARS]


class FakeCrops:
    def get_by_id(self, crop_id: str):  # type: ignore[no-untyped-def]
        return CROPS.get(crop_id)


class DryRecentAutumnClimate:
    """De 2020 em diante, março a maio sem chuva: a falta de água no ciclo cresce."""

    def get_seasons(self, cell_id: str) -> list:  # type: ignore[type-arg]
        return [
            season(y, rain=lambda d, y=y: 0.0 if y >= 2020 and 3 <= d.month <= 5 else 8.0)
            for y in YEARS
        ]


class FakeSoil:
    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return SoloInfo(40.0, 30.0, "argiloso", 60.0, "soilgrids")


class FakeRecentSmap:
    def __init__(self, value: RecentSoilMoisture | None) -> None:
        self._value = value

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        return self._value


class FakeRecentWeather:
    def __init__(self, days: list[RecentDay] | None) -> None:
        self._days = days
        self.calls: list[tuple[str, date, date]] = []

    def get_recent_days(self, cell_id: str, start: date, end: date) -> list[RecentDay] | None:
        self.calls.append((cell_id, start, end))
        return self._days


class FakeForecast:
    def __init__(self, forecast: EnsoForecast | None) -> None:
        self._forecast = forecast

    def get_enso_forecast(self) -> EnsoForecast | None:
        return self._forecast


class FakeOni:
    def get_oni_years(self) -> list[OniYear]:
        return [
            OniYear(y, 0.9 if y % 4 == 0 else 0.0, "el_nino" if y % 4 == 0 else None) for y in YEARS
        ]


class FakeCommunity:
    def __init__(self, reports: tuple[NearbyReport, ...] = (), unavailable: bool = False) -> None:
        self._reports = reports
        self._unavailable = unavailable
        self.calls = 0

    def nearby(self, lat: float, lon: float) -> NearbyReports:
        self.calls += 1
        if self._unavailable:
            raise CommunityUnavailableError("sem banco")
        return NearbyReports(raio_km=30.0, anos_safra=(2024, 2025, 2026), relatos=self._reports)


FROST = NearbyReport(
    id="r1",
    tipo="evento",
    subtipo="geada",
    valores={},
    celula=CELL,
    lat=-18.95,
    lon=-48.15,
    data_fato=date(2026, 11, 14),
    meu=False,
)
FORECAST = EnsoForecast(
    emitida_em=date(2026, 11, 12),
    fonte="NOAA",
    estacoes=(EnsoSeasonForecast("FMA", 2027, la_nina=0, neutro=2, el_nino=98),),
)
# 30 dias até 12/nov, os 10 últimos sem chuva; 13 e 14/nov a API ainda não tem
DRY_DAYS = [
    RecentDay(date(2026, 10, 14) + timedelta(days=i), 5.0 if i < 20 else 0.0, 30.0)
    for i in range(30)
] + [RecentDay(date(2026, 11, 13), None, None), RecentDay(date(2026, 11, 14), None, None)]


def _service(**overrides: object) -> AvisosService:
    deps: dict[str, object] = {
        "recommender": FakeRecommender(),
        "climate_repo": FakeClimate(),
        "crop_repo": FakeCrops(),
        "soil_repo": FakeSoil(),
        "risk_service": ClimateRiskService(WaterBalanceCalculator()),
        "recent_soil_moisture_repo": FakeRecentSmap(RecentSoilMoisture(15.0, date(2026, 11, 10))),
        "recent_weather_repo": FakeRecentWeather(DRY_DAYS),
        "forecast_repo": FakeForecast(FORECAST),
        "enso_repo": FakeOni(),
        "community_service": FakeCommunity((FROST,)),
        "today": lambda: TODAY,
    }
    deps.update(overrides)
    return AvisosService(**deps)  # type: ignore[arg-type]


def test_should_join_the_groups_and_count_only_the_alerts_of_now() -> None:
    community = FakeCommunity((FROST,))

    avisos = _service(community_service=community).avisos(LAT, LON, colheita="meio")

    assert (avisos.lat, avisos.lon, avisos.celula_id, avisos.hoje) == (LAT, LON, CELL, TODAY)
    assert [a.tipo for a in avisos.agora.avisos] == ["terra_seca", "dias_sem_chuva", "enso"]
    assert avisos.agora.ultima_leitura == date(2026, 11, 12)
    assert (avisos.raio_km, avisos.vizinhos_dias) == (30.0, 7)
    # Tarefa 0065: os relatos dos vizinhos ficam de fora (o grupo é null e a comunidade nem é
    # lida); o contador conta só os 3 de agora. Mudanças e recordes são informação, não alerta.
    assert avisos.perto is None
    assert community.calls == 0
    assert avisos.contador == 3
    assert avisos.mudou is not None and avisos.recordes is not None
    assert avisos.periodo is not None and avisos.periodo.recente_inicio == 2020


def test_should_bring_back_the_nearby_group_with_the_neighbours_service_but_not_count_it() -> None:
    # O "Perto de você" volta quando a comunidade voltar (o service dos vizinhos injetado); mesmo
    # assim, o contador fica só com os avisos de agora (a tela conta só os cartões de "Agora").
    avisos = _service(vizinhos_service=AvisosVizinhosService()).avisos(LAT, LON)

    assert avisos.perto is not None
    assert [a.valores["evento"] for a in avisos.perto.avisos] == ["geada"]
    assert avisos.contador == 3


@pytest.mark.parametrize("nivel", ["normal", "seco", "incerto"])
def test_should_give_the_enso_warning_the_verdict_of_the_autumn_signal(nivel: str) -> None:
    # S9 (tarefa 0049): o Plano dizia "O sinal marca o Plano A" e o aviso, "Veja o Plano B". O aviso
    # leva o veredito do sinal (o mesmo do Plano de 3 anos) para o "o que fazer" seguir ele.
    avisos = _service(recommender=FakeRecommender(sinal=nivel)).avisos(LAT, LON)

    enso = next(a for a in avisos.agora.avisos if a.tipo == "enso")
    assert enso.valores["sinal"] == nivel


def test_should_leave_the_enso_verdict_empty_without_the_signal() -> None:
    avisos = _service().avisos(LAT, LON)

    enso = next(a for a in avisos.agora.avisos if a.tipo == "enso")
    assert enso.valores["sinal"] is None


def test_should_ask_power_for_the_last_30_days_up_to_yesterday() -> None:
    weather = FakeRecentWeather(DRY_DAYS)

    _service(recent_weather_repo=weather).avisos(LAT, LON)

    # 30 dias com os dois extremos: 16/out a 14/nov (o POWER sai com uns 2 dias de atraso)
    assert weather.calls == [(CELL, date(2026, 10, 16), date(2026, 11, 14))]


def test_should_leave_out_the_power_alerts_when_the_api_fails() -> None:
    avisos = _service(recent_weather_repo=FakeRecentWeather(None)).avisos(LAT, LON)

    assert [a.tipo for a in avisos.agora.avisos] == ["terra_seca", "enso"]
    # Sem o POWER, a última leitura do grupo é a mais nova das outras (previsão de 12/nov)
    assert avisos.agora.ultima_leitura == date(2026, 11, 12)


def test_should_show_nothing_out_of_normal_with_the_last_reading_date() -> None:
    avisos = _service(
        recent_soil_moisture_repo=FakeRecentSmap(RecentSoilMoisture(59.3, date(2026, 11, 10))),
        recent_weather_repo=FakeRecentWeather(None),
        forecast_repo=FakeForecast(None),
    ).avisos(LAT, LON)

    assert avisos.agora.avisos == ()
    assert avisos.agora.ultima_leitura == date(2026, 11, 10)
    assert avisos.contador == 0


def test_should_leave_out_the_nearby_group_without_the_community() -> None:
    avisos = _service(
        community_service=FakeCommunity(unavailable=True),
        vizinhos_service=AvisosVizinhosService(),
    ).avisos(LAT, LON)

    assert avisos.perto is None
    assert avisos.contador == 3


def test_should_use_the_same_engine_inputs_as_the_recommendation() -> None:
    recommender = FakeRecommender()

    _service(recommender=recommender).avisos(
        LAT, LON, colheita="tarde", solo_override="arenoso", confirmadas=[(2025, "parado")]
    )

    call = recommender.calls[0]
    assert (call["colheita"], call["solo_override"]) == ("tarde", "arenoso")
    assert list(call["confirmadas"]) == [(2025, "parado")]  # type: ignore[call-overload]


def test_should_link_the_last_year_of_the_series_outside_the_safrinha() -> None:
    avisos = _service().avisos(LAT, LON)

    assert avisos.safrinha is not None
    assert avisos.safrinha.em_andamento is False
    assert avisos.safrinha.explorar_ano == 2024
    assert avisos.safrinha.semeadura == date(2027, 2, 18)


def test_should_compare_the_years_the_best_option_worked() -> None:
    avisos = _service().avisos(LAT, LON)

    assert avisos.mudou is not None
    assert "mudou_deu_certo" in [a.tipo for a in avisos.mudou.avisos]


def _crop_changes(avisos) -> dict[str, dict[str, object]]:  # type: ignore[no-untyped-def]
    assert avisos.mudou is not None
    return {
        a.tipo: a.valores
        for a in avisos.mudou.avisos
        if a.tipo in ("mudou_falta_agua", "mudou_deu_certo")
    }


def test_should_count_the_crop_changes_for_the_crop_of_the_plan() -> None:
    # Tarefa 0065: a tela manda a cultura do 1º ano do plano; a falta de água e o "deu certo"
    # usam essa cultura (sem ela, a melhor opção do motor, como antes).
    service = _service(climate_repo=DryRecentAutumnClimate())

    melhor = _crop_changes(service.avisos(LAT, LON))
    plano = _crop_changes(service.avisos(LAT, LON, cultura="sorgo"))

    assert (melhor["mudou_falta_agua"]["cultura"], melhor["mudou_deu_certo"]["cultura"]) == (
        "milho_safrinha",
        "milho_safrinha",
    )
    assert (plano["mudou_falta_agua"]["cultura"], plano["mudou_falta_agua"]["nome"]) == (
        "sorgo",
        "Sorgo",
    )
    # A falta de água com o ciclo e o Kc do sorgo (90 dias, 0,8), não os do milho
    assert plano["mudou_falta_agua"]["recente"] != melhor["mudou_falta_agua"]["recente"]
    # Sorgo de teste: falhou em 4 dos 15 anos antes de 2020 e em nenhum depois
    assert plano["mudou_deu_certo"] == {
        "antes_bons": 11,
        "antes_total": 15,
        "recente_bons": 5,
        "recente_total": 5,
        "cultura": "sorgo",
        "nome": "Sorgo",
    }


def test_should_keep_the_other_alerts_on_the_best_option_of_the_engine() -> None:
    # Só os dois quadros da cultura mudam; o El Niño / La Niña e a safrinha seguem a melhor opção.
    avisos = _service().avisos(LAT, LON, cultura="sorgo")

    enso = next(a for a in avisos.agora.avisos if a.tipo == "enso")
    assert enso.valores["cultura"] == "milho_safrinha"
    assert avisos.safrinha is not None and avisos.safrinha.cultura == "milho_safrinha"


def test_should_count_the_crop_changes_for_a_crop_past_the_deadline() -> None:
    avisos = _service().avisos(LAT, LON, cultura="milho_braquiaria")

    assert _crop_changes(avisos)["mudou_deu_certo"]["cultura"] == "milho_braquiaria"


def test_should_leave_out_the_crop_changes_when_the_plan_leaves_the_soil_fallow() -> None:
    # Deixar parado não tem falta de água nem "deu certo": os dois quadros não vêm.
    avisos = _service(climate_repo=DryRecentAutumnClimate()).avisos(LAT, LON, cultura="pousio")

    assert avisos.mudou is not None
    assert _crop_changes(avisos) == {}


def test_should_refuse_an_unknown_crop() -> None:
    recommender = FakeRecommender()

    with pytest.raises(ValidationDomainError):
        _service(recommender=recommender).avisos(LAT, LON, cultura="trigo")

    assert recommender.calls == []


def test_should_keep_the_outside_area_error_of_the_engine() -> None:
    with pytest.raises(OutsideAreaError):
        _service(recommender=FakeRecommender(outside=True)).avisos(LAT, LON)
