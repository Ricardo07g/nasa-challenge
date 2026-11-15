"""Cartão "Clima 2041–2060" do raio-X: março a maio, média dos modelos (tarefa 0043).

Deltas e temporadas de teste com valores redondos (não são do NEX-GDDP-CMIP6 nem do IMERG).
"""

from datetime import date, timedelta

from app.models.climate import ClimateSeason, Cmip6Delta
from app.services.future_climate_service import FutureClimateService

DAYS = 212


def _delta(model: str, month: int, rain_pct: float, tmax_c: float) -> Cmip6Delta:
    return Cmip6Delta(model=model, scenario="ssp245", month=month, rain_pct=rain_pct, tmax_c=tmax_c)


def _model(model: str, rain: tuple[float, float, float], tmax: float) -> list[Cmip6Delta]:
    deltas = [_delta(model, month, pct, tmax) for month, pct in zip((3, 4, 5), rain, strict=True)]
    # Meses fora de março a maio não entram.
    return [*deltas, _delta(model, 1, 50.0, 9.0), _delta(model, 7, 50.0, 9.0)]


def _season(year: int, march: float, april: float, may: float) -> ClimateSeason:
    """Chuva do mês espalhada por igual nos dias dele (o total do mês é o número dado)."""
    monthly = {3: (march, 31), 4: (april, 30), 5: (may, 31)}
    rain = []
    for i in range(DAYS):
        total, days = monthly.get((date(year, 1, 1) + timedelta(days=i)).month, (0.0, 1))
        rain.append(total / days)
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=date(year, 1, 1),
        rain_mm=tuple(rain),
        rain_source="teste",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
    )


def test_should_average_the_three_models_from_march_to_may() -> None:
    deltas = (
        _model("A", (-10.0, -10.0, -10.0), 1.0)
        + _model("B", (-20.0, -20.0, -20.0), 2.0)
        + _model("C", (6.0, 6.0, 6.0), 3.0)
    )

    result = FutureClimateService().summarize(deltas, [])

    assert result is not None
    assert (result.chuva_pct, result.tmax_c) == (-8.0, 2.0)
    assert (result.modelos, result.modelos_menos_chuva, result.modelos_mais_chuva) == (3, 2, 1)
    assert result.modelos_mais_quente == 3
    assert (result.cenario, result.periodo) == ("ssp245", "2041-2060")


def test_should_weigh_each_month_by_the_rain_that_falls_in_it() -> None:
    # Março chove 3 vezes mais que maio: −20% em março pesa mais que +20% em maio.
    deltas = _model("A", (-20.0, 0.0, 20.0), 1.0)
    seasons = [_season(2023, 300.0, 200.0, 100.0)]

    result = FutureClimateService().summarize(deltas, seasons)

    assert result is not None
    # (300 × −20 + 200 × 0 + 100 × 20) ÷ 600 = −6,7%
    assert result.chuva_pct == -6.7


def test_should_have_no_card_without_deltas() -> None:
    assert FutureClimateService().summarize([], []) is None
