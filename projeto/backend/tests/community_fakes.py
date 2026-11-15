"""Falsos dos relatos da comunidade (tarefa 0047), usados pelos testes do service e das rotas."""

import uuid
from collections.abc import Sequence
from datetime import date, datetime

from app.models.community_report import CommunityReport, NewCommunityReport
from app.models.crop_option import CropParams

CROP_IDS = ("pousio", "milho_safrinha", "sorgo", "milho_braquiaria", "milheto", "crotalaria")


class FakeReportRepository:
    """Guarda os relatos numa lista, com os mesmos filtros da tabela `community_report`."""

    def __init__(self) -> None:
        self.reports: list[CommunityReport] = []

    def add(self, report: NewCommunityReport, sent_at: datetime) -> CommunityReport:
        stored = CommunityReport(
            id=str(uuid.uuid4()),
            tipo=report.tipo,
            subtipo=report.subtipo,
            valores=dict(report.valores),
            celula=report.celula,
            data_fato=report.data_fato,
            enviado_em=sent_at,
            device_hash=report.device_hash,
        )
        self.reports.append(stored)
        return stored

    def count_sent_since(self, device_hash: str, since: datetime) -> int:
        return sum(
            1 for r in self.reports if r.device_hash == device_hash and r.enviado_em >= since
        )

    def list_in_cells(self, cell_ids: Sequence[str], fact_since: date) -> list[CommunityReport]:
        return [
            r
            for r in self.reports
            if r.celula in cell_ids and (r.data_fato is None or r.data_fato >= fact_since)
        ]

    def list_by_device(self, device_hash: str, tipo: str) -> list[CommunityReport]:
        return [r for r in self.reports if r.device_hash == device_hash and r.tipo == tipo]

    def delete(self, report_id: str, device_hash: str) -> bool:
        before = len(self.reports)
        self.reports = [
            r for r in self.reports if not (r.id == report_id and r.device_hash == device_hash)
        ]
        return len(self.reports) < before


class FakeCropRepository:
    """As 6 culturas do culturas.yaml (só o id importa para os relatos)."""

    def list_all(self) -> list[CropParams]:
        return [
            CropParams(
                id=crop_id,
                nome=crop_id,
                tipo="grao",
                funcao="x",
                semeadura_limite_mes_dia=None,
                dias_florescer=60,
                ciclo_dias=100,
                kc_pico=1.0,
                solo_palhada=0,
                solo_nitrogenio=0,
                solo_pragas=0,
                n_deixado_kg=0,
                como_fazer=(),
            )
            for crop_id in CROP_IDS
        ]

    def get_by_id(self, crop_id: str) -> CropParams | None:
        return next((c for c in self.list_all() if c.id == crop_id), None)
