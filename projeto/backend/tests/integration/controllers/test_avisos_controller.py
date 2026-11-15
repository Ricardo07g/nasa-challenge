"""Integration tests for GET /api/avisos (tela "Avisos", remodelagem S6, tarefa 0046).

Clima, solo e culturas falsos do conftest; NASA POWER recente e relatos da comunidade falsos aqui
(nada de arquivo, banco ou rede).
"""

from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_community_report_service, get_recent_weather_repository
from app.main import app
from app.models.avisos import RecentDay
from app.models.community_report import TIPO_EVENTO, NewCommunityReport
from app.repositories.rules_repository import load_default_rules
from app.services.community_report_service import CommunityReportService
from tests.community_fakes import FakeCropRepository, FakeReportRepository

UFU = {"lat": -18.9543, "lon": -48.1993, "colheita": "meio"}
NOW = datetime(2026, 11, 15, 15, 0, tzinfo=UTC)
GROUPS = {"agora", "mudou", "recordes", "perto"}


class FakeRecentWeather:
    """30 dias com chuva até a véspera (valores de teste, não são do NASA POWER)."""

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

    def get_recent_days(self, cell_id: str, start: date, end: date) -> list[RecentDay] | None:
        if self.fail:
            return None
        return [
            RecentDay(start + timedelta(days=i), 5.0, 30.0) for i in range((end - start).days + 1)
        ]


def _community(repository: FakeReportRepository | None) -> CommunityReportService:
    return CommunityReportService(
        repository=repository,
        crop_repo=FakeCropRepository(),
        rules=load_default_rules(),
        salt="sal-de-teste",
        now=lambda: NOW,
    )


@pytest.fixture
def reports() -> FakeReportRepository:
    return FakeReportRepository()


@pytest.fixture
def avisos_client(client: TestClient, reports: FakeReportRepository) -> Iterator[TestClient]:
    app.dependency_overrides[get_recent_weather_repository] = FakeRecentWeather
    app.dependency_overrides[get_community_report_service] = lambda: _community(reports)
    yield client


def test_should_answer_the_four_groups_and_the_counter(avisos_client: TestClient) -> None:
    response = avisos_client.get("/api/avisos", params=UFU)

    assert response.status_code == 200
    body = response.json()
    assert body["ponto"] == {"lat": -18.9543, "lon": -48.1993}
    assert body["celula_id"] == "-190_-482"
    assert set(body) >= GROUPS | {"contador", "hoje", "periodo", "safrinha", "raio_km"}
    assert body["vizinhos_dias"] == 7
    assert set(body["agora"]) == {"avisos", "ultima_leitura"}
    # A série falsa chove 8 mm todo dia: nada fora do normal agora; sem relatos, nada perto.
    assert body["agora"]["avisos"] == []
    assert body["perto"] == {"avisos": [], "ultima_leitura": body["hoje"]}
    assert body["contador"] == 0


def test_should_bring_each_alert_with_level_kind_numbers_source_and_date(
    avisos_client: TestClient, reports: FakeReportRepository
) -> None:
    today = date.fromisoformat(avisos_client.get("/api/avisos", params=UFU).json()["hoje"])
    reports.add(
        NewCommunityReport(TIPO_EVENTO, "geada", {}, "-190_-482", today, "a" * 64),
        sent_at=NOW,
    )

    body = avisos_client.get("/api/avisos", params=UFU).json()

    assert body["perto"]["avisos"] == [
        {
            "tipo": "vizinho_evento",
            "nivel": "fique_de_olho",
            "fontes": ["comunidade"],
            "data": today.isoformat(),
            "antiga": False,
            "valores": {"evento": "geada", "relatos": 1},
        }
    ]
    assert body["contador"] == 1


def test_should_compare_the_recent_years_and_list_the_records(avisos_client: TestClient) -> None:
    body = avisos_client.get("/api/avisos", params=UFU).json()

    assert body["periodo"] == {
        "recente_inicio": 2020,
        "recente_fim": 2024,
        "antes_inicio": 2005,
        "antes_fim": 2019,
    }
    assert body["mudou"]["ultima_leitura"] == "2024-07-30"
    tipos = [a["tipo"] for a in body["recordes"]["avisos"]]
    assert "recorde_outono_seco" in tipos
    # 2007 e 2014 da série falsa ficam sem chuva de fevereiro a junho: o veranico recorde é de 2014
    veranico = next(a for a in body["recordes"]["avisos"] if a["tipo"] == "recorde_veranico")
    assert veranico["valores"]["ano"] == 2014
    assert veranico["fontes"] == ["nasa_power"]


def test_should_say_the_safrinha_is_not_running_and_link_the_last_year(
    avisos_client: TestClient,
) -> None:
    safrinha = avisos_client.get("/api/avisos", params=UFU).json()["safrinha"]

    assert set(safrinha) == {
        "em_andamento",
        "cultura",
        "nome",
        "semeadura",
        "colheita",
        "explorar_ano",
    }
    assert safrinha["explorar_ano"] == 2024


def test_should_leave_out_the_nearby_group_without_the_community_database(
    client: TestClient,
) -> None:
    app.dependency_overrides[get_recent_weather_repository] = lambda: FakeRecentWeather(fail=True)
    app.dependency_overrides[get_community_report_service] = lambda: _community(None)

    body = client.get("/api/avisos", params=UFU).json()

    assert body["perto"] is None


def test_should_answer_outside_area_like_the_recommendation(avisos_client: TestClient) -> None:
    response = avisos_client.get("/api/avisos", params={"lat": -10.0, "lon": -50.0})

    assert response.status_code == 404
    assert response.json()["code"] == "OUTSIDE_AREA"


def test_should_refuse_an_invalid_harvest_band(avisos_client: TestClient) -> None:
    response = avisos_client.get("/api/avisos", params={**UFU, "colheita": "agosto"})

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_REQUEST"
