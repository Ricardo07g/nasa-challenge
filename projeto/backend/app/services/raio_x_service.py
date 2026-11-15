"""Raio-X do ponto marcado (tela 4 "O que o satélite viu", remodelagem S4, tarefa 0043).

Junta os 8 blocos do painel, a faixa de calor do NDVI, os alertas da área e os cartões menores.
Cada conta mora no seu service; este só busca os dados nos repositories e monta a resposta. A
cultura sugerida (bloco da água e cartão dos 20 anos) é a melhor opção do motor do
`/recomendacao`, com a mesma colheita, o mesmo solo e as mesmas safras confirmadas.
"""

from collections.abc import Callable, Iterable, Sequence
from typing import Any, Final, Protocol

from app.constants import (
    PILOT_MAX_LAT,
    PILOT_MAX_LON,
    PILOT_MIN_LAT,
    PILOT_MIN_LON,
    SOIL_CAD_BY_TEXTURE,
)
from app.models.climate import ClimateSeason
from app.models.raio_x import (
    AguaTerra,
    AlertasArea,
    CartoesRaioX,
    ChuvaVinteAnos,
    RaioX,
    RegiaoChuva,
    SoloRaioX,
    UmidadeAgora,
)
from app.models.regras import Regras
from app.models.soja_recente import SojaRecente
from app.models.talhao import NdviRecord, SoloInfo
from app.repositories.climate_repository import ClimateRepository, RegionRainRepository
from app.repositories.crop_params_repository import CropParamsRepository
from app.repositories.ndvi_repository import NdviRepository
from app.repositories.rules_repository import load_default_rules
from app.repositories.sinal_outono_repository import RecentSoilMoistureRepository
from app.repositories.soil_repository import DEFAULT_SOIL, NearestSoilRepository, SoilRepository
from app.services.burned_area_service import BurnedAreaService
from app.services.future_climate_service import FutureClimateService
from app.services.harvest_delay_service import RecommenderProtocol
from app.services.ndvi_strip_service import NdviStripService
from app.services.raio_x_climate_service import RaioXClimateService
from app.services.region_rank_service import RegionRankService

PILOT_BOX: Final[tuple[float, float, float, float]] = (
    PILOT_MIN_LAT,
    PILOT_MAX_LAT,
    PILOT_MIN_LON,
    PILOT_MAX_LON,
)
KM_DECIMALS: Final[int] = 1


class SojaRecenteChecker(Protocol):
    def check(self, lat: float, lon: float) -> SojaRecente | None: ...


class RaioXService:
    def __init__(
        self,
        climate_repo: ClimateRepository,
        soil_repo: SoilRepository,
        ndvi_repo: NdviRepository,
        crop_repo: CropParamsRepository,
        recommender: RecommenderProtocol,
        reference_eto: Callable[[ClimateSeason], Sequence[float]],
        recent_soil_moisture_repo: RecentSoilMoistureRepository,
        nearest_soil_repo: NearestSoilRepository | None = None,
        soja_recente_service: SojaRecenteChecker | None = None,
        region_rain_repo: RegionRainRepository | None = None,
        burned_area_service: BurnedAreaService | None = None,
        rules: Regras | None = None,
    ) -> None:
        self._rules = rules if rules is not None else load_default_rules()
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._ndvi_repo = ndvi_repo
        self._crop_repo = crop_repo
        self._recommender = recommender
        self._reference_eto = reference_eto
        self._recent_smap = recent_soil_moisture_repo
        self._nearest_soil = nearest_soil_repo
        self._soja = soja_recente_service
        self._region_rain = region_rain_repo
        self._burned = burned_area_service
        self._climate = RaioXClimateService(self._rules)
        self._ndvi = NdviStripService(self._rules)
        self._region = RegionRankService(self._rules)
        self._future = FutureClimateService(self._rules)

    def raio_x(
        self,
        lat: float,
        lon: float,
        colheita: str = "meio",
        solo_override: str | None = None,
        confirmadas: Iterable[tuple[int, str]] = (),
        lang: str = "pt-BR",
    ) -> RaioX:
        """O raio-X do ponto. Raises: os mesmos do `/recomendacao` (OutsideAreaError, 422)."""
        rec = self._recommender.recommend(
            lat=lat,
            lon=lon,
            colheita=colheita,
            solo_override=solo_override,
            lang=lang,
            confirmadas=list(confirmadas),
        )
        cell_id = rec.celula_id
        seasons = self._climate_repo.get_seasons(cell_id)
        solo = self._soil(lat, lon)
        records = self._ndvi_records(lat, lon)
        soja = self._soja.check(lat, lon) if self._soja else None
        recent = self._recent_smap.get_recent_soil_moisture(lat, lon)
        umidade = None if recent is None else UmidadeAgora(recent.sm_rootzone_pctl, recent.data)
        readings = [r.data for r in records] + ([umidade.data] if umidade else [])
        return RaioX(
            lat=lat,
            lon=lon,
            celula_id=cell_id,
            leitura_recente=max(readings, default=None),
            altitude_m=None,
            solo=solo,
            agua=self._water(rec, seasons, solo, solo_override),
            umidade=umidade,
            verde=self._ndvi.green(records, soja),
            chuva=self._climate.typical_rain(seasons),
            veranico=self._climate.longest_dry_spell(seasons),
            calor=self._climate.heat_years(seasons),
            regiao=self._region_block(cell_id),
            historico_ndvi=self._ndvi.strip(records),
            alertas=AlertasArea(
                geada=self._climate.frost(seasons),
                chuva_forte=self._climate.heavy_rain(seasons),
                fogo=self._burned.near(lat, lon) if self._burned else None,
            ),
            cartoes=CartoesRaioX(
                chuva_20_anos=self._rain_card(rec),
                clima_futuro=self._future.summarize(
                    self._climate_repo.get_cmip6_deltas(cell_id), seasons
                ),
            ),
        )

    def _soil(self, lat: float, lon: float) -> SoloRaioX | None:
        """O solo do ponto (ou da célula); sem ele, o ponto gravado mais perto até o limite."""
        soil: SoloInfo = self._soil_repo.get_soil(lat, lon)
        vizinho_km: float | None = None
        if soil.fonte == DEFAULT_SOIL.fonte and self._nearest_soil is not None:
            near = self._nearest_soil.get_nearest_soil(lat, lon)
            if near is not None and near.distancia_km <= self._rules.raio_x.solo_vizinho_max_km:
                soil, vizinho_km = near.soil, round(near.distancia_km, KM_DECIMALS)
        if soil.fonte == DEFAULT_SOIL.fonte:
            return None
        return SoloRaioX(
            textura=soil.textura_solo,
            argila_pct=soil.argila_percentual,
            areia_pct=soil.areia_percentual,
            cad_mm=soil.cad_capacidade_agua_mm,
            vizinho_km=vizinho_km,
        )

    def _water(
        self,
        rec: Any,
        seasons: Sequence[ClimateSeason],
        solo: SoloRaioX | None,
        solo_override: str | None,
    ) -> AguaTerra | None:
        """A CAD da terra escolhida pelo produtor (a do motor) ou a do solo do bloco 1."""
        cad = SOIL_CAD_BY_TEXTURE.get(solo_override) if solo_override else None
        if cad is None and solo is not None:
            cad = solo.cad_mm
        crop = self._crop_repo.get_by_id(rec.melhor)
        if cad is None or crop is None:
            return None
        return self._climate.flowering_water(
            seasons, crop, rec.semeadura, cad, reference_eto=self._reference_eto
        )

    def _ndvi_records(self, lat: float, lon: float) -> list[NdviRecord]:
        result: Any = self._ndvi_repo.get_ndvi_history(lat, lon)
        return list(result[0] if isinstance(result, tuple) else result)

    def _region_block(self, cell_id: str) -> RegiaoChuva | None:
        if self._region_rain is None:
            return None
        regra = self._rules.raio_x
        totals = self._region_rain.rain_totals_in_window(
            regra.regiao_inicio, regra.regiao_fim, PILOT_BOX
        )
        return self._region.rank(cell_id, totals)

    @staticmethod
    def _rain_card(rec: Any) -> ChuvaVinteAnos | None:
        melhor = next((o for o in rec.opcoes if o.id == rec.melhor), None)
        if melhor is None:
            return None
        return ChuvaVinteAnos(
            cultura=melhor.id,
            nome=melhor.nome,
            anos_bons=melhor.anos_bons_chuva,
            total_anos=melhor.total_anos,
        )
