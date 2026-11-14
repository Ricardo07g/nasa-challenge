"""Unit tests for TalhaoService using fake repositories."""

from datetime import date

from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.talhao import FonteDado, NdviRecord, SoloInfo
from app.services.field_history_service import FieldHistoryService
from app.services.talhao_service import TalhaoService


class FakeClimateRepository:
    def __init__(self, deltas: list[Cmip6Delta] | None = None) -> None:
        self._deltas = deltas or []

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return "-190_-482" if -19.25 <= lat < -18.75 and -48.4375 <= lon < -47.8125 else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return [
            ClimateSeason(
                cell_id=cell_id,
                year=year,
                start_date=date(year, 1, 1),
                lat=-18.95,
                rain_mm=(1.0,),
                rain_source="nasa_power",
                tmax_c=(30.0,),
                tmin_c=(18.0,),
            )
            for year in range(2005, 2025)
        ]

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        return list(self._deltas)


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
    def __init__(self, empty: bool = False) -> None:
        self._empty = empty

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        if self._empty:
            return []
        records = []
        for year in range(2019, 2025):
            records += [
                NdviRecord(data=date(year, 1, 17), ndvi=8200),
                NdviRecord(data=date(year, 2, 18), ndvi=3600),
                NdviRecord(data=date(year, 4, 15), ndvi=7000),
            ]
        return records


def _service(
    climate: FakeClimateRepository | None = None, ndvi: FakeNdviRepository | None = None
) -> TalhaoService:
    return TalhaoService(
        climate_repo=climate or FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        ndvi_repo=ndvi or FakeNdviRepository(),
        history_service=FieldHistoryService(),
    )


def test_should_return_soil_history_and_climate_sources_when_point_has_data() -> None:
    talhao = _service().inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert talhao.dentro_da_area is True
    assert talhao.celula_id == "-190_-482"
    assert talhao.solo.textura_solo == "argiloso"
    assert talhao.colheita_sugerida.faixa == "meio"
    assert talhao.historico is not None
    assert talhao.historico.total == 6
    assert talhao.historico.anos[0].ndvi_max == 0.7
    # Só as fontes que existem: sem CMIP6 no arquivo, ele não aparece como "ok".
    assert talhao.dados_fontes == (FonteDado(fonte="nasa_power", periodo="2005-2024"),)


def test_should_list_cmip6_source_with_scenario_and_model_count_when_deltas_exist() -> None:
    deltas = [
        Cmip6Delta(model=m, scenario="ssp245", month=1, rain_pct=0.0, tmax_c=1.0)
        for m in ("ACCESS-CM2", "MIROC6", "MPI-ESM1-2-HR")
    ]

    talhao = _service(FakeClimateRepository(deltas)).inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert talhao.dados_fontes[-1] == FonteDado(
        fonte="nex_gddp_cmip6", periodo="2041-2060", cenario="ssp245", modelos=3
    )


def test_should_return_outside_area_without_sources_when_point_has_no_data() -> None:
    talhao = _service().inspect_talhao(lat=-15.79, lon=-47.88)

    assert talhao.dentro_da_area is False
    assert talhao.celula_id is None
    assert talhao.dados_fontes == ()


def test_should_hide_history_and_use_default_harvest_when_no_ndvi() -> None:
    talhao = _service(ndvi=FakeNdviRepository(empty=True)).inspect_talhao(-18.9543, -48.1993)

    assert talhao.historico is None
    assert (talhao.colheita_sugerida.faixa, talhao.colheita_sugerida.fonte) == ("meio", "padrao")
