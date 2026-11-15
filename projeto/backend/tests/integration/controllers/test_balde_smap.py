"""Balde inicial pelo SMAP (R3.3): /talhao e /recomendacao com e sem o arquivo do SMAP_PATH.

A API é montada pelo `dependencies.py` de verdade, sem banco, com o clima da fazenda de exemplo e o
arquivo do SMAP do `SMAP_PATH`. A umidade é de teste (0,6 em todos os anos, versão `teste-smap`),
não dado real. Nada de rede, banco nem variável da máquina: o `Settings` é montado aqui.
"""

import json
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import dependencies
from app.config import Settings
from app.main import app

UFU = {"lat": -18.9543, "lon": -48.1993}
SMAP_DADO = {"fonte": "smap", "periodo": "2016-2025", "cenario": None, "modelos": None}


def _write_smap_file(path: Path, lat: float = -18.95, lon: float = -48.15) -> Path:
    # Ponto no centro da célula da fazenda (-190_-482); umidade de teste no 18/02 de cada ano.
    serie = [
        {"data": f"{ano}-02-18", "sm_rootzone_wetness": 0.6, "sm_rootzone_m3_m3": 0.3}
        for ano in range(2016, 2026)
    ]
    payload = {
        "versao_dados": {"fonte": "smap", "parametros": {"produto": "SPL4SMGP.008"},
                         "fim": "2026-11-14T13:00:00Z", "versao": "teste-smap"},
        "pontos": [{"lat": lat, "lon": lon, "serie": serie}],
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
    ):
        factory.cache_clear()


@pytest.fixture
def api_with_smap(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Callable[[Path | None], TestClient]]:
    def _build(smap_path: Path | None) -> TestClient:
        settings = Settings(
            _env_file=None,
            database_url=None,
            solo_cache_path=None,
            ndvi_cache_path=None,
            cmip6_path=None,
            smap_path=smap_path,
            clima_path=Settings.model_fields["clima_path"].default,
            culturas_path=Settings.model_fields["culturas_path"].default,
            regras_path=Settings.model_fields["regras_path"].default,
        )
        monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
        _clear_caches()
        return TestClient(app)

    yield _build
    _clear_caches()


def test_should_list_smap_in_talhao_when_the_file_covers_the_cell(
    api_with_smap: Callable[[Path | None], TestClient], tmp_path: Path
) -> None:
    client = api_with_smap(_write_smap_file(tmp_path / "smap.json"))

    dados = client.get("/api/talhao", params=UFU).json()["dados"]

    assert SMAP_DADO in dados


def test_should_explain_the_smap_bucket_in_every_option(
    api_with_smap: Callable[[Path | None], TestClient], tmp_path: Path
) -> None:
    client = api_with_smap(_write_smap_file(tmp_path / "smap.json"))

    body = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    # A fixture do clima vai de 2005 a 2024: o SMAP entra em 2016 a 2024.
    assert {o["porque"][1] for o in body["opcoes"]} == {
        "O balde de água começou com a umidade da terra medida pelo SMAP no dia de plantar em 9 "
        "dos 20 anos (2016 a 2024); nos outros, com 50% da água disponível."
    }


@pytest.mark.parametrize("with_file", [False, True])
def test_should_leave_smap_out_without_the_file_or_for_another_cell(
    api_with_smap: Callable[[Path | None], TestClient], tmp_path: Path, with_file: bool
) -> None:
    # Com arquivo, o único ponto é de outra célula (-191_-482): nada de SMAP vizinho.
    path = _write_smap_file(tmp_path / "smap.json", lat=-19.05) if with_file else None
    client = api_with_smap(path)

    dados = client.get("/api/talhao", params=UFU).json()["dados"]
    body = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert all(d["fonte"] != "smap" for d in dados)
    assert not any("SMAP" in frase for o in body["opcoes"] for frase in o["porque"])
