"""Unit tests for FileCmip6Repository: deltas do NEX-GDDP-CMIP6 lidos do arquivo do contrato.

O arquivo é o que o `pipeline/fetch_cmip6_deltas.py` grava ("Contrato dos dados das fontes", CMIP6).
Os valores e o modelo `MODELO-TESTE` são de teste, não dado real.
"""

import json
from pathlib import Path

import pytest

from app.repositories.cmip6_repository import FileCmip6Repository

# Célula do POWER (0,5° × 0,625°) da Fazenda do Glória (UFU) e a de baixo dela.
UFU_POWER_CELL = {"lat_min": -19.25, "lat_max": -18.75, "lon_min": -48.4375, "lon_max": -47.8125}
SOUTH_POWER_CELL = {"lat_min": -19.75, "lat_max": -19.25, "lon_min": -48.4375, "lon_max": -47.8125}
# Célula de 0,1° da fazenda (centro -18,95 / -48,15), dentro da célula do POWER da UFU.
UFU_CELL_ID = "-190_-482"


def _delta(mes: int, chuva_pct: float, tmax_c: float, tmin_c: float | None = 1.0) -> dict:
    item = {
        "modelo": "MODELO-TESTE",
        "cenario": "ssp245",
        "mes": mes,
        "chuva_pct": chuva_pct,
        "tmax_c": tmax_c,
    }
    if tmin_c is not None:
        item["tmin_c"] = tmin_c
    return item


def _point(lat: float, lon: float, cobertura: dict, cmip6: list[dict]) -> dict:
    return {"lat": lat, "lon": lon, "cobertura": cobertura, "cmip6": cmip6}


def _write(path: Path, pontos: list[dict]) -> Path:
    payload = {
        "versao_dados": {
            "fonte": "nex_gddp_cmip6",
            "parametros": {"cenario": "ssp245"},
            "fim": "2026-11-14T13:00:00Z",
            "versao": "2026.11-teste",
        },
        "pontos": pontos,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_deltas_of_the_point_whose_coverage_contains_the_cell_center(
    tmp_path: Path,
) -> None:
    path = _write(
        tmp_path / "cmip6.json",
        [
            _point(-19.0, -48.125, UFU_POWER_CELL, [_delta(2, -10.0, 2.0, 1.0)]),
            _point(-19.5, -48.125, SOUTH_POWER_CELL, [_delta(2, 20.0, 3.0, 2.0)]),
        ],
    )

    [delta] = FileCmip6Repository(path).get_cmip6_deltas(UFU_CELL_ID)

    assert (delta.model, delta.scenario, delta.month) == ("MODELO-TESTE", "ssp245", 2)
    assert (delta.rain_pct, delta.tmax_c, delta.tmin_c) == (-10.0, 2.0, 1.0)


def test_should_read_every_month_and_model_of_the_covering_point(tmp_path: Path) -> None:
    other_model = {**_delta(3, 5.0, 1.0), "modelo": "OUTRO-MODELO-TESTE"}
    path = _write(
        tmp_path / "cmip6.json",
        [_point(-19.0, -48.125, UFU_POWER_CELL, [_delta(2, -10.0, 2.0), other_model])],
    )

    deltas = FileCmip6Repository(path).get_cmip6_deltas(UFU_CELL_ID)

    assert [(d.model, d.month) for d in deltas] == [
        ("MODELO-TESTE", 2),
        ("OUTRO-MODELO-TESTE", 3),
    ]


def test_should_return_no_deltas_when_no_coverage_contains_the_cell(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "cmip6.json",
        [_point(-19.0, -48.125, UFU_POWER_CELL, [_delta(2, -10.0, 2.0)])],
    )

    # Uberaba (-19,75 / -47,93) e São Paulo: fora da célula do POWER que o arquivo cobre.
    assert FileCmip6Repository(path).get_cmip6_deltas("-198_-480") == []
    assert FileCmip6Repository(path).get_cmip6_deltas("-236_-467") == []


def test_should_use_the_power_cell_rule_lower_edge_in_and_upper_edge_out(tmp_path: Path) -> None:
    # Como no FixtureClimateRepository: lat_min <= lat < lat_max (o mesmo para a longitude).
    path = _write(
        tmp_path / "cmip6.json",
        [_point(-19.0, -48.125, UFU_POWER_CELL, [_delta(2, -10.0, 2.0)])],
    )
    repo = FileCmip6Repository(path)

    assert repo.get_cmip6_deltas("-193_-482") != []  # centro -19,25: na borda de baixo
    assert repo.get_cmip6_deltas("-188_-482") == []  # centro -18,75: na borda de cima


def test_should_leave_tmin_empty_when_the_file_has_no_tmin(tmp_path: Path) -> None:
    null_tmin = {**_delta(3, 5.0, 1.0), "tmin_c": None}
    path = _write(
        tmp_path / "cmip6.json",
        [_point(-19.0, -48.125, UFU_POWER_CELL, [_delta(2, -10.0, 2.0, tmin_c=None), null_tmin])],
    )

    deltas = FileCmip6Repository(path).get_cmip6_deltas(UFU_CELL_ID)

    assert [d.tmin_c for d in deltas] == [None, None]


@pytest.mark.parametrize("path", [None, Path("nao-existe/cmip6.json")])
def test_should_return_no_deltas_without_the_file(path: Path | None) -> None:
    assert FileCmip6Repository(path).get_cmip6_deltas(UFU_CELL_ID) == []


def test_should_return_no_deltas_for_a_malformed_cell_id(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "cmip6.json",
        [_point(-19.0, -48.125, UFU_POWER_CELL, [_delta(2, -10.0, 2.0)])],
    )

    assert FileCmip6Repository(path).get_cmip6_deltas("celula-invalida") == []


def test_should_refuse_a_delta_outside_the_contract(tmp_path: Path) -> None:
    # O model valida: chuva caindo mais de 100% não existe.
    path = _write(
        tmp_path / "cmip6.json",
        [_point(-19.0, -48.125, UFU_POWER_CELL, [_delta(2, -150.0, 2.0)])],
    )

    with pytest.raises(ValueError, match="rain_pct"):
        FileCmip6Repository(path).get_cmip6_deltas(UFU_CELL_ID)
