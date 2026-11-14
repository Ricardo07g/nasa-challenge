"""Service for analyzing 10-year MODIS NDVI field history and harvest band suggestion."""

from collections import defaultdict
from datetime import date
from statistics import median
from typing import Any

from app.constants import (
    EARLY_HARVEST_DOY_LIMIT,
    MID_HARVEST_DOY_LIMIT,
    MIN_NDVI_YEARS_FOR_SUGGESTION,
    NDVI_FALLOW_THRESHOLD,
    NDVI_HARVEST_DROP_RATIO,
    NDVI_PLANTED_THRESHOLD,
)
from app.models.talhao import ColheitaSugerida, HistoricoAno, HistoricoTalhao


class FieldHistoryService:
    """Analyzes MODIS MOD13Q1 NDVI time series to infer off-season land use and harvest timing."""

    def classify_entressafra(self, ndvi_records: list[dict[str, Any]]) -> HistoricoTalhao:
        """Classifies each year (Mar-May) as 'plantou', 'parado', or 'incerto' (ADR-0002, US-07)."""
        by_year: dict[int, list[float]] = defaultdict(list)
        for rec in ndvi_records:
            month = int(rec.get("month", 0))
            year = int(rec.get("year", 0))
            if 3 <= month <= 5 and year > 0:
                by_year[year].append(float(rec.get("ndvi", 0.0)))

        anos_list: list[HistoricoAno] = []
        parado_count = 0

        for year in sorted(by_year.keys()):
            values = by_year[year]
            ndvi_max = round(max(values), 2) if values else 0.0
            ndvi_med = round(sum(values) / len(values), 2) if values else 0.0

            if ndvi_max >= NDVI_PLANTED_THRESHOLD:
                situacao = "plantou"
                status = "Segunda Safra"
            elif ndvi_max < NDVI_FALLOW_THRESHOLD:
                situacao = "parado"
                status = "Pousio"
                parado_count += 1
            else:
                situacao = "incerto"
                status = "Incerto"

            anos_list.append(
                HistoricoAno(
                    ano=year,
                    situacao=situacao,
                    ndvi_max=ndvi_max,
                    ndvi_medio_safrinha=ndvi_med,
                    status_talhao=status,
                )
            )

        return HistoricoTalhao(
            anos=tuple(anos_list),
            parado=parado_count,
            total=len(anos_list),
            fonte="modis_mod13q1",
        )

    def suggest_harvest_band(self, ndvi_records: list[dict[str, Any]]) -> ColheitaSugerida:
        """Suggests soybean harvest window ('cedo' | 'meio' | 'tarde') from NDVI drop (US-02)."""
        by_year: dict[int, list[tuple[date, float]]] = defaultdict(list)
        for rec in ndvi_records:
            dt_str = str(rec.get("date", ""))
            month = int(rec.get("month", 0))
            year = int(rec.get("year", 0))
            if dt_str and 1 <= month <= 3 and year > 0:
                by_year[year].append((date.fromisoformat(dt_str), float(rec.get("ndvi", 0.0))))

        if len(by_year) < MIN_NDVI_YEARS_FOR_SUGGESTION:
            return ColheitaSugerida(faixa="meio", fonte="padrao", anos_usados=0)

        drop_doys: list[int] = []
        for year in sorted(by_year.keys()):
            pts = sorted(by_year[year], key=lambda x: x[0])
            peak_ndvi = max((val for _, val in pts), default=0.0)
            threshold = peak_ndvi * NDVI_HARVEST_DROP_RATIO

            harvest_doy: int | None = None
            for dt_val, ndvi_val in pts:
                if dt_val.month >= 2 and ndvi_val <= threshold:
                    harvest_doy = dt_val.timetuple().tm_yday
                    break

            if harvest_doy is not None:
                drop_doys.append(harvest_doy)

        if len(drop_doys) < MIN_NDVI_YEARS_FOR_SUGGESTION:
            return ColheitaSugerida(faixa="meio", fonte="padrao", anos_usados=0)

        med_doy = median(drop_doys)
        if med_doy <= EARLY_HARVEST_DOY_LIMIT:
            faixa = "cedo"
        elif med_doy <= MID_HARVEST_DOY_LIMIT:
            faixa = "meio"
        else:
            faixa = "tarde"

        return ColheitaSugerida(
            faixa=faixa,
            fonte="ndvi_modis",
            anos_usados=len(drop_doys),
        )
