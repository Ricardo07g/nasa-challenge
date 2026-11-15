"""Chuva do IMERG no `climate_season` do PostGIS de teste (R3.4, tarefa 0027).

Repositories e banco de verdade. As temporadas e o arquivo do IMERG usam valores de teste
(1.0, 7.5 etc.) e a versão `teste-imerg`, não dado real. O `versao_dados` usa a chave de fonte
real porque a carga recusa arquivo de outra fonte.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any

import psycopg
import pytest

from app.models.climate import ClimateSeason
from app.repositories.climate_repository import PostgisClimateRepository, SeasonWindow
from pipeline.load_files_to_db import build_loader
from tests.integration.db.support import Api

pytestmark = pytest.mark.db

DAYS = 212
FARM_CELL = "-190_-482"
OTHER_CELL = "-190_-481"


def _season(cell_id: str, year: int, days: int = DAYS, source: str = "nasa_power") -> ClimateSeason:
    return ClimateSeason(
        cell_id=cell_id,
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple(1.0 for _ in range(days)),
        rain_source=source,
        tmax_c=tuple(30.0 for _ in range(days)),
        tmin_c=tuple(18.0 for _ in range(days)),
        eto_mm=tuple(4.0 for _ in range(days)),
    )


def _save(db_url: str, cell_id: str, *seasons: ClimateSeason) -> PostgisClimateRepository:
    repo = PostgisClimateRepository(db_url)
    lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))
    repo.save_cell_seasons(
        cell_id, lat=(lat_idx + 0.5) / 10, lon=(lon_idx + 0.5) / 10, seasons=list(seasons)
    )
    return repo


def _by_year(repo: PostgisClimateRepository, cell_id: str) -> dict[int, ClimateSeason]:
    return {season.year: season for season in repo.get_seasons(cell_id)}


# --- repository ---------------------------------------------------------------------------------


def test_should_list_the_window_of_every_saved_season(db_url: str) -> None:
    repo = _save(db_url, FARM_CELL, _season(FARM_CELL, 2005), _season(FARM_CELL, 2006, days=2))

    assert repo.list_season_windows() == [
        SeasonWindow(cell_id=FARM_CELL, year=2005, start_date=date(2005, 1, 1), days=212),
        SeasonWindow(cell_id=FARM_CELL, year=2006, start_date=date(2006, 1, 1), days=2),
    ]


def test_should_replace_only_the_rain_and_its_source(db_url: str) -> None:
    repo = _save(db_url, FARM_CELL, _season(FARM_CELL, 2005), _season(FARM_CELL, 2006))
    imerg = tuple(7.5 for _ in range(DAYS))

    replaced = repo.replace_seasons_rain(
        "gpm_imerg", {(FARM_CELL, 2005): imerg, (FARM_CELL, 2010): imerg}
    )

    assert replaced == 1  # 2010 não está no banco: nada é criado
    seasons = _by_year(repo, FARM_CELL)
    assert (seasons[2005].rain_mm, seasons[2005].rain_source) == (imerg, "gpm_imerg")
    assert seasons[2005].tmax_c == tuple(30.0 for _ in range(DAYS))
    assert seasons[2005].eto_mm == tuple(4.0 for _ in range(DAYS))
    assert (seasons[2006].rain_mm[0], seasons[2006].rain_source) == (1.0, "nasa_power")
    assert sorted(_by_year(repo, FARM_CELL)) == [2005, 2006]


def test_saving_the_power_season_again_should_bring_back_its_source(db_url: str) -> None:
    # Pré-carga com --forcar depois da carga do IMERG: a chuva volta a ser do POWER, e o rótulo
    # também (antes o upsert não mexia no rain_source e a chuva do POWER ficava como gpm_imerg).
    repo = _save(db_url, FARM_CELL, _season(FARM_CELL, 2005))
    repo.replace_seasons_rain("gpm_imerg", {(FARM_CELL, 2005): tuple(7.5 for _ in range(DAYS))})

    _save(db_url, FARM_CELL, _season(FARM_CELL, 2005))

    season = _by_year(repo, FARM_CELL)[2005]
    assert (season.rain_mm[0], season.rain_source) == (1.0, "nasa_power")


# --- carga do arquivo ---------------------------------------------------------------------------


def _imerg_file(tmp_path: Path, celulas: list[dict[str, Any]]) -> Path:
    path = tmp_path / "imerg.json"
    payload = {
        "versao_dados": {
            "fonte": "gpm_imerg",
            "parametros": {"produto": "GPM_3IMERGDF"},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "teste-imerg",
        },
        "celulas": celulas,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _cell(cell_id: str, seasons: dict[int, list[Any]]) -> dict[str, Any]:
    lat_idx, lon_idx = (int(part) for part in cell_id.split("_"))
    return {
        "celula": cell_id,
        "lat": (lat_idx + 0.5) / 10,
        "lon": (lon_idx + 0.5) / 10,
        "temporadas": [
            {"ano": year, "inicio": f"{year}-01-01", "chuva_mm": rain}
            for year, rain in seasons.items()
        ],
    }


def _runs(db_url: str) -> list[tuple[str, str, dict[str, Any]]]:
    with psycopg.connect(db_url) as conn:
        rows = conn.execute("SELECT source, version, params FROM data_run ORDER BY id;").fetchall()
    return [(str(source), str(version), dict(params)) for source, version, params in rows]


def test_should_load_complete_imerg_years_and_keep_power_in_the_others(
    db_url: str, tmp_path: Path
) -> None:
    repo = _save(db_url, FARM_CELL, _season(FARM_CELL, 2005), _season(FARM_CELL, 2006))
    _save(db_url, OTHER_CELL, _season(OTHER_CELL, 2005))
    complete = [7.5] * DAYS
    incomplete = [7.5] * (DAYS - 1) + [None]
    path = _imerg_file(
        tmp_path,
        [
            _cell(FARM_CELL, {2005: complete, 2006: incomplete}),
            _cell(OTHER_CELL, {2005: complete, 2006: complete}),  # 2006 não está no banco
        ],
    )
    loader = build_loader(db_url)

    plan = loader.plan(imerg_path=path)
    loader.run(plan)

    farm = _by_year(repo, FARM_CELL)
    assert (farm[2005].rain_mm[0], farm[2005].rain_source) == (7.5, "gpm_imerg")
    assert (farm[2006].rain_mm[-1], farm[2006].rain_source) == (1.0, "nasa_power")
    assert _by_year(repo, OTHER_CELL)[2005].rain_source == "gpm_imerg"
    assert sorted(_by_year(repo, OTHER_CELL)) == [2005]
    [(source, version, params)] = _runs(db_url)
    assert (source, version) == ("gpm_imerg", "teste-imerg")
    assert params["temporadas_trocadas"] == 2
    assert params["temporadas_incompletas"] == 1
    assert params["temporadas_sem_clima"] == 1


def test_should_give_the_same_result_when_loaded_twice(db_url: str, tmp_path: Path) -> None:
    repo = _save(db_url, FARM_CELL, _season(FARM_CELL, 2005))
    path = _imerg_file(tmp_path, [_cell(FARM_CELL, {2005: [7.5] * DAYS})])
    loader = build_loader(db_url)

    loader.run(loader.plan(imerg_path=path))
    first = _by_year(repo, FARM_CELL)
    loader.run(loader.plan(imerg_path=path))

    assert _by_year(repo, FARM_CELL) == first
    assert [source for source, _, _ in _runs(db_url)] == ["gpm_imerg", "gpm_imerg"]


# --- na API -------------------------------------------------------------------------------------

UFU = {"lat": -18.9543, "lon": -48.1993}  # dentro da célula -190_-482


def test_api_should_show_the_imerg_rain_after_the_load(
    api: Api, db_url: str, tmp_path: Path
) -> None:
    years = range(2005, 2025)
    _save(db_url, FARM_CELL, *(_season(FARM_CELL, year) for year in years))
    before = api.client.get("/api/talhao", params=UFU).json()
    path = _imerg_file(tmp_path, [_cell(FARM_CELL, {year: [7.5] * DAYS for year in years})])
    loader = build_loader(db_url)
    loader.run(loader.plan(imerg_path=path))

    talhao = api.client.get("/api/talhao", params=UFU).json()
    rec = api.client.get("/api/recomendacao", params={**UFU, "colheita": "meio"}).json()

    def sources(body: dict[str, Any]) -> list[tuple[str, str]]:
        return [(dado["fonte"], dado["periodo"]) for dado in body["dados"]]

    assert sources(before) == [("nasa_power", "2005-2024")]
    assert sources(talhao) == [("nasa_power", "2005-2024"), ("gpm_imerg", "2005-2024")]
    porque = [frase for opcao in rec["opcoes"] for frase in opcao["porque"]]
    assert any("(GPM IMERG + NASA POWER)" in frase for frase in porque)
