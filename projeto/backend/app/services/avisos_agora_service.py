"""Grupo "Agora" da tela Avisos (remodelagem S6, tarefa 0046, RF-31).

Regras (números no grupo `avisos_tela` do `regras.yaml`; o resto é reaproveitado):
- **Terra seca:** percentil do SMAP recente até `terra_seca_percentil_max`; a leitura com mais de
  `smap_antiga_dias` dias vai marcada como antiga.
- **Dias sem chuva:** nos últimos dias do NASA POWER, `dias_sem_chuva_min` dias seguidos com chuva
  abaixo do dia seco dos avisos (`avisos.dia_seco_abaixo_mm`) até a última leitura. Dia sem dado
  no meio para a contagem (não dá para dizer que foi seco).
- **Calor:** `calor_dias_min` dias com a máxima no calor do motor (`clima.calor_temp_c`) ou acima
  nos últimos `calor_janela_dias` dias até a última leitura.
- **El Niño / La Niña:** a previsão da NOAA para a estação do outono (`sinal_enso.estacao_previsao`)
  com a fase mais provável em `sinal_enso.fase_chance_min_pct` ou mais, e como a melhor opção do
  motor se saiu nos anos daquela fase (ONI de cada ano) e nos outros. Neutro não é aviso.
- **Safrinha em andamento:** entre a semeadura e a colheita da melhor opção, a regra de avisos do
  replay (`CropAlertService`) nos dias recentes. Fora dela, nada (a tela mostra o link do ano).
A chuva recente nunca é comparada com "o normal": a série guardada só tem janeiro a julho.
"""

from collections.abc import Callable, Sequence
from datetime import date, timedelta
from typing import Final

from app.models.avisos import (
    ATENCAO,
    FIQUE_DE_OLHO,
    FONTE_NOAA,
    FONTE_POWER,
    FONTE_SMAP,
    Aviso,
    RecentDay,
    SafrinhaAviso,
)
from app.models.crop_option import CropParams
from app.models.enso import OniYear
from app.models.enso_forecast import EnsoForecast
from app.models.recomendacao import ResultadoOpcao
from app.models.regras import Regras
from app.models.safra_passada import DailyWeather
from app.models.sinal_outono import RecentSoilMoisture
from app.repositories.rules_repository import load_default_rules
from app.services.crop_alert_service import CropAlertService

PERCENT: Final[int] = 100
SAFRINHA_ALERTS: Final[dict[str, str]] = {
    "aviso_veranico": "safrinha_veranico",
    "aviso_calor": "safrinha_calor",
}


def _complete(days: Sequence[RecentDay]) -> list[RecentDay]:
    """Os dias em ordem até a última leitura (o último com chuva e máxima)."""
    ordered = sorted(days, key=lambda d: d.data)
    last = max(
        (i for i, d in enumerate(ordered) if d.chuva_mm is not None and d.tmax_c is not None),
        default=None,
    )
    return [] if last is None else ordered[: last + 1]


class AvisosAgoraService:
    """Os avisos de agora para o ponto, com o dia de hoje injetado."""

    def __init__(self, rules: Regras | None = None, today: Callable[[], date] = date.today) -> None:
        self._rules = rules if rules is not None else load_default_rules()
        self._regra = self._rules.avisos_tela
        self._today = today
        self._alerts = CropAlertService(self._rules)

    # --- terra seca ----------------------------------------------------------------------------

    def dry_soil(self, moisture: RecentSoilMoisture | None) -> Aviso | None:
        """Terra seca pelo SMAP: "mais seca que em X% dos anos nesta época" (X = 100 − pctl)."""
        if moisture is None or moisture.sm_rootzone_pctl > self._regra.terra_seca_percentil_max:
            return None
        pctl = moisture.sm_rootzone_pctl
        return Aviso(
            tipo="terra_seca",
            nivel=ATENCAO,
            fontes=(FONTE_SMAP,),
            data=moisture.data,
            valores={"percentil": pctl, "mais_seca_que_pct": round(PERCENT - pctl)},
            antiga=(self._today() - moisture.data).days > self._regra.smap_antiga_dias,
        )

    # --- dias sem chuva e calor ----------------------------------------------------------------

    def recent_weather(self, days: Sequence[RecentDay]) -> tuple[list[Aviso], date | None]:
        """Os avisos dos dias recentes do NASA POWER e a data da última leitura."""
        series = _complete(days)
        if not series:
            return [], None
        last = series[-1].data
        avisos = [a for a in (self._dry_spell(series), self._heat(series)) if a is not None]
        return avisos, last

    def _dry_spell(self, series: list[RecentDay]) -> Aviso | None:
        dry_below = self._rules.avisos.dia_seco_abaixo_mm
        run: list[RecentDay] = []
        for day in reversed(series):
            expected = series[-1].data - timedelta(days=len(run))
            if day.data != expected or day.chuva_mm is None or day.chuva_mm >= dry_below:
                break
            run.append(day)
        if len(run) < self._regra.dias_sem_chuva_min:
            return None
        return Aviso(
            tipo="dias_sem_chuva",
            nivel=ATENCAO,
            fontes=(FONTE_POWER,),
            data=series[-1].data,
            valores={
                "dias": len(run),
                "desde": run[-1].data.isoformat(),
                "no_minimo": len(run) == len(series),
            },
        )

    def _heat(self, series: list[RecentDay]) -> Aviso | None:
        regra, limit = self._regra, self._rules.clima.calor_temp_c
        last = series[-1].data
        first = last - timedelta(days=regra.calor_janela_dias - 1)
        hot = sum(
            1 for d in series if d.data >= first and d.tmax_c is not None and d.tmax_c >= limit
        )
        if hot < regra.calor_dias_min:
            return None
        return Aviso(
            tipo="calor",
            nivel=ATENCAO,
            fontes=(FONTE_POWER,),
            data=last,
            valores={"dias": hot, "janela_dias": regra.calor_janela_dias, "temp_c": limit},
        )

    # --- El Niño / La Niña ---------------------------------------------------------------------

    def enso(
        self,
        forecast: EnsoForecast | None,
        oni_years: Sequence[OniYear],
        best: ResultadoOpcao | None,
        rain_sources: Sequence[str],
    ) -> Aviso | None:
        """A previsão do outono e o que aconteceu com a melhor opção em anos parecidos."""
        regra = self._rules.sinal_enso
        season = forecast.season(regra.estacao_previsao) if forecast else None
        if forecast is None or season is None or season.last_day() < self._today():
            return None
        top = season.most_likely()
        if top is None or top[0] is None or top[1] < regra.fase_chance_min_pct:
            return None
        fase, chance = top
        phases = {item.ano: item.fase for item in oni_years}
        known = [d for d in best.anos_detalhe if d.ano in phases] if best else []
        in_phase = [d for d in known if phases[d.ano] == fase]
        others = [d for d in known if phases[d.ano] != fase]
        history = bool(known)
        return Aviso(
            tipo="enso",
            nivel=FIQUE_DE_OLHO,
            fontes=(FONTE_NOAA, *rain_sources) if history else (FONTE_NOAA,),
            data=forecast.emitida_em,
            valores={
                "fase": fase,
                "chance_pct": chance,
                "estacao": season.estacao,
                "ano": season.ano,
                "cultura": best.id if best else None,
                "nome": best.nome if best else None,
                "anos_fase": len(in_phase) if history else None,
                "bons_fase": sum(1 for d in in_phase if d.bom) if history else None,
                "anos_outros": len(others) if history else None,
                "bons_outros": sum(1 for d in others if d.bom) if history else None,
                "ano_inicio": min(d.ano for d in known) if history else None,
                "ano_fim": max(d.ano for d in known) if history else None,
            },
        )

    # --- safrinha ------------------------------------------------------------------------------

    def safrinha(
        self, crop: CropParams | None, nome: str | None, sowing: date, explorar_ano: int | None
    ) -> SafrinhaAviso:
        """A safrinha deste ano (ou a próxima) com a melhor opção; `sowing` dá o dia e o mês."""
        if crop is None or crop.ciclo_dias <= 0:
            return SafrinhaAviso(False, None, None, None, None, explorar_ano)
        today = self._today()
        start = date(today.year, sowing.month, sowing.day)
        end = start + timedelta(days=crop.ciclo_dias)
        if today > end:
            start = date(today.year + 1, sowing.month, sowing.day)
            end = start + timedelta(days=crop.ciclo_dias)
        return SafrinhaAviso(
            em_andamento=start <= today <= end,
            cultura=crop.id,
            nome=nome,
            semeadura=start,
            colheita=end,
            explorar_ano=explorar_ano,
        )

    def safrinha_alerts(
        self,
        crop: CropParams | None,
        nome: str,
        safrinha: SafrinhaAviso,
        days: Sequence[RecentDay],
    ) -> list[Aviso]:
        """Os avisos de veranico e calor do replay nos dias recentes, só durante a safrinha."""
        if crop is None or not safrinha.em_andamento or safrinha.semeadura is None:
            return []
        series = [
            DailyWeather(d.data, d.chuva_mm, d.tmax_c)
            for d in _complete(days)
            if d.chuva_mm is not None and d.tmax_c is not None
        ]
        events = self._alerts.timeline(crop, nome, safrinha.semeadura, series)
        heat: dict[str, float] = {"temp_c": self._rules.clima.calor_temp_c}
        return [
            Aviso(
                tipo=SAFRINHA_ALERTS[event.tipo],
                nivel=ATENCAO,
                fontes=(FONTE_POWER,),
                data=event.data,
                valores={
                    "dias": self._run_until(series, event.data, event.tipo == "aviso_calor"),
                    "cultura": crop.id,
                    "nome": nome,
                    **(heat if event.tipo == "aviso_calor" else {}),
                },
            )
            for event in events
            if event.tipo in SAFRINHA_ALERTS
        ]

    def _run_until(self, series: Sequence[DailyWeather], day: date, hot: bool) -> int:
        """Dias seguidos secos (ou quentes) que terminam no dia do aviso, para a frase."""
        dry_below = self._rules.avisos.dia_seco_abaixo_mm
        limit = self._rules.clima.calor_temp_c
        run = 0
        for item in sorted(
            (d for d in series if d.data <= day), key=lambda d: d.data, reverse=True
        ):
            if (item.tmax_c >= limit) if hot else (item.chuva_mm < dry_below):
                run += 1
            else:
                break
        return run
