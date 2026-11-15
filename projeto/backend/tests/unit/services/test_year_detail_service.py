"""Unit tests for YearDetailService: o que aconteceu em cada ano da faixa de chuva (P1).

Séries montadas à mão (valores de teste, não são do NASA POWER). Semeadura em 18/fev; a cultura de
grão floresce no dia 60 e a fase crítica vai do dia 45 ao 74 (60 ± 15, regras.yaml, grupo clima).
O resultado de cada ano (aperto, ISNA, calor) vem pronto, como o motor entrega.
"""

from dataclasses import replace
from datetime import date, timedelta

from app.models.climate import ClimateSeason
from app.models.crop_option import CropParams
from app.models.enso import OniYear
from app.models.recomendacao import AnoDetalhe, ResultadoAno
from app.repositories.rules_repository import load_default_rules
from app.services.year_detail_service import YearDetailService

SOWING = date(2027, 2, 18)  # o ano é ignorado: vale o dia e o mês de cada ano da série
DAYS = 212
WET_MM = 8.0
DRY_MM = 0.0


def _crop(tipo: str = "grao") -> CropParams:
    return CropParams(
        id="milho_safrinha",
        nome="Milho",
        tipo=tipo,
        funcao="Grão",
        semeadura_limite_mes_dia="02-28",
        dias_florescer=60,
        ciclo_dias=100,
        kc_pico=1.2,
        solo_palhada=20,
        solo_nitrogenio=0,
        solo_pragas=0,
        n_deixado_kg=0,
    )


def _season(year: int, dry_after_sowing: range = range(0)) -> ClimateSeason:
    """Chuva todo dia, menos nos dias `dry_after_sowing` (contados a partir da semeadura)."""
    start = date(year, 1, 1)
    sowing_idx = (date(year, SOWING.month, SOWING.day) - start).days
    rain = tuple(DRY_MM if (i - sowing_idx) in dry_after_sowing else WET_MM for i in range(DAYS))
    return ClimateSeason(
        cell_id="-190_-482",
        year=year,
        start_date=start,
        lat=-18.95,
        rain_mm=rain,
        rain_source="nasa_power",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
    )


def _result(
    year: int, falta_agua: bool = False, calor: bool = False, dias_calor: int = 0
) -> ResultadoAno:
    return ResultadoAno(
        ano=year,
        aperto=falta_agua or calor,
        isna=0.4 if falta_agua else 0.9,
        dias_calor=dias_calor,
        falta_agua=falta_agua,
        calor=calor,
    )


class FakeEnsoRepository:
    def __init__(self, years: list[OniYear]) -> None:
        self._years = years

    def get_oni_years(self) -> list[OniYear]:
        return list(self._years)


ONI = FakeEnsoRepository(
    [OniYear(2019, 0.93, "el_nino"), OniYear(2020, 0.65, None), OniYear(2021, -0.86, "la_nina")]
)


def _details(
    seasons: list[ClimateSeason],
    resultados: list[ResultadoAno],
    crop: CropParams | None = None,
    enso_repo: FakeEnsoRepository | None = ONI,
    lang: str = "pt-BR",
) -> tuple[AnoDetalhe, ...]:
    service = YearDetailService(enso_repo=enso_repo)
    return service.year_details(
        crop=crop or _crop(), semeadura=SOWING, seasons=seasons, resultados=resultados, lang=lang
    )


def test_should_describe_a_year_with_a_dry_spell_in_the_critical_stage() -> None:
    # 2019: 12 dias sem chuva no meio da fase crítica (dias 50 a 61) e ISNA abaixo do limiar
    [detalhe] = _details([_season(2019, range(50, 62))], [_result(2019, falta_agua=True)])

    assert detalhe == AnoDetalhe(
        ano=2019,
        bom=False,
        fase_critica=date(2019, 4, 19),  # 18/fev + 60 dias (floração estimada)
        dias_sem_chuva=12,
        enso="el_nino",
        texto=(
            "Em 2019, plantando em 18 de fevereiro, a planta chegou na fase que mais precisa de "
            "água por volta de 19 de abril e ficou 12 dias sem chuva. Faltou água nessa fase. "
            "Ano de El Niño."
        ),
    )


def test_should_describe_a_good_year_without_a_dry_day_in_the_critical_stage() -> None:
    # 2020 é bissexto: 18/fev + 60 dias = 18/abr. Ano neutro no ONI: sem marca.
    [detalhe] = _details([_season(2020)], [_result(2020)])

    assert (detalhe.bom, detalhe.fase_critica, detalhe.dias_sem_chuva) == (
        True,
        date(2020, 4, 18),
        0,
    )
    assert detalhe.enso is None
    assert detalhe.texto == (
        "Em 2020, plantando em 18 de fevereiro, a planta chegou na fase que mais precisa de água "
        "por volta de 18 de abril e não ficou nenhum dia sem chuva. Deu certo."
    )


def test_should_count_only_the_dry_days_inside_the_critical_stage() -> None:
    # Seca dos dias 30 a 49: só os dias 45 a 49 caem na fase crítica
    [detalhe] = _details([_season(2021, range(30, 50))], [_result(2021)])

    assert detalhe.dias_sem_chuva == 5


def test_should_use_the_singular_for_a_single_dry_day() -> None:
    [detalhe] = _details([_season(2021, range(50, 51))], [_result(2021)])

    assert "e ficou 1 dia sem chuva. Deu certo. Ano de La Niña." in detalhe.texto


def test_should_say_when_the_year_had_heat_in_the_critical_stage() -> None:
    [detalhe] = _details([_season(2021)], [_result(2021, calor=True, dias_calor=4)])

    assert detalhe.bom is False
    assert detalhe.texto.endswith(
        "não ficou nenhum dia sem chuva. Fez 4 dias com 35 °C ou mais nessa fase. Ano de La Niña."
    )


def test_should_say_both_reasons_when_water_and_heat_failed() -> None:
    [detalhe] = _details(
        [_season(2019, range(45, 75))], [_result(2019, falta_agua=True, calor=True, dias_calor=3)]
    )

    assert detalhe.dias_sem_chuva == 30
    assert detalhe.texto.endswith(
        "ficou 30 dias sem chuva. Faltou água nessa fase. "
        "Fez 3 dias com 35 °C ou mais nessa fase. Ano de El Niño."
    )


def test_should_leave_enso_empty_without_the_oni_file() -> None:
    detalhes = _details(
        [_season(2019, range(50, 62)), _season(2021)],
        [_result(2019, falta_agua=True), _result(2021)],
        enso_repo=None,
    )

    assert [d.enso for d in detalhes] == [None, None]
    assert all("Niño" not in d.texto and "Niña" not in d.texto for d in detalhes)


def test_should_follow_the_years_and_the_result_of_the_motor_in_order() -> None:
    # A faixa sai de anos_detalhe[].bom: um item por ano simulado, na mesma ordem, bom = sem aperto
    seasons = [_season(year) for year in (2019, 2020, 2021)]
    resultados = [_result(2019), _result(2020, falta_agua=True), _result(2021)]

    detalhes = _details(seasons, resultados)

    assert [(d.ano, d.bom) for d in detalhes] == [(2019, True), (2020, False), (2021, True)]


def test_should_use_the_establishment_window_for_cover_crops() -> None:
    # Cobertura: a fase crítica são os primeiros 30 dias, que começam na semeadura
    [detalhe] = _details(
        [_season(2021, range(25, 40))], [_result(2021)], crop=_crop(tipo="cobertura")
    )

    assert (detalhe.fase_critica, detalhe.dias_sem_chuva) == (date(2021, 2, 18), 5)
    assert detalhe.texto == (
        "Em 2021, plantando em 18 de fevereiro, nos primeiros 30 dias, quando a planta mais "
        "precisa de água para pegar, a lavoura ficou 5 dias sem chuva. Deu certo. Ano de La Niña."
    )


def test_should_write_the_text_in_english() -> None:
    [detalhe] = _details(
        [_season(2019, range(50, 62))], [_result(2019, falta_agua=True)], lang="en"
    )

    assert detalhe.texto == (
        "In 2019, sowing on February 18, the crop reached the stage that needs water most around "
        "April 19 and went 12 days without rain. The crop ran short of water in this stage. "
        "El Niño year."
    )


def test_should_take_the_dry_day_threshold_and_the_texts_from_the_rules() -> None:
    base = load_default_rules()
    frases = dict(base.frases_ano)
    frases["pt"] = replace(frases["pt"], el_nino="El Niño (NOAA).")
    rules = replace(base, avisos=replace(base.avisos, dia_seco_abaixo_mm=10.0), frases_ano=frases)
    service = YearDetailService(enso_repo=ONI, rules=rules)

    # Com o limiar de 10 mm, os dias de 8 mm também são secos: a fase inteira (30 dias)
    [detalhe] = service.year_details(
        crop=_crop(), semeadura=SOWING, seasons=[_season(2019)], resultados=[_result(2019)]
    )

    assert detalhe.dias_sem_chuva == 30
    assert detalhe.texto.endswith("El Niño (NOAA).")


def test_should_write_the_first_day_of_a_month_as_an_ordinal_in_portuguese() -> None:
    # 1º de abril: semeadura em 31/jan + 60 dias, num ano comum
    service = YearDetailService(enso_repo=None)
    [detalhe] = service.year_details(
        crop=_crop(),
        semeadura=date(2027, 1, 31),
        seasons=[_season(2019)],
        resultados=[_result(2019)],
    )

    assert detalhe.fase_critica == date(2019, 1, 31) + timedelta(days=60)
    assert "plantando em 31 de janeiro" in detalhe.texto
    assert "por volta de 1º de abril" in detalhe.texto
