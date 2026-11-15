"""Grupo "Perto de você" da tela Avisos (remodelagem S6, tarefa 0046).

Os eventos relatados pela comunidade (seção 7, tarefa 0047) nos últimos `avisos_tela.vizinhos_dias`
dias (hoje e os anteriores, no dia de Uberlândia), no raio da comunidade (`comunidade.raio_km`), um
aviso por tipo de evento, do mais recente para o mais antigo. Todo relato é de vizinho e não é
confirmado: o front sempre escreve isso junto.
"""

from collections import defaultdict
from datetime import date, timedelta

from app.models.avisos import FIQUE_DE_OLHO, FONTE_COMUNIDADE, Aviso, GrupoAvisos
from app.models.community_report import TIPO_EVENTO, NearbyReports
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules


class AvisosVizinhosService:
    """Junta os relatos de evento dos vizinhos por tipo."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._regra = (rules if rules is not None else load_default_rules()).avisos_tela

    def events(self, reports: NearbyReports, today: date) -> GrupoAvisos:
        """Um aviso por tipo de evento dos últimos dias; a leitura é a consulta de hoje."""
        since = today - timedelta(days=self._regra.vizinhos_dias - 1)
        by_kind: dict[str, list[date]] = defaultdict(list)
        for report in reports.relatos:
            day = report.data_fato
            if report.tipo == TIPO_EVENTO and report.subtipo and day and since <= day <= today:
                by_kind[report.subtipo].append(day)
        avisos = sorted(
            (
                Aviso(
                    tipo="vizinho_evento",
                    nivel=FIQUE_DE_OLHO,
                    fontes=(FONTE_COMUNIDADE,),
                    data=max(days),
                    valores={"evento": kind, "relatos": len(days)},
                )
                for kind, days in by_kind.items()
            ),
            key=lambda a: (a.data or since, str(a.valores["evento"])),
            reverse=True,
        )
        return GrupoAvisos(tuple(avisos), today)
