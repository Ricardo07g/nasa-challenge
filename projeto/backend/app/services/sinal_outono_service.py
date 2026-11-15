"""Sinal para o outono e SMAP de agora (RF-20; tarefa 0038, decisão de 15/11/2026).

Regra (hipótese do time, a revisar; números no `regras.yaml`, grupo `sinal_enso`):
1. Previsão do ENSO: a chance oficial de El Niño, neutro e La Niña da NOAA CPC para a estação do
   outono da safrinha (FMA). Sem fase mais provável com a chance mínima: `incerto`.
2. Histórico: nos anos daquela fase (ONI de cada ano, `EnsoRepository`), em quantos a opção do
   1º ano do Plano A deu certo (o `bom` do `anos_detalhe`, PRD 7.2). Com poucos anos: `incerto`.
   Com problema em metade ou mais deles: `seco` (Plano B), se o 1º ano do Plano B se saiu melhor
   nesses anos (ou é a mesma cultura); senão, `incerto`. No resto: `normal` (Plano A).
3. SMAP de agora: uma frase com o percentil, só para informar (não decide o plano).
Mostra chance, nunca certeza, e nunca inventa previsão: sem a previsão do ENSO, não há sinal.
A regra antiga da data (chuva dos 30 dias antes da data limite, `regra_dia_plantar`) saiu na S9 da
remodelagem (tarefa 0049): a tela do Plano trocou a regra pelo Plano A / Plano B com o número
derivado da série (tarefa 0045).
"""

import math
from bisect import bisect_right
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Final

from app.models.climate import ClimateSeason
from app.models.enso import FaseEnso
from app.models.enso_forecast import EnsoSeasonForecast, season_middle_month
from app.models.recomendacao import PlanoRotacao, ResultadoOpcao
from app.models.regras import Regras
from app.models.sinal_outono import (
    NivelSinal,
    RecentSoilMoisture,
    SinalOutono,
    SmapAgora,
)
from app.repositories.enso_forecast_repository import EnsoForecastRepository
from app.repositories.enso_repository import EnsoRepository
from app.repositories.rules_repository import load_default_rules
from app.repositories.sinal_outono_repository import RecentSoilMoistureRepository

SECO: NivelSinal = "seco"
NORMAL: NivelSinal = "normal"
INCERTO: NivelSinal = "incerto"
SOURCE_SOIL: Final[str] = "SMAP"
# Nome de cada fonte da chuva guardada (`climate_season.rain_source`), na ordem em que aparece.
RAIN_SOURCE_NAMES: Final[dict[str, str]] = {"nasa_power": "NASA POWER", "gpm_imerg": "GPM IMERG"}
FALLOW_NAME = {"pt": "pousio", "en": "fallow"}
MONTHS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
MONTH_NAMES_PT = (
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)
MONTH_NAMES_EN = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)
# Nome da fase na previsão e nos anos da série (neutro é a fase None)
PHASE_PT: Final[dict[FaseEnso | None, str]] = {
    "el_nino": "El Niño",
    "la_nina": "La Niña",
    None: "neutro, sem El Niño nem La Niña",
}
PHASE_EN: Final[dict[FaseEnso | None, str]] = {
    "el_nino": "El Niño",
    "la_nina": "La Niña",
    None: "neutral, no El Niño or La Niña",
}
# Como a terra está agora, uma frase por faixa do SMAP (as faixas vêm do regras.yaml)
SMAP_BANDS_PT: Final[tuple[str, ...]] = (
    "mais seca que o normal",
    "um pouco mais seca que o normal",
    "com a umidade perto do normal",
    "um pouco mais úmida que o normal",
    "mais úmida que o normal",
)
SMAP_BANDS_EN: Final[tuple[str, ...]] = (
    "drier than normal",
    "a little drier than normal",
    "close to normal",
    "a little wetter than normal",
    "wetter than normal",
)
PERCENT = 100
MONTHS_IN_YEAR = 12


@dataclass(frozen=True)
class _PhaseRecord:
    """Como uma opção se saiu nos anos de uma fase: quantos, quantos bons e o 1º ano da série."""

    anos: int
    bons: int
    inicio: int


def _record(
    option: ResultadoOpcao | None, phases: dict[int, FaseEnso | None], fase: FaseEnso | None
) -> _PhaseRecord | None:
    """Anos da fase entre os anos da opção com o ONI conhecido; None sem nenhum ano com o ONI."""
    if option is None:
        return None
    known = [d for d in option.anos_detalhe if d.ano in phases]
    if not known:
        return None
    in_phase = [d for d in known if phases[d.ano] == fase]
    return _PhaseRecord(
        anos=len(in_phase), bons=sum(1 for d in in_phase if d.bom), inicio=min(d.ano for d in known)
    )


def _years_text(anos: int, fase: FaseEnso | None, en: bool) -> str:
    """Quantos anos da fase: 6 anos de El Niño, 1 ano neutro, 6 El Niño years."""
    if en:
        label = "neutral" if fase is None else PHASE_EN[fase]
        return f"{anos} {label} {'year' if anos == 1 else 'years'}"
    if fase is None:
        return "1 ano neutro" if anos == 1 else f"{anos} anos neutros"
    return f"{anos} {'ano' if anos == 1 else 'anos'} de {PHASE_PT[fase]}"


def _few_years_text(anos: int, fase: FaseEnso | None, en: bool) -> str:
    """Poucos anos da fase: Só 3 anos de La Niña, Nenhum ano neutro, Only 3 La Niña years."""
    if anos == 0:
        one = _years_text(1, fase, en).removeprefix("1 ")
        return f"No {one}" if en else f"Nenhum {one}"
    return f"Only {_years_text(anos, fase, en)}" if en else f"Só {_years_text(anos, fase, en)}"


class SinalOutonoService:
    """Junta a previsão do ENSO, o histórico das opções e a chuva guardada no sinal da tela 7."""

    def __init__(
        self,
        forecast_repo: EnsoForecastRepository,
        enso_repo: EnsoRepository,
        soil_moisture_repo: RecentSoilMoistureRepository,
        rules: Regras | None = None,
        today: Callable[[], date] = date.today,
    ) -> None:
        self._forecast_repo = forecast_repo
        self._enso_repo = enso_repo
        self._soil_moisture_repo = soil_moisture_repo
        regras = rules if rules is not None else load_default_rules()
        self._regras = regras.sinal_enso
        if len(self._regras.smap_faixas_pct) != len(SMAP_BANDS_PT) - 1:
            raise ValueError(
                f"sinal_enso.smap_faixas_pct precisa de {len(SMAP_BANDS_PT) - 1} percentis"
            )
        self._today = today

    def evaluate(
        self,
        lat: float,
        lon: float,
        plano_a: PlanoRotacao,
        plano_b: PlanoRotacao,
        opcoes: Sequence[ResultadoOpcao],
        seasons: Sequence[ClimateSeason] = (),
        lang: str = "pt-BR",
    ) -> SinalOutono | None:
        """Sinal para o ponto, entre o Plano A e o Plano B.

        O Plano A é o melhor plano do ano normal e o Plano B, o do ano seco (PRD 7.7 e 7.10).
        `seasons` é a série de chuva guardada da célula (a mesma do motor): o histórico de cada
        opção vem dela, e a fonte da chuva entra nas fontes do sinal.
        Devolve None sem a previsão do ENSO, sem a estação do outono nela ou com ela já passada.
        """
        forecast = self._forecast_repo.get_enso_forecast()
        season = forecast.season(self._regras.estacao_previsao) if forecast else None
        if forecast is None or season is None or season.last_day() < self._today():
            return None

        en = lang.lower().startswith("en")
        by_id = {o.id: o for o in opcoes}
        nivel, motivo = self._level_and_reason(season, forecast.fonte, plano_a, plano_b, by_id, en)
        rain_sources = self._rain_sources(seasons)
        moisture = self._soil_moisture_repo.get_recent_soil_moisture(lat, lon)
        smap_agora = self._smap_now(moisture, en) if moisture is not None else None
        fonte = (forecast.fonte, *rain_sources) + ((SOURCE_SOIL,) if smap_agora else ())
        return SinalOutono(
            nivel=nivel,
            motivo=motivo,
            fonte=fonte,
            data=forecast.emitida_em,
            smap_agora=smap_agora,
        )

    # --- nível e motivo ------------------------------------------------------------------------

    def _level_and_reason(
        self,
        season: EnsoSeasonForecast,
        fonte: str,
        plano_a: PlanoRotacao,
        plano_b: PlanoRotacao,
        by_id: dict[str, ResultadoOpcao],
        en: bool,
    ) -> tuple[NivelSinal, str]:
        regras = self._regras
        period = self._period(season, en)
        top = season.most_likely()
        if top is None or top[1] < regras.fase_chance_min_pct:
            pcts = (season.la_nina, season.neutro, season.el_nino)
            if en:
                parts = "La Niña {}%, neutral {}%, El Niño {}%".format(*pcts)
                return INCERTO, f"Forecast for {period} ({fonte}): no phase stands out ({parts})."
            parts = "La Niña {}%, neutro {}%, El Niño {}%".format(*pcts)
            return INCERTO, f"Previsão para {period} ({fonte}): nenhuma fase se destaca ({parts})."

        fase, chance = top
        label = (PHASE_EN if en else PHASE_PT)[fase]
        forecast_part = (
            f"Forecast for {period}: {label} ({chance}%, {fonte})."
            if en
            else f"Previsão para {period}: {label} ({chance}%, {fonte})."
        )
        phases = {item.ano: item.fase for item in self._enso_repo.get_oni_years()}
        first_a, first_b = plano_a.anos[0], plano_b.anos[0]
        name_a = self._name(by_id, first_a, en)
        record_a = _record(by_id.get(first_a), phases, fase)
        if record_a is None:
            history = (
                "No El Niño / La Niña phase for the years of the series yet to compare."
                if en
                else "Ainda sem a fase do El Niño / La Niña de cada ano da série para comparar."
            )
            return INCERTO, f"{forecast_part} {history}"
        if record_a.anos < regras.anos_fase_min:
            few = _few_years_text(record_a.anos, fase, en)
            history = (
                f"{few} since {record_a.inicio}: too few to tell how {name_a} does."
                if en
                else f"{few} desde {record_a.inicio}: pouco para dizer como {name_a} se sai."
            )
            return INCERTO, f"{forecast_part} {history}"
        years = _years_text(record_a.anos, fase, en)

        ruins = (record_a.anos - record_a.bons) / record_a.anos
        record_b = _record(by_id.get(first_b), phases, fase) if first_b != first_a else None
        show_b = record_b is not None and ruins >= regras.fracao_anos_ruins_seco
        if ruins < regras.fracao_anos_ruins_seco:
            nivel = NORMAL
        elif record_b is None or record_b.bons > record_a.bons:
            nivel = SECO
        else:
            nivel = INCERTO
        name_b = self._name(by_id, first_b, en)
        if en:
            history = f"In the {years} since {record_a.inicio}, {name_a} worked in {record_a.bons}"
            if show_b and record_b is not None:
                history += f" and {name_b} in {record_b.bons}"
            history += "."
            if nivel == INCERTO:
                history += " Plan B did not do better in those years."
        else:
            prefix = "No" if record_a.anos == 1 else "Nos"
            history = (
                f"{prefix} {years} desde {record_a.inicio}, {name_a} deu certo em {record_a.bons}"
            )
            if show_b and record_b is not None:
                history += f" e {name_b} em {record_b.bons}"
            history += "."
            if nivel == INCERTO:
                history += " O plano B não foi melhor nesses anos."
        return nivel, f"{forecast_part} {history}"

    @staticmethod
    def _period(season: EnsoSeasonForecast, en: bool) -> str:
        """Os meses da estação: "fevereiro a abril de 2027" / "February to April 2027"."""
        middle = season_middle_month(season.estacao)
        first = (middle - 2) % MONTHS_IN_YEAR
        last = middle % MONTHS_IN_YEAR
        if en:
            return f"{MONTH_NAMES_EN[first]} to {MONTH_NAMES_EN[last]} {season.ano}"
        return f"{MONTH_NAMES_PT[first]} a {MONTH_NAMES_PT[last]} de {season.ano}"

    @staticmethod
    def _name(by_id: dict[str, ResultadoOpcao], crop_id: str, en: bool) -> str:
        option = by_id.get(crop_id)
        nome = option.nome if option else FALLOW_NAME["en" if en else "pt"]
        return nome[:1].lower() + nome[1:]

    # --- fontes --------------------------------------------------------------------------------

    @staticmethod
    def _rain_sources(seasons: Sequence[ClimateSeason]) -> tuple[str, ...]:
        """Nomes das fontes da chuva da série, na ordem de RAIN_SOURCE_NAMES (as outras no fim)."""
        sources = {season.rain_source for season in seasons}
        names = tuple(name for key, name in RAIN_SOURCE_NAMES.items() if key in sources)
        return names + tuple(sorted(sources - RAIN_SOURCE_NAMES.keys()))

    # --- SMAP de agora -------------------------------------------------------------------------

    def _smap_now(self, moisture: RecentSoilMoisture, en: bool) -> SmapAgora:
        """A terra agora pelo SMAP: a faixa do percentil, o percentil e o dia (só informa)."""
        band = bisect_right(self._regras.smap_faixas_pct, moisture.sm_rootzone_pctl)
        pctl = math.floor(moisture.sm_rootzone_pctl)
        day = moisture.data
        if en:
            texto = (
                f"Your soil is {SMAP_BANDS_EN[band]} right now ({SOURCE_SOIL}, percentile {pctl}, "
                f"{MONTHS_EN[day.month - 1]} {day.day}, {day.year})."
            )
        else:
            texto = (
                f"Sua terra está {SMAP_BANDS_PT[band]} agora ({SOURCE_SOIL}, percentil {pctl}, "
                f"{day:%d/%m/%Y})."
            )
        return SmapAgora(percentil=pctl, data=day, texto=texto)
