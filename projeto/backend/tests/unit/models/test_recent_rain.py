"""Contrato do arquivo da chuva recente (IMERG Late, A2.3): uma célula de 0,1° por registro."""

from datetime import date

import pytest

from app.models.recent_rain import RecentRainRecord
from app.models.sinal_outono import RecentRain

DAY = date(2027, 2, 28)


def _record(**overrides: object) -> RecentRainRecord:
    # Valores de teste (não são do IMERG): 90 mm em 30 dias contra 200 mm de média.
    values: dict[str, object] = {
        "cell_id": "-190_-482",
        "lat": -18.95,
        "lon": -48.15,
        "data": DAY,
        "dias": 30,
        "chuva_30d_mm": 90.0,
        "media_30d_mm": 200.0,
        "fracao_da_media": 0.45,
        "anos_media": 20,
    }
    values.update(overrides)
    return RecentRainRecord(**values)  # type: ignore[arg-type]


def test_should_turn_the_cell_record_into_the_recent_rain_of_the_signal() -> None:
    rain = _record().to_recent_rain()

    assert rain == RecentRain(chuva_mm=90.0, media_mm=200.0, dias=30, data=DAY)
    assert rain.fracao_da_media == pytest.approx(0.45)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("chuva_30d_mm", -0.1),
        ("chuva_30d_mm", float("nan")),
        ("media_30d_mm", 0.0),
        ("media_30d_mm", float("inf")),
        ("dias", 0),
        ("anos_media", 0),
        ("lat", -90.5),
        ("lon", 180.5),
        ("cell_id", " "),
    ],
)
def test_should_reject_values_outside_the_contract(field: str, value: object) -> None:
    # Média zero não serve de comparação; chuva negativa seria o -9999,9 do IMERG passando.
    with pytest.raises(ValueError, match=field):
        _record(**{field: value})


def test_should_reject_a_fraction_that_does_not_match_rain_over_average() -> None:
    # A fração gravada tem de ser a conta das duas somas, não um número solto.
    with pytest.raises(ValueError, match="fracao_da_media"):
        _record(fracao_da_media=0.6)


def test_should_accept_the_fraction_rounded_to_four_decimals() -> None:
    record = _record(chuva_30d_mm=85.3, media_30d_mm=190.2, fracao_da_media=0.4485)

    assert record.fracao_da_media == 0.4485
