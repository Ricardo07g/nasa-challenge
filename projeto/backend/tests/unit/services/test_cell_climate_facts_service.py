"""Unit tests for CellClimateFactsService (clima 2041-2060 e geada da célula, tarefa 0044)."""

from datetime import date

from app.models.climate import ClimateSeason, Cmip6Delta
from app.services.cell_climate_facts_service import CellClimateFactsService

DAYS = 212


def _deltas(model: str, rain_by_month: dict[int, float], tmax_c: float) -> list[Cmip6Delta]:
    return [
        Cmip6Delta(
            model=model,
            scenario="ssp245",
            month=m,
            rain_pct=rain_by_month.get(m, 50.0),
            tmax_c=tmax_c if m in (3, 4, 5) else 9.0,
        )
        for m in range(1, 8)
    ]


def _season(year: int, cold_day: date | None = None, tmin: float = 12.0) -> ClimateSeason:
    start = date(year, 1, 1)
    mins = [tmin] * DAYS
    if cold_day is not None:
        mins[(cold_day - start).days] = 2.5
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=start,
        lat=-18.95,
        rain_mm=tuple([3.0] * DAYS),
        rain_source="gpm_imerg",
        tmax_c=tuple([28.0] * DAYS),
        tmin_c=tuple(mins),
        eto_mm=(),
    )


def test_should_average_march_to_may_across_models_and_count_who_agrees() -> None:
    # Média de março a maio de cada modelo: A -10, B -20, C +6 -> média -8,0; 2 de 3 indicam menos
    # chuva. Máxima: +1, +2, +3 -> +2,0, os 3 indicam mais calor. Os outros meses não entram.
    deltas = (
        _deltas("A", {3: -10.0, 4: -10.0, 5: -10.0}, 1.0)
        + _deltas("B", {3: -20.0, 4: -20.0, 5: -20.0}, 2.0)
        + _deltas("C", {3: 6.0, 4: 6.0, 5: 6.0}, 3.0)
    )

    clima = CellClimateFactsService().future_outlook(deltas)

    assert clima is not None
    assert (clima.chuva_pct, clima.tmax_c) == (-8.0, 2.0)
    assert (clima.modelos, clima.concordam_chuva, clima.concordam_tmax) == (3, 2, 3)
    assert clima.meses == (3, 4, 5)
    assert clima.cenario == "ssp245"


def test_should_have_no_future_climate_line_without_deltas() -> None:
    assert CellClimateFactsService().future_outlook([]) is None


def test_should_count_years_with_a_frost_night_between_may_and_july() -> None:
    seasons = [
        _season(2005, cold_day=date(2005, 6, 10)),  # geada em junho: conta
        _season(2006, cold_day=date(2006, 4, 20)),  # abril: fora dos meses
        _season(2007),
        _season(2008, cold_day=date(2008, 7, 2)),
    ]

    geada = CellClimateFactsService().frost_risk(seasons)

    assert geada is not None
    assert (geada.anos, geada.total) == (2, 4)
    assert (geada.tmin_max_c, geada.meses) == (3.0, (5, 6, 7))


def test_should_report_zero_frost_years_when_no_night_gets_that_cold() -> None:
    geada = CellClimateFactsService().frost_risk([_season(2005), _season(2006)])

    assert geada is not None
    assert geada.anos == 0


def test_should_have_no_frost_line_without_seasons() -> None:
    assert CellClimateFactsService().frost_risk([]) is None
