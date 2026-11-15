"""SMAP recente no sinal para o outono (A2.2; tarefa 0038): a linha do SMAP de agora no `sinal`.

A API é montada pelo `dependencies.py` de verdade, sem banco, com o clima da fazenda de exemplo, o
arquivo do SMAP recente (`SMAP_RECENTE_PATH`) e o da previsão do ENSO (`ENSO_PREVISAO_PATH`).
Desde a tarefa 0038 o SMAP só informa: sem a previsão do ENSO, o `sinal` sai nulo. Percentil,
chances e versões são de teste, não dado real.
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


def _write_forecast_file(path: Path) -> Path:
    # Previsão de teste para fevereiro a abril do próximo ano (não é da NOAA)
    season = {"estacao": "FMA", "ano": date.today().year + 1, "la_nina": 10, "neutro": 20,
              "el_nino": 70}  # fmt: skip
    payload = {
        "versao_dados": {"fonte": "noaa_cpc_enso", "parametros": {}, "fim": "2026-11-15T03:00:00Z",
                         "versao": "teste-enso-previsao"},
        "fonte": "Fonte de teste",
        "emitida_em": "2026-11-14",
        "estacoes": [season],
    }  # fmt: skip
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _clear_caches() -> None:
    for factory in (
        dependencies.get_climate_repository,
        dependencies.get_soil_repository,
        dependencies.get_crop_params_repository,
        dependencies.get_ndvi_repository,
        dependencies.get_rules_repository,
        dependencies.get_smap_repository,
        dependencies.get_recent_soil_moisture_repository,
        dependencies.get_enso_repository,
        dependencies.get_enso_forecast_repository,
    ):
        factory.cache_clear()


@pytest.fixture
def api_with_recent_smap(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Callable[[Path, Path | None], TestClient]]:
    def _build(recent_path: Path, forecast_path: Path | None) -> TestClient:
        settings = Settings(
            _env_file=None,
            database_url=None,
            solo_cache_path=None,
            ndvi_cache_path=None,
            cmip6_path=None,
            oni_path=None,
            smap_path=None,
            smap_recente_path=recent_path,
            enso_previsao_path=forecast_path,
            clima_path=Settings.model_fields["clima_path"].default,
            culturas_path=Settings.model_fields["culturas_path"].default,
            regras_path=Settings.model_fields["regras_path"].default,
        )
        monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
        _clear_caches()
        return TestClient(app)

    yield _build
    app.dependency_overrides.clear()
    _clear_caches()


def test_should_show_the_recent_smap_percentile_in_the_autumn_signal(
    api_with_recent_smap: Callable[[Path, Path | None], TestClient], tmp_path: Path
) -> None:
    client = api_with_recent_smap(
        _write_recent_file(tmp_path / "smap_recente.json", 12.5),
        _write_forecast_file(tmp_path / "enso_previsao.json"),
    )

    sinal = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()["sinal"]

    assert sinal["smap_agora"] == {
        "percentil": 12,
        "data": "2026-11-10",
        "texto": "Sua terra está mais seca que o normal agora (SMAP, percentil 12, 10/11/2026).",
    }
    assert sinal["fonte"][0] == "Fonte de teste"
    assert sinal["fonte"][-1] == "SMAP"
    # Sem o arquivo do ONI, não há como comparar os anos: o SMAP seco não decide o plano
    assert sinal["nivel"] == "incerto"
    assert sinal["data"] == "2026-11-14"


def test_should_not_turn_the_signal_on_with_the_recent_smap_alone(
    api_with_recent_smap: Callable[[Path, Path | None], TestClient], tmp_path: Path
) -> None:
    client = api_with_recent_smap(_write_recent_file(tmp_path / "smap_recente.json", 12.5), None)

    body = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert body["sinal"] is None
