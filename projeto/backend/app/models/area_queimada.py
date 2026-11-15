"""Área queimada do MODIS (MCD64A1, coleção 061, 500 m) na caixa piloto (tarefa 0043).

Contrato do arquivo que o `pipeline/fetch_area_queimada.py` grava e o
`FileAreaQueimadaRepository` lê (`AGENTS.md` do backend, "Contrato dos dados das fontes" →
"Área queimada"): os pixels de 500 m que queimaram em algum ano, numa grade da projeção
sinusoidal do MODIS (a mesma do cabeçalho dos recortes da ORNL), com os anos de cada um.
"""

import math
from dataclasses import dataclass
from typing import Final

from app.models.soja_recente import SINUSOIDAL_RADIUS_M, GradeSinusoidal
from app.models.validation import require_non_blank

# O pixel de "500 m" do MODIS tem 463,31 m: a Terra inteira tem 86.400 pixels de leste a oeste.
MODIS_500M_PIXEL_M: Final[float] = 2 * math.pi * SINUSOIDAL_RADIUS_M / 86_400


def pixel_center(grade: GradeSinusoidal, row: int, col: int) -> tuple[float, float]:
    """Latitude e longitude do centro do pixel (linha, coluna) da grade sinusoidal."""
    x = grade.x_oeste_m + (col + 0.5) * grade.pixel_m
    y = grade.y_norte_m - (row + 0.5) * grade.pixel_m
    phi = y / grade.raio_m
    return math.degrees(phi), math.degrees(x / (grade.raio_m * math.cos(phi)))


@dataclass(frozen=True)
class PixelQueimado:
    """O centro de um pixel de 500 m e os anos em que ele queimou."""

    lat: float
    lon: float
    anos: tuple[int, ...]


@dataclass(frozen=True)
class QueimadasPerto:
    """Os pixels queimados em volta de um ponto e o período coberto pelo arquivo."""

    ano_inicio: int
    ano_fim: int
    fonte: str
    pixels: tuple[PixelQueimado, ...]


@dataclass(frozen=True)
class MapaAreaQueimada:
    """O arquivo: `queimadas` = (linha, coluna, anos) de cada pixel que queimou em algum ano."""

    fonte: str
    ano_inicio: int
    ano_fim: int
    grade: GradeSinusoidal
    queimadas: tuple[tuple[int, int, tuple[int, ...]], ...]

    def __post_init__(self) -> None:
        require_non_blank("fonte", self.fonte)
        if self.ano_inicio > self.ano_fim:
            raise ValueError(f"anos fora de ordem: {self.ano_inicio} a {self.ano_fim}")
        for row, col, anos in self.queimadas:
            if not (0 <= row < self.grade.linhas and 0 <= col < self.grade.colunas):
                raise ValueError(f"pixel ({row}, {col}) fora da grade")
            if not anos:
                raise ValueError(f"pixel ({row}, {col}) sem nenhum ano")
            if any(not self.ano_inicio <= ano <= self.ano_fim for ano in anos):
                raise ValueError(
                    f"pixel ({row}, {col}) com ano fora de {self.ano_inicio} a {self.ano_fim}"
                )
