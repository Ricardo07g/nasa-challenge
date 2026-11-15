"""Histórico do talhão em faixa de calor e o bloco "Verde da lavoura" (tela 4, tarefa 0043).

A série de NDVI do ponto (MODIS MOD13Q1 + MYD13Q1, já sem nuvem e sem neve) vira uma grade: um
ano por linha (os anos do `historico_ndvi`, 2017 a 2026, decisão D5) e uma leitura de 16 dias por
coluna, de janeiro a julho (grupo `raio_x`). Terra e Aqua ficam 8 dias defasados: cada coluna
junta os dois e fica com o maior NDVI bom, como a composição de 16 dias do próprio MODIS.
"""

from collections.abc import Sequence
from datetime import date
from typing import Final

from app.models.raio_x import FaixaNdvi, FaixaNdviAno, VerdeLavoura
from app.models.regras import Regras
from app.models.soja_recente import SojaRecente, safra_label
from app.models.talhao import NdviRecord
from app.repositories.rules_repository import load_default_rules
from app.services.calendar_days import common_day_of_year, month_day, month_day_text
from app.services.field_history_service import FieldHistoryService, _source_label, scaled_ndvi

DAY_ONE: Final[int] = 1


class NdviStripService:
    """A grade do NDVI (anos × leituras de 16 dias) e a última leitura e o pico da soja."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._rules = rules if rules is not None else load_default_rules()
        self._regra = self._rules.raio_x
        self._history = FieldHistoryService(self._rules)

    def _column_starts(self) -> list[int]:
        """Dia do ano (num ano comum) em que começa cada coluna, até `ndvi_fim`."""
        regra = self._regra
        first = common_day_of_year(date(2023, *month_day(regra.ndvi_inicio)))
        last = common_day_of_year(date(2023, *month_day(regra.ndvi_fim)))
        return list(range(first, last + 1, regra.ndvi_coluna_dias))

    def _in_window(self, day: date) -> bool:
        regra = self._regra
        return month_day(regra.ndvi_inicio) <= (day.month, day.day) <= month_day(regra.ndvi_fim)

    def strip(self, records: Sequence[NdviRecord]) -> FaixaNdvi | None:
        """`None` sem nenhuma leitura boa nos anos e na janela.

        A coluna sai do dia do ano da composição (o calendário do MODIS recomeça em 1º/jan), e o
        rótulo dela, do dia num ano comum.
        """
        historico = self._rules.historico_ndvi
        years = range(historico.ano_inicio, historico.ano_fim + 1)
        starts = self._column_starts()
        step = self._regra.ndvi_coluna_dias
        grid: dict[int, list[float | None]] = {year: [None] * len(starts) for year in years}
        used: list[NdviRecord] = []
        for rec in records:
            if rec.data.year not in grid or not self._in_window(rec.data):
                continue
            column = (rec.data.timetuple().tm_yday - starts[0]) // step
            if not 0 <= column < len(starts):
                continue
            value = scaled_ndvi(rec.ndvi)
            current = grid[rec.data.year][column]
            grid[rec.data.year][column] = value if current is None else max(current, value)
            used.append(rec)
        if not used:
            return None
        return FaixaNdvi(
            colunas=tuple(month_day_text(start) for start in starts),
            anos=tuple(FaixaNdviAno(ano=year, valores=tuple(grid[year])) for year in years),
            fonte=_source_label(used),
            colheita_dia=self._history.suggest_harvest_band(records).dia,
        )

    def green(self, records: Sequence[NdviRecord], soja: SojaRecente | None) -> VerdeLavoura | None:
        """Bloco 4: a última leitura da série e o pico da soja na safra mais recente.

        O pico é o maior NDVI da janela do pico da soja (`regiao_ndvi.pico_inicio` a `pico_fim`, a
        regra da soja do ano) no último ano da série. Sem série, o pico do mapa da soja recente
        (RF-24), quando o pixel tem dado.
        """
        if not records:
            if soja is None or soja.ndvi_pico is None:
                return None
            return VerdeLavoura(None, None, soja.ndvi_pico, None, soja.safra, soja.fonte)
        last = max(records, key=lambda rec: rec.data)
        soy = self._rules.regiao_ndvi
        window = (month_day(soy.pico_inicio), month_day(soy.pico_fim))
        peak_window = [
            rec
            for rec in records
            if rec.data.year == last.data.year
            and window[0] <= (rec.data.month, rec.data.day) <= window[1]
        ]
        peak = max(peak_window, key=lambda rec: (scaled_ndvi(rec.ndvi), rec.data), default=None)
        return VerdeLavoura(
            ultimo_ndvi=scaled_ndvi(last.ndvi),
            ultimo_data=last.data,
            pico_ndvi=None if peak is None else scaled_ndvi(peak.ndvi),
            pico_data=None if peak is None else peak.data,
            safra=safra_label(last.data.year) if peak is not None else None,
            fonte=_source_label(records),
        )
