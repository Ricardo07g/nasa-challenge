"""Nota de futuro (R3.1): /talhao e /recomendacao com e sem o arquivo dos deltas do CMIP6.

A API é montada pelo `dependencies.py` de verdade, sem banco, com o clima da fazenda de exemplo e o
arquivo dos deltas do `CMIP6_PATH`. Os deltas são de teste (`MODELO-TESTE`, valores redondos), não
dado real. Nada de rede, banco nem variável da máquina: o `Settings` é montado aqui.
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
UFU_POWER_CELL = {"lat_min": -19.25, "lat_max": -18.75, "lon_min": -48.4375, "lon_max": -47.8125}
# Célula do POWER ao sul (Uberaba), que não contém a fazenda.
SOUTH_POWER_CELL = {"lat_min": -19.75, "lat_max": -19.25, "lon_min": -48.4375, "lon_max": -47.8125}
NASA_POWER = {"fonte": "nasa_power", "periodo": "2005-2024", "cenario": None, "modelos": None}


def _write_cmip6_file(path: Path, cobertura: dict, models: tuple[str, ...]) -> Path:
    # Deltas zero em todos os meses: o clima de 2041-2060 fica igual ao observado.
    cmip6 = [
        {"modelo": m, "cenario": "ssp245", "mes": mes, "chuva_pct": 0.0, "tmax_c": 0.0,
         "tmin_c": 0.0}
        for m in models
        for mes in range(1, 8)
    ]  # fmt: skip
    payload = {
        "versao_dados": {"fonte": "nex_gddp_cmip6", "parametros": {"cenario": "ssp245"},
                         "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-teste"},
        "pontos": [{"lat": -19.0, "lon": -48.125, "cobertura": cobertura, "cmip6": cmip6}],
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
def api_with_cmip6(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Callable[[Path | None], TestClient]]:
    def _build(cmip6_path: Path | None) -> TestClient:
        # Sem banco e sem caches: clima da fixture, solo padrão, sem NDVI, sem busca sob demanda.
        settings = Settings(
            _env_file=None,
            database_url=None,
            solo_cache_path=None,
            ndvi_cache_path=None,
            cmip6_path=cmip6_path,
            clima_path=Settings.model_fields["clima_path"].default,
            culturas_path=Settings.model_fields["culturas_path"].default,
            regras_path=Settings.model_fields["regras_path"].default,
        )
        monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
        _clear_caches()
        return TestClient(app)

    yield _build
    _clear_caches()


def test_should_list_cmip6_in_talhao_sources_when_the_file_covers_the_cell(
    api_with_cmip6: Callable[[Path | None], TestClient], tmp_path: Path
) -> None:
    path = _write_cmip6_file(
        tmp_path / "cmip6.json", UFU_POWER_CELL, ("MODELO-TESTE", "OUTRO-MODELO-TESTE")
    )

    body = api_with_cmip6(path).get("/api/talhao", params=UFU).json()

    assert body["dados"] == [
        NASA_POWER,
        {"fonte": "nex_gddp_cmip6", "periodo": "2041-2060", "cenario": "ssp245", "modelos": 2},
    ]


def test_should_fill_future_and_its_score_when_the_file_covers_the_cell(
    api_with_cmip6: Callable[[Path | None], TestClient], tmp_path: Path
) -> None:
    path = _write_cmip6_file(
        tmp_path / "cmip6.json", UFU_POWER_CELL, ("MODELO-TESTE", "OUTRO-MODELO-TESTE")
    )

    response = api_with_cmip6(path).get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    opcoes = response.json()["opcoes"]
    assert opcoes
    for opcao in opcoes:
        anos_bons = opcao["chuva"]["anos_bons"]
        # Delta zero: o futuro é igual ao passado em todos os modelos.
        assert opcao["futuro"] == {
            "anos_bons_media": anos_bons,
            "anos_bons_min": anos_bons,
            "anos_bons_max": anos_bons,
            "modelos": 2,
            "cenario": "ssp245",
        }
        assert opcao["notas"]["futuro"] == opcao["notas"]["seguranca"]
        assert any("NEX-GDDP-CMIP6" in frase for frase in opcao["porque"])


@pytest.mark.parametrize("cobertura", [SOUTH_POWER_CELL, None])
def test_should_leave_future_out_without_deltas_for_the_cell(
    api_with_cmip6: Callable[[Path | None], TestClient],
    tmp_path: Path,
    cobertura: dict | None,
) -> None:
    # Arquivo que só cobre outra célula do POWER, ou nenhum arquivo: futuro null, nada inventado.
    path = (
        _write_cmip6_file(tmp_path / "cmip6.json", cobertura, ("MODELO-TESTE",))
        if cobertura
        else None
    )
    client = api_with_cmip6(path)

    talhao = client.get("/api/talhao", params=UFU).json()
    rec = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    assert talhao["dados"] == [NASA_POWER]
    assert all(o["futuro"] is None for o in rec["opcoes"])
    assert all(o["notas"]["futuro"] is None for o in rec["opcoes"])
    assert not any("NEX-GDDP-CMIP6" in frase for o in rec["opcoes"] for frase in o["porque"])
