"""Testes do NDVI por área (RF-34, tarefa 0050): formato do ladrilho e o `GridNdviRepository`.

Valores de teste, não do MODIS. O único número real é a posição da fazenda de exemplo na grade
global do MODIS (pixel 52298, 64518, conferido num recorte da ORNL em 14/11/2026).
"""

import json
from array import array
from datetime import date
from pathlib import Path

import pytest

from app.models.talhao import NdviRecord
from app.repositories.ndvi_grid_repository import (
    NO_OBSERVATION,
    NO_QUALITY,
    GridNdviRepository,
    TileHeader,
    dates_checksum,
    encode_tile,
    index_from_json,
    read_tile_header,
)
from tests.ndvi_grid_fakes import (
    INDEX_NAME,
    FakeTile,
    index_payload,
    pixel_center,
    write_ndvi_grid,
)

FAZENDA = (-18.9543, -48.1993)
FAZENDA_PIXEL = (52298, 64518)
DATES = [
    (date(2017, 1, 1), "MOD13Q1"),
    (date(2017, 1, 9), "MYD13Q1"),
    (date(2017, 1, 17), "MOD13Q1"),
]
# 5 × 5 pixels em volta da fazenda de exemplo (ela fica no meio, linha 2 e coluna 2).
TILE = FakeTile(row=52296, col=64516, nrows=5, ncols=5)


def _value(row: int, col: int, index: int) -> tuple[int, int] | None:
    """Um valor diferente por pixel e data; a 2ª data do pixel (52297, 64517) sem observação."""
    if (row, col, index) == (52297, 64517, 1):
        return None
    return 1000 + 100 * index + 10 * (row - 52296) + (col - 64516), index % 2


def _expected(row: int, col: int) -> list[NdviRecord]:
    records = []
    for index, (day, product) in enumerate(DATES):
        item = _value(row, col, index)
        if item is not None:
            records.append(
                NdviRecord(data=day, ndvi=round(item[0] * 0.0001, 4), qualidade=item[1],
                           produto=product)
            )  # fmt: skip
    return records


# --- formato do ladrilho ------------------------------------------------------------------------


def test_should_write_a_tile_header_that_describes_the_tile(tmp_path: Path) -> None:
    path = tmp_path / "ladrilho.bin"
    layers = [array("h", [NO_OBSERVATION] * 6) for _ in DATES]
    quality = [bytes([NO_QUALITY] * 6) for _ in DATES]
    path.write_bytes(encode_tile(10, 20, 2, 3, DATES, layers, quality, rows_per_block=1))

    assert read_tile_header(path) == TileHeader(
        origin_row=10,
        origin_col=20,
        nrows=2,
        ncols=3,
        ndates=3,
        rows_per_block=1,
        dates_crc=dates_checksum(DATES),
    )
    assert read_tile_header(path).nblocks == 2


def test_should_change_the_dates_checksum_when_a_date_or_a_product_changes() -> None:
    other_product = [DATES[0], (date(2017, 1, 9), "MOD13Q1"), DATES[2]]

    assert dates_checksum(DATES) != dates_checksum(DATES[:2])
    assert dates_checksum(DATES) != dates_checksum(other_product)


def test_should_refuse_layers_that_do_not_match_the_tile() -> None:
    short = [array("h", [0] * 5) for _ in DATES]
    quality = [bytes(6) for _ in DATES]

    with pytest.raises(ValueError, match="pixels"):
        encode_tile(0, 0, 2, 3, DATES, short, quality)
    with pytest.raises(ValueError, match="datas"):
        encode_tile(0, 0, 2, 3, DATES, [array("h", [0] * 6)], quality)


def test_should_refuse_a_file_that_is_not_a_tile(tmp_path: Path) -> None:
    path = tmp_path / "outro.bin"
    path.write_bytes(b"isto nao e um ladrilho de ndvi, so texto")

    with pytest.raises(ValueError, match="ladrilho"):
        read_tile_header(path)


# --- leitura de um ponto ------------------------------------------------------------------------


def test_should_read_the_series_of_the_pixel_that_contains_the_point(tmp_path: Path) -> None:
    repository = GridNdviRepository(write_ndvi_grid(tmp_path, [TILE], DATES, _value))

    assert repository.get_ndvi_history(*FAZENDA) == _expected(*FAZENDA_PIXEL)


def test_should_leave_out_the_dates_without_a_good_observation(tmp_path: Path) -> None:
    repository = GridNdviRepository(write_ndvi_grid(tmp_path, [TILE], DATES, _value))

    records = repository.get_ndvi_history(*pixel_center(52297, 64517))

    assert [r.data for r in records] == [date(2017, 1, 1), date(2017, 1, 17)]
    assert records == _expected(52297, 64517)


@pytest.mark.parametrize(
    "pixel",
    [(52296, 64516), (52296, 64520), (52300, 64516), (52300, 64520)],
    ids=["noroeste", "nordeste", "sudoeste", "sudeste"],
)
def test_should_read_the_corner_pixels_of_a_tile(tmp_path: Path, pixel: tuple[int, int]) -> None:
    repository = GridNdviRepository(write_ndvi_grid(tmp_path, [TILE], DATES, _value))

    assert repository.get_ndvi_history(*pixel_center(*pixel)) == _expected(*pixel)


@pytest.mark.parametrize(
    "pixel",
    [(52295, 64518), (52301, 64518), (52298, 64515), (52298, 64521)],
    ids=["norte", "sul", "oeste", "leste"],
)
def test_should_return_nothing_just_outside_the_tile(
    tmp_path: Path, pixel: tuple[int, int]
) -> None:
    repository = GridNdviRepository(write_ndvi_grid(tmp_path, [TILE], DATES, _value))

    assert repository.get_ndvi_history(*pixel_center(*pixel)) == []


def test_should_return_nothing_outside_the_area(tmp_path: Path) -> None:
    repository = GridNdviRepository(write_ndvi_grid(tmp_path, [TILE], DATES, _value))

    assert repository.get_ndvi_history(-15.79, -47.88) == []  # Brasília


def test_should_find_the_pixel_in_every_block_of_a_tile(tmp_path: Path) -> None:
    # 10 linhas em blocos de 4: o último bloco tem só 2 linhas.
    tile = FakeTile(row=52290, col=64510, nrows=10, ncols=3)
    index = write_ndvi_grid(tmp_path, [tile], DATES, _value, rows_per_block=4)
    repository = GridNdviRepository(index)

    for row in (52290, 52293, 52294, 52297, 52298, 52299):
        assert repository.get_ndvi_history(*pixel_center(row, 64511)) == _expected(row, 64511)


def test_should_use_the_tile_with_the_nearest_center_where_tiles_overlap(tmp_path: Path) -> None:
    west = FakeTile(row=52290, col=64510, nrows=11, ncols=11)  # centro (52295, 64515)
    east = FakeTile(row=52294, col=64514, nrows=11, ncols=11)  # centro (52299, 64519)

    def value(row: int, col: int, index: int) -> tuple[int, int]:
        return 2000 + 10 * index, 0  # igual nos dois: o que muda é o ladrilho, pelo arquivo

    index = write_ndvi_grid(tmp_path, [west, east], DATES, value)
    (tmp_path / "ladrilhos" / east.name).unlink()  # sem o do leste, o ponto dele fica vazio
    repository = GridNdviRepository(index)

    assert repository.get_ndvi_history(*pixel_center(52295, 64515)) != []  # do oeste
    assert repository.get_ndvi_history(*FAZENDA) == []  # (52298, 64518) é do leste


def test_should_open_only_the_tile_of_the_point(tmp_path: Path) -> None:
    far = FakeTile(row=50000, col=60000, nrows=5, ncols=5)
    index = write_ndvi_grid(tmp_path, [TILE, far], DATES, _value)
    (tmp_path / "ladrilhos" / far.name).write_bytes(b"corrompido")
    repository = GridNdviRepository(index)

    assert repository.get_ndvi_history(*FAZENDA) == _expected(*FAZENDA_PIXEL)


def test_should_keep_only_a_few_blocks_in_memory(tmp_path: Path) -> None:
    tile = FakeTile(row=52290, col=64510, nrows=10, ncols=3)
    index = write_ndvi_grid(tmp_path, [tile], DATES, _value, rows_per_block=2)
    repository = GridNdviRepository(index, max_cached_blocks=2)

    for row in range(52290, 52300):
        assert repository.get_ndvi_history(*pixel_center(row, 64510)) == _expected(row, 64510)

    assert repository.cached_blocks <= 2


def test_should_refuse_a_tile_made_with_other_dates(tmp_path: Path) -> None:
    index = write_ndvi_grid(tmp_path, [TILE], DATES, _value)
    payload = json.loads(index.read_text(encoding="utf-8"))
    payload["datas"][1][1] = "MOD13Q1"
    index.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="datas"):
        GridNdviRepository(index).get_ndvi_history(*FAZENDA)


# --- sem arquivo, versão e contrato do índice ---------------------------------------------------


def test_should_return_nothing_without_the_index(tmp_path: Path) -> None:
    assert GridNdviRepository(None).get_ndvi_history(*FAZENDA) == []
    assert GridNdviRepository(None).get_data_run() is None
    missing = GridNdviRepository(tmp_path / INDEX_NAME)
    assert missing.get_ndvi_history(*FAZENDA) == []
    assert missing.get_data_run() is None


def test_should_read_the_data_run_from_the_index(tmp_path: Path) -> None:
    versao = {"fonte": "teste", "parametros": {"ladrilhos": 1}, "fim": "2026-11-15T12:00:00Z",
              "versao": "2026.11-teste"}  # fmt: skip
    index = write_ndvi_grid(tmp_path, [TILE], DATES, _value, versao_dados=versao)

    data_run = GridNdviRepository(index).get_data_run()

    assert data_run is not None
    assert (data_run.source, data_run.version) == ("teste", "2026.11-teste")
    assert data_run.params == {"ladrilhos": 1}


def test_should_read_the_index_contract() -> None:
    index = index_from_json(index_payload([TILE], DATES))

    assert index.fator_escala == 0.0001
    assert index.datas == tuple(DATES)
    assert [(t.arquivo, t.linha, t.coluna, t.linhas, t.colunas) for t in index.ladrilhos] == [
        ("ladrilhos/r52296_c64516.bin", 52296, 64516, 5, 5)
    ]


@pytest.mark.parametrize(
    "change",
    [
        lambda p: p.pop("ladrilhos"),
        lambda p: p.update(fator_escala=0),
        lambda p: p["datas"].append(["2017-02-02", "MCD12Q1"]),
        lambda p: p["ladrilhos"][0].update(arquivo="../fora.bin"),
        lambda p: p["ladrilhos"][0].update(linhas=0),
    ],
    ids=["sem ladrilhos", "escala zero", "produto errado", "fora da pasta", "sem linhas"],
)
def test_should_refuse_an_index_out_of_the_contract(change) -> None:  # type: ignore[no-untyped-def]
    payload = index_payload([TILE], DATES)
    change(payload)

    with pytest.raises(ValueError):
        index_from_json(payload)
