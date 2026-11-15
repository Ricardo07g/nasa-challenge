"""Unit tests for PastSeasonService: replay de uma safrinha passada no ponto (P4).

Repositories falsos (sem arquivo, banco ou rede). A opção vem do motor do /recomendacao rodando
sobre os mesmos falsos; com uma cultura só (além do pousio), ela é sempre a escolhida.
"""

from datetime import date, timedelta

import pytest

from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.crop_option import CropParams
from app.models.safra_passada import SeasonEvent
from app.models.talhao import SoloInfo
from app.repositories.climate_repository import cell_id_for
from app.services.climate_risk_service import ClimateRiskService
from app.services.crop_alert_service import CropAlertService
from app.services.errors import NotFoundError, OutsideAreaError, ValidationDomainError
from app.services.past_season_service import PastSeasonService
from app.services.recommendation_service import RecommendationService
from app.services.rotation_plan_service import RotationPlanService
from app.services.water_balance_calculator import WaterBalanceCalculator

DAYS = 212
LAT, LON = -18.9543, -48.1993
CELL_ID = cell_id_for(LAT, LON)
# 2024: seca de 6/abr a 19/abr e calor de 36 °C em 24 e 25/abr, perto da floração do milho.
DRY_2024 = (date(2024, 4, 6), date(2024, 4, 19))
HOT_2024 = (date(2024, 4, 24), date(2024, 4, 25))


def _crop(crop_id: str, tipo: str, limite: str | None, nome_en: str = "") -> CropParams:
    pousio = tipo == "pousio"
    return CropParams(
        id=crop_id,
        nome=crop_id.replace("_", " ").capitalize(),
        nome_en=nome_en,
        tipo=tipo,
        funcao="x",
        semeadura_limite_mes_dia=limite,
        dias_florescer=0 if pousio else 60,
        ciclo_dias=0 if pousio else 100,
        kc_pico=1.0,
        solo_palhada=20,
        solo_nitrogenio=0,
        solo_pragas=0,
        n_deixado_kg=0,
    )


POUSIO = _crop("pousio", "pousio", None)
MILHO = _crop("milho_safrinha", "grao", "02-28", nome_en="Corn alone")
SORGO = _crop("sorgo", "grao", "03-20", nome_en="Sorghum")


class FakeCropParamsRepository:
    def __init__(self, crops: list[CropParams]) -> None:
        self._crops = crops

    def list_all(self) -> list[CropParams]:
        return list(self._crops)

    def get_by_id(self, crop_id: str) -> CropParams | None:
        return next((c for c in self._crops if c.id == crop_id), None)


def _season(year: int) -> ClimateSeason:
    start = date(year, 1, 1)
    days = [start + timedelta(days=i) for i in range(DAYS)]
    rain = tuple(0.0 if DRY_2024[0] <= d <= DRY_2024[1] else 8.0 for d in days)
    tmax = tuple(36.0 if HOT_2024[0] <= d <= HOT_2024[1] else 30.0 for d in days)
    return ClimateSeason(
        cell_id=CELL_ID,
        year=year,
        start_date=start,
        lat=LAT,
        rain_mm=rain,
        rain_source="nasa_power",
        tmax_c=tmax,
        tmin_c=tuple([18.0] * DAYS),
        eto_mm=tuple([4.0] * DAYS),
    )


class FakeClimateRepository:
    """Temporadas de 2005 a 2024 só na célula da fazenda (2024 com seca e calor em abril)."""

    def __init__(self, has_cell: bool = True) -> None:
        self.has_cell = has_cell

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return CELL_ID if self.has_cell and cell_id_for(lat, lon) == CELL_ID else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return [_season(y) for y in range(2005, 2025)] if cell_id == CELL_ID else []

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        return []


class FakeSoilRepository:
    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return SoloInfo(
            argila_percentual=42.5,
            areia_percentual=38.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


class FakeIngestionService:
    """Busca sob demanda falsa: "grava" a célula no repository de clima e devolve o id."""

    def __init__(self, climate_repo: FakeClimateRepository) -> None:
        self._climate_repo = climate_repo
        self.calls: list[tuple[float, float]] = []

    def ingest_area(self, lat: float, lon: float) -> str | None:
        self.calls.append((lat, lon))
        self._climate_repo.has_cell = True
        return CELL_ID


def _service(
    crops: list[CropParams] | None = None,
    climate_repo: FakeClimateRepository | None = None,
    ingestion_service: FakeIngestionService | None = None,
) -> PastSeasonService:
    climate = climate_repo or FakeClimateRepository()
    crop_repo = FakeCropParamsRepository(crops or [POUSIO, MILHO])
    recommender = RecommendationService(
        crop_repo=crop_repo,
        climate_repo=climate,
        soil_repo=FakeSoilRepository(),
        risk_service=ClimateRiskService(WaterBalanceCalculator()),
        plan_service=RotationPlanService(),
        ingestion_service=ingestion_service,
    )
    return PastSeasonService(
        climate_repo=climate,
        crop_repo=crop_repo,
        recommender=recommender,
        alert_service=CropAlertService(),
        ingestion_service=ingestion_service,
    )


def test_should_replay_the_recommended_option_with_the_dry_spell_and_heat_of_that_year() -> None:
    season = _service().replay(lat=LAT, lon=LON, ano=2024)

    assert season.ano == 2024
    assert season.opcao == "milho_safrinha"
    assert [(e.data, e.tipo) for e in season.eventos] == [
        (date(2024, 2, 18), "semeadura"),
        (date(2024, 4, 6), "sem_chuva"),
        (date(2024, 4, 15), "aviso_veranico"),
        (date(2024, 4, 18), "fase_critica"),
        (date(2024, 4, 20), "voltou_chuva"),
        (date(2024, 4, 25), "aviso_calor"),
        (date(2024, 2, 18) + timedelta(days=100), "colheita"),
    ]
    assert season.eventos[0].texto == "Semeadura: Milho safrinha."
    assert season.eventos[2].texto == (
        "Aviso: 10 dias sem chuva perto da fase que mais precisa de água. Converse com o agrônomo."
    )


def test_should_answer_a_good_year_without_warnings() -> None:
    season = _service().replay(lat=LAT, lon=LON, ano=2023)

    assert [e.tipo for e in season.eventos] == ["semeadura", "fase_critica", "colheita"]
    assert season.eventos[0].data == date(2023, 2, 18)


def test_should_write_the_texts_in_english() -> None:
    season = _service().replay(lat=LAT, lon=LON, ano=2024, lang="en-US")

    assert season.eventos[0] == SeasonEvent(
        data=date(2024, 2, 18), tipo="semeadura", texto="Sowing: Corn alone."
    )
    assert season.eventos[-1].texto == "Harvest: Corn alone."


def test_should_sow_on_the_date_of_the_harvest_band() -> None:
    season = _service(crops=[POUSIO, MILHO, SORGO]).replay(
        lat=LAT, lon=LON, ano=2024, colheita="tarde"
    )

    # Colheita da soja no fim de fevereiro: semeadura em 3/mar, quando o milho já saiu da janela.
    assert season.opcao == "sorgo"
    assert season.eventos[0].data == date(2024, 3, 3)


def test_should_raise_not_found_for_a_year_without_data_at_the_point() -> None:
    with pytest.raises(NotFoundError) as error:
        _service().replay(lat=LAT, lon=LON, ano=1999)

    assert error.value.code == "NOT_FOUND"
    assert "1999" in str(error.value)


def test_should_raise_outside_area_for_a_point_without_data() -> None:
    with pytest.raises(OutsideAreaError):
        _service().replay(lat=-23.55, lon=-46.63, ano=2024)


def test_should_fetch_a_new_cell_on_demand_before_the_replay() -> None:
    climate = FakeClimateRepository(has_cell=False)
    ingestion = FakeIngestionService(climate)

    season = _service(climate_repo=climate, ingestion_service=ingestion).replay(
        lat=LAT, lon=LON, ano=2024
    )

    assert ingestion.calls == [(LAT, LON)]
    assert season.opcao == "milho_safrinha"


def test_should_raise_validation_error_for_an_unknown_harvest_band() -> None:
    with pytest.raises(ValidationDomainError):
        _service().replay(lat=LAT, lon=LON, ano=2024, colheita="depois")


def test_should_replay_the_option_asked_when_it_fits_the_window() -> None:
    # Tarefa 0044: o replay vira o detalhe de qualquer ano do explorador, para a opção que a aba
    # Sugestão mostra (com um objetivo, pode não ser a melhor do motor).
    season = _service(crops=[POUSIO, MILHO, SORGO]).replay(
        lat=LAT, lon=LON, ano=2024, opcao="sorgo"
    )

    assert season.opcao == "sorgo"
    assert season.eventos[0].texto == "Semeadura: Sorgo."


def test_should_raise_not_found_for_an_option_out_of_the_window_or_unknown() -> None:
    service = _service(crops=[POUSIO, MILHO, SORGO])

    with pytest.raises(NotFoundError):
        service.replay(lat=LAT, lon=LON, ano=2024, colheita="tarde", opcao="milho_safrinha")
    with pytest.raises(NotFoundError):
        service.replay(lat=LAT, lon=LON, ano=2024, opcao="soja")


def test_should_raise_not_found_when_no_option_fits_the_sowing_window() -> None:
    with pytest.raises(NotFoundError) as error:
        _service(crops=[POUSIO, MILHO]).replay(lat=LAT, lon=LON, ano=2024, colheita="tarde")

    assert error.value.code == "NOT_FOUND"
