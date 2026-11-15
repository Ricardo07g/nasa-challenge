"""Alerta de fogo do raio-X (tela 4, remodelagem S4, tarefa 0043).

"Houve fogo a até X km do seu ponto em N de 10 anos (MODIS, NASA)": os pixels de 500 m do
MCD64A1 com o centro a até `alertas_area.fogo_raio_km` do ponto, nos anos da regra que o arquivo
cobre. Só aparece com risco (`fogo_anos_min` anos ou mais).
"""

from app.models.raio_x import AlertaFogo
from app.models.regras import Regras
from app.repositories.area_queimada_repository import AreaQueimadaRepository
from app.repositories.rules_repository import load_default_rules
from app.services.region_service import distance_m

M_PER_KM = 1000.0


class BurnedAreaService:
    def __init__(self, repository: AreaQueimadaRepository, rules: Regras | None = None) -> None:
        self._repository = repository
        self._regra = (rules if rules is not None else load_default_rules()).alertas_area

    def near(self, lat: float, lon: float) -> AlertaFogo | None:
        """`None` sem o arquivo, com o ponto fora dele ou sem fogo perto em anos suficientes."""
        regra = self._regra
        near = self._repository.get_burned_near(lat, lon, regra.fogo_raio_km)
        if near is None:
            return None
        first = max(regra.fogo_ano_inicio, near.ano_inicio)
        last = min(regra.fogo_ano_fim, near.ano_fim)
        if first > last:
            return None
        limit_m = regra.fogo_raio_km * M_PER_KM
        years = sorted(
            {
                year
                for pixel in near.pixels
                if distance_m(lat, lon, pixel.lat, pixel.lon) <= limit_m
                for year in pixel.anos
                if first <= year <= last
            }
        )
        if len(years) < regra.fogo_anos_min or not years:
            return None
        return AlertaFogo(
            anos=tuple(years),
            total_anos=last - first + 1,
            raio_km=regra.fogo_raio_km,
            fonte=near.fonte,
        )
