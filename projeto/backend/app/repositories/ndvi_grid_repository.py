"""NDVI do MODIS por área (RF-34, tarefa 0050): ladrilhos compactados e o índice que os lista.

O `pipeline/fetch_ndvi_area.py` grava; o `GridNdviRepository` lê. Formato (só biblioteca padrão:
`array`, `struct` e `zlib`; o backend não tem numpy):

- **Índice** (JSON, `NDVI_AREA_PATH`): `versao_dados`, `formato`, `fonte`, `fator_escala`, `grade`
  (a grade global do MODIS na projeção sinusoidal), `datas` (`[data, produto]` na ordem dos
  ladrilhos), `area` e `ladrilhos` (arquivo, pixel global do canto de cima à esquerda e tamanho).
- **Ladrilho** (binário, um arquivo por ladrilho, ao lado do índice): cabeçalho (`TILE_HEADER`),
  a tabela de onde começa cada bloco e os blocos. Um bloco = `rows_per_block` linhas de pixels,
  comprimido com zlib. Dentro dele, data a data (a ordem de `datas`), os pixels das linhas do bloco:
  primeiro o byte alto do NDVI bruto (int16), depois o byte baixo e por fim a qualidade (uint8).
  Separar os bytes deixa o zlib achar a repetição dos bytes altos (~6% menor, medido com o NDVI
  real da região). Sem observação boa: NDVI `NO_OBSERVATION` e qualidade `NO_QUALITY`.

Ler um ponto abre só o ladrilho dele e descomprime só o bloco do pixel (~1,5 MB com 270 datas);
um cache LRU pequeno guarda os últimos blocos.
"""

import json
import logging
import math
import struct
import sys
import zlib
from array import array
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any, Final

from app.constants import NDVI_DECIMALS
from app.models.data_run import DataRun
from app.models.soja_recente import GradeSinusoidal
from app.models.talhao import NDVI_PRODUCTS, NdviRecord
from app.repositories.data_run_repository import data_run_from_json

logger = logging.getLogger(__name__)

TILE_MAGIC: Final[bytes] = b"RZNDVIGR"
TILE_FORMAT_VERSION: Final[int] = 1
# magic, versão, linhas por bloco, linha e coluna globais do canto de cima à esquerda, linhas,
# colunas, datas, CRC32 das datas e número de blocos (little endian).
TILE_HEADER: Final[struct.Struct] = struct.Struct("<8sHHIIIIIII")
_OFFSET: Final[struct.Struct] = struct.Struct("<Q")
NO_OBSERVATION: Final[int] = -32768
NO_QUALITY: Final[int] = 255
# 8 linhas: blocos de ~1,5 MB com 241 colunas e 270 datas (medido: 1,48 byte por pixel e data com o
# NDVI real da região, contra 1,54 com blocos de 1 linha).
DEFAULT_ROWS_PER_BLOCK: Final[int] = 8
ZLIB_LEVEL: Final[int] = 6
DEFAULT_MAX_CACHED_BLOCKS: Final[int] = 8
INDEX_FORMAT_NAME: Final[str] = "raiz-orbital-ndvi-area"
INDEX_FORMAT_VERSION: Final[int] = 1


@dataclass(frozen=True)
class TileHeader:
    """O cabeçalho de um ladrilho: posição na grade global, tamanho, datas e blocos."""

    origin_row: int
    origin_col: int
    nrows: int
    ncols: int
    ndates: int
    rows_per_block: int
    dates_crc: int

    @property
    def nblocks(self) -> int:
        return math.ceil(self.nrows / self.rows_per_block)


def dates_checksum(dates: Sequence[tuple[date, str]]) -> int:
    """CRC32 da lista de datas e produtos: o ladrilho só vale com as datas do índice."""
    text = ";".join(f"{day.isoformat()}:{product}" for day, product in dates)
    return zlib.crc32(text.encode("ascii"))


def _little_endian(values: array) -> bytes:
    if sys.byteorder == "big":
        values = array(values.typecode, values)
        values.byteswap()
    return values.tobytes()


def encode_tile(
    origin_row: int,
    origin_col: int,
    nrows: int,
    ncols: int,
    dates: Sequence[tuple[date, str]],
    ndvi_layers: Sequence[array],
    quality_layers: Sequence[bytes],
    *,
    rows_per_block: int = DEFAULT_ROWS_PER_BLOCK,
) -> bytes:
    """O arquivo de um ladrilho. `ndvi_layers[d]` (int16) e `quality_layers[d]` têm os pixels da
    data `d`, linha a linha a partir do canto de cima à esquerda (`NO_OBSERVATION` e `NO_QUALITY`
    onde não há observação boa)."""
    size = nrows * ncols
    if len(ndvi_layers) != len(dates) or len(quality_layers) != len(dates):
        raise ValueError(
            f"{len(dates)} datas, mas vieram {len(ndvi_layers)} camadas de NDVI e "
            f"{len(quality_layers)} de qualidade"
        )
    for layer in (*ndvi_layers, *quality_layers):
        if len(layer) != size:
            raise ValueError(f"camada com {len(layer)} pixels; o ladrilho tem {nrows} × {ncols}")
    if rows_per_block < 1:
        raise ValueError(f"linhas por bloco: 1 ou mais, veio {rows_per_block}")
    header = TileHeader(
        origin_row, origin_col, nrows, ncols, len(dates), rows_per_block, dates_checksum(dates)
    )
    blocks: list[bytes] = []
    for first_row in range(0, nrows, rows_per_block):
        start, end = first_row * ncols, min(nrows, first_row + rows_per_block) * ncols
        ndvi = array("h")
        for layer in ndvi_layers:
            ndvi.extend(layer[start:end])
        raw = _little_endian(ndvi)
        quality = b"".join(bytes(layer[start:end]) for layer in quality_layers)
        blocks.append(zlib.compress(raw[1::2] + raw[0::2] + quality, ZLIB_LEVEL))
    head = TILE_HEADER.pack(
        TILE_MAGIC,
        TILE_FORMAT_VERSION,
        rows_per_block,
        origin_row,
        origin_col,
        nrows,
        ncols,
        len(dates),
        header.dates_crc,
        header.nblocks,
    )
    offset = len(head) + _OFFSET.size * (len(blocks) + 1)
    offsets = []
    for block in blocks:
        offsets.append(offset)
        offset += len(block)
    offsets.append(offset)
    return head + b"".join(_OFFSET.pack(o) for o in offsets) + b"".join(blocks)


def _parse_header(data: bytes, name: str) -> TileHeader:
    if len(data) < TILE_HEADER.size or not data.startswith(TILE_MAGIC):
        raise ValueError(f"{name} não é um ladrilho de NDVI do Raiz Orbital")
    _, version, rows_per_block, row, col, nrows, ncols, ndates, crc, nblocks = TILE_HEADER.unpack(
        data[: TILE_HEADER.size]
    )
    if version != TILE_FORMAT_VERSION:
        raise ValueError(f"ladrilho {name} na versão {version}; a API lê a {TILE_FORMAT_VERSION}")
    header = TileHeader(row, col, nrows, ncols, ndates, rows_per_block, crc)
    if min(nrows, ncols, rows_per_block) < 1 or nblocks != header.nblocks:
        raise ValueError(f"ladrilho {name} com o cabeçalho fora do formato")
    return header


def read_tile_header(path: Path) -> TileHeader:
    """O cabeçalho de um ladrilho gravado (`ValueError` se o arquivo não for um ladrilho)."""
    with path.open("rb") as file:
        return _parse_header(file.read(TILE_HEADER.size), path.name)


# --- índice ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class GridTile:
    """Um ladrilho do índice: o arquivo (relativo à pasta do índice) e onde ele fica na grade."""

    arquivo: str
    linha: int
    coluna: int
    linhas: int
    colunas: int

    @property
    def center(self) -> tuple[float, float]:
        return self.linha + (self.linhas - 1) / 2, self.coluna + (self.colunas - 1) / 2


@dataclass(frozen=True)
class NdviGridIndex:
    """O índice: a escala do NDVI, as datas dos ladrilhos, a grade global e os ladrilhos."""

    fator_escala: float
    datas: tuple[tuple[date, str], ...]
    x_oeste_m: float
    y_norte_m: float
    pixel_m: float
    raio_m: float
    ladrilhos: tuple[GridTile, ...]

    def tile_grade(self, tile: GridTile) -> GradeSinusoidal:
        return GradeSinusoidal(
            x_oeste_m=self.x_oeste_m + tile.coluna * self.pixel_m,
            y_norte_m=self.y_norte_m - tile.linha * self.pixel_m,
            pixel_m=self.pixel_m,
            linhas=tile.linhas,
            colunas=tile.colunas,
            raio_m=self.raio_m,
        )


def _tile_from_json(item: Mapping[str, Any]) -> GridTile:
    arquivo = str(item["arquivo"])
    parts = PurePosixPath(arquivo).parts
    if not parts or PurePosixPath(arquivo).is_absolute() or ".." in parts:
        raise ValueError(f"ladrilho fora da pasta do índice: {arquivo!r}")
    tile = GridTile(
        arquivo=arquivo,
        linha=int(item["linha"]),
        coluna=int(item["coluna"]),
        linhas=int(item["linhas"]),
        colunas=int(item["colunas"]),
    )
    if min(tile.linhas, tile.colunas) < 1:
        raise ValueError(f"ladrilho {arquivo} sem linhas ou colunas")
    return tile


def _date_from_json(item: Sequence[Any]) -> tuple[date, str]:
    day, product = date.fromisoformat(str(item[0])), str(item[1])
    if product not in NDVI_PRODUCTS:
        raise ValueError(f"produto precisa ser MOD13Q1 ou MYD13Q1, veio {product!r}")
    return day, product


def index_from_json(payload: Mapping[str, Any]) -> NdviGridIndex:
    """O índice do NDVI por área. Chave faltando ou valor fora do contrato: `ValueError`."""
    try:
        grade = payload["grade"]
        index = NdviGridIndex(
            fator_escala=float(payload["fator_escala"]),
            datas=tuple(_date_from_json(item) for item in payload["datas"]),
            x_oeste_m=float(grade["x_oeste_m"]),
            y_norte_m=float(grade["y_norte_m"]),
            pixel_m=float(grade["pixel_m"]),
            raio_m=float(grade["raio_m"]),
            ladrilhos=tuple(_tile_from_json(item) for item in payload["ladrilhos"]),
        )
    except (KeyError, TypeError, IndexError) as exc:
        raise ValueError(f"índice do NDVI por área fora do contrato (falta {exc})") from exc
    if not index.fator_escala > 0:
        raise ValueError(f"fator_escala precisa ser maior que zero, veio {index.fator_escala}")
    if not index.pixel_m > 0 or not index.raio_m > 0:
        raise ValueError("grade do NDVI por área com pixel ou raio sem tamanho")
    return index


# --- repository -----------------------------------------------------------------------------


class GridNdviRepository:
    """Lê a série de NDVI do pixel do ponto nos ladrilhos do `NDVI_AREA_PATH`.

    Para um ponto, usa o ladrilho de centro mais perto entre os que contêm o pixel dele (os
    ladrilhos podem se sobrepor). Fora de todos, ou sem índice: série vazia. Devolve só as
    observações boas, com o NDVI físico (fator do índice, 4 casas), como o arquivo por ponto.
    """

    def __init__(
        self, index_path: Path | None, max_cached_blocks: int = DEFAULT_MAX_CACHED_BLOCKS
    ) -> None:
        self._index_path = index_path
        self._max_cached_blocks = max_cached_blocks
        self._payload: dict[str, Any] | None = None
        self._index: NdviGridIndex | None = None
        self._offsets: dict[str, tuple[TileHeader, tuple[int, ...]]] = {}
        self._blocks: OrderedDict[tuple[str, int], bytes] = OrderedDict()

    def _load(self) -> NdviGridIndex | None:
        if self._payload is None:
            path = self._index_path
            if path is None or not path.is_file():
                self._payload = {}
            else:
                payload = json.loads(path.read_text(encoding="utf-8"))
                self._index = index_from_json(payload)
                self._payload = payload
        return self._index

    def get_data_run(self) -> DataRun | None:
        """A execução que gerou o índice (`versao_dados`); None sem índice."""
        self._load()
        versao_dados = (self._payload or {}).get("versao_dados")
        return None if versao_dados is None else data_run_from_json(versao_dados)

    @property
    def cached_blocks(self) -> int:
        return len(self._blocks)

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        index = self._load()
        found = None if index is None else self._find_pixel(index, lat, lon)
        if index is None or found is None:
            return []
        tile, row, col = found
        values = self._pixel_values(index, tile, row, col)
        if values is None:
            return []
        records = [
            NdviRecord(
                data=day,
                ndvi=round(raw * index.fator_escala, NDVI_DECIMALS),
                qualidade=quality,
                produto=product,
            )
            for (day, product), (raw, quality) in zip(index.datas, values, strict=True)
            if raw != NO_OBSERVATION
        ]
        return sorted(records, key=lambda r: (r.data, r.produto or ""))

    def _find_pixel(
        self, index: NdviGridIndex, lat: float, lon: float
    ) -> tuple[GridTile, int, int] | None:
        """O ladrilho de centro mais perto que contém o pixel do ponto (distância em pixels:
        a maior entre linhas e colunas, depois a reta; empate, o primeiro do índice)."""
        best: tuple[tuple[float, float], GridTile, int, int] | None = None
        for tile in index.ladrilhos:
            pixel = index.tile_grade(tile).pixel_at(lat, lon)
            if pixel is None:
                continue
            center_row, center_col = tile.center
            d_row, d_col = tile.linha + pixel[0] - center_row, tile.coluna + pixel[1] - center_col
            rank = (max(abs(d_row), abs(d_col)), math.hypot(d_row, d_col))
            if best is None or rank < best[0]:
                best = (rank, tile, pixel[0], pixel[1])
        return None if best is None else best[1:]

    def _tile_offsets(
        self, index: NdviGridIndex, tile: GridTile
    ) -> tuple[TileHeader, tuple[int, ...]] | None:
        cached = self._offsets.get(tile.arquivo)
        if cached is not None:
            return cached
        assert self._index_path is not None
        path = self._index_path.parent / tile.arquivo
        if not path.is_file():
            logger.warning("Ladrilho %s do NDVI por área não encontrado em %s", tile.arquivo, path)
            return None
        with path.open("rb") as file:
            header = _parse_header(file.read(TILE_HEADER.size), tile.arquivo)
            raw_offsets = file.read(_OFFSET.size * (header.nblocks + 1))
        position = (header.origin_row, header.origin_col, header.nrows, header.ncols)
        if position != (tile.linha, tile.coluna, tile.linhas, tile.colunas):
            raise ValueError(f"ladrilho {tile.arquivo} não bate com a posição dele no índice")
        if header.ndates != len(index.datas) or header.dates_crc != dates_checksum(index.datas):
            raise ValueError(f"ladrilho {tile.arquivo} gravado com outras datas que as do índice")
        offsets = tuple(o for (o,) in _OFFSET.iter_unpack(raw_offsets))
        self._offsets[tile.arquivo] = (header, offsets)
        return header, offsets

    def _block(self, tile: GridTile, number: int, offsets: tuple[int, ...]) -> bytes:
        key = (tile.arquivo, number)
        if key in self._blocks:
            self._blocks.move_to_end(key)
            return self._blocks[key]
        assert self._index_path is not None
        with (self._index_path.parent / tile.arquivo).open("rb") as file:
            file.seek(offsets[number])
            data = zlib.decompress(file.read(offsets[number + 1] - offsets[number]))
        self._blocks[key] = data
        while len(self._blocks) > self._max_cached_blocks:
            self._blocks.popitem(last=False)
        return data

    def _pixel_values(
        self, index: NdviGridIndex, tile: GridTile, row: int, col: int
    ) -> list[tuple[int, int]] | None:
        """(NDVI bruto, qualidade) do pixel em cada data, na ordem das `datas` do índice."""
        found = self._tile_offsets(index, tile)
        if found is None:
            return None
        header, offsets = found
        number, local_row = divmod(row, header.rows_per_block)
        rows_in_block = min(header.rows_per_block, header.nrows - number * header.rows_per_block)
        stride = rows_in_block * header.ncols
        data = self._block(tile, number, offsets)
        plane = stride * header.ndates
        if len(data) != 3 * plane:
            raise ValueError(f"bloco {number} do ladrilho {tile.arquivo} fora do tamanho")
        values = []
        for position in range(local_row * header.ncols + col, plane, stride):
            raw = data[position] << 8 | data[plane + position]
            values.append((raw - 65536 if raw >= 32768 else raw, data[2 * plane + position]))
        return values
