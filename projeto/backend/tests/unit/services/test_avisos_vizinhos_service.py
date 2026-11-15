"""Grupo "Perto de você" da tela Avisos (tarefa 0046): eventos de vizinhos dos últimos 7 dias."""

from datetime import date

from app.models.avisos import FIQUE_DE_OLHO
from app.models.community_report import NearbyReport, NearbyReports
from app.services.avisos_vizinhos_service import AvisosVizinhosService

TODAY = date(2026, 11, 15)


def _report(tipo: str, subtipo: str | None, day: date | None, n: int = 0) -> NearbyReport:
    return NearbyReport(
        id=f"r{n}-{tipo}-{subtipo}-{day}",
        tipo=tipo,
        subtipo=subtipo,
        valores={"mm": 10.0} if tipo == "chuva" else {},
        celula="-190_-482",
        lat=-18.95,
        lon=-48.15,
        data_fato=day,
        meu=False,
    )


def test_should_group_the_neighbor_events_of_the_last_7_days_by_kind() -> None:
    reports = NearbyReports(
        raio_km=30.0,
        anos_safra=(2024, 2025, 2026),
        relatos=(
            _report("evento", "fogo", date(2026, 11, 15)),
            _report("evento", "geada", date(2026, 11, 14)),
            _report("evento", "geada", date(2026, 11, 12), 1),
            _report("evento", "granizo", date(2026, 11, 9)),  # hoje e os 6 dias antes: ainda vale
            _report("evento", "vendaval", date(2026, 11, 8)),  # 7 dias atrás: fica de fora
            _report("chuva", None, date(2026, 11, 15)),
            _report("plantio", "milheto", None),
        ),
    )

    group = AvisosVizinhosService().events(reports, TODAY)

    assert group.ultima_leitura == TODAY
    assert [(a.valores["evento"], a.valores["relatos"], a.data) for a in group.avisos] == [
        ("fogo", 1, date(2026, 11, 15)),
        ("geada", 2, date(2026, 11, 14)),
        ("granizo", 1, date(2026, 11, 9)),
    ]
    assert {(a.tipo, a.nivel, a.fontes) for a in group.avisos} == {
        ("vizinho_evento", FIQUE_DE_OLHO, ("comunidade",))
    }


def test_should_have_no_alert_without_events() -> None:
    reports = NearbyReports(raio_km=30.0, anos_safra=(), relatos=())

    group = AvisosVizinhosService().events(reports, TODAY)

    assert group.avisos == ()
    assert group.ultima_leitura == TODAY
