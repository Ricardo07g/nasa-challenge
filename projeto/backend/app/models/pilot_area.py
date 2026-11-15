"""Área piloto: a caixa com dados preparados (Uberlândia e Uberaba, ADR-0003)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PilotArea:
    """Limites da área piloto em graus (WGS 84): o front desenha a caixa e bloqueia o ponto fora."""

    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float
