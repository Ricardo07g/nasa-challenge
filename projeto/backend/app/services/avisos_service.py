"""Tela "Avisos" do ponto marcado (/avisos, remodelagem S6, tarefa 0046, RF-31).

Só busca os dados nos repositories e monta os quatro grupos; cada regra mora no seu service:
- Agora (`AvisosAgoraService`): SMAP recente, NASA POWER dos últimos `avisos_tela.power_dias` dias
  até ontem (com cache de 24 h no repository; sem resposta, os avisos dele não aparecem), a
  previsão do ENSO com o ONI e a safrinha em andamento;
- O que mudou e Fora do comum (`AvisosMudancaService`): a série guardada da célula e a melhor
  opção do motor (a mesma do `/recomendacao`, com a mesma colheita, solo e safras confirmadas);
- Perto de você (`AvisosVizinhosService`): os relatos da comunidade. Desligado desde a tarefa
  0065 (a comunidade está "em breve"): sem o service dos vizinhos injetado, o grupo é None e a
  comunidade nem é lida. Volta quando a comunidade voltar (sem banco, o grupo também some).
O contador do botão "Avisos" do cabeçalho conta só os avisos de Agora (tarefa 0065).
"""

from collections.abc import Callable, Iterable, Sequence
from datetime import date, datetime, timedelta, timezone
from typing import Any, Protocol

from app.constants import PILOT_UTC_OFFSET_HOURS, SOIL_CAD_BY_TEXTURE
from app.models.avisos import Aviso, Avisos, GrupoAvisos, RecentDay
from app.models.climate import ClimateSeason
from app.models.community_report import NearbyReports
from app.models.recomendacao import ResultadoOpcao
from app.models.regras import Regras
from app.repositories.climate_repository import ClimateRepository
from app.repositories.crop_params_repository import CropParamsRepository
from app.repositories.enso_forecast_repository import EnsoForecastRepository
from app.repositories.enso_repository import EnsoRepository
from app.repositories.recent_weather_repository import RecentWeatherRepository
from app.repositories.rules_repository import load_default_rules
from app.repositories.sinal_outono_repository import RecentSoilMoistureRepository
from app.repositories.smap_repository import CellSmapRepository
from app.repositories.soil_repository import SoilRepository
from app.services.avisos_agora_service import AvisosAgoraService
from app.services.avisos_mudanca_service import AvisosMudancaService, cycle_deficits
from app.services.avisos_vizinhos_service import AvisosVizinhosService
from app.services.climate_risk_service import ClimateRiskService
from app.services.errors import CommunityUnavailableError
from app.services.harvest_delay_service import RecommenderProtocol

LOCAL_TZ = timezone(timedelta(hours=PILOT_UTC_OFFSET_HOURS))


def pilot_today() -> date:
    """O dia de hoje em Uberlândia (UTC−3), como nas datas dos relatos (decisão D46)."""
    return datetime.now(LOCAL_TZ).date()


class NearbyReportsProvider(Protocol):
    """Os relatos da redondeza (`CommunityReportService.nearby`)."""

    def nearby(self, lat: float, lon: float) -> NearbyReports: ...


class AvisosService:
    def __init__(
        self,
        recommender: RecommenderProtocol,
        climate_repo: ClimateRepository,
        crop_repo: CropParamsRepository,
        soil_repo: SoilRepository,
        risk_service: ClimateRiskService,
        recent_soil_moisture_repo: RecentSoilMoistureRepository,
        recent_weather_repo: RecentWeatherRepository | None,
        forecast_repo: EnsoForecastRepository,
        enso_repo: EnsoRepository,
        community_service: NearbyReportsProvider | None = None,
        smap_repo: CellSmapRepository | None = None,
        rules: Regras | None = None,
        today: Callable[[], date] = pilot_today,
        vizinhos_service: AvisosVizinhosService | None = None,
    ) -> None:
        self._rules = rules if rules is not None else load_default_rules()
        self._recommender = recommender
        self._climate_repo = climate_repo
        self._crop_repo = crop_repo
        self._soil_repo = soil_repo
        self._risk = risk_service
        self._recent_smap = recent_soil_moisture_repo
        self._recent_weather = recent_weather_repo
        self._forecast_repo = forecast_repo
        self._enso_repo = enso_repo
        self._community = community_service
        self._smap_repo = smap_repo
        self._today = today
        self._agora = AvisosAgoraService(self._rules, today=today)
        self._mudanca = AvisosMudancaService(self._rules)
        # "Perto de você" desligado sem o service dos vizinhos (tarefa 0065)
        self._vizinhos = vizinhos_service

    def avisos(
        self,
        lat: float,
        lon: float,
        colheita: str = "meio",
        solo_override: str | None = None,
        confirmadas: Iterable[tuple[int, str]] = (),
        lang: str = "pt-BR",
    ) -> Avisos:
        """Os avisos do ponto. Raises: os mesmos do `/recomendacao` (OutsideAreaError, 422)."""
        rec: Any = self._recommender.recommend(
            lat=lat,
            lon=lon,
            colheita=colheita,
            solo_override=solo_override,
            lang=lang,
            confirmadas=list(confirmadas),
        )
        cell_id: str = rec.celula_id
        seasons = self._climate_repo.get_seasons(cell_id)
        best: ResultadoOpcao | None = next((o for o in rec.opcoes if o.id == rec.melhor), None)
        crop = self._crop_repo.get_by_id(rec.melhor)
        today = self._today()

        agora, safrinha = self._now_group(lat, lon, cell_id, rec, best, crop, seasons, today)
        changes = self._mudanca.changes(seasons, best, self._deficits(lat, lon, rec, crop, seasons))
        perto = self._nearby_group(lat, lon, today)
        return Avisos(
            lat=lat,
            lon=lon,
            celula_id=cell_id,
            hoje=today,
            agora=agora,
            mudou=changes[0] if changes else None,
            periodo=changes[1] if changes else None,
            recordes=self._mudanca.records(seasons),
            perto=perto,
            raio_km=self._rules.comunidade.raio_km,
            vizinhos_dias=self._rules.avisos_tela.vizinhos_dias,
            safrinha=safrinha,
            contador=len(agora.avisos),
        )

    # --- Agora ---------------------------------------------------------------------------------

    def _now_group(
        self,
        lat: float,
        lon: float,
        cell_id: str,
        rec: Any,
        best: ResultadoOpcao | None,
        crop: Any,
        seasons: Sequence[ClimateSeason],
        today: date,
    ) -> tuple[GrupoAvisos, Any]:
        moisture = self._recent_smap.get_recent_soil_moisture(lat, lon)
        days = self._recent_days(cell_id, today)
        weather_alerts, power_last = self._agora.recent_weather(days)
        forecast = self._forecast_repo.get_enso_forecast()
        rain_sources = tuple(sorted({s.rain_source for s in seasons}))
        sinal = getattr(rec, "sinal", None)
        enso = self._agora.enso(
            forecast,
            self._enso_repo.get_oni_years(),
            best,
            rain_sources,
            sinal=sinal.nivel if sinal is not None else None,
        )
        nome = best.nome if best else None
        explorar = max((s.year for s in seasons), default=None)
        safrinha = self._agora.safrinha(crop, nome, rec.semeadura, explorar)
        safrinha_alerts = self._agora.safrinha_alerts(crop, nome or "", safrinha, days)

        avisos: list[Aviso | None] = [
            self._agora.dry_soil(moisture),
            *weather_alerts,
            enso,
            *safrinha_alerts,
        ]
        readings = [
            moisture.data if moisture else None,
            power_last,
            enso.data if enso else None,
        ]
        group = GrupoAvisos(
            avisos=tuple(a for a in avisos if a is not None),
            ultima_leitura=max((d for d in readings if d is not None), default=None),
        )
        return group, safrinha

    def _recent_days(self, cell_id: str, today: date) -> list[RecentDay]:
        if self._recent_weather is None:
            return []
        end = today - timedelta(days=1)
        start = end - timedelta(days=self._rules.avisos_tela.power_dias - 1)
        return self._recent_weather.get_recent_days(cell_id, start, end) or []

    # --- O que mudou ---------------------------------------------------------------------------

    def _deficits(
        self, lat: float, lon: float, rec: Any, crop: Any, seasons: Sequence[ClimateSeason]
    ) -> dict[int, float]:
        """Falta de água da melhor opção em cada ano, com o mesmo balde e a mesma CAD do motor."""
        if crop is None:
            return {}
        cad = SOIL_CAD_BY_TEXTURE.get(rec.solo)
        if cad is None:
            cad = self._soil_repo.get_soil(lat, lon).cad_capacidade_agua_mm
        wetness = (
            self._risk.sowing_day_wetness(
                self._smap_repo.get_cell_smap_series(rec.celula_id), rec.semeadura
            )
            if self._smap_repo is not None
            else {}
        )
        return cycle_deficits(crop, seasons, rec.semeadura, cad, self._risk, wetness)

    # --- Perto de você -------------------------------------------------------------------------

    def _nearby_group(self, lat: float, lon: float, today: date) -> GrupoAvisos | None:
        if self._vizinhos is None or self._community is None:
            return None
        try:
            reports = self._community.nearby(lat, lon)
        except CommunityUnavailableError:
            return None
        return self._vizinhos.events(reports, today)
