"""Construtores de teste da tela "Avisos" (tarefa 0046). Todos os números são de teste."""

from collections.abc import Callable, Sequence
from datetime import date, timedelta

from app.constants import CLIMATE_SEASON_DAYS
from app.models.climate import ClimateSeason
from app.models.crop_option import CropParams
from app.models.recomendacao import AnoDetalhe, NotasOpcao, ResultadoOpcao

CELL = "-190_-482"
YEARS = tuple(range(2005, 2025))


def crop(
    crop_id: str = "milho_safrinha",
    tipo: str = "grao",
    ciclo: int = 120,
    florescer: int = 60,
    kc: float = 1.2,
) -> CropParams:
    return CropParams(
        id=crop_id,
        nome=crop_id,
        tipo=tipo,
        funcao="x",
        semeadura_limite_mes_dia="02-28",
        dias_florescer=florescer,
        ciclo_dias=ciclo,
        kc_pico=kc,
        solo_palhada=0,
        solo_nitrogenio=0,
        solo_pragas=0,
        n_deixado_kg=0,
    )


def option(
    crop_id: str = "milho_safrinha",
    nome: str = "Milho sozinho",
    bad_years: Sequence[int] = (),
    years: Sequence[int] = YEARS,
) -> ResultadoOpcao:
    notas = NotasOpcao(seguranca=50.0, futuro=None, solo=50.0, renda=50.0, final=50.0)
    detalhe = tuple(
        AnoDetalhe(
            ano=y,
            bom=y not in bad_years,
            fase_critica=date(y, 4, 18),
            dias_sem_chuva=0,
            enso=None,
            texto="",
        )
        for y in years
    )
    return ResultadoOpcao(
        id=crop_id,
        nome=nome,
        na_janela=True,
        data_limite="2027-02-28",
        anos_bons_chuva=len(years) - len(bad_years),
        total_anos=len(years),
        faixa_anos=(),
        rotulo_chuva="medio",
        texto_chuva="",
        futuro=None,
        da_grao=True,
        rotulo_renda="medio",
        texto_renda="",
        texto_risco="",
        rotulo_terra="medio",
        texto_terra="",
        notas=notas,
        notas_seco=notas,
        porque=(),
        como_fazer=(),
        anos_detalhe=detalhe,
    )


DayValue = Callable[[date], float]


def season(
    year: int,
    rain: DayValue = lambda _d: 8.0,
    tmax: DayValue = lambda _d: 30.0,
    source: str = "gpm_imerg",
    days: int = CLIMATE_SEASON_DAYS,
) -> ClimateSeason:
    """Temporada de 1/jan com chuva e máxima dadas por dia (padrão: 8 mm e 30 °C todo dia)."""
    start = date(year, 1, 1)
    dates = [start + timedelta(days=i) for i in range(days)]
    return ClimateSeason(
        cell_id=CELL,
        year=year,
        start_date=start,
        lat=-18.95,
        rain_mm=tuple(rain(d) for d in dates),
        rain_source=source,
        tmax_c=tuple(tmax(d) for d in dates),
        tmin_c=tuple(18.0 for _ in dates),
        eto_mm=tuple(4.0 for _ in dates),
    )
