"""Unit tests da carga dos arquivos do CMIP6 e do NDVI no banco, com repositories falsos.

Os arquivos são escritos em `tmp_path` no formato do contrato ("Contrato dos dados das fontes").
Os valores, o `MODELO-TESTE` e as versões `teste-*` são de teste, não dado real. O `versao_dados`
usa a chave de fonte real porque a carga recusa arquivo de outra fonte.
"""

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.config import Settings
from app.models.climate import Cmip6Delta
from app.models.data_run import DataRun
from app.models.talhao import NdviRecord
from pipeline import load_files_to_db
from pipeline.load_files_to_db import FilesToDbLoader, LoadError, describe_plan

# Célula do POWER (0,5° × 0,625°) da Fazenda do Glória (UFU) e a de cima dela.
UFU_POWER_CELL = {"lat_min": -19.25, "lat_max": -18.75, "lon_min": -48.4375, "lon_max": -47.8125}
NORTH_POWER_CELL = {"lat_min": -18.75, "lat_max": -18.25, "lon_min": -48.4375, "lon_max": -47.8125}
FARM_CELL = "-190_-482"  # centro -18,95: dentro da UFU
LOWER_EDGE_CELL = "-193_-482"  # centro -19,25: borda de baixo da UFU, dentro
UPPER_EDGE_CELL = "-188_-482"  # centro -18,75: borda de cima da UFU, fora (é da de cima)
OUTSIDE_CELL = "-200_-500"  # centro -19,95 / -49,95: nenhum ponto do arquivo cobre
FINISHED = datetime(2026, 11, 14, 15, 30, tzinfo=UTC)


def _delta(mes: int, chuva_pct: float, tmax_c: float, modelo: str = "MODELO-TESTE") -> dict:
    return {
        "modelo": modelo,
        "cenario": "ssp245",
        "mes": mes,
        "chuva_pct": chuva_pct,
        "tmax_c": tmax_c,
        "tmin_c": 1.0,
    }


def _cmip6_file(tmp_path: Path, pontos: list[dict], fonte: str = "nex_gddp_cmip6") -> Path:
    path = tmp_path / "cmip6_deltas.json"
    payload = {
        "versao_dados": {
            "fonte": fonte,
            "parametros": {"cenario": "ssp245", "pontos": len(pontos)},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "teste-cmip6",
        },
        "pontos": pontos,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _two_power_cells(tmp_path: Path) -> Path:
    return _cmip6_file(
        tmp_path,
        [
            {
                "lat": -19.0,
                "lon": -48.125,
                "cobertura": UFU_POWER_CELL,
                "cmip6": [_delta(1, -10.0, 2.0), _delta(2, -5.0, 1.5)],
            },
            {
                "lat": -18.5,
                "lon": -48.125,
                "cobertura": NORTH_POWER_CELL,
                "cmip6": [_delta(1, 20.0, 3.0), _delta(2, 10.0, 2.5)],
            },
        ],
    )


def _obs(data: str, ndvi: Any, qualidade: Any = 0, produto: Any = "MOD13Q1") -> dict:
    item: dict[str, Any] = {"data": data, "ndvi": ndvi}
    if qualidade is not None:
        item["qualidade"] = qualidade
    if produto is not None:
        item["produto"] = produto
    return item


def _ndvi_file(
    tmp_path: Path, pontos: list[dict], fonte: str = "modis_mod13q1", with_version: bool = True
) -> Path:
    path = tmp_path / "ndvi.json"
    payload: dict[str, Any] = {"pontos": pontos}
    if with_version:
        payload["versao_dados"] = {
            "fonte": fonte,
            "parametros": {"produtos": ["MOD13Q1", "MYD13Q1"]},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "teste-ndvi",
        }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


class FakeDatabase:
    """Faz o papel do PostGIS: as células de `grid_cell` e o que a carga grava."""

    def __init__(self, cell_ids: list[str] | None = None) -> None:
        self.cell_ids = list(cell_ids or [])
        self.cmip6: dict[str, list[Cmip6Delta]] = {}
        self.ndvi: list[tuple[float, float, list[NdviRecord]]] = []
        self.runs: list[DataRun] = []

    def list_cell_ids(self) -> list[str]:
        return list(self.cell_ids)

    def save_cmip6_deltas(self, cell_id: str, deltas: list[Cmip6Delta]) -> None:
        self.cmip6[cell_id] = list(deltas)

    def save_ndvi_history(self, lat: float, lon: float, records: list[NdviRecord]) -> None:
        self.ndvi.append((lat, lon, list(records)))

    def save_run(self, run: DataRun) -> None:
        self.runs.append(run)

    def wrote_anything(self) -> bool:
        return bool(self.cmip6 or self.ndvi or self.runs)


def _loader(db: FakeDatabase) -> FilesToDbLoader:
    return FilesToDbLoader(
        grid_repo=db, cmip6_repo=db, ndvi_repo=db, run_repo=db, clock=lambda: FINISHED
    )


# --- CMIP6 → cmip6_delta ---------------------------------------------------------------------


def test_should_save_the_deltas_of_the_point_covering_each_cell_center(tmp_path: Path) -> None:
    db = FakeDatabase([FARM_CELL, LOWER_EDGE_CELL, UPPER_EDGE_CELL])
    loader = _loader(db)

    loader.run(loader.plan(cmip6_path=_two_power_cells(tmp_path)))

    ufu = [(d.month, d.rain_pct) for d in db.cmip6[FARM_CELL]]
    assert ufu == [(1, -10.0), (2, -5.0)]
    assert [(d.month, d.rain_pct) for d in db.cmip6[LOWER_EDGE_CELL]] == ufu  # borda de baixo
    assert [(d.month, d.rain_pct) for d in db.cmip6[UPPER_EDGE_CELL]] == [(1, 20.0), (2, 10.0)]


def test_should_save_nothing_for_a_cell_no_point_covers(tmp_path: Path) -> None:
    db = FakeDatabase([FARM_CELL, OUTSIDE_CELL])
    loader = _loader(db)

    plan = loader.plan(cmip6_path=_two_power_cells(tmp_path))
    loader.run(plan)

    assert set(db.cmip6) == {FARM_CELL}
    assert plan.cmip6 is not None
    assert (plan.cmip6.cells_with_deltas, plan.cmip6.cells_without_deltas) == (1, 1)
    assert plan.cmip6.rows == 2


def test_should_record_one_cmip6_run_with_the_file_version(tmp_path: Path) -> None:
    db = FakeDatabase([FARM_CELL, UPPER_EDGE_CELL, OUTSIDE_CELL])
    loader = _loader(db)

    loader.run(loader.plan(cmip6_path=_two_power_cells(tmp_path)))

    assert db.runs == [
        DataRun(
            source="nex_gddp_cmip6",
            params={
                "script": "pipeline.load_files_to_db",
                "arquivo": "cmip6_deltas.json",
                "arquivo_fim": "2026-11-14T13:00:00Z",
                "celulas_com_deltas": 2,
                "celulas_sem_deltas": 1,
                "linhas": 4,
                "parametros_do_arquivo": {"cenario": "ssp245", "pontos": 2},
            },
            finished_at=FINISHED,
            version="teste-cmip6",
        )
    ]


def test_should_not_record_a_run_when_no_cell_of_the_grid_gets_deltas(tmp_path: Path) -> None:
    db = FakeDatabase([OUTSIDE_CELL])
    loader = _loader(db)

    loader.run(loader.plan(cmip6_path=_two_power_cells(tmp_path)))

    assert not db.wrote_anything()


# --- NDVI → ndvi_point -----------------------------------------------------------------------


def test_should_save_the_series_of_every_point_of_the_ndvi_file(tmp_path: Path) -> None:
    path = _ndvi_file(
        tmp_path,
        [
            {"lat": -18.9543, "lon": -48.1993, "serie": [_obs("2016-04-06", 0.71)]},
            {"lat": -19.5, "lon": -48.6, "serie": [_obs("2016-04-14", 0.25, 1, "MYD13Q1")]},
        ],
    )
    db = FakeDatabase()
    loader = _loader(db)

    loader.run(loader.plan(ndvi_path=path))

    assert db.ndvi == [
        (-18.9543, -48.1993, [NdviRecord(date(2016, 4, 6), 0.71, 0, "MOD13Q1")]),
        (-19.5, -48.6, [NdviRecord(date(2016, 4, 14), 0.25, 1, "MYD13Q1")]),
    ]


def test_should_skip_records_the_table_cannot_take_and_count_them(tmp_path: Path) -> None:
    serie = [
        _obs("2016-04-06", 0.71),  # entra
        _obs("2016-04-14", 0.88, qualidade=3),  # nuvem
        _obs("2016-04-22", None),  # sem NDVI
        _obs("2016-04-30", 0.65, qualidade=None),  # sem qualidade (cache antigo)
        _obs("2016-05-08", 0.64, produto=None),  # sem produto (cache antigo)
        _obs("2016-05-16", 6400, qualidade=0, produto="MYD13Q1"),  # NDVI bruto, não o físico
    ]
    old_cache = [_obs("2016-04-06", 7100, qualidade=None, produto=None)]
    path = _ndvi_file(
        tmp_path,
        [
            {"lat": -18.9543, "lon": -48.1993, "serie": serie},
            {"lat": -19.5, "lon": -48.6, "serie": old_cache},
        ],
    )
    db = FakeDatabase()
    loader = _loader(db)

    plan = loader.plan(ndvi_path=path)
    loader.run(plan)

    assert db.ndvi == [(-18.9543, -48.1993, [NdviRecord(date(2016, 4, 6), 0.71, 0, "MOD13Q1")])]
    assert plan.ndvi is not None
    assert (plan.ndvi.points_total, plan.ndvi.points_with_series, plan.ndvi.rows) == (2, 1, 1)
    assert (plan.ndvi.skipped_unreadable, plan.ndvi.skipped_out_of_table) == (2, 4)
    assert plan.ndvi.skipped == 6


def test_should_record_one_ndvi_run_with_the_file_version(tmp_path: Path) -> None:
    serie = [_obs("2016-04-06", 0.71), _obs("2016-04-14", 0.88, qualidade=3)]
    path = _ndvi_file(tmp_path, [{"lat": -18.9543, "lon": -48.1993, "serie": serie}])
    db = FakeDatabase()
    loader = _loader(db)

    loader.run(loader.plan(ndvi_path=path))

    assert db.runs == [
        DataRun(
            source="modis_mod13q1",
            params={
                "script": "pipeline.load_files_to_db",
                "arquivo": "ndvi.json",
                "arquivo_fim": "2026-11-14T13:00:00Z",
                "pontos": 1,
                "pontos_gravados": 1,
                "linhas": 1,
                "registros_pulados": 1,
                "parametros_do_arquivo": {"produtos": ["MOD13Q1", "MYD13Q1"]},
            },
            finished_at=FINISHED,
            version="teste-ndvi",
        )
    ]


def test_should_load_both_files_and_record_one_run_per_source(tmp_path: Path) -> None:
    ndvi = _ndvi_file(
        tmp_path, [{"lat": -18.9543, "lon": -48.1993, "serie": [_obs("2016-04-06", 0.7)]}]
    )
    db = FakeDatabase([FARM_CELL])
    loader = _loader(db)

    loader.run(loader.plan(cmip6_path=_two_power_cells(tmp_path), ndvi_path=ndvi))

    assert [run.source for run in db.runs] == ["nex_gddp_cmip6", "modis_mod13q1"]
    assert set(db.cmip6) == {FARM_CELL}
    assert len(db.ndvi) == 1


# --- Arquivos recusados: nada é gravado ------------------------------------------------------


def test_should_refuse_a_missing_file(tmp_path: Path) -> None:
    with pytest.raises(LoadError, match="não encontrado"):
        _loader(FakeDatabase([FARM_CELL])).plan(cmip6_path=tmp_path / "nao-existe.json")


def test_should_refuse_a_file_without_versao_dados(tmp_path: Path) -> None:
    path = _ndvi_file(tmp_path, [], with_version=False)

    with pytest.raises(LoadError, match="versao_dados"):
        _loader(FakeDatabase()).plan(ndvi_path=path)


@pytest.mark.parametrize("fonte", ["teste", "modis_mod13q1"])
def test_should_refuse_a_cmip6_file_of_another_source(tmp_path: Path, fonte: str) -> None:
    path = _cmip6_file(tmp_path, [], fonte=fonte)

    with pytest.raises(LoadError, match="nex_gddp_cmip6"):
        _loader(FakeDatabase([FARM_CELL])).plan(cmip6_path=path)


def test_should_refuse_an_ndvi_file_of_another_source(tmp_path: Path) -> None:
    path = _ndvi_file(tmp_path, [], fonte="teste")

    with pytest.raises(LoadError, match="modis_mod13q1"):
        _loader(FakeDatabase()).plan(ndvi_path=path)


def test_should_refuse_a_file_outside_the_contract_before_writing_anything(
    tmp_path: Path,
) -> None:
    # O NDVI está certo, mas o CMIP6 tem chuva caindo mais de 100%: nada entra no banco.
    bad = _cmip6_file(
        tmp_path,
        [
            {
                "lat": -19.0,
                "lon": -48.125,
                "cobertura": UFU_POWER_CELL,
                "cmip6": [_delta(1, -150, 2)],
            }
        ],
    )
    ndvi = _ndvi_file(
        tmp_path, [{"lat": -18.9543, "lon": -48.1993, "serie": [_obs("2016-04-06", 0.7)]}]
    )
    db = FakeDatabase([FARM_CELL])

    with pytest.raises(LoadError, match="fora do contrato"):
        _loader(db).plan(cmip6_path=bad, ndvi_path=ndvi)

    assert not db.wrote_anything()


def test_should_only_read_when_planning(tmp_path: Path) -> None:
    db = FakeDatabase([FARM_CELL])

    _loader(db).plan(cmip6_path=_two_power_cells(tmp_path))

    assert not db.wrote_anything()


# --- Resumo e linha de comando ---------------------------------------------------------------


def test_should_describe_cells_points_rows_and_skipped_records(tmp_path: Path) -> None:
    serie = [_obs("2016-04-06", 0.71), _obs("2016-04-14", 0.88, qualidade=3)]
    ndvi = _ndvi_file(tmp_path, [{"lat": -18.9543, "lon": -48.1993, "serie": serie}])
    loader = _loader(FakeDatabase([FARM_CELL, OUTSIDE_CELL]))

    text = describe_plan(loader.plan(cmip6_path=_two_power_cells(tmp_path), ndvi_path=ndvi))

    assert "2 células no banco: 1 com deltas, 1 sem deltas" in text
    assert "2 linhas em cmip6_delta" in text
    assert "1 pontos no arquivo, 1 com série" in text
    assert "1 linhas em ndvi_point" in text
    assert "1 registros pulados" in text
    assert "teste-cmip6" in text and "teste-ndvi" in text


def _settings(database_url: str | None) -> Settings:
    return Settings(_env_file=None, database_url=database_url)


def test_main_should_need_at_least_one_file(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(load_files_to_db, "get_settings", lambda: _settings(None))

    with pytest.raises(SystemExit) as exc:
        load_files_to_db.main(["--dry-run"])

    assert exc.value.code == 2


def test_main_should_need_database_url_to_load(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(load_files_to_db, "get_settings", lambda: _settings(None))

    code = load_files_to_db.main(["--cmip6", str(_two_power_cells(tmp_path))])

    assert code == 2
    assert "DATABASE_URL" in capsys.readouterr().err


def test_main_dry_run_without_database_should_read_the_files_and_write_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(load_files_to_db, "get_settings", lambda: _settings(None))
    ndvi = _ndvi_file(
        tmp_path, [{"lat": -18.9543, "lon": -48.1993, "serie": [_obs("2016-04-06", 0.7)]}]
    )

    code = load_files_to_db.main(
        ["--cmip6", str(_two_power_cells(tmp_path)), "--ndvi", str(ndvi), "--dry-run"]
    )

    out = capsys.readouterr().out
    assert code == 0
    assert "0 células no banco" in out
    assert "1 linhas em ndvi_point" in out
    assert "--dry-run: nada foi gravado." in out


def test_main_should_load_through_the_built_loader(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    db = FakeDatabase([FARM_CELL])
    monkeypatch.setattr(load_files_to_db, "get_settings", lambda: _settings("postgresql://teste"))
    monkeypatch.setattr(load_files_to_db, "build_loader", lambda url: _loader(db))

    code = load_files_to_db.main(["--cmip6", str(_two_power_cells(tmp_path))])

    assert code == 0
    assert set(db.cmip6) == {FARM_CELL}
    assert [run.source for run in db.runs] == ["nex_gddp_cmip6"]
    assert "2 linhas em cmip6_delta" in capsys.readouterr().out


def test_main_should_report_a_refused_file_and_write_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    db = FakeDatabase([FARM_CELL])
    monkeypatch.setattr(load_files_to_db, "get_settings", lambda: _settings("postgresql://teste"))
    monkeypatch.setattr(load_files_to_db, "build_loader", lambda url: _loader(db))

    code = load_files_to_db.main(["--ndvi", str(tmp_path / "nao-existe.json")])

    assert code == 1
    assert "nada foi gravado" in capsys.readouterr().err.lower()
    assert not db.wrote_anything()
