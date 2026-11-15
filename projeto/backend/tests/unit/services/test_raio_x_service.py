"""O raio-X do ponto marcado junta os blocos, os alertas e os cartões (tela 4, tarefa 0043).

Repositories e motor falsos, com valores de teste redondos (não são de nenhuma fonte real). As
contas de cada bloco têm teste próprio; aqui fica a montagem: o que entra, de onde vem e o que
some sem dado.
"""

from datetime import date
from types import SimpleNamespace

import pytest

from app.models.area_queimada import PixelQueimado, QueimadasPerto
from app.models.climate import CellRainTotal, ClimateSeason, Cmip6Delta
from app.models.crop_option import CropParams
from app.models.raio_x import SoloVizinho
from app.models.sinal_outono import RecentSoilMoisture
from app.models.soja_recente import SojaRecente
from app.models.talhao import NdviRecord, SoloInfo
from app.repositories.soil_repository import DEFAULT_SOIL
from app.services.burned_area_service import BurnedAreaService
from app.services.errors import OutsideAreaError
from app.services.raio_x_service import RaioXService

LAT, LON = -18.9543, -48.1993
CELL = "-190_-482"
DAYS = 212

ARGILOSO = SoloInfo(
    argila_percentual=46.0,
    areia_percentual=32.0,
    textura_solo="argiloso",
    cad_capacidade_agua_mm=60.0,
    fonte="soilgrids",
)


def _season(year: int) -> ClimateSeason:
    return ClimateSeason(
        cell_id=CELL,
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple([4.0] * DAYS),
        rain_source="teste",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
        eto_mm=tuple([4.0] * DAYS),
    )


class FakeClimate:
    def __init__(self, deltas: list[Cmip6Delta] | None = None) -> None:
        self._deltas = deltas or []

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return CELL

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return [_season(year) for year in range(2005, 2025)]

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        return list(self._deltas)


class FakeSoil:
    def __init__(self, soil: SoloInfo = ARGILOSO) -> None:
        self._soil = soil

    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return self._soil


class FakeNearestSoil:
    def __init__(self, near: SoloVizinho | None) -> None:
        self._near = near

    def get_nearest_soil(self, lat: float, lon: float) -> SoloVizinho | None:
        return self._near


class FakeNdvi:
    def __init__(self, records: list[NdviRecord] | None = None) -> None:
        self._records = records or []

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        return list(self._records)


MILHO = CropParams(
    id="milho_safrinha",
    nome="Milho sozinho",
    tipo="grao",
    funcao="Grão",
    semeadura_limite_mes_dia="02-28",
    dias_florescer=60,
    ciclo_dias=120,
    kc_pico=1.25,
    solo_palhada=20,
    solo_nitrogenio=0,
    solo_pragas=0,
    n_deixado_kg=0,
)


class FakeCrops:
    def list_all(self) -> list[CropParams]:
        return [MILHO]

    def get_by_id(self, crop_id: str) -> CropParams | None:
        return MILHO if crop_id == MILHO.id else None


class FakeRecommender:
    """O motor falso: a melhor opção é o milho, deu certo em 16 de 20 anos."""

    def __init__(self, outside: bool = False) -> None:
        self.outside = outside
        self.calls: list[dict[str, object]] = []

    def recommend(self, **kwargs: object) -> SimpleNamespace:
        self.calls.append(kwargs)
        if self.outside:
            raise OutsideAreaError("fora")
        option = SimpleNamespace(
            id="milho_safrinha", nome="Milho sozinho", anos_bons_chuva=16, total_anos=20
        )
        return SimpleNamespace(
            celula_id=CELL, semeadura=date(2027, 2, 18), melhor="milho_safrinha", opcoes=(option,)
        )


class FakeRecentSmap:
    def __init__(self, value: RecentSoilMoisture | None) -> None:
        self._value = value

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        return self._value


class FakeRegionRain:
    def rain_totals_in_window(
        self, inicio: str, fim: str, box: tuple[float, float, float, float]
    ) -> list[CellRainTotal]:
        self.asked = (inicio, fim, box)
        rows = [CellRainTotal(CELL, 2023, 300.0, 92, "teste")]
        rows += [CellRainTotal(f"-19{i}_-480", 2023, 400.0, 92, "teste") for i in range(10)]
        return rows


class FakeBurned:
    def get_burned_near(self, lat: float, lon: float, km: float) -> QueimadasPerto | None:
        return QueimadasPerto(2016, 2025, "MODIS MCD64A1", (PixelQueimado(LAT, LON, (2019,)),))


def _service(**overrides: object) -> RaioXService:
    deps: dict[str, object] = {
        "climate_repo": FakeClimate(),
        "soil_repo": FakeSoil(),
        "ndvi_repo": FakeNdvi(),
        "crop_repo": FakeCrops(),
        "recommender": FakeRecommender(),
        "reference_eto": lambda season: season.eto_mm,
        "recent_soil_moisture_repo": FakeRecentSmap(None),
    }
    deps.update(overrides)
    return RaioXService(**deps)  # type: ignore[arg-type]


def test_should_bring_the_soil_and_the_water_it_keeps_at_flowering() -> None:
    raio = _service().raio_x(LAT, LON, colheita="meio")

    assert raio.celula_id == CELL
    assert raio.solo is not None
    assert (raio.solo.textura, raio.solo.argila_pct, raio.solo.areia_pct) == ("argiloso", 46, 32)
    assert raio.solo.vizinho_km is None
    assert raio.agua is not None
    # 60 mm ÷ (4 mm × Kc 1,25 = 5 mm/dia) = 12 dias, com o milho (a melhor opção do motor)
    assert (raio.agua.cad_mm, raio.agua.dias, raio.agua.cultura) == (60.0, 12, "milho_safrinha")


def test_should_ask_the_engine_with_the_same_harvest_soil_and_seasons() -> None:
    engine = FakeRecommender()

    _service(recommender=engine).raio_x(
        LAT, LON, colheita="tarde", solo_override="arenoso", confirmadas=[(2025, "parado")]
    )

    call = engine.calls[0]
    assert (call["colheita"], call["solo_override"]) == ("tarde", "arenoso")
    assert list(call["confirmadas"]) == [(2025, "parado")]  # type: ignore[call-overload]


def test_should_use_the_texture_the_producer_chose_for_the_water_block() -> None:
    raio = _service().raio_x(LAT, LON, colheita="meio", solo_override="arenoso")

    assert raio.agua is not None
    assert raio.agua.cad_mm == 40.0  # CAD da terra arenosa (a mesma do motor)
    assert raio.solo is not None and raio.solo.textura == "argiloso"  # o mapa continua o mapa


def test_should_use_the_nearest_soil_of_a_neighbor_cell_and_say_how_far() -> None:
    near = SoloVizinho(soil=ARGILOSO, distancia_km=6.24)

    raio = _service(soil_repo=FakeSoil(DEFAULT_SOIL), nearest_soil_repo=FakeNearestSoil(near))
    result = raio.raio_x(LAT, LON, colheita="meio")

    assert result.solo is not None
    assert (result.solo.textura, result.solo.vizinho_km) == ("argiloso", 6.2)


def test_should_not_use_a_neighbor_soil_too_far_away() -> None:
    near = SoloVizinho(soil=ARGILOSO, distancia_km=20.0)

    raio = _service(soil_repo=FakeSoil(DEFAULT_SOIL), nearest_soil_repo=FakeNearestSoil(near))
    result = raio.raio_x(LAT, LON, colheita="meio")

    assert (result.solo, result.agua) == (None, None)


def test_should_leave_out_the_blocks_without_data() -> None:
    raio = _service().raio_x(LAT, LON, colheita="meio")

    assert (raio.umidade, raio.verde, raio.historico_ndvi, raio.regiao) == (None, None, None, None)
    assert (raio.alertas.geada, raio.alertas.chuva_forte, raio.alertas.fogo) == (None, None, None)
    assert raio.cartoes.clima_futuro is None
    assert raio.altitude_m is None  # o grid_cell não tem altitude


def test_should_bring_the_climate_blocks_from_the_cell_series() -> None:
    raio = _service().raio_x(LAT, LON, colheita="meio")

    assert raio.chuva is not None and raio.chuva.media_mm == 848.0  # 4 mm × 212 dias
    assert raio.veranico is None or raio.veranico.dias == 0
    assert raio.calor is not None and raio.calor.anos_com_calor == 0


def test_should_bring_the_soil_moisture_now_and_the_latest_reading_date() -> None:
    smap = FakeRecentSmap(RecentSoilMoisture(sm_rootzone_pctl=34.5, data=date(2026, 11, 10)))
    ndvi = FakeNdvi([NdviRecord(date(2026, 7, 28), 0.42, 0, "MOD13Q1")])

    raio = _service(recent_soil_moisture_repo=smap, ndvi_repo=ndvi).raio_x(LAT, LON, "meio")

    assert raio.umidade is not None
    assert (raio.umidade.percentil, raio.umidade.data) == (34.5, date(2026, 11, 10))
    assert raio.leitura_recente == date(2026, 11, 10)
    assert raio.verde is not None and raio.verde.ultimo_ndvi == 0.42
    assert raio.historico_ndvi is not None


def test_should_use_the_recent_soy_map_without_ndvi_series() -> None:
    soja = SimpleNamespace(
        check=lambda lat, lon: SojaRecente("2025/26", True, 0.88, "MODIS MOD13Q1 + MYD13Q1")
    )

    raio = _service(soja_recente_service=soja).raio_x(LAT, LON, "meio")

    assert raio.verde is not None and raio.verde.pico_ndvi == 0.88


def test_should_compare_the_cell_with_the_pilot_box() -> None:
    region = FakeRegionRain()

    raio = _service(region_rain_repo=region).raio_x(LAT, LON, "meio")

    assert raio.regiao is not None and raio.regiao.pct_mais_seca == 100
    assert region.asked == ("03-01", "05-31", (-19.9, -18.4, -49.0, -47.5))


def test_should_bring_the_fire_alert_and_the_cards() -> None:
    deltas = [Cmip6Delta("A", "ssp245", month, -10.0, 2.0) for month in (3, 4, 5)]

    raio = _service(
        burned_area_service=BurnedAreaService(FakeBurned()), climate_repo=FakeClimate(deltas)
    ).raio_x(LAT, LON, "meio")

    assert raio.alertas.fogo is not None and raio.alertas.fogo.anos == (2019,)
    assert raio.cartoes.chuva_20_anos is not None
    assert (raio.cartoes.chuva_20_anos.anos_bons, raio.cartoes.chuva_20_anos.total_anos) == (16, 20)
    assert raio.cartoes.clima_futuro is not None
    assert (raio.cartoes.clima_futuro.chuva_pct, raio.cartoes.clima_futuro.tmax_c) == (-10.0, 2.0)


def test_should_tell_when_the_point_is_outside_the_area() -> None:
    with pytest.raises(OutsideAreaError):
        _service(recommender=FakeRecommender(outside=True)).raio_x(-23.55, -46.63, "meio")
