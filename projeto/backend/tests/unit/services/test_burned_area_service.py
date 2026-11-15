"""Alerta de fogo do raio-X: anos com área queimada a até X km do ponto (tarefa 0043).

Repository falso com pixels inventados (não são do MODIS MCD64A1).
"""

from dataclasses import replace

from app.models.area_queimada import PixelQueimado, QueimadasPerto
from app.repositories.rules_repository import load_default_rules
from app.services.burned_area_service import BurnedAreaService

LAT, LON = -18.9543, -48.1993
# ~0,009° de latitude ≈ 1 km
KM = 0.009


class FakeBurnedRepository:
    def __init__(self, pixels: list[PixelQueimado] | None, anos: tuple[int, int] = (2016, 2025)):
        self._pixels = pixels
        self._anos = anos
        self.asked_km: float | None = None

    def get_burned_near(self, lat: float, lon: float, km: float) -> QueimadasPerto | None:
        self.asked_km = km
        if self._pixels is None:
            return None
        return QueimadasPerto(self._anos[0], self._anos[1], "MODIS MCD64A1", tuple(self._pixels))


def test_should_count_the_years_with_fire_within_the_radius() -> None:
    repo = FakeBurnedRepository(
        [
            PixelQueimado(LAT + 1 * KM, LON, (2017, 2021)),
            PixelQueimado(LAT - 4 * KM, LON, (2021, 2024)),
            PixelQueimado(LAT + 7 * KM, LON, (2019,)),  # a ~7 km: fora dos 5 km
        ]
    )

    alert = BurnedAreaService(repo).near(LAT, LON)

    assert alert is not None
    assert (alert.anos, alert.total_anos, alert.raio_km) == ((2017, 2021, 2024), 10, 5.0)
    assert alert.fonte == "MODIS MCD64A1"
    assert repo.asked_km == 5.0


def test_should_have_no_alert_without_fire_nearby() -> None:
    repo = FakeBurnedRepository([PixelQueimado(LAT + 8 * KM, LON, (2019,))])

    assert BurnedAreaService(repo).near(LAT, LON) is None


def test_should_have_no_alert_without_the_burned_area_file() -> None:
    assert BurnedAreaService(FakeBurnedRepository(None)).near(LAT, LON) is None


def test_should_count_only_the_years_of_the_rule_and_of_the_file() -> None:
    # O arquivo só tem 2016 a 2020: o total é 5 anos, e 2015 (fora da regra) não conta.
    repo = FakeBurnedRepository([PixelQueimado(LAT, LON, (2015, 2018))], anos=(2015, 2020))

    alert = BurnedAreaService(repo).near(LAT, LON)

    assert alert is not None
    assert (alert.anos, alert.total_anos) == ((2018,), 5)


def test_should_use_the_radius_from_the_rules() -> None:
    rules = load_default_rules()
    wide = replace(rules, alertas_area=replace(rules.alertas_area, fogo_raio_km=10.0))
    repo = FakeBurnedRepository([PixelQueimado(LAT + 8 * KM, LON, (2019,))])

    alert = BurnedAreaService(repo, wide).near(LAT, LON)

    assert alert is not None
    assert (alert.anos, alert.raio_km) == ((2019,), 10.0)
