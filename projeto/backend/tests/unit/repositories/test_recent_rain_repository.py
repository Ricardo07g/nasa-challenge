"""Chuva recente do arquivo do contrato (IMERG Late, A2.3), lida pela célula de 0,1° do ponto."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.models.sinal_outono import RecentRain
from app.repositories.recent_rain_repository import FileRecentRainRepository
from app.repositories.sinal_outono_repository import RecentRainRepository

UFU = (-18.9543, -48.1993)  # célula -190_-482


def _cell(cell_id: str, lat: float, lon: float, **overrides: Any) -> dict[str, Any]:
    # Valores de teste (não são do IMERG).
    item = {
        "cell_id": cell_id, "lat": lat, "lon": lon, "data": "2027-02-28", "dias": 30,
        "chuva_30d_mm": 90.0, "media_30d_mm": 200.0, "fracao_da_media": 0.45, "anos_media": 20,
    }  # fmt: skip
    item.update(overrides)
    return item


def _write(path: Path, cells: list[dict[str, Any]], fonte: str = "imerg_late") -> Path:
    payload = {
        "versao_dados": {"fonte": fonte, "parametros": {"produto": "GPM_3IMERGDL.07"},
                         "fim": "2027-03-01T12:00:00Z", "versao": "2027.03-teste"},
        "celulas": cells,
    }  # fmt: skip
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_give_the_recent_rain_of_the_cell_of_the_point(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "chuva.json",
        [_cell("-191_-482", -19.05, -48.15, chuva_30d_mm=10.0, fracao_da_media=0.05),
         _cell("-190_-482", -18.95, -48.15)],
    )  # fmt: skip
    repo: RecentRainRepository = FileRecentRainRepository(path)

    assert repo.get_recent_rain(*UFU) == RecentRain(
        chuva_mm=90.0, media_mm=200.0, dias=30, data=date(2027, 2, 28)
    )


def test_should_have_no_recent_rain_for_a_cell_that_is_not_in_the_file(tmp_path: Path) -> None:
    # Nunca a chuva da célula vizinha: sem a célula, sem o dado (o sinal segue sem a terra).
    path = _write(tmp_path / "chuva.json", [_cell("-191_-482", -19.05, -48.15)])

    assert FileRecentRainRepository(path).get_recent_rain(*UFU) is None


@pytest.mark.parametrize("path", [None, Path("nao_existe.json")])
def test_should_have_no_recent_rain_without_the_file(path: Path | None) -> None:
    assert FileRecentRainRepository(path).get_recent_rain(*UFU) is None


def test_should_refuse_a_file_from_another_source(tmp_path: Path) -> None:
    # Apontar a variável para o arquivo errado (ex.: o do NDVI) não pode virar chuva.
    path = _write(tmp_path / "chuva.json", [_cell("-190_-482", -18.95, -48.15)], fonte="smap")

    with pytest.raises(ValueError, match="imerg_late"):
        FileRecentRainRepository(path).get_recent_rain(*UFU)


def test_should_refuse_a_cell_outside_the_contract(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "chuva.json", [_cell("-190_-482", -18.95, -48.15, chuva_30d_mm=-9999.9)]
    )

    with pytest.raises(ValueError, match="chuva_30d_mm"):
        FileRecentRainRepository(path).get_recent_rain(*UFU)
