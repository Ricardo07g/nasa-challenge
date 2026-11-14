"""Repositories do sinal para o outono: enquanto as tarefas A2.1 a A2.3 não trazem os dados."""

from app.repositories.sinal_outono_repository import NoAutumnSignalDataRepository


def test_should_have_no_forecast_soil_moisture_or_recent_rain_until_the_data_arrives() -> None:
    # Sem o dado, nada de previsão inventada: o service devolve sinal nulo (PRD 7.10, AGENTS.md).
    repo = NoAutumnSignalDataRepository()

    assert repo.get_seasonal_forecast(-18.9543, -48.1993) is None
    assert repo.get_recent_soil_moisture(-18.9543, -48.1993) is None
    assert repo.get_recent_rain(-18.9543, -48.1993) is None
