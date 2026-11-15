"""Grade de NDVI por área de teste (tarefa 0050): ladrilhos pequenos e o índice, gravados em disco.

Os valores são de teste, não do MODIS: por isso o `versao_dados` usa a fonte `teste`. A grade é a
global do MODIS (sinusoidal, pixel de 231,66 m), a mesma do `pipeline/fetch_ndvi_area.py`.
"""

import json
import math
from array import array
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from app.models.soja_recente import MODIS_250M_PIXEL_M, SINUSOIDAL_RADIUS_M
from app.repositories.ndvi_grid_repository import NO_OBSERVATION, NO_QUALITY, encode_tile

X_WEST_M = -math.pi * SINUSOIDAL_RADIUS_M
Y_NORTH_M = math.pi / 2 * SINUSOIDAL_RADIUS_M
TEST_RUN = {"fonte": "teste", "parametros": {}, "fim": "2026-11-15T12:00:00Z", "versao": "teste"}
INDEX_NAME = "ndvi_modis_area.json"

# (NDVI bruto, qualidade) de um pixel global (linha, coluna) numa data (índice em `datas`), ou
# None quando não há observação boa.
PixelValue = Callable[[int, int, int], tuple[int, int] | None]


@dataclass(frozen=True)
class FakeTile:
    """Um ladrilho: o pixel global do canto de cima à esquerda e o tamanho."""

    row: int
    col: int
    nrows: int
    ncols: int

    @property
    def name(self) -> str:
        return f"r{self.row}_c{self.col}.bin"


def pixel_center(row: int, col: int) -> tuple[float, float]:
    """Latitude e longitude do centro de um pixel global do MODIS (sinusoidal inversa)."""
    x = X_WEST_M + (col + 0.5) * MODIS_250M_PIXEL_M
    y = Y_NORTH_M - (row + 0.5) * MODIS_250M_PIXEL_M
    lat = y / SINUSOIDAL_RADIUS_M
    return math.degrees(lat), math.degrees(x / (SINUSOIDAL_RADIUS_M * math.cos(lat)))


def tile_bytes(
    tile: FakeTile,
    dates: Sequence[tuple[date, str]],
    value: PixelValue,
    rows_per_block: int = 8,
) -> bytes:
    ndvi_layers = []
    quality_layers = []
    for index in range(len(dates)):
        ndvi = array("h")
        quality = bytearray()
        for local in range(tile.nrows * tile.ncols):
            local_row, local_col = divmod(local, tile.ncols)
            item = value(tile.row + local_row, tile.col + local_col, index)
            ndvi.append(NO_OBSERVATION if item is None else item[0])
            quality.append(NO_QUALITY if item is None else item[1])
        ndvi_layers.append(ndvi)
        quality_layers.append(bytes(quality))
    return encode_tile(
        tile.row,
        tile.col,
        tile.nrows,
        tile.ncols,
        dates,
        ndvi_layers,
        quality_layers,
        rows_per_block=rows_per_block,
    )


def index_payload(
    tiles: Sequence[FakeTile],
    dates: Sequence[tuple[date, str]],
    versao_dados: dict[str, Any] | None = None,
    scale: float = 0.0001,
) -> dict[str, Any]:
    return {
        "versao_dados": versao_dados or TEST_RUN,
        "formato": {"nome": "raiz-orbital-ndvi-area", "versao": 1},
        "fonte": "MODIS MOD13Q1 + MYD13Q1",
        "fator_escala": scale,
        "grade": {
            "projecao": "sinusoidal_modis",
            "raio_m": SINUSOIDAL_RADIUS_M,
            "pixel_m": MODIS_250M_PIXEL_M,
            "x_oeste_m": X_WEST_M,
            "y_norte_m": Y_NORTH_M,
        },
        "datas": [[day.isoformat(), product] for day, product in dates],
        "area": {"lat_min": -19.9, "lat_max": -18.4, "lon_min": -49.0, "lon_max": -47.5},
        "ladrilhos": [
            {
                "arquivo": f"ladrilhos/{tile.name}",
                "linha": tile.row,
                "coluna": tile.col,
                "linhas": tile.nrows,
                "colunas": tile.ncols,
            }
            for tile in tiles
        ],
    }


def write_ndvi_grid(
    folder: Path,
    tiles: Sequence[FakeTile],
    dates: Sequence[tuple[date, str]],
    value: PixelValue,
    *,
    rows_per_block: int = 8,
    versao_dados: dict[str, Any] | None = None,
) -> Path:
    """Grava os ladrilhos em `<folder>/ladrilhos/` e o índice; devolve o caminho do índice."""
    (folder / "ladrilhos").mkdir(parents=True, exist_ok=True)
    for tile in tiles:
        data = tile_bytes(tile, dates, value, rows_per_block)
        (folder / "ladrilhos" / tile.name).write_bytes(data)
    index = folder / INDEX_NAME
    index.write_text(json.dumps(index_payload(tiles, dates, versao_dados)), encoding="utf-8")
    return index
