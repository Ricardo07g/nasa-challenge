"""Histórico do talhão em faixa de calor e bloco "Verde da lavoura" do raio-X (tarefa 0043).

Valores de teste (não são do MODIS): chaves de produto do contrato, NDVI redondo.
"""

from datetime import date

from app.models.soja_recente import SojaRecente
from app.models.talhao import NdviRecord
from app.services.ndvi_strip_service import NdviStripService

SERVICE = NdviStripService()


def _rec(day: date, ndvi: float, produto: str = "MOD13Q1") -> NdviRecord:
    return NdviRecord(data=day, ndvi=ndvi, qualidade=0, produto=produto)


def test_should_have_one_column_per_16_day_reading_from_january_to_july() -> None:
    strip = SERVICE.strip([_rec(date(2023, 1, 1), 0.8)])

    assert strip is not None
    assert strip.colunas == (
        "01-01", "01-17", "02-02", "02-18", "03-06", "03-22", "04-07",
        "04-23", "05-09", "05-25", "06-10", "06-26", "07-12", "07-28",
    )  # fmt: skip


def test_should_have_one_row_per_year_of_the_field_history() -> None:
    # Os anos do historico_ndvi do regras.yaml (2017 a 2026, decisão D5 da remodelagem).
    strip = SERVICE.strip([_rec(date(2023, 1, 1), 0.8)])

    assert strip is not None
    assert [row.ano for row in strip.anos] == list(range(2017, 2027))
    assert all(len(row.valores) == 14 for row in strip.anos)


def test_should_keep_the_highest_of_terra_and_aqua_in_each_column() -> None:
    # Terra no dia 17 (17/jan) e Aqua no dia 25 (25/jan): a mesma coluna de 17/jan a 1º/fev.
    records = [
        _rec(date(2023, 1, 17), 0.62),
        _rec(date(2023, 1, 25), 0.71, "MYD13Q1"),
        _rec(date(2023, 4, 7), 0.3),
    ]

    strip = SERVICE.strip(records)

    assert strip is not None
    row = next(r for r in strip.anos if r.ano == 2023)
    assert row.valores[1] == 0.71
    assert row.valores[6] == 0.3
    assert row.valores[0] is None


def test_should_say_the_source_and_the_day_the_soy_usually_dries() -> None:
    records = []
    for year in range(2017, 2027):
        records += [_rec(date(year, 1, 17), 0.84), _rec(date(year, 2, 18), 0.35)]

    strip = SERVICE.strip(records)

    assert strip is not None
    assert strip.fonte == "MODIS MOD13Q1"
    assert strip.colheita_dia == "02-18"


def test_should_leave_out_readings_after_july_and_out_of_the_years() -> None:
    strip = SERVICE.strip([_rec(date(2023, 8, 13), 0.5), _rec(date(2015, 3, 6), 0.5)])

    assert strip is None


def test_should_have_no_strip_without_ndvi() -> None:
    assert SERVICE.strip([]) is None


# --- bloco 4: verde da lavoura ------------------------------------------------------------------


def test_should_give_the_last_reading_and_the_soy_peak_of_the_latest_season() -> None:
    records = [
        _rec(date(2025, 1, 17), 0.9),
        _rec(date(2026, 1, 9), 0.81, "MYD13Q1"),
        _rec(date(2026, 1, 25), 0.86, "MYD13Q1"),
        _rec(date(2026, 3, 22), 0.95),  # depois de 15/mar: fora da janela do pico da soja
        _rec(date(2026, 7, 28), 0.42),
    ]

    green = SERVICE.green(records, None)

    assert green is not None
    assert (green.ultimo_ndvi, green.ultimo_data) == (0.42, date(2026, 7, 28))
    assert (green.pico_ndvi, green.pico_data, green.safra) == (0.86, date(2026, 1, 25), "2025/26")
    assert green.fonte == "MODIS MOD13Q1 + MYD13Q1"


def test_should_use_the_recent_soy_map_without_a_series() -> None:
    soja = SojaRecente(safra="2025/26", vista=True, ndvi_pico=0.88, fonte="MODIS MOD13Q1 + MYD13Q1")

    green = SERVICE.green([], soja)

    assert green is not None
    assert (green.ultimo_ndvi, green.pico_ndvi, green.safra) == (None, 0.88, "2025/26")


def test_should_have_no_green_block_without_any_ndvi() -> None:
    no_data = SojaRecente(safra="2025/26", vista=None, ndvi_pico=None, fonte="MODIS")

    assert SERVICE.green([], None) is None
    assert SERVICE.green([], no_data) is None


def test_should_say_whether_the_satellite_saw_soy_in_the_latest_season() -> None:
    # S9 (tarefa 0049): num ponto sem soja (cidade), o bloco dizia "Pico da soja 2025/26: 0,33". O
    # bloco diz se a soja apareceu, com a mesma regra da faixa do histórico (pico e colheita).
    soy = [
        _rec(date(2026, 1, 17), 0.86),
        _rec(date(2026, 2, 18), 0.35),
        _rec(date(2026, 7, 28), 0.4),
    ]
    city = [
        _rec(date(2026, 1, 17), 0.33),
        _rec(date(2026, 2, 18), 0.31),
        _rec(date(2026, 7, 28), 0.3),
    ]
    winter_only = [_rec(date(2026, 7, 28), 0.4)]

    with_soy, without_soy, unknown = (SERVICE.green(r, None) for r in (soy, city, winter_only))

    assert with_soy is not None and with_soy.soja_vista is True
    assert without_soy is not None and without_soy.soja_vista is False
    assert without_soy.pico_ndvi == 0.33  # o número fica: muda só o rótulo na tela
    assert unknown is not None and unknown.soja_vista is None  # nenhuma leitura do verão


def test_should_take_whether_soy_was_seen_from_the_recent_soy_map_without_a_series() -> None:
    city = SojaRecente(safra="2025/26", vista=False, ndvi_pico=0.33, fonte="MODIS MOD13Q1")

    green = SERVICE.green([], city)

    assert green is not None and green.soja_vista is False
