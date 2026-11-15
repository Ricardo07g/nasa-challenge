"""Replay de uma safrinha passada no ponto (P4, plano de evolução 4.4).

Repete a chuva (GPM IMERG; nos anos sem IMERG, NASA POWER) e o calor (NASA POWER) de um ano da
série guardada com a opção que o /recomendacao
escolhe para o ponto e a semeadura da faixa de colheita, e devolve os avisos que o produtor
teria recebido (regras do `CropAlertService`, as mesmas do acompanhamento diário do P6).
"""

from datetime import date, timedelta
from typing import Protocol

from app.models.climate import ClimateSeason
from app.models.recomendacao import Recomendacao
from app.models.safra_passada import DailyWeather, PastSeason
from app.repositories.climate_repository import ClimateRepository
from app.repositories.crop_params_repository import CropParamsRepository
from app.services.cell_lookup import IngestionServiceProtocol, find_or_ingest_cell
from app.services.crop_alert_service import CropAlertService
from app.services.errors import NotFoundError, OutsideAreaError


class RecommenderProtocol(Protocol):
    """O motor do /recomendacao (`RecommendationService`): dá a melhor opção e a semeadura."""

    def recommend(
        self, lat: float, lon: float, colheita: str = "meio", lang: str = "pt-BR"
    ) -> Recomendacao: ...


def season_days(season: ClimateSeason) -> list[DailyWeather]:
    """Chuva e máxima de cada dia da temporada, com a data de cada um."""
    total = min(len(season.rain_mm), len(season.tmax_c))
    return [
        DailyWeather(
            data=season.start_date + timedelta(days=idx),
            chuva_mm=season.rain_mm[idx],
            tmax_c=season.tmax_c[idx],
        )
        for idx in range(total)
    ]


class PastSeasonService:
    """Como teria sido a safrinha de um ano passado, com os avisos daquele ano."""

    def __init__(
        self,
        climate_repo: ClimateRepository,
        crop_repo: CropParamsRepository,
        recommender: RecommenderProtocol,
        alert_service: CropAlertService,
        ingestion_service: IngestionServiceProtocol | None = None,
    ) -> None:
        self._climate_repo = climate_repo
        self._crop_repo = crop_repo
        self._recommender = recommender
        self._alert_service = alert_service
        self._ingestion_service = ingestion_service

    def replay(
        self,
        lat: float,
        lon: float,
        ano: int,
        colheita: str = "meio",
        lang: str = "pt-BR",
        opcao: str | None = None,
    ) -> PastSeason:
        """Eventos da safrinha de `ano` no ponto, com a melhor opção da faixa de colheita.

        Com `opcao` (tarefa 0044: o detalhe de qualquer ano do explorador da aba Sugestão), o
        replay é dessa opção, desde que ela caiba na janela de plantio da faixa.

        Raises:
            OutsideAreaError: o ponto não tem dados (nem pela busca sob demanda).
            NotFoundError: o ponto tem dados, mas não do ano pedido; nenhuma opção cabe na
                janela de plantio da faixa de colheita; ou a `opcao` pedida não cabe nela.
            ValidationDomainError: faixa de colheita inválida (vem do motor do /recomendacao).
        """
        cell_id = find_or_ingest_cell(self._climate_repo, self._ingestion_service, lat, lon)
        seasons = self._climate_repo.get_seasons(cell_id) if cell_id is not None else []
        if not seasons:
            raise OutsideAreaError(
                "Ainda não temos dados preparados para esse ponto. Veja a fazenda de exemplo."
            )
        season = next((s for s in seasons if s.year == ano), None)
        if season is None:
            raise NotFoundError(f"Sem dado de {ano} neste ponto.")

        rec = self._recommender.recommend(lat=lat, lon=lon, colheita=colheita, lang=lang)
        escolhida = opcao or rec.melhor
        crop = self._crop_repo.get_by_id(escolhida)
        option = next((o for o in rec.opcoes if o.id == escolhida), None)
        if crop is None or option is None:
            raise NotFoundError(
                f"A opção '{escolhida}' não cabe na janela de plantio da colheita '{colheita}'."
                if opcao
                else f"Nenhuma opção cabe na janela de plantio da colheita '{colheita}' para "
                "repetir."
            )

        sowing = date(ano, rec.semeadura.month, rec.semeadura.day)
        events = self._alert_service.timeline(
            crop=crop, crop_name=option.nome, sowing=sowing, days=season_days(season), lang=lang
        )
        return PastSeason(ano=ano, opcao=crop.id, eventos=tuple(events))
