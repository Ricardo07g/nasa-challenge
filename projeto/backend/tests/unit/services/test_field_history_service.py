"""Unit tests for FieldHistoryService (MODIS NDVI classification and harvest band suggestion)."""

from app.services.field_history_service import FieldHistoryService


def test_should_classify_years_into_plantou_or_parado_when_ndvi_series_analyzed() -> None:
    service = FieldHistoryService()
    records = [
        {"date": "2022-04-10", "year": 2022, "month": 4, "ndvi": 0.72},
        {"date": "2023-04-10", "year": 2023, "month": 4, "ndvi": 0.32},
        {"date": "2024-04-10", "year": 2024, "month": 4, "ndvi": 0.51},
    ]

    history = service.classify_entressafra(records)

    assert history.total == 3
    assert history.parado == 1
    assert history.fonte == "modis_mod13q1"
    situacoes = {a.ano: a.situacao for a in history.anos}
    assert situacoes[2022] == "plantou"
    assert situacoes[2023] == "parado"
    assert situacoes[2024] == "incerto"


def test_should_suggest_meio_harvest_band_when_ndvi_drops_in_mid_february() -> None:
    service = FieldHistoryService()
    records = []
    for year in range(2019, 2025):
        records.extend(
            [
                {"date": f"{year}-01-17", "year": year, "month": 1, "ndvi": 0.84},
                {"date": f"{year}-02-02", "year": year, "month": 2, "ndvi": 0.65},
                {"date": f"{year}-02-18", "year": year, "month": 2, "ndvi": 0.35},
            ]
        )

    suggestion = service.suggest_harvest_band(records)

    assert suggestion.faixa == "meio"
    assert suggestion.fonte == "ndvi_modis"
    assert suggestion.anos_usados == 6


def test_should_fallback_to_default_meio_when_fewer_than_five_years_available() -> None:
    service = FieldHistoryService()
    records = [
        {"date": "2024-01-17", "year": 2024, "month": 1, "ndvi": 0.80},
        {"date": "2024-02-02", "year": 2024, "month": 2, "ndvi": 0.30},
    ]

    suggestion = service.suggest_harvest_band(records)

    assert suggestion.faixa == "meio"
    assert suggestion.fonte == "padrao"
    assert suggestion.anos_usados == 0
