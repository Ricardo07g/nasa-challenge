"""Unit tests for CachedNdviRepository."""

import json
from datetime import date
from pathlib import Path

from app.models.talhao import NdviRecord
from app.repositories.ndvi_repository import CachedNdviRepository


def _cache(tmp_path: Path) -> Path:
    path = tmp_path / "ndvi.json"
    serie = [{"data": "2016-04-06", "ndvi": 7100}, {"data": "2016-04-22", "ndvi": 6800}]
    payload = {"pontos": [{"lat": -18.9543, "lon": -48.1993, "serie": serie}]}
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_return_series_when_point_is_in_cache(tmp_path: Path) -> None:
    repo = CachedNdviRepository(_cache(tmp_path))

    serie = repo.get_ndvi_history(-18.9543, -48.1993)

    assert serie == [
        NdviRecord(data=date(2016, 4, 6), ndvi=7100.0),
        NdviRecord(data=date(2016, 4, 22), ndvi=6800.0),
    ]


def test_should_return_empty_series_for_other_points(tmp_path: Path) -> None:
    repo = CachedNdviRepository(_cache(tmp_path))
    repo.get_ndvi_history(-18.9543, -48.1993)

    assert repo.get_ndvi_history(-19.50, -48.60) == []


def test_should_return_empty_series_when_no_cache_configured() -> None:
    assert CachedNdviRepository(None).get_ndvi_history(-18.9543, -48.1993) == []
