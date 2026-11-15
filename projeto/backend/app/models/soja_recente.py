"""Soja na safra mais recente no ponto marcado (RF-24, tarefa 0037).

Contrato do arquivo que o `pipeline/fetch_soja_recente.py` grava e o `FileSojaRecenteRepository`
lê (`AGENTS.md` do backend, "Contrato dos dados das fontes" → "Soja recente"): o maior NDVI de cada
pixel de 250 m do MODIS na janela da safra, em centésimos, numa grade da projeção sinusoidal do
MODIS (a mesma do cabeçalho dos recortes da ORNL).
"""

import math
import re
from dataclasses import dataclass
from typing import Final

from app.models.validation import require_between, require_finite, require_non_blank

# Esfera da projeção sinusoidal do MODIS e o pixel de "250 m" (na verdade 231,66 m): a Terra
# inteira tem 172.800 pixels de leste a oeste (36 tiles × 4.800).
SINUSOIDAL_RADIUS_M: Final[float] = 6_371_007.181
MODIS_250M_PIXEL_M: Final[float] = 2 * math.pi * SINUSOIDAL_RADIUS_M / 172_800
# NDVI físico do MOD13Q1: de −0,2 a 1. O pico vai em centésimos: de −20 a 100.
NDVI_PICO_MIN: Final[float] = -0.2
NDVI_PICO_MAX: Final[float] = 1.0
PICO_CENTESIMOS_MIN: Final[int] = -20
PICO_CENTESIMOS_MAX: Final[int] = 100
CENTESIMOS: Final[int] = 100
_SAFRA = re.compile(r"\d{4}/\d{2}")


def safra_label(harvest_year: int) -> str:
    """A safra da soja colhida em `harvest_year` (colhida em fevereiro de 2026 = "2025/26")."""
    return f"{harvest_year - 1}/{harvest_year % 100:02d}"


@dataclass(frozen=True)
class SojaRecente:
    """O que o satélite viu no ponto na safra mais recente (campo `soja_recente` do `/talhao`).

    `vista` = o maior NDVI da janela (`ndvi_pico`) chegou ao limite da soja; os dois ficam `None`
    juntos quando o pixel não teve observações boas suficientes (sem dado: o app não avisa).
    """

    safra: str
    vista: bool | None
    ndvi_pico: float | None
    fonte: str

    def __post_init__(self) -> None:
        if not _SAFRA.fullmatch(self.safra):
            raise ValueError(f"safra precisa ser AAAA/AA (ex.: 2025/26), veio {self.safra!r}")
        require_non_blank("fonte", self.fonte)
        if (self.vista is None) != (self.ndvi_pico is None):
            raise ValueError("vista e ndvi_pico vêm juntos (ou os dois null, sem dado)")
        if self.ndvi_pico is not None:
            require_between("ndvi_pico", self.ndvi_pico, NDVI_PICO_MIN, NDVI_PICO_MAX)


@dataclass(frozen=True)
class PicoSojaRecente:
    """O maior NDVI da janela no pixel do ponto, como está no arquivo (`None` = sem dado)."""

    safra: str
    fonte: str
    ndvi_pico: float | None


@dataclass(frozen=True)
class GradeSinusoidal:
    """Grade de pixels na projeção sinusoidal do MODIS (metros), linha 0 no norte, coluna 0 a oeste.

    Ponto → pixel: x = R·λ·cos φ e y = R·φ (λ e φ em radianos); coluna = ⌊(x − x_oeste) / pixel⌋
    e linha = ⌊(y_norte − y) / pixel⌋.
    """

    x_oeste_m: float
    y_norte_m: float
    pixel_m: float
    linhas: int
    colunas: int
    raio_m: float = SINUSOIDAL_RADIUS_M

    def __post_init__(self) -> None:
        for name in ("x_oeste_m", "y_norte_m", "pixel_m", "raio_m"):
            require_finite(name, getattr(self, name))
        if not self.pixel_m > 0:
            raise ValueError(f"pixel_m precisa ser maior que zero, veio {self.pixel_m!r}")
        if not self.raio_m > 0:
            raise ValueError(f"raio_m precisa ser maior que zero, veio {self.raio_m!r}")
        for name in ("linhas", "colunas"):
            if getattr(self, name) < 1:
                raise ValueError(f"{name} precisa ser 1 ou mais, veio {getattr(self, name)!r}")

    def pixel_at(self, lat: float, lon: float) -> tuple[int, int] | None:
        """(linha, coluna) do pixel que contém o ponto; `None` fora da grade."""
        phi = math.radians(lat)
        x = self.raio_m * math.radians(lon) * math.cos(phi)
        y = self.raio_m * phi
        row = math.floor((self.y_norte_m - y) / self.pixel_m)
        col = math.floor((x - self.x_oeste_m) / self.pixel_m)
        if 0 <= row < self.linhas and 0 <= col < self.colunas:
            return row, col
        return None


def _is_hundredths(value: object) -> bool:
    return value is None or (
        type(value) is int and PICO_CENTESIMOS_MIN <= value <= PICO_CENTESIMOS_MAX
    )


@dataclass(frozen=True)
class MapaSojaRecente:
    """O arquivo da soja recente: o pico de cada pixel em centésimos (`None` = sem dado).

    `pico_centesimos[linha][coluna]`, com as linhas e colunas da `grade`.
    """

    safra: str
    fonte: str
    grade: GradeSinusoidal
    pico_centesimos: tuple[tuple[int | None, ...], ...]

    def __post_init__(self) -> None:
        if not _SAFRA.fullmatch(self.safra):
            raise ValueError(f"safra precisa ser AAAA/AA (ex.: 2025/26), veio {self.safra!r}")
        require_non_blank("fonte", self.fonte)
        if len(self.pico_centesimos) != self.grade.linhas:
            raise ValueError(
                f"pico_centesimos tem {len(self.pico_centesimos)} linhas; a grade tem "
                f"{self.grade.linhas}"
            )
        for index, row in enumerate(self.pico_centesimos):
            if len(row) != self.grade.colunas:
                raise ValueError(
                    f"linha {index} de pico_centesimos com {len(row)} colunas; a grade tem "
                    f"{self.grade.colunas}"
                )
            if not all(_is_hundredths(value) for value in row):
                raise ValueError(
                    f"linha {index} de pico_centesimos com valor fora de "
                    f"{PICO_CENTESIMOS_MIN} a {PICO_CENTESIMOS_MAX} (inteiro) ou null"
                )

    def pico_em(self, lat: float, lon: float) -> PicoSojaRecente | None:
        """O pico do pixel que contém o ponto; `None` fora da grade."""
        pixel = self.grade.pixel_at(lat, lon)
        if pixel is None:
            return None
        value = self.pico_centesimos[pixel[0]][pixel[1]]
        return PicoSojaRecente(
            safra=self.safra,
            fonte=self.fonte,
            ndvi_pico=None if value is None else value / CENTESIMOS,
        )
