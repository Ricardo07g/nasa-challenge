"""Célula de clima de um ponto, com a busca sob demanda quando ela está ligada (tarefa 0001)."""

from typing import Protocol

from app.repositories.climate_repository import ClimateRepository


class IngestionServiceProtocol(Protocol):
    """Busca e grava os dados de uma célula nova. Devolve o id, ou None sem clima para gravar."""

    def ingest_area(self, lat: float, lon: float) -> str | None: ...


def find_or_ingest_cell(
    climate_repo: ClimateRepository,
    ingestion_service: IngestionServiceProtocol | None,
    lat: float,
    lon: float,
) -> str | None:
    """Id da célula do ponto. Sem dados e com a busca ligada (há banco), busca e grava antes.

    A busca sob demanda só existe quando a injeção de dependências passa o serviço (com banco);
    sem ele, ponto sem dados continua fora da área.
    """
    cell_id = climate_repo.find_cell_id(lat, lon)
    if cell_id is None and ingestion_service is not None:
        cell_id = ingestion_service.ingest_area(lat, lon)
    return cell_id
