"""Unit tests for FieldHistoryService (histórico do talhão pelo NDVI e colheita sugerida)."""

from datetime import date

import pytest

from app.models.talhao import NdviRecord
from app.services.field_history_service import FieldHistoryService


def _rec(day: str, ndvi: float) -> NdviRecord:
    return NdviRecord(data=date.fromisoformat(day), ndvi=ndvi)


def test_should_classify_years_into_plantou_parado_or_incerto_by_offseason_peak() -> None:
    service = FieldHistoryService()
    records = [
        _rec("2022-04-10", 0.72),
        _rec("2023-04-10", 0.32),
        _rec("2024-04-10", 0.51),
    ]

    history = service.classify_entressafra(records)

    assert history.total == 3
    assert history.parado == 1
    assert history.fonte == "modis_mod13q1"
    assert {a.ano: a.situacao for a in history.anos} == {
        2022: "plantou",
        2023: "parado",
        2024: "incerto",
    }


def test_should_apply_modis_scale_factor_when_values_are_raw_integers() -> None:
    # PRD §11: valor bruto 7100 -> 0,71 depois do fator de escala 0,0001
    service = FieldHistoryService()

    history = service.classify_entressafra([_rec("2022-05-01", 7100), _rec("2023-05-01", 3200)])

    assert {a.ano: (a.situacao, a.ndvi_max) for a in history.anos} == {
        2022: ("plantou", 0.71),
        2023: ("parado", 0.32),
    }


def test_should_ignore_march_soybean_green_when_classifying_offseason() -> None:
    # PRD 7.8 / plano §4.7: entressafra = 1/abr a 31/jul. O verde de março ainda é a soja.
    service = FieldHistoryService()
    records = [_rec("2023-03-06", 0.85), _rec("2023-04-23", 0.30), _rec("2023-06-10", 0.28)]

    history = service.classify_entressafra(records)

    assert [(a.ano, a.situacao) for a in history.anos] == [(2023, "parado")]


def test_should_count_july_as_offseason() -> None:
    service = FieldHistoryService()

    history = service.classify_entressafra([_rec("2023-07-28", 0.66), _rec("2023-08-13", 0.20)])

    assert [(a.ano, a.situacao) for a in history.anos] == [(2023, "plantou")]


def test_should_suggest_meio_harvest_band_when_ndvi_drops_in_mid_february() -> None:
    service = FieldHistoryService()
    records = []
    for year in range(2019, 2025):
        records += [
            _rec(f"{year}-01-17", 0.84),
            _rec(f"{year}-02-02", 0.65),
            _rec(f"{year}-02-18", 0.35),
        ]

    suggestion = service.suggest_harvest_band(records)

    assert (suggestion.faixa, suggestion.fonte, suggestion.anos_usados) == ("meio", "ndvi_modis", 6)


@pytest.mark.parametrize("scale", [1.0, 10000.0])
def test_should_fallback_to_default_meio_when_fewer_than_five_years_available(
    scale: float,
) -> None:
    # PRD §11: menos de 5 anos válidos -> faixa meio, fonte padrao
    service = FieldHistoryService()
    records = [_rec("2024-01-17", 0.80 * scale), _rec("2024-02-02", 0.30 * scale)]

    suggestion = service.suggest_harvest_band(records)

    assert (suggestion.faixa, suggestion.fonte, suggestion.anos_usados) == ("meio", "padrao", 0)
