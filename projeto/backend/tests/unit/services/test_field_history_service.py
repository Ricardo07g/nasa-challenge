"""Unit tests for FieldHistoryService (histórico do talhão pelo NDVI e colheita sugerida)."""

from dataclasses import replace
from datetime import date

import pytest

from app.models.talhao import HistoricoAno, HistoricoTalhao, NdviRecord
from app.repositories.rules_repository import load_default_rules
from app.services.errors import ValidationDomainError
from app.services.field_history_service import FieldHistoryService


def _rec(day: str, ndvi: float) -> NdviRecord:
    return NdviRecord(data=date.fromisoformat(day), ndvi=ndvi)


def _obs(day: str, ndvi: float, produto: str | None = "MOD13Q1") -> NdviRecord:
    return NdviRecord(data=date.fromisoformat(day), ndvi=ndvi, qualidade=0, produto=produto)


def _soy(year: int, raw: bool = False) -> list[NdviRecord]:
    """Soja de teste: pico de 0,85 em 17/jan e colheita (0,30) em 6/mar (grupo regiao_ndvi)."""
    scale = 10000 if raw else 1
    return [_obs(f"{year}-01-17", 0.85 * scale), _obs(f"{year}-03-06", 0.30 * scale)]


def _offseason(year: int, peak: float, n_obs: int = 3) -> list[NdviRecord]:
    """A soja do ano e `n_obs` observações boas de abril a julho, com o maior NDVI em maio."""
    days = [f"{year}-05-09", f"{year}-04-07", f"{year}-06-10", f"{year}-07-12"][:n_obs]
    low = 0.22 if abs(peak) <= 1 else 2200
    after = [_obs(day, peak if i == 0 else low) for i, day in enumerate(days)]
    return [*_soy(year, raw=abs(peak) > 1), *after]


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


def test_should_ignore_green_before_the_harvest_and_after_july() -> None:
    # A soja verde até 15/mar e o verde de agosto ficam fora. A colheita é 1/abr (a 1ª observação
    # até 0,40 depois do pico) e fica fora também; 31/jul entra.
    records = [
        _obs("2023-01-17", 0.85),
        _obs("2023-03-15", 0.80),
        _obs("2023-04-01", 0.30),
        _obs("2023-04-17", 0.31),
        _obs("2023-05-20", 0.28),
        _obs("2023-07-31", 0.25),
        _obs("2023-08-01", 0.81),
        _obs("2023-08-05", 0.82),
    ]

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2023) == HistoricoAno(ano=2023, situacao="parado", ndvi_max=0.31, n_obs=3)


def test_should_mark_sem_dado_without_ndvi_max_when_fewer_than_three_good_observations() -> None:
    records = _offseason(2018, 0.75, n_obs=2) + _offseason(2019, 0.30)

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2018) == HistoricoAno(
        ano=2018, situacao="sem_dado", ndvi_max=None, n_obs=2
    )
    assert _year(history, 2017) == HistoricoAno(
        ano=2017, situacao="sem_dado", ndvi_max=None, n_obs=0
    )


def test_should_list_every_year_from_2017_to_2026_and_ignore_the_others() -> None:
    # Decisão de 15/11/2026: 10 anos, de 2017 a 2026 (a entressafra de 2026 já aconteceu).
    records = _offseason(2016, 0.75) + _offseason(2020, 0.30) + _offseason(2027, 0.75)

    history = FieldHistoryService().classify_entressafra(records)

    assert [a.ano for a in history.anos] == list(range(2017, 2027))
    assert history.total == 10


def test_should_summarize_parado_plantou_and_sem_certeza() -> None:
    # Guia NDVI: 5 parado, 4 plantou e 1 incerto em 10 anos
    peaks = [0.30, 0.72, 0.31, 0.74, 0.29, 0.70, 0.33, 0.71, 0.28, 0.52]
    records = [
        r
        for year, peak in zip(range(2017, 2027), peaks, strict=True)
        for r in _offseason(year, peak)
    ]

    history = FieldHistoryService().classify_entressafra(records)

    assert (history.parado, history.plantou, history.sem_certeza, history.total) == (5, 4, 1, 10)


def test_should_count_incerto_and_sem_dado_as_sem_certeza() -> None:
    records = _offseason(2017, 0.30) + _offseason(2018, 0.72) + _offseason(2019, 0.50)

    history = FieldHistoryService().classify_entressafra(records)

    # 2019 incerto + 7 anos sem dado
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
    # Com mínimo de 1, uma observação depois da colheita já classifica o ano
    records = [*_soy(2021), _obs("2021-05-09", 0.30)]

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


# --- soja do ano antes da entressafra (decisão de 15/11/2026, a mesma regra da região) --------


def test_should_mark_a_year_without_the_soy_peak_as_sem_soja() -> None:
    # Cidade ou pasto seco: nunca passa de 0,70 no verão. Hoje sairia "parado"; não é soja.
    records = [_obs(day, 0.30) for day in ("2022-01-17", "2022-02-18", "2022-04-07", "2022-05-09")]
    records.append(_obs("2022-06-10", 0.28))

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2022) == HistoricoAno(
        ano=2022, situacao="sem_soja", ndvi_max=None, n_obs=0
    )


def test_should_mark_a_perennial_green_year_as_sem_soja() -> None:
    # Cana ou pasto verde o ano todo: o pico passa de 0,70, mas nunca seca até 15/mai.
    days = ("2022-01-17", "2022-02-18", "2022-03-22", "2022-04-22", "2022-05-08", "2022-06-09")
    records = [_obs(day, 0.78) for day in days]

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2022).situacao == "sem_soja"


def test_should_not_take_a_drop_after_mid_may_as_the_harvest() -> None:
    records = [
        _obs("2022-02-18", 0.88),
        _obs("2022-04-07", 0.60),
        _obs("2022-05-24", 0.30),
        _obs("2022-06-10", 0.25),
        _obs("2022-07-12", 0.25),
    ]

    assert _year(FieldHistoryService().classify_entressafra(records), 2022).situacao == "sem_soja"


def test_should_not_count_late_soy_still_green_in_april_as_planted() -> None:
    # Soja tardia: pico em 6/mar, ainda verde em 7/abr (0,75), colhida em 22/abr. Pela janela fixa
    # de abril a julho daria "plantou"; depois da colheita, ficou parado.
    records = [
        _obs("2022-02-18", 0.70),
        _obs("2022-03-06", 0.84),
        _obs("2022-04-07", 0.75),
        _obs("2022-04-22", 0.35),
        _obs("2022-05-08", 0.30),
        _obs("2022-05-24", 0.28),
        _obs("2022-06-09", 0.25),
    ]

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2022) == HistoricoAno(ano=2022, situacao="parado", ndvi_max=0.30, n_obs=3)


def test_should_keep_sem_dado_when_the_satellite_saw_nothing_in_the_summer() -> None:
    # Sem nenhuma observação boa de 1/jan a 15/mar, não dá para dizer que não teve soja.
    records = [_obs(day, 0.30) for day in ("2022-04-07", "2022-05-09", "2022-06-10")]

    history = FieldHistoryService().classify_entressafra(records)

    assert _year(history, 2022) == HistoricoAno(
        ano=2022, situacao="sem_dado", ndvi_max=None, n_obs=0
    )


def test_should_count_sem_soja_apart_from_parado_plantou_and_sem_certeza() -> None:
    no_soy = [_obs(f"{year}-{md}", 0.30) for year in (2017, 2018) for md in ("01-17", "05-09")]
    records = no_soy + _offseason(2019, 0.30) + _offseason(2020, 0.72) + _offseason(2021, 0.50)

    history = FieldHistoryService().classify_entressafra(records)

    # 2017 e 2018 sem soja; 2021 incerto + 5 anos sem dado (2022 a 2026)
    assert (history.parado, history.plantou, history.sem_certeza, history.sem_soja) == (1, 1, 6, 2)
    assert history.total == 10


def test_should_take_the_soy_peak_and_harvest_from_the_region_rules() -> None:
    # Um lugar só: o grupo regiao_ndvi do regras.yaml vale para o talhão e para a região.
    base = load_default_rules()
    regras = replace(base, regiao_ndvi=replace(base.regiao_ndvi, pico_min_ndvi=0.90))

    history = FieldHistoryService(rules=regras).classify_entressafra(_offseason(2022, 0.30))

    assert _year(history, 2022).situacao == "sem_soja"


def test_should_find_the_soy_harvest_date_after_the_peak() -> None:
    service = FieldHistoryService()
    observations = [(date(2022, 1, 17), 0.85), (date(2022, 3, 6), 0.30), (date(2022, 4, 7), 0.20)]

    assert service.soy_harvest_date(2022, observations) == date(2022, 3, 6)
    assert service.soy_harvest_date(2022, [(date(2022, 1, 17), 0.65)]) is None


# --- safras confirmadas pelo produtor (decisão de 15/11/2026) ------------------------------


def test_should_let_the_producer_confirm_the_last_three_off_seasons() -> None:
    assert FieldHistoryService().confirmable_years() == (2024, 2025, 2026)


def test_should_take_the_confirmable_years_from_injected_rules() -> None:
    base = load_default_rules()
    historico_ndvi = replace(base.historico_ndvi, ano_fim=2027, anos_confirmaveis=2)

    service = FieldHistoryService(rules=replace(base, historico_ndvi=historico_ndvi))

    assert service.confirmable_years() == (2026, 2027)


def test_should_check_the_confirmations_and_keep_them_by_year() -> None:
    confirmadas = FieldHistoryService().check_confirmations([(2026, "plantou"), (2024, "parado")])

    assert confirmadas == {2024: "parado", 2026: "plantou"}


@pytest.mark.parametrize(
    ("pairs", "message"),
    [
        ([(2023, "plantou")], "2023"),
        ([(2027, "parado")], "2027"),
        ([(2025, "incerto")], "incerto"),
        ([(2025, "plantou"), (2025, "parado")], "repetido"),
    ],
    ids=["antes-da-janela", "depois-da-janela", "valor-invalido", "ano-repetido"],
)
def test_should_refuse_confirmations_outside_the_last_three_years_or_with_other_values(
    pairs: list[tuple[int, str]], message: str
) -> None:
    with pytest.raises(ValidationDomainError, match=message):
        FieldHistoryService().check_confirmations(pairs)


def test_should_replace_the_satellite_with_the_producer_answer() -> None:
    # 2025: o satélite viu "plantou" (0,72); o produtor diz que deixou parado. Vale o produtor.
    records = _offseason(2024, 0.30) + _offseason(2025, 0.72)

    history = FieldHistoryService().classify_entressafra(records, {2025: "parado"})

    assert _year(history, 2025) == HistoricoAno(
        ano=2025, situacao="parado", ndvi_max=0.72, n_obs=3, fonte_ano="produtor"
    )
    assert _year(history, 2024).fonte_ano == "satelite"
    assert (history.parado, history.plantou, history.sem_certeza) == (2, 0, 8)


def test_should_let_the_producer_answer_a_year_the_satellite_did_not_see() -> None:
    # 2026 ainda sem dado do satélite (ou sem soja): o produtor responde e o ano passa a contar.
    records = _offseason(2024, 0.30) + _offseason(2025, 0.72)

    history = FieldHistoryService().classify_entressafra(records, {2026: "plantou"})

    assert _year(history, 2026) == HistoricoAno(
        ano=2026, situacao="plantou", ndvi_max=None, n_obs=0, fonte_ano="produtor"
    )
    assert (history.parado, history.plantou, history.sem_certeza, history.total) == (1, 2, 7, 10)


def test_should_build_the_history_from_the_producer_without_a_satellite_series() -> None:
    history = FieldHistoryService().classify_entressafra([], {2024: "parado", 2025: "plantou"})

    assert history.fonte == "produtor"
    assert (history.parado, history.plantou, history.sem_certeza, history.total) == (1, 1, 8, 10)
    assert _year(history, 2024).fonte_ano == "produtor"
    assert _year(history, 2017) == HistoricoAno(
        ano=2017, situacao="sem_dado", ndvi_max=None, n_obs=0
    )
