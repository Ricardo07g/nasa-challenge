"""Unit tests for TalhaoService including Cache-Aside on-demand ingestion (Sub-task 1.3)."""

from datetime import date
from typing import Any

from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.talhao import FonteDado, HistoricoAno, NdviRecord, SoloInfo
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
    def __init__(self) -> None:
        self.soils: dict[tuple[float, float], SoloInfo] = {}

    def save_soil(self, lat: float, lon: float, soil: SoloInfo) -> None:
        self.soils[(round(lat, 3), round(lon, 3))] = soil

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return self.soils.get(
            (round(lat, 3), round(lon, 3)),
            SoloInfo(
                argila_percentual=42.5,
                areia_percentual=38.0,
                textura_solo="argiloso",
                cad_capacidade_agua_mm=60.0,
                fonte="soilgrids",
            ),
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
                NdviRecord(data=date(year, 5, 1), ndvi=6500),
                NdviRecord(data=date(year, 6, 2), ndvi=4000),
            ]
        return records


def _service(
    climate: FakeClimateRepository | None = None,
    ndvi: FakeNdviRepository | None = None,
    ingestion_service: Any = None,
) -> TalhaoService:
    return TalhaoService(
        climate_repo=climate or FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        ndvi_repo=ndvi or FakeNdviRepository(),
        history_service=FieldHistoryService(),
        ingestion_service=ingestion_service,
    )


def test_should_return_soil_history_and_climate_sources_when_point_has_data() -> None:
    talhao = _service().inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert talhao.dentro_da_area is True
    assert talhao.celula_id == "-190_-482"
    assert talhao.solo.textura_solo == "argiloso"
    assert talhao.colheita_sugerida.faixa == "meio"
    assert talhao.historico is not None
    # 2016 a 2025: 2019 a 2024 com 3 observações boas por entressafra, os outros sem dado
    assert (talhao.historico.plantou, talhao.historico.sem_certeza) == (6, 4)
    assert talhao.historico.total == 10
    assert talhao.historico.anos[3] == HistoricoAno(
        ano=2019, situacao="plantou", ndvi_max=0.7, n_obs=3
    )
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


class FakeIngestionService:
    def __init__(self, cell_id: str | None = "-178_-510") -> None:
        self.cell_id = cell_id
        self.calls: list[tuple[float, float]] = []

    def ingest_area(self, lat: float, lon: float) -> str | None:
        self.calls.append((lat, lon))
        return self.cell_id


def test_should_trigger_on_demand_ingestion_when_cache_misses() -> None:
    # Decisão explícita: com a ingestão injetada, busca (não depende de o repositório saber gravar).
    ingestion_service = FakeIngestionService()
    service = _service(climate=FakeClimateRepository(), ingestion_service=ingestion_service)

    # Coordenadas de Rio Verde / GO fora da área pré-carregada
    talhao = service.obter_talhao(lat=-17.78, lon=-50.92)

    assert len(ingestion_service.calls) == 1
    assert ingestion_service.calls[0] == (-17.78, -50.92)
    assert talhao.dentro_da_area is True
    assert talhao.celula_id == "-178_-510"
    assert talhao.dados_fontes == (FonteDado(fonte="nasa_power", periodo="2005-2024"),)


def test_should_not_trigger_ingestion_when_point_already_has_data() -> None:
    ingestion_service = FakeIngestionService()
    service = _service(ingestion_service=ingestion_service)

    talhao = service.inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert ingestion_service.calls == []
    assert talhao.celula_id == "-190_-482"


def test_should_stay_outside_area_when_ingestion_finds_no_climate() -> None:
    service = _service(ingestion_service=FakeIngestionService(cell_id=None))

    talhao = service.inspect_talhao(lat=-17.78, lon=-50.92)

    assert talhao.dentro_da_area is False
    assert talhao.celula_id is None
    assert talhao.dados_fontes == ()
