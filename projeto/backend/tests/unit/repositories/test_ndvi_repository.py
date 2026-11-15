"""Unit tests for CachedNdviRepository (contrato do NDVI no AGENTS.md do backend).

Os valores são de teste, não do MODIS: por isso o `versao_dados` não usa a chave `modis_mod13q1`.
"""

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from app.models.data_run import DataRun
from app.models.talhao import NdviRecord
from app.repositories.ndvi_grid_repository import GridNdviRepository
from app.repositories.ndvi_repository import (
    CachedNdviRepository,
    LayeredNdviRepository,
    NdviPointSeries,
)
from tests.ndvi_grid_fakes import FakeTile, pixel_center, write_ndvi_grid

UFU = (-18.9543, -48.1993)
TEST_RUN = {"fonte": "teste", "parametros": {}, "fim": "2026-11-14T13:00:00Z", "versao": "teste"}


def _write(tmp_path: Path, payload: dict[str, Any]) -> Path:
    path = tmp_path / "ndvi.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _old_cache(tmp_path: Path) -> Path:
    serie = [{"data": "2016-04-06", "ndvi": 7100}, {"data": "2016-04-22", "ndvi": 6800}]
    return _write(tmp_path, {"pontos": [{"lat": UFU[0], "lon": UFU[1], "serie": serie}]})


def _new_file(tmp_path: Path, pontos: list[dict[str, Any]]) -> Path:
    return _write(tmp_path, {"versao_dados": TEST_RUN, "pontos": pontos})


def _ponto(lat: float, lon: float, serie: list[dict[str, Any]]) -> dict[str, Any]:
    return {"lat": lat, "lon": lon, "serie": serie}


def test_should_return_series_when_point_is_in_cache(tmp_path: Path) -> None:
    repo = CachedNdviRepository(_old_cache(tmp_path))

    serie = repo.get_ndvi_history(*UFU)

    assert serie == [
        NdviRecord(data=date(2016, 4, 6), ndvi=7100.0),
        NdviRecord(data=date(2016, 4, 22), ndvi=6800.0),
    ]


def test_should_return_empty_series_for_other_points(tmp_path: Path) -> None:
    repo = CachedNdviRepository(_old_cache(tmp_path))
    repo.get_ndvi_history(*UFU)

    assert repo.get_ndvi_history(-19.50, -48.60) == []


def test_should_return_empty_series_when_no_cache_configured() -> None:
    assert CachedNdviRepository(None).get_ndvi_history(*UFU) == []


def test_should_read_quality_and_product_from_the_new_file(tmp_path: Path) -> None:
    serie = [
        {"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"},
        {"data": "2016-04-14", "ndvi": 0.69, "qualidade": 1, "produto": "MYD13Q1"},
    ]
    repo = CachedNdviRepository(_new_file(tmp_path, [_ponto(*UFU, serie)]))

    assert repo.get_ndvi_history(*UFU) == [
        NdviRecord(data=date(2016, 4, 6), ndvi=0.71, qualidade=0, produto="MOD13Q1"),
        NdviRecord(data=date(2016, 4, 14), ndvi=0.69, qualidade=1, produto="MYD13Q1"),
    ]


def test_should_drop_snow_cloud_and_empty_observations(tmp_path: Path) -> None:
    # Qualidade 2 (neve) e 3 (nuvem) não entram; NDVI ausente ou null é "sem valor" (contrato).
    serie = [
        {"data": "2016-04-06", "ndvi": 0.31, "qualidade": 0, "produto": "MOD13Q1"},
        {"data": "2016-04-14", "ndvi": 0.88, "qualidade": 3, "produto": "MYD13Q1"},
        {"data": "2016-04-22", "ndvi": 0.86, "qualidade": 2, "produto": "MOD13Q1"},
        {"data": "2016-04-30", "ndvi": None, "qualidade": 0, "produto": "MYD13Q1"},
        {"data": "2016-05-08", "qualidade": 0, "produto": "MOD13Q1"},
    ]
    repo = CachedNdviRepository(_new_file(tmp_path, [_ponto(*UFU, serie)]))

    assert repo.get_ndvi_history(*UFU) == [
        NdviRecord(data=date(2016, 4, 6), ndvi=0.31, qualidade=0, produto="MOD13Q1"),
    ]


def test_should_use_the_nearest_point_within_the_declared_distance(tmp_path: Path) -> None:
    # (-18.9550, -48.1990) fica a ~85 m do ponto da lavoura e a ~180 m do outro ponto do arquivo.
    # Os três caem na mesma chave de 0,0025°: a busca é pela distância, não pela chave.
    perto = [{"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"}]
    longe = [{"data": "2016-04-06", "ndvi": 0.20, "qualidade": 0, "produto": "MOD13Q1"}]
    pontos = [_ponto(*UFU, perto), _ponto(-18.9560, -48.2005, longe)]
    repo = CachedNdviRepository(_new_file(tmp_path, pontos))

    assert [r.ndvi for r in repo.get_ndvi_history(-18.9550, -48.1990)] == [0.71]


def test_should_return_empty_series_when_nearest_point_is_too_far(tmp_path: Path) -> None:
    # ~630 m ao sul: mais longe que um pixel do MOD13Q1 (250 m). Não usa o vizinho.
    serie = [{"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"}]
    repo = CachedNdviRepository(_new_file(tmp_path, [_ponto(*UFU, serie)]))

    assert repo.get_ndvi_history(-18.9600, -48.1993) == []


def test_should_accept_a_smaller_max_distance(tmp_path: Path) -> None:
    serie = [{"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"}]
    repo = CachedNdviRepository(_new_file(tmp_path, [_ponto(*UFU, serie)]), max_distance_m=50.0)

    assert repo.get_ndvi_history(-18.9550, -48.1990) == []  # ~85 m
    assert len(repo.get_ndvi_history(*UFU)) == 1


def test_should_list_every_point_with_its_series_and_the_discarded_count(tmp_path: Path) -> None:
    # Mesma leitura do get_ndvi_history (sem neve, nuvem nem NDVI vazio), mas de todos os pontos.
    ufu = [
        {"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"},
        {"data": "2016-04-14", "ndvi": 0.88, "qualidade": 3, "produto": "MYD13Q1"},
        {"data": "2016-04-22", "ndvi": None, "qualidade": 0, "produto": "MOD13Q1"},
    ]
    other = [{"data": "2016-04-06", "ndvi": 0.20, "qualidade": 1, "produto": "MYD13Q1"}]
    pontos = [_ponto(*UFU, ufu), _ponto(-19.5, -48.6, other)]
    repo = CachedNdviRepository(_new_file(tmp_path, pontos))

    assert repo.list_point_series() == [
        NdviPointSeries(
            lat=UFU[0],
            lon=UFU[1],
            records=(NdviRecord(date(2016, 4, 6), 0.71, qualidade=0, produto="MOD13Q1"),),
            discarded=2,
        ),
        NdviPointSeries(
            lat=-19.5,
            lon=-48.6,
            records=(NdviRecord(date(2016, 4, 6), 0.20, qualidade=1, produto="MYD13Q1"),),
            discarded=0,
        ),
    ]


def test_should_list_old_cache_records_without_product_and_quality(tmp_path: Path) -> None:
    [point] = CachedNdviRepository(_old_cache(tmp_path)).list_point_series()

    assert [(r.ndvi, r.qualidade, r.produto) for r in point.records] == [
        (7100.0, None, None),
        (6800.0, None, None),
    ]


def test_should_list_no_point_without_the_file() -> None:
    assert CachedNdviRepository(None).list_point_series() == []


def test_should_read_the_data_version_of_the_ndvi_file(tmp_path: Path) -> None:
    repo = CachedNdviRepository(_new_file(tmp_path, []))

    assert repo.get_data_run() == DataRun(
        source="teste",
        params={},
        finished_at=datetime(2026, 11, 14, 13, 0, tzinfo=UTC),
        version="teste",
    )


def test_should_have_no_data_version_in_the_old_cache_or_without_file(tmp_path: Path) -> None:
    assert CachedNdviRepository(_old_cache(tmp_path)).get_data_run() is None
    assert CachedNdviRepository(None).get_data_run() is None


# --- camadas: o arquivo de pontos primeiro, depois a grade por área (tarefa 0050) ---------------

GRID_DATES = [(date(2017, 1, 1), "MOD13Q1"), (date(2017, 1, 9), "MYD13Q1")]
# 5 × 5 pixels em volta da fazenda de exemplo (pixel global 52298, 64518).
GRID_TILE = FakeTile(row=52296, col=64516, nrows=5, ncols=5)


def _grid(tmp_path: Path) -> GridNdviRepository:
    folder = tmp_path / "grade"
    return GridNdviRepository(
        write_ndvi_grid(folder, [GRID_TILE], GRID_DATES, lambda row, col, index: (5000, 0))
    )


def test_should_prefer_the_exact_point_of_the_points_file_over_the_grid(tmp_path: Path) -> None:
    serie = [{"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"}]
    points = CachedNdviRepository(_new_file(tmp_path, [_ponto(*UFU, serie)]))

    layered = LayeredNdviRepository(points, _grid(tmp_path))

    assert layered.get_ndvi_history(*UFU) == [
        NdviRecord(data=date(2016, 4, 6), ndvi=0.71, qualidade=0, produto="MOD13Q1")
    ]


def test_should_read_the_grid_where_the_points_file_has_no_point(tmp_path: Path) -> None:
    serie = [{"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"}]
    points = CachedNdviRepository(_new_file(tmp_path, [_ponto(-19.5, -48.6, serie)]))

    layered = LayeredNdviRepository(points, _grid(tmp_path))

    assert layered.get_ndvi_history(*pixel_center(52300, 64520)) == [
        NdviRecord(data=date(2017, 1, 1), ndvi=0.5, qualidade=0, produto="MOD13Q1"),
        NdviRecord(data=date(2017, 1, 9), ndvi=0.5, qualidade=0, produto="MYD13Q1"),
    ]


def test_should_return_nothing_when_no_layer_covers_the_point(tmp_path: Path) -> None:
    layered = LayeredNdviRepository(CachedNdviRepository(None), _grid(tmp_path))

    assert layered.get_ndvi_history(-15.79, -47.88) == []
