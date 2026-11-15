"""Região pelo satélite (P3): a soja num raio em volta do ponto, na entressafra, ano a ano.

Duas partes:

- `RegionClassifier`: em cada pixel da máscara de lavoura, acha a soja do ano (pico e colheita,
  grupo `regiao_ndvi` do `regras.yaml`, tarefa 0036) e classifica a entressafra depois da colheita
  com a regra do histórico do talhão (`FieldHistoryService`, grupo `historico_ndvi`), para as duas
  telas nunca discordarem; depois soma os pixels em percentuais. Quem usa é o
  `pipeline/fetch_regiao_ndvi.py`, offline (nenhum pixel sai do pipeline, RNF-10);
- `RegionService`: a resposta de `GET /api/regiao`, lida do arquivo que o pipeline grava.
"""

from collections.abc import Iterable, Mapping
from dataclasses import replace
from datetime import date
from math import asin, cos, radians, sin, sqrt
from typing import Final, get_args

from app.constants import EARTH_RADIUS_M
from app.models.regiao import RegiaoAno, RegiaoDoPonto
from app.models.regras import Regras
from app.models.talhao import SituacaoAno
from app.repositories.regiao_repository import RegionRepository
from app.repositories.rules_repository import load_default_rules
from app.services.errors import OutsideAreaError
from app.services.field_history_service import FieldHistoryService, month_day, scaled_ndvi

# Percentual com 1 casa, como a tela mostra ("62%") e o guia NDVI ("60,5").
PCT_DECIMALS: Final[int] = 1
# Distância do ponto ao centro da região com 1 casa ("a 12,3 km da sua lavoura").
DISTANCE_DECIMALS: Final[int] = 1
M_PER_KM: Final[float] = 1000.0
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


Observation = tuple[date, float]


class RegionClassifier:
    """A soja do ano em cada pixel, a regra do talhão depois da colheita e os percentuais."""

    def __init__(self, rules: Regras | None = None) -> None:
        regras = rules if rules is not None else load_default_rules()
        self._history = FieldHistoryService(regras)
        self._soja = regras.regiao_ndvi

    def harvest_date(self, ano: int, observations: Iterable[Observation]) -> date | None:
        """Data da colheita da soja do ano no pixel; None se o pixel não mostrou a soja.

        Pico: o maior NDVI de `pico_inicio` a `pico_fim` precisa chegar a `pico_min_ndvi` (com
        o mesmo valor em duas datas, vale a última). Colheita: a primeira observação depois do
        pico, até `colheita_fim`, com NDVI até `colheita_max_ndvi`. Sem pico ou sem colheita
        (cana, café, pasto, solo exposto), None. As observações já chegam boas (qualidade 0/1).
        """
        regra = self._soja
        inicio, fim = month_day(regra.pico_inicio), month_day(regra.pico_fim)
        serie = sorted((day, scaled_ndvi(ndvi)) for day, ndvi in observations if day.year == ano)
        janela = [(day, ndvi) for day, ndvi in serie if inicio <= (day.month, day.day) <= fim]
        if not janela:
            return None
        pico = max(ndvi for _, ndvi in janela)
        if pico < regra.pico_min_ndvi:
            return None
        dia_pico = max(day for day, ndvi in janela if ndvi == pico)
        limite = month_day(regra.colheita_fim)
        return next(
            (
                day
                for day, ndvi in serie
                if day > dia_pico
                and (day.month, day.day) <= limite
                and ndvi <= regra.colheita_max_ndvi
            ),
            None,
        )

    def classify_pixel(self, ano: int, observations: Iterable[Observation]) -> SituacaoAno | None:
        """Situação da entressafra do pixel no ano; None se ele não foi soja naquele ano.

        Com a soja e a colheita, a regra do talhão (`classify_year`: mínimo de observações e os
        limites do `historico_ndvi`) olha só as observações depois da data da colheita, até
        `entressafra_fim`. A própria observação da colheita fica de fora.
        """
        observations = list(observations)
        colheita = self.harvest_date(ano, observations)
        if colheita is None:
            return None
        fim = month_day(self._soja.entressafra_fim)
        valores = [
            scaled_ndvi(ndvi)
            for day, ndvi in observations
            if day.year == ano and day > colheita and (day.month, day.day) <= fim
        ]
        return self._history.classify_year(ano, valores).situacao

    def summarize(
        self, ano: int, counts: Mapping[str, int], n_pixels_lavoura: int | None = None
    ) -> RegiaoAno:
        """Pixels de soja por situação → percentuais (guia NDVI): o "sem dado" fica fora da conta
        de parado, plantou e incerto, mas é informado. Sem pixel, nada é dividido.
        `n_pixels_lavoura` (a máscara inteira no raio) só é informado.
        """
        unknown = sorted(set(counts) - set(SITUACOES))
        if unknown:
            raise ValueError(f"situação desconhecida na contagem: {unknown}")
        n_pixels = sum(counts.values())
        classified = sum(counts.get(name, 0) for name in CLASSIFIED)
        if n_pixels == 0:
            return RegiaoAno(ano, 0, None, None, None, None, n_pixels_lavoura)
        pct_sem_dado = _pct(counts.get("sem_dado", 0), n_pixels)
        if classified == 0:
            return RegiaoAno(ano, n_pixels, None, None, None, pct_sem_dado, n_pixels_lavoura)
        return RegiaoAno(
            ano=ano,
            n_pixels=n_pixels,
            pct_parado=_pct(counts.get("parado", 0), classified),
            pct_plantou=_pct(counts.get("plantou", 0), classified),
            pct_incerto=_pct(counts.get("incerto", 0), classified),
            pct_sem_dado=pct_sem_dado,
            n_pixels_lavoura=n_pixels_lavoura,
        )


class RegionService:
    """`GET /api/regiao`: a região que contém o ponto, com os anos que têm percentual."""

    def __init__(self, repository: RegionRepository) -> None:
        self._repository = repository

    def get_region(self, lat: float, lon: float) -> RegiaoDoPonto:
        """A região mais perto cujo círculo (`raio_km` em volta do centro) contém o ponto, com a
        distância do ponto até o centro (haversine, km com 1 casa).

        Ficam só os anos com algum pixel classificado, em ordem. Ponto fora de todos os
        círculos (ou sem arquivo): `OutsideAreaError`, nunca a região de outro lugar.
        """
        inside = [
            (distance_m(lat, lon, region.lat, region.lon), i, region)
            for i, region in enumerate(self._repository.list_regions())
        ]
        inside = [item for item in inside if item[0] <= item[2].raio_km * M_PER_KM]
        if not inside:
            raise OutsideAreaError("Ainda não temos a região pelo satélite para esse ponto.")
        distance, _, region = min(inside)
        anos = sorted((a for a in region.anos if a.pct_parado is not None), key=lambda a: a.ano)
        return RegiaoDoPonto(
            regiao=replace(region, anos=tuple(anos)),
            distancia_km=round(distance / M_PER_KM, DISTANCE_DECIMALS),
        )
