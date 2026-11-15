"""Contrato do acesso à região pelo satélite (P3): percentuais da lavoura por ano, por região."""

from typing import Protocol

from app.models.regiao import RegiaoSatelite


class RegionRepository(Protocol):
    """As regiões já calculadas pelo pipeline (cada uma com centro, raio e anos)."""

    def list_regions(self) -> list[RegiaoSatelite]: ...
