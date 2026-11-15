"""Região pelo satélite (P3): a lavoura num raio em volta do ponto, na entressafra, ano a ano.

Duas partes, as duas com a regra do histórico do talhão (`FieldHistoryService`, grupo
`historico_ndvi` do `regras.yaml`), para as duas telas nunca discordarem:

- `RegionClassifier`: classifica um pixel num ano e soma os pixels em percentuais. Quem usa é o
  `pipeline/fetch_regiao_ndvi.py`, offline (nenhum pixel sai do pipeline, RNF-10);
- `RegionService`: a resposta de `GET /api/regiao`, lida do arquivo que o pipeline grava.
"""

from collections.abc import Iterable, Mapping
from dataclasses import replace
from datetime import date
from math import asin, cos, radians, sin, sqrt
from typing import Final, get_args

from app.constants import EARTH_RADIUS_M
from app.models.regiao import RegiaoAno, RegiaoSatelite
from app.models.regras import Regras
from app.models.talhao import SituacaoAno
from app.repositories.regiao_repository import RegionRepository
from app.services.errors import OutsideAreaError
from app.services.field_history_service import FieldHistoryService, scaled_ndvi

# Percentual com 1 casa, como a tela mostra ("62%") e o guia NDVI ("60,5").
PCT_DECIMALS: Final[int] = 1
SITUACOES: Final[tuple[str, ...]] = get_args(SituacaoAno)
CLASSIFIED: Final[tuple[str, ...]] = ("parado", "plantou", "incerto")


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância em metros sobre a esfera (haversine), com coordenadas WGS 84 em graus."""
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def _pct(part: int, whole: int) -> float:
    return round(100.0 * part / whole, PCT_DECIMALS)


class RegionClassifier:
    """A regra do talhão aplicada a cada pixel de lavoura e os percentuais de um ano."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._history = FieldHistoryService(rules)

    def classify_pixel(self, ano: int, observations: Iterable[tuple[date, float]]) -> SituacaoAno:
        """Situação do pixel no ano pelas observações boas (data da composição, NDVI físico).

        As observações já chegam sem neve, nuvem nem valor de preenchimento; ficam só as do ano
        dentro da janela da entressafra.
        """
        valores = [
            scaled_ndvi(ndvi)
            for day, ndvi in observations
            if day.year == ano and self._history.in_entressafra(day)
        ]
        return self._history.classify_year(ano, valores).situacao

    def summarize(self, ano: int, counts: Mapping[str, int]) -> RegiaoAno:
        """Pixels por situação → percentuais (guia NDVI): o "sem dado" fica fora da conta de
        parado, plantou e incerto, mas é informado. Sem pixel, nada é dividido.
        """
        unknown = sorted(set(counts) - set(SITUACOES))
        if unknown:
            raise ValueError(f"situação desconhecida na contagem: {unknown}")
        n_pixels = sum(counts.values())
        classified = sum(counts.get(name, 0) for name in CLASSIFIED)
        if n_pixels == 0:
            return RegiaoAno(ano, 0, None, None, None, None)
        pct_sem_dado = _pct(counts.get("sem_dado", 0), n_pixels)
        if classified == 0:
            return RegiaoAno(ano, n_pixels, None, None, None, pct_sem_dado)
        return RegiaoAno(
            ano=ano,
            n_pixels=n_pixels,
            pct_parado=_pct(counts.get("parado", 0), classified),
            pct_plantou=_pct(counts.get("plantou", 0), classified),
            pct_incerto=_pct(counts.get("incerto", 0), classified),
            pct_sem_dado=pct_sem_dado,
        )


class RegionService:
    """`GET /api/regiao`: a região que contém o ponto, com os anos que têm percentual."""

    def __init__(self, repository: RegionRepository) -> None:
        self._repository = repository

    def get_region(self, lat: float, lon: float) -> RegiaoSatelite:
        """A região mais perto cujo círculo (`raio_km` em volta do centro) contém o ponto.

        Ficam só os anos com algum pixel classificado, em ordem. Ponto fora de todos os
        círculos (ou sem arquivo): `OutsideAreaError`, nunca a região de outro lugar.
        """
        inside = [
            (distance_m(lat, lon, region.lat, region.lon), i, region)
            for i, region in enumerate(self._repository.list_regions())
        ]
        inside = [item for item in inside if item[0] <= item[2].raio_km * 1000.0]
        if not inside:
            raise OutsideAreaError("Ainda não temos a região pelo satélite para esse ponto.")
        _, _, region = min(inside)
        anos = sorted((a for a in region.anos if a.pct_parado is not None), key=lambda a: a.ano)
        return replace(region, anos=tuple(anos))
