"""Unit tests for FieldHistoryService (histórico do talhão pelo NDVI e colheita sugerida)."""

from dataclasses import replace
from datetime import date

import pytest

from app.models.talhao import HistoricoAno, HistoricoTalhao, NdviRecord
from app.repositories.rules_repository import load_default_rules
from app.services.field_history_service import FieldHistoryService


def _rec(day: str, ndvi: float) -> NdviRecord:
    return NdviRecord(data=date.fromisoformat(day), ndvi=ndvi)


def _obs(day: str, ndvi: float, produto: str | None = "MOD13Q1") -> NdviRecord:
    return NdviRecord(data=date.fromisoformat(day), ndvi=ndvi, qualidade=0, produto=produto)


def _offseason(year: int, peak: float, n_obs: int = 3) -> list[NdviRecord]:
    """`n_obs` observações boas de abril a julho, com o maior NDVI em maio."""
    days = [f"{year}-05-09", f"{year}-04-07", f"{year}-06-10", f"{year}-07-12"][:n_obs]
    low = 0.22 if abs(peak) <= 1 else 2200
    return [_obs(day, peak if i == 0 else low) for i, day in enumerate(days)]


def _year(history: HistoricoTalhao, ano: int) -> HistoricoAno:
    return next(a for a in history.anos if a.ano == ano)


@pytest.mark.parametrize(
    ("peak", "situacao"),
    [(0.72, "plantou"), (0.30, "parado"), (0.52, "incerto"), (0.60, "incerto"), (0.45, "incerto")],
)
def test_should_classify_year_by_highest_offseason_ndvi(peak: float, situacao: str) -> None:
    # Guia NDVI, "Regra do talhão": > 0,60 plantou; < 0,45 parado; entre (e nos limites) incerto
    history = FieldHistoryService().classify_entressafra(_offseason(2022, peak))

    assert _year(history, 2022) == HistoricoAno(ano=2022, situacao=situacao, ndvi_max=peak, n_obs=3)


@pytest.mark.parametrize(
    ("raw", "ndvi_max", "situacao"), [(7100, 0.71, "plantou"), (6000, 0.6, "incerto")]
)
def test_should_apply_modis_scale_factor_when_values_are_raw_integers(
    raw: int, ndvi_max: float, situacao: str
) -> None:
    # Guia NDVI: valor bruto 7.100 vira 0,71; 6.000 vira 0,60 (incerto, sem erro de arredondamento)
    history = FieldHistoryService().classify_entressafra(_offseason(2022, raw))

    assert (_year(history, 2022).ndvi_max, _year(history, 2022).situacao) == (ndvi_max, situacao)


def test_should_ignore_green_outside_april_to_july() -> None:
    # 15/mar (ainda a soja) e 5/ago ficam fora; 1/abr e 31/jul entram (janela inclusiva).
    records = [
        _obs("2023-03-15", 0.85),
        _obs("2023-03-31", 0.80),
        _obs("2023-04-01", 0.30),
        _obs("2023-05-20", 0.28),
        _obs("2023-07-31", 0.25),
        _obs("2023-08-01", 0.81),
        _obs("2023-08-05", 0.82),
    ]

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2023) == HistoricoAno(ano=2023, situacao="parado", ndvi_max=0.30, n_obs=3)


def test_should_mark_sem_dado_without_ndvi_max_when_fewer_than_three_good_observations() -> None:
    records = _offseason(2018, 0.75, n_obs=2) + _offseason(2019, 0.30)

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2018) == HistoricoAno(
        ano=2018, situacao="sem_dado", ndvi_max=None, n_obs=2
    )
    assert _year(history, 2017) == HistoricoAno(
        ano=2017, situacao="sem_dado", ndvi_max=None, n_obs=0
    )


def test_should_list_every_year_from_2016_to_2025_and_ignore_the_others() -> None:
    records = _offseason(2015, 0.75) + _offseason(2020, 0.30) + _offseason(2026, 0.75)

    history = FieldHistoryService().classify_entressafra(records)

    assert [a.ano for a in history.anos] == list(range(2016, 2026))
    assert history.total == 10


def test_should_summarize_parado_plantou_and_sem_certeza() -> None:
    # Guia NDVI: 5 parado, 4 plantou e 1 incerto em 10 anos
    peaks = [0.30, 0.72, 0.31, 0.74, 0.29, 0.70, 0.33, 0.71, 0.28, 0.52]
    records = [
        r
        for year, peak in zip(range(2016, 2026), peaks, strict=True)
        for r in _offseason(year, peak)
    ]

    history = FieldHistoryService().classify_entressafra(records)

    assert (history.parado, history.plantou, history.sem_certeza, history.total) == (5, 4, 1, 10)


def test_should_count_incerto_and_sem_dado_as_sem_certeza() -> None:
    records = _offseason(2016, 0.30) + _offseason(2017, 0.72) + _offseason(2018, 0.50)

    history = FieldHistoryService().classify_entressafra(records)

    # 2018 incerto + 7 anos sem dado
    assert (history.parado, history.plantou, history.sem_certeza, history.total) == (1, 1, 8, 10)


def test_should_name_window_and_the_modis_products_that_were_used() -> None:
    terra_e_aqua = [_obs("2020-04-07", 0.3), _obs("2020-04-15", 0.3, produto="MYD13Q1")]
    so_terra = [_obs("2020-04-07", 0.3)]
    cache_antigo = [NdviRecord(data=date(2020, 4, 7), ndvi=3000)]
    service = FieldHistoryService()

    assert service.classify_entressafra(terra_e_aqua).fonte == "MODIS MOD13Q1 + MYD13Q1"
    assert service.classify_entressafra(so_terra).fonte == "MODIS MOD13Q1"
    # O cache antigo não diz o produto: não inventa qual foi.
    assert service.classify_entressafra(cache_antigo).fonte == "MODIS"
    assert service.classify_entressafra(so_terra).janela == "04-01 a 07-31"


def test_should_classify_with_limits_from_injected_rules() -> None:
    # regras.yaml: "plantou" só acima de 0,80 -> o pico de 0,72 vira "incerto"
    base = load_default_rules()
    regras = replace(base, historico_ndvi=replace(base.historico_ndvi, limite_plantou=0.80))

    history = FieldHistoryService(rules=regras).classify_entressafra(_offseason(2022, 0.72))

    assert _year(history, 2022).situacao == "incerto"


def test_should_use_window_years_and_minimum_from_injected_rules() -> None:
    base = load_default_rules()
    historico_ndvi = replace(
        base.historico_ndvi,
        janela_inicio="05-01",
        janela_fim="06-30",
        min_observacoes=1,
        ano_inicio=2020,
        ano_fim=2022,
    )
    service = FieldHistoryService(rules=replace(base, historico_ndvi=historico_ndvi))
    # 7/abr (0,75) fica fora da janela de maio a junho; sobra 1 observação de 0,30
    records = [_obs("2021-04-07", 0.75), _obs("2021-05-09", 0.30)]

    history = service.classify_entressafra(records)

    assert [a.ano for a in history.anos] == [2020, 2021, 2022]
    assert _year(history, 2021) == HistoricoAno(ano=2021, situacao="parado", ndvi_max=0.30, n_obs=1)
    assert history.janela == "05-01 a 06-30"


def test_should_classify_one_year_from_its_good_values() -> None:
    # A regra de um ano só, que a região pelo satélite (P3) aplica a cada pixel.
    service = FieldHistoryService()

    assert service.classify_year(2022, [0.22, 0.72, 0.25]) == HistoricoAno(
        ano=2022, situacao="plantou", ndvi_max=0.72, n_obs=3
    )
    assert service.classify_year(2022, [0.72, 0.25]).situacao == "sem_dado"


@pytest.mark.parametrize(
    ("day", "inside"),
    [
        (date(2023, 4, 1), True),
        (date(2023, 7, 31), True),
        (date(2024, 5, 15), True),
        (date(2023, 3, 31), False),
        (date(2023, 8, 1), False),
    ],
)
def test_should_tell_whether_a_day_falls_in_the_offseason_window(day: date, inside: bool) -> None:
    assert FieldHistoryService().in_entressafra(day) is inside


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


def test_should_suggest_harvest_band_from_interleaved_terra_and_aqua_observations() -> None:
    # Arquivo novo: NDVI físico, qualidade e produto, com Terra e Aqua defasados em 8 dias.
    records = []
    for year in range(2016, 2022):
        records += [
            _obs(f"{year}-01-09", 0.80, produto="MYD13Q1"),
            _obs(f"{year}-01-17", 0.84),
            _obs(f"{year}-02-02", 0.70),
            _obs(f"{year}-02-10", 0.38, produto="MYD13Q1"),  # dia 41: abaixo de 50% do pico
            _obs(f"{year}-02-18", 0.30),
        ]

    suggestion = FieldHistoryService().suggest_harvest_band(records)

    assert (suggestion.faixa, suggestion.fonte, suggestion.anos_usados) == ("cedo", "ndvi_modis", 6)
