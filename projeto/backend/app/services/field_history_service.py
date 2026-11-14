"""Histórico do talhão pelo NDVI do MODIS e faixa de colheita sugerida (PRD 7.8 e 7.9)."""

from collections import defaultdict
from datetime import date
from statistics import median

from app.constants import (
    EARLY_HARVEST_DOY_LIMIT,
    MID_HARVEST_DOY_LIMIT,
    MIN_NDVI_YEARS_FOR_SUGGESTION,
    NDVI_FALLOW_THRESHOLD,
    NDVI_HARVEST_DROP_RATIO,
    NDVI_PLANTED_THRESHOLD,
    NDVI_SCALE_FACTOR,
    OFFSEASON_MONTHS,
)
from app.models.talhao import ColheitaSugerida, HistoricoAno, HistoricoTalhao, NdviRecord


def scaled_ndvi(value: float) -> float:
    """NDVI físico (-1 a 1). O MOD13Q1 bruto vem inteiro com fator 0,0001 (7100 = 0,71)."""
    return value * NDVI_SCALE_FACTOR if abs(value) > 1.0 else value


class FieldHistoryService:
    """Lê a série de NDVI do talhão: uso na entressafra e quando a soja seca."""

    def classify_entressafra(self, ndvi_records: list[NdviRecord]) -> HistoricoTalhao:
        """Maior NDVI de 1/abr a 31/jul: > 0,6 plantou, < 0,45 parado, senão incerto."""
        by_year: dict[int, list[float]] = defaultdict(list)
        for rec in ndvi_records:
            if rec.data.month in OFFSEASON_MONTHS:
                by_year[rec.data.year].append(scaled_ndvi(rec.ndvi))

        anos: list[HistoricoAno] = []
        for year in sorted(by_year):
            ndvi_max = round(max(by_year[year]), 2)
            if ndvi_max > NDVI_PLANTED_THRESHOLD:
                situacao = "plantou"
            elif ndvi_max < NDVI_FALLOW_THRESHOLD:
                situacao = "parado"
            else:
                situacao = "incerto"
            anos.append(HistoricoAno(ano=year, situacao=situacao, ndvi_max=ndvi_max))

        return HistoricoTalhao(
            anos=tuple(anos),
            parado=sum(1 for a in anos if a.situacao == "parado"),
            total=len(anos),
            fonte="modis_mod13q1",
        )

    def suggest_harvest_band(self, ndvi_records: list[NdviRecord]) -> ColheitaSugerida:
        """Primeira imagem de jan a mar abaixo de 50% do pico; mediana dos anos vira a faixa."""
        by_year: dict[int, list[tuple[date, float]]] = defaultdict(list)
        for rec in ndvi_records:
            if 1 <= rec.data.month <= 3:
                by_year[rec.data.year].append((rec.data, scaled_ndvi(rec.ndvi)))

        drop_doys: list[int] = []
        for year in sorted(by_year):
            pts = sorted(by_year[year])
            threshold = max(val for _, val in pts) * NDVI_HARVEST_DROP_RATIO
            harvest_day = next(
                (day for day, val in pts if day.month >= 2 and val <= threshold), None
            )
            if harvest_day is not None:
                drop_doys.append(harvest_day.timetuple().tm_yday)

        if len(drop_doys) < MIN_NDVI_YEARS_FOR_SUGGESTION:
            return ColheitaSugerida(faixa="meio", fonte="padrao", anos_usados=0)

        med_doy = median(drop_doys)
        if med_doy <= EARLY_HARVEST_DOY_LIMIT:
            faixa = "cedo"
        elif med_doy <= MID_HARVEST_DOY_LIMIT:
            faixa = "meio"
        else:
            faixa = "tarde"
        return ColheitaSugerida(faixa=faixa, fonte="ndvi_modis", anos_usados=len(drop_doys))
