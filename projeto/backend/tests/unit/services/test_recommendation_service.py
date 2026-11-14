"""Unit tests for RecommendationService with fake repositories."""

from datetime import date

from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.crop_option import CropParams
from app.models.talhao import SoloInfo
from app.services.climate_risk_service import ClimateRiskService
from app.services.recommendation_service import RecommendationService
from app.services.rotation_plan_service import RotationPlanService
from app.services.water_balance_calculator import WaterBalanceCalculator


class FakeCropParamsRepository:
    def __init__(self) -> None:
        self._crops = [
            CropParams(
                id="pousio",
                nome="Pousio",
                nome_en="Fallow",
                tipo="pousio",
                funcao="Nenhuma",
                semeadura_limite_mes_dia=None,
                dias_florescer=0,
                ciclo_dias=120,
                kc_pico=0.30,
                palhada_score=15,
                n_deixado_kg=0,
                nematoide_efeito=-10,
                produtividade_padrao_sc_ha=0.0,
                preco_padrao_saca=0.0,
                custo_padrao_ha=250.0,
                como_fazer=("Controlar daninhas",),
            ),
            CropParams(
                id="milho_safrinha",
                nome="Milho safrinha",
                nome_en="Second-crop Corn",
                tipo="grao",
                funcao="Grão",
                semeadura_limite_mes_dia="02-28",
                dias_florescer=60,
                ciclo_dias=120,
                kc_pico=1.15,
                palhada_score=55,
                n_deixado_kg=0,
                nematoide_efeito=-15,
                produtividade_padrao_sc_ha=95.0,
                preco_padrao_saca=55.0,
                custo_padrao_ha=3200.0,
                como_fazer=("Plantar cedo",),
            ),
            CropParams(
                id="sorgo",
                nome="Sorgo granífero",
                nome_en="Grain Sorghum",
                tipo="grao",
                funcao="Grão",
                semeadura_limite_mes_dia="03-20",
                dias_florescer=55,
                ciclo_dias=110,
                kc_pico=1.00,
                palhada_score=65,
                n_deixado_kg=0,
                nematoide_efeito=10,
                produtividade_padrao_sc_ha=75.0,
                preco_padrao_saca=44.0,
                custo_padrao_ha=2100.0,
                como_fazer=("Tolerante à seca",),
            ),
            CropParams(
                id="milho_braquiaria",
                nome="Milho + braquiária ruziziensis",
                nome_en="Corn + Ruzigrass Intercrop",
                tipo="consorcio",
                funcao="Grão + cobertura",
                semeadura_limite_mes_dia="02-28",
                dias_florescer=60,
                ciclo_dias=120,
                kc_pico=1.20,
                palhada_score=95,
                n_deixado_kg=15,
                nematoide_efeito=5,
                produtividade_padrao_sc_ha=92.0,
                preco_padrao_saca=55.0,
                custo_padrao_ha=3450.0,
                como_fazer=("Consórcio na linha",),
            ),
            CropParams(
                id="milheto",
                nome="Milheto",
                nome_en="Pearl Millet",
                tipo="cobertura",
                funcao="Cobertura",
                semeadura_limite_mes_dia="03-15",
                dias_florescer=45,
                ciclo_dias=90,
                kc_pico=0.90,
                palhada_score=85,
                n_deixado_kg=20,
                nematoide_efeito=15,
                produtividade_padrao_sc_ha=0.0,
                preco_padrao_saca=0.0,
                custo_padrao_ha=450.0,
                como_fazer=("Cobertura rústica",),
            ),
            CropParams(
                id="crotalaria",
                nome="Crotalária spectabilis",
                nome_en="Showy Rattlebox",
                tipo="cobertura",
                funcao="Cobertura leguminosa",
                semeadura_limite_mes_dia="02-28",
                dias_florescer=50,
                ciclo_dias=100,
                kc_pico=0.95,
                palhada_score=75,
                n_deixado_kg=80,
                nematoide_efeito=30,
                produtividade_padrao_sc_ha=0.0,
                preco_padrao_saca=0.0,
                custo_padrao_ha=650.0,
                como_fazer=("Supressão de nematoides",),
            ),
        ]

    def list_all(self) -> list[CropParams]:
        return list(self._crops)

    def get_by_id(self, crop_id: str) -> CropParams | None:
        return next((c for c in self._crops if c.id == crop_id), None)


class FakeClimateRepository:
    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return "-189_-483"

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        seasons = []
        for year in range(2005, 2025):
            rain = 1.5 if year in (2007, 2010, 2012, 2014) else 5.5
            seasons.append(
                ClimateSeason(
                    cell_id=cell_id,
                    year=year,
                    start_date=date(year, 1, 1),
                    rain_mm=tuple([rain] * 210),
                    rain_source="nasa_power",
                    tmax_c=tuple([30.0] * 210),
                    tmin_c=tuple([18.0] * 210),
                    eto_mm=tuple([4.0] * 210),
                    gwetroot=tuple([0.65] * 210),
                )
            )
        return seasons

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta:
        return Cmip6Delta(
            cell_id=cell_id,
            cenario="SSP2-4.5",
            modelos_referencia=("ACCESS-CM2", "MIROC6"),
            aumento_temperatura_media_c=1.8,
            variacao_chuva_safrinha_pct=-12.5,
            aumento_dias_calor_extremo_ge_35c=6.4,
        )

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        return SmapSoilMoisture(
            data=date(2024, 2, 18),
            latitude=lat,
            longitude=lon,
            sm_surface_m3_m3=0.28,
            sm_rootzone_m3_m3=0.32,
            sm_rootzone_wetness=0.68,
            fonte="nasa_smap_l4",
        )


class FakeSoilRepository:
    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return SoloInfo(
            argila_percentual=42.5,
            areia_percentual=38.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


def _build_service() -> RecommendationService:
    return RecommendationService(
        crop_repo=FakeCropParamsRepository(),
        climate_repo=FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        risk_service=ClimateRiskService(WaterBalanceCalculator()),
        plan_service=RotationPlanService(),
    )


def test_should_keep_all_five_plantable_crops_in_window_when_harvest_is_meio() -> None:
    service = _build_service()

    rec = service.recommend(lat=-18.92, lon=-48.28, colheita="meio")

    assert rec.colheita == "meio"
    assert rec.semeadura == date(2027, 2, 18)
    assert len(rec.opcoes) == 5
    assert len(rec.fora_da_janela) == 0
    assert all(o.id != "pousio" for o in rec.opcoes)
    assert rec.melhor in {o.id for o in rec.opcoes}


def test_should_move_early_deadline_crops_to_fora_da_janela_when_harvest_is_tarde() -> None:
    service = _build_service()

    rec = service.recommend(lat=-18.92, lon=-48.28, colheita="tarde")

    assert rec.semeadura == date(2027, 3, 3)
    in_window_ids = {o.id for o in rec.opcoes}
    out_window_ids = {o.id for o in rec.fora_da_janela}

    assert in_window_ids == {"sorgo", "milheto"}
    assert out_window_ids == {"milho_safrinha", "milho_braquiaria", "crotalaria"}


def test_should_support_soil_override_nematoide_and_english_language() -> None:
    service = _build_service()

    rec = service.recommend(
        lat=-18.92,
        lon=-48.28,
        colheita="meio",
        solo_override="arenoso",
        nematoide=True,
        gado=True,
        lang="en",
    )

    assert rec.solo == "arenoso"
    assert rec.nematoide is True
    assert rec.gado is True
    assert any("NASA POWER" in phrase for opt in rec.opcoes for phrase in opt.porque)
