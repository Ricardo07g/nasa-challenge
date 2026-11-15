"""Repositórios falsos para os testes das rotas (sem arquivo, banco ou rede)."""

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    get_climate_repository,
    get_crop_params_repository,
    get_enso_repository,
    get_ndvi_repository,
    get_recent_rain_repository,
    get_recent_soil_moisture_repository,
    get_satellite_ingestion_service,
    get_smap_repository,
    get_soil_repository,
)
from app.main import app
from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.crop_option import CropParams
from app.models.enso import OniYear
from app.models.talhao import NdviRecord, SoloInfo
from app.repositories.climate_repository import cell_id_for
from app.repositories.sinal_outono_repository import NoAutumnSignalDataRepository

DAYS = 212


def _crop(
    crop_id: str, tipo: str, limite: str | None, solo: tuple[int, int, int], **kw
) -> CropParams:
    palhada, nitrogenio, pragas = solo
    return CropParams(
        id=crop_id,
        nome=crop_id,
        tipo=tipo,
        funcao="x",
        semeadura_limite_mes_dia=limite,
        dias_florescer=60,
        ciclo_dias=100,
        kc_pico=1.0,
        solo_palhada=palhada,
        solo_nitrogenio=nitrogenio,
        solo_pragas=pragas,
        n_deixado_kg=0,
        como_fazer=("Passo 1",),
        **kw,
    )


CROPS = [
    _crop("pousio", "pousio", None, (0, 0, 0)),
    _crop(
        "milho_safrinha",
        "grao",
        "02-28",
        (20, 0, 0),
        produtividade_padrao_sc_ha=80.0,
        preco_padrao_saca=62.0,
        custo_padrao_ha=3500.0,
    ),
    _crop(
        "sorgo",
        "grao",
        "03-20",
        (20, 0, 15),
        produtividade_padrao_sc_ha=60.0,
        preco_padrao_saca=49.6,
        custo_padrao_ha=2200.0,
    ),
    _crop(
        "milho_braquiaria",
        "consorcio",
        "02-28",
        (40, 0, 10),
        produtividade_padrao_sc_ha=76.0,
        preco_padrao_saca=62.0,
        custo_padrao_ha=3800.0,
    ),
    _crop("milheto", "cobertura", "03-15", (35, 0, 20), custo_padrao_ha=600.0),
    _crop("crotalaria", "cobertura", "02-28", (25, 30, 30), custo_padrao_ha=800.0),
]


class FakeCropParamsRepository:
    def list_all(self) -> list[CropParams]:
        return list(CROPS)

    def get_by_id(self, crop_id: str) -> CropParams | None:
        return next((c for c in CROPS if c.id == crop_id), None)


class FakeClimateRepository:
    """Dados só perto de Uberlândia; 2007 e 2014 sem chuva de fevereiro a junho."""

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return cell_id_for(lat, lon) if -19.25 <= lat < -18.75 and -48.44 <= lon < -47.81 else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        seasons = []
        for year in range(2005, 2025):
            start = date(year, 1, 1)
            dry = year in (2007, 2014)
            rain = tuple(
                0.0 if dry and 2 <= (start + timedelta(days=i)).month <= 6 else 8.0
                for i in range(DAYS)
            )
            seasons.append(
                ClimateSeason(
                    cell_id=cell_id,
                    year=year,
                    start_date=start,
                    lat=-18.95,
                    rain_mm=rain,
                    rain_source="nasa_power",
                    tmax_c=tuple([30.0] * DAYS),
                    tmin_c=tuple([18.0] * DAYS),
                )
            )
        return seasons

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


def _ndvi(day: date, ndvi: float, produto: str = "MOD13Q1") -> NdviRecord:
    return NdviRecord(data=day, ndvi=ndvi, qualidade=0, produto=produto)


class FakeNdviRepository:
    """Valores de teste (não são do MODIS), de 2016 a 2025, com Terra e Aqua.

    Soja seca em 18/fev (colheita "meio"). Entressafra: anos ímpares plantou (0,71), pares parado
    (0,30); 2018 tem 1 observação só (sem_dado) e 2020 fica em 0,52 (incerto).
    """

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        records = []
        for year in range(2016, 2026):
            records += [_ndvi(date(year, 1, 17), 0.84), _ndvi(date(year, 2, 18), 0.35)]
            peak = 0.52 if year == 2020 else (0.71 if year % 2 else 0.30)
            records.append(_ndvi(date(year, 5, 9), peak))
            if year != 2018:
                records += [
                    _ndvi(date(year, 4, 7), 0.25, "MYD13Q1"),
                    _ndvi(date(year, 6, 10), 0.22, "MYD13Q1"),
                ]
        return records


class FakeEnsoRepository:
    """Valores de teste (não são da NOAA): 2007 de El Niño e 2014 de La Niña; os outros, neutros."""

    def get_oni_years(self) -> list[OniYear]:
        return [
            OniYear(2007, 0.9, "el_nino"),
            OniYear(2010, 0.1, None),
            OniYear(2014, -0.9, "la_nina"),
        ]


class FakeSmapRepository:
    """Sem SMAP por padrão (o balde começa em 50% da CAD)."""

    def __init__(self, records: list[SmapSoilMoisture] | None = None) -> None:
        self._records = records or []

    def get_cell_smap_series(self, cell_id: str) -> list[SmapSoilMoisture]:
        return list(self._records)


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides[get_crop_params_repository] = FakeCropParamsRepository
    app.dependency_overrides[get_climate_repository] = FakeClimateRepository
    app.dependency_overrides[get_soil_repository] = FakeSoilRepository
    app.dependency_overrides[get_ndvi_repository] = FakeNdviRepository
    # O arquivo do ONI da máquina (ONI_PATH) nunca entra nos testes
    app.dependency_overrides[get_enso_repository] = FakeEnsoRepository
    # Sem a chuva recente do IMERG_LATE_PATH do ambiente (o compose aponta para data/baixados).
    app.dependency_overrides[get_recent_rain_repository] = NoAutumnSignalDataRepository
    app.dependency_overrides[get_smap_repository] = FakeSmapRepository
    app.dependency_overrides[get_recent_soil_moisture_repository] = NoAutumnSignalDataRepository
    # Sem busca sob demanda: ponto sem dados fica fora da área (nada de rede real nos testes).
    app.dependency_overrides[get_satellite_ingestion_service] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()
