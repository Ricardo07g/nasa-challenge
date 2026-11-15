"""SMAP recente no sinal para o outono (A2.2): o arquivo do SMAP_RECENTE_PATH chega ao `sinal`.

A API é montada pelo `dependencies.py` de verdade, sem banco, com o clima da fazenda de exemplo e o
arquivo do SMAP recente do `SMAP_RECENTE_PATH`. A chuva recente (IMERG, A2.3) ainda não existe: um
repository falso faz o papel dela. Percentil, chuva e versão são de teste, não dado real.
"""

import json
from collections.abc import Callable, Iterator
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import dependencies
from app.config import Settings
from app.main import app
from app.models.sinal_outono import RecentRain

UFU = {"lat": -18.9543, "lon": -48.1993}


def _write_recent_file(path: Path, pctl: float) -> Path:
    serie = [{"data": "2026-11-10", "sm_rootzone_wetness": 0.4, "sm_rootzone_m3_m3": 0.2}]
    payload = {
        "versao_dados": {"fonte": "smap", "parametros": {"modo": "recente", "data": "2026-11-10"},
                         "fim": "2026-11-14T13:00:00Z", "versao": "teste-smap-recente"},
        "pontos": [{"lat": -18.95, "lon": -48.15, "sm_rootzone_pctl": pctl, "serie": serie}],
    }  # fmt: skip
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


class FakeRecentRainRepository:
    """Chuva de teste dos últimos 30 dias: 40% da média (abaixo dos 60% do PRD 7.10)."""

    def get_recent_rain(self, lat: float, lon: float) -> RecentRain | None:
        return RecentRain(chuva_mm=40.0, media_mm=100.0, dias=30, data=date(2026, 11, 12))


def _clear_caches() -> None:
    for factory in (
        dependencies.get_climate_repository,
        dependencies.get_soil_repository,
        dependencies.get_crop_params_repository,
        dependencies.get_ndvi_repository,
        dependencies.get_rules_repository,
        dependencies.get_smap_repository,
        dependencies.get_recent_soil_moisture_repository,
    ):
        factory.cache_clear()


@pytest.fixture
def api_with_recent_smap(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[[Path], TestClient]]:
    def _build(recent_path: Path) -> TestClient:
        settings = Settings(
            _env_file=None,
            database_url=None,
            solo_cache_path=None,
            ndvi_cache_path=None,
            cmip6_path=None,
            smap_path=None,
            smap_recente_path=recent_path,
            clima_path=Settings.model_fields["clima_path"].default,
            culturas_path=Settings.model_fields["culturas_path"].default,
            regras_path=Settings.model_fields["regras_path"].default,
        )
        monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
        _clear_caches()
        app.dependency_overrides[dependencies.get_recent_rain_repository] = FakeRecentRainRepository
        return TestClient(app)

    yield _build
    app.dependency_overrides.clear()
    _clear_caches()


def test_should_use_the_recent_smap_percentile_in_the_autumn_signal(
    api_with_recent_smap: Callable[[Path], TestClient], tmp_path: Path
) -> None:
    client = api_with_recent_smap(_write_recent_file(tmp_path / "smap_recente.json", 12.5))

    sinal = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()["sinal"]

    # Percentil 12 (< 20) e 40% da chuva média (< 60%): terra seca agora (PRD 7.10).
    assert sinal["nivel"] == "seco"
    assert sinal["fonte"] == ["SMAP", "GPM IMERG"]
    assert "percentil 12 (SMAP)" in sinal["motivo"]
    assert sinal["data"] == "2026-11-12"
