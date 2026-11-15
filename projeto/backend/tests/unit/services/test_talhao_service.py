"""Unit tests for TalhaoService including Cache-Aside on-demand ingestion (Sub-task 1.3)."""

from datetime import date
from typing import Any

from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.soja_recente import PicoSojaRecente, SojaRecente
from app.models.talhao import ChuvaMes, FonteDado, HistoricoAno, NdviRecord, SoloInfo
from app.services.field_history_service import FieldHistoryService
from app.services.soja_recente_service import SojaRecenteService
from app.services.talhao_service import TalhaoService

DAYS = 212  # 1/jan a 31/jul


class FakeClimateRepository:
    """Temporadas de teste de 2005 a 2024 com 2 mm de chuva todo dia (valores redondos)."""

    def __init__(
        self,
        deltas: list[Cmip6Delta] | None = None,
        seasons: bool = True,
        imerg_years: tuple[int, ...] = (),
    ) -> None:
        self._deltas = deltas or []
        self._seasons = seasons
        self._imerg_years = imerg_years

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return "-190_-482" if -19.25 <= lat < -18.75 and -48.4375 <= lon < -47.8125 else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        if not self._seasons:
            return []
        return [
            ClimateSeason(
                cell_id=cell_id,
                year=year,
                start_date=date(year, 1, 1),
                lat=-18.95,
                rain_mm=tuple([2.0] * DAYS),
                rain_source="gpm_imerg" if year in self._imerg_years else "nasa_power",
                tmax_c=tuple([30.0] * DAYS),
                tmin_c=tuple([18.0] * DAYS),
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


class FakeSmapRepository:
    """Umidade de teste (não do SMAP) no dia 18/02 dos anos dados, na célula da fazenda."""

    def __init__(self, years: tuple[int, ...] = ()) -> None:
        self._years = years
        self.calls: list[str] = []

    def get_cell_smap_series(self, cell_id: str) -> list[SmapSoilMoisture]:
        self.calls.append(cell_id)
        return [
            SmapSoilMoisture(date(year, 2, 18), -18.95, -48.15, 0.3, 0.6, "teste")
            for year in self._years
        ]


class FakeSojaRecenteRepository:
    """Pico de teste (não do MODIS) só perto da fazenda de exemplo; fora dela, fora da grade."""

    def __init__(self, ndvi_pico: float | None) -> None:
        self._ndvi_pico = ndvi_pico

    def get_pico(self, lat: float, lon: float) -> PicoSojaRecente | None:
        if not (-19.0 <= lat <= -18.9 and -48.25 <= lon <= -48.15):
            return None
        return PicoSojaRecente(safra="2025/26", fonte="teste", ndvi_pico=self._ndvi_pico)


def _service(
    climate: FakeClimateRepository | None = None,
    ndvi: FakeNdviRepository | None = None,
    ingestion_service: Any = None,
    smap: FakeSmapRepository | None = None,
    soja: SojaRecenteService | None = None,
) -> TalhaoService:
    return TalhaoService(
        climate_repo=climate or FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        ndvi_repo=ndvi or FakeNdviRepository(),
        history_service=FieldHistoryService(),
        ingestion_service=ingestion_service,
        smap_repo=smap,
        soja_recente_service=soja,
    )


def test_should_return_soil_history_and_climate_sources_when_point_has_data() -> None:
    talhao = _service().inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert talhao.dentro_da_area is True
    assert talhao.celula_id == "-190_-482"
    assert talhao.solo.textura_solo == "argiloso"
    assert talhao.colheita_sugerida.faixa == "meio"
    assert talhao.historico is not None
    # 2017 a 2026: 2019 a 2024 com 3 observações boas por entressafra, os outros sem dado
    assert (talhao.historico.plantou, talhao.historico.sem_certeza) == (6, 4)
    assert talhao.historico.total == 10
    assert talhao.historico.anos[2] == HistoricoAno(
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


def test_should_list_imerg_rain_when_the_cell_has_any_year_with_it() -> None:
    # Carga da tarefa 0027: os anos completos do IMERG trocam a chuva do POWER na célula.
    deltas = [Cmip6Delta(model="ACCESS-CM2", scenario="ssp245", month=1, rain_pct=0.0, tmax_c=1.0)]
    climate = FakeClimateRepository(deltas, imerg_years=(2010, 2011))

    talhao = _service(climate).inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert talhao.dados_fontes[:2] == (
        FonteDado(fonte="nasa_power", periodo="2005-2024"),
        FonteDado(fonte="gpm_imerg", periodo="2005-2024"),
    )
    assert talhao.dados_fontes[-1].fonte == "nex_gddp_cmip6"


def test_should_list_smap_with_the_years_of_the_cell_when_it_has_smap() -> None:
    smap = FakeSmapRepository(years=tuple(range(2016, 2026)))

    talhao = _service(smap=smap).inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert FonteDado(fonte="smap", periodo="2016-2025") in talhao.dados_fontes
    assert smap.calls == ["-190_-482"]


def test_should_not_list_smap_when_the_cell_has_no_smap() -> None:
    talhao = _service(smap=FakeSmapRepository()).inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert all(d.fonte != "smap" for d in talhao.dados_fontes)


def test_should_return_outside_area_without_sources_when_point_has_no_data() -> None:
    talhao = _service().inspect_talhao(lat=-15.79, lon=-47.88)

    assert talhao.dentro_da_area is False
    assert talhao.celula_id is None
    assert talhao.dados_fontes == ()
    assert talhao.chuva_mensal is None


def test_should_return_monthly_rain_of_the_cell_from_its_seasons() -> None:
    chuva = _service().inspect_talhao(lat=-18.9543, lon=-48.1993).chuva_mensal

    assert chuva is not None
    # 2 mm/dia: janeiro = 62; fevereiro = (15 anos x 56 + 5 bissextos x 58) / 20 = 56,5
    assert chuva.meses[:2] == (ChuvaMes(mes=1, media_mm=62.0), ChuvaMes(mes=2, media_mm=56.5))
    assert [m.mes for m in chuva.meses] == [1, 2, 3, 4, 5, 6]
    assert chuva.anos == tuple(range(2005, 2025))
    assert chuva.fonte == "nasa_power"


def test_should_return_no_monthly_rain_when_the_cell_has_no_seasons() -> None:
    climate = FakeClimateRepository(seasons=False)

    talhao = _service(climate).inspect_talhao(lat=-18.9543, lon=-48.1993)

    assert talhao.dentro_da_area is True
    assert talhao.chuva_mensal is None


def test_should_tell_whether_the_satellite_saw_soybean_in_the_last_season() -> None:
    # RF-24 (tarefa 0037): o limite da soja (0,70) vem do regras.yaml, pelo service.
    seen = _service(soja=SojaRecenteService(FakeSojaRecenteRepository(0.86)))
    not_seen = _service(soja=SojaRecenteService(FakeSojaRecenteRepository(0.41)))
    no_data = _service(soja=SojaRecenteService(FakeSojaRecenteRepository(None)))

    assert seen.inspect_talhao(-18.9543, -48.1993).soja_recente == SojaRecente(
        safra="2025/26", vista=True, ndvi_pico=0.86, fonte="teste"
    )
    assert not_seen.inspect_talhao(-18.9543, -48.1993).soja_recente == SojaRecente(
        safra="2025/26", vista=False, ndvi_pico=0.41, fonte="teste"
    )
    assert no_data.inspect_talhao(-18.9543, -48.1993).soja_recente == SojaRecente(
        safra="2025/26", vista=None, ndvi_pico=None, fonte="teste"
    )


def test_should_have_no_recent_soybean_outside_the_grid_or_without_the_service() -> None:
    soja = SojaRecenteService(FakeSojaRecenteRepository(0.86))

    assert _service(soja=soja).inspect_talhao(-18.6, -47.9).soja_recente is None
    assert _service().inspect_talhao(-18.9543, -48.1993).soja_recente is None


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
