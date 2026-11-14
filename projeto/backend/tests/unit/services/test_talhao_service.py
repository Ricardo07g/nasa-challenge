"""Unit tests for TalhaoService using fake repositories."""

from typing import Any

from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.talhao import HistoricoAno, SoloInfo
from app.services.field_history_service import FieldHistoryService
from app.services.talhao_service import TalhaoService


class FakeClimateRepository:
    def find_cell_id(self, lat: float, lon: float) -> str | None:
        if -19.9 <= lat <= -18.4 and -49.0 <= lon <= -47.5:
            return "-189_-483"
        return None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return []

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta:
        raise NotImplementedError

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        return None


class FakeSoilRepository:
    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return SoloInfo(
            argila_percentual=42.5,
            areia_percentual=38.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


class FakeNdviRepository:
    def get_ndvi_history(
        self, lat: float, lon: float
    ) -> tuple[list[dict[str, Any]], list[HistoricoAno]]:
        records = []
        for year in range(2019, 2025):
            records.extend(
                [
                    {"date": f"{year}-01-17", "year": year, "month": 1, "ndvi": 0.82},
                    {"date": f"{year}-02-18", "year": year, "month": 2, "ndvi": 0.36},
                    {"date": f"{year}-04-15", "year": year, "month": 4, "ndvi": 0.70},
                ]
            )
        return records, []


def test_should_return_within_area_true_and_soil_and_history_when_inside_bounding_box() -> None:
    service = TalhaoService(
        climate_repo=FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        ndvi_repo=FakeNdviRepository(),
        history_service=FieldHistoryService(),
    )

    talhao = service.inspect_talhao(lat=-18.92, lon=-48.28)

    assert talhao.dentro_da_area is True
    assert talhao.celula_id == "-189_-483"
    assert talhao.solo.textura_solo == "argiloso"
    assert talhao.solo.cad_capacidade_agua_mm == 60.0
    assert talhao.colheita_sugerida.faixa == "meio"
    assert talhao.historico is not None
    assert talhao.historico.total == 6


def test_should_return_within_area_false_when_coordinates_outside_bounding_box() -> None:
    service = TalhaoService(
        climate_repo=FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        ndvi_repo=FakeNdviRepository(),
        history_service=FieldHistoryService(),
    )

    talhao = service.inspect_talhao(lat=-15.79, lon=-47.88)

    assert talhao.dentro_da_area is False
    assert talhao.celula_id is None
