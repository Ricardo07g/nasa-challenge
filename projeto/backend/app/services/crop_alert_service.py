"""Regras de aviso da safra: veranico e calor na fase crítica (plano de evolução 4.4).

É o service que o replay de uma safra passada (P4) usa e que o acompanhamento diário (P6) vai
reaproveitar: recebe a série diária (chuva e máxima) e o plano (cultura e semeadura) e devolve a
linha do tempo, sem saber de onde veio o dado. Números e textos vêm do `regras.yaml`
(grupos `clima`, `avisos` e `frases_safra`).
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Final

from app.models.crop_option import CropParams
from app.models.regras import FrasesSafra, Regras, RegrasClima
from app.models.safra_passada import DailyWeather, SeasonEvent
from app.repositories.rules_repository import load_default_rules

COVER_CROP_TYPE: Final[str] = "cobertura"
CONSORTIUM_TYPE: Final[str] = "consorcio"
ENGLISH_PREFIX: Final[str] = "en"


@dataclass(frozen=True)
class CriticalStage:
    """Fase crítica em dias do ciclo, a contar da semeadura: [start, end) e o dia do evento."""

    start: int
    end: int
    marker: int


def critical_stage(crop: CropParams, clima: RegrasClima) -> CriticalStage:
    """Janela crítica do PRD 7.2, a mesma da conta do aperto (`ClimateRiskService`).

    Grão e consórcio: floração ± `janela_grao_meia_dias`, com o evento na floração estimada.
    Cobertura: os primeiros `janela_cobertura_dias` (pegamento), com o evento na semeadura.
    """
    if crop.tipo == COVER_CROP_TYPE:
        end = min(clima.janela_cobertura_dias, crop.ciclo_dias)
        return CriticalStage(start=0, end=end, marker=0)
    half = clima.janela_grao_meia_dias
    return CriticalStage(
        start=max(0, crop.dias_florescer - half),
        end=min(crop.ciclo_dias, crop.dias_florescer + half),
        marker=crop.dias_florescer,
    )


@dataclass
class _Spell:
    """Sequência de dias seguidos (secos ou quentes) e se ela já gerou aviso."""

    days: int = 0
    start: date = date.min
    warned: bool = False

    def extend(self, day: date) -> None:
        if self.days == 0:
            self.start = day
        self.days += 1

    def reset(self) -> None:
        self.days, self.warned = 0, False


class CropAlertService:
    """Linha do tempo da safra com os avisos de veranico e calor (P4 e P6)."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._rules = rules if rules is not None else load_default_rules()

    def timeline(
        self,
        crop: CropParams,
        crop_name: str,
        sowing: date,
        days: Sequence[DailyWeather],
        lang: str = "pt-BR",
    ) -> list[SeasonEvent]:
        """Percorre o ciclo dia a dia e devolve os eventos em ordem de data.

        Regras (plano de evolução 4.4):
            - veranico: `veranico_min_dias` dias seguidos com chuva abaixo de `dia_seco_abaixo_mm`,
              num dia da fase crítica (a seca pode ter começado antes). Um aviso por sequência seca;
              o "parou de chover" fica no primeiro dia dela e o "voltou a chover" no primeiro dia
              com chuva antes da colheita;
            - calor: `calor_dias_seguidos` dias seguidos com máxima de `clima.calor_temp_c` ou mais
              na fase crítica. Um aviso por sequência quente;
            - no máximo `max_avisos` avisos em `janela_limite_dias` dias: o aviso que não cabe
              espera o primeiro dia com vaga, se a sequência ainda durar.

        Args:
            crop: Parâmetros da cultura (ciclo, floração e tipo).
            crop_name: Nome da opção como o produtor vê, na língua pedida.
            sowing: Data da semeadura.
            days: Série diária em ordem de data; dias fora do ciclo são ignorados.
            lang: Língua dos textos (`Accept-Language`); "en..." = inglês, o resto = português.

        Returns:
            Semeadura, fase crítica, avisos e colheita, em ordem de data.
        """
        clima, avisos = self._rules.clima, self._rules.avisos
        texts = self._texts(lang)
        stage = critical_stage(crop, clima)
        harvest = sowing + timedelta(days=crop.ciclo_dias)

        events = [
            SeasonEvent(sowing, "semeadura", texts.semeadura.format(opcao=crop_name)),
            SeasonEvent(
                sowing + timedelta(days=stage.marker),
                "fase_critica",
                self._critical_stage_text(crop, texts),
            ),
        ]
        warnings: list[date] = []
        dry, hot = _Spell(), _Spell()
        for day in sorted((d for d in days if sowing <= d.data < harvest), key=lambda d: d.data):
            in_stage = stage.start <= (day.data - sowing).days < stage.end

            if self._is_dry(day):
                dry.extend(day.data)
            else:
                if dry.warned:
                    text = texts.voltou_chuva.format(dias=dry.days)
                    events.append(SeasonEvent(day.data, "voltou_chuva", text))
                dry.reset()
            if day.tmax_c >= clima.calor_temp_c:
                hot.extend(day.data)
            else:
                hot.reset()

            if not in_stage:
                continue
            if self._should_warn(dry, avisos.veranico_min_dias, warnings, day.data):
                events.append(SeasonEvent(dry.start, "sem_chuva", texts.sem_chuva))
                text = texts.aviso_veranico.format(dias=dry.days)
                events.append(SeasonEvent(day.data, "aviso_veranico", text))
                dry.warned = True
                warnings.append(day.data)
            if self._should_warn(hot, avisos.calor_dias_seguidos, warnings, day.data):
                text = texts.aviso_calor.format(dias=hot.days, temp_c=f"{clima.calor_temp_c:g}")
                events.append(SeasonEvent(day.data, "aviso_calor", text))
                hot.warned = True
                warnings.append(day.data)

        events.append(SeasonEvent(harvest, "colheita", self._harvest_text(crop, crop_name, texts)))
        return sorted(events, key=lambda e: e.data)

    def longest_dry_spell(
        self, crop: CropParams, sowing: date, days: Sequence[DailyWeather]
    ) -> int:
        """Maior sequência de dias secos seguidos dentro da fase crítica (detalhe do ano, P1).

        Dia seco é o mesmo do aviso de veranico (`avisos.dia_seco_abaixo_mm`) e a fase é a da
        conta do aperto (`critical_stage`). Só os dias da fase contam: a seca que começou antes
        conta a partir do primeiro dia da fase, e a que segue depois para no último.

        Args:
            crop: Parâmetros da cultura (floração, ciclo e tipo).
            sowing: Data da semeadura.
            days: Série diária; dias fora da fase são ignorados.

        Returns:
            Dias secos seguidos (0 quando choveu em todos os dias da fase com dado).
        """
        stage = critical_stage(crop, self._rules.clima)
        in_stage = sorted(
            (d for d in days if stage.start <= (d.data - sowing).days < stage.end),
            key=lambda d: d.data,
        )
        longest = current = 0
        previous: date | None = None
        for day in in_stage:
            continues = previous is not None and (day.data - previous).days == 1
            current = (current + 1 if continues else 1) if self._is_dry(day) else 0
            longest = max(longest, current)
            previous = day.data
        return longest

    def _is_dry(self, day: DailyWeather) -> bool:
        """Dia sem chuva: abaixo de `avisos.dia_seco_abaixo_mm` (o mesmo nos avisos e no P1)."""
        return day.chuva_mm < self._rules.avisos.dia_seco_abaixo_mm

    def _should_warn(self, spell: _Spell, min_days: int, warnings: list[date], day: date) -> bool:
        if spell.warned or spell.days < min_days:
            return False
        avisos = self._rules.avisos
        recent = sum(1 for w in warnings if (day - w).days < avisos.janela_limite_dias)
        return recent < avisos.max_avisos

    def _texts(self, lang: str) -> FrasesSafra:
        is_en = lang.lower().startswith(ENGLISH_PREFIX)
        return self._rules.frases_safra[ENGLISH_PREFIX if is_en else "pt"]

    def _critical_stage_text(self, crop: CropParams, texts: FrasesSafra) -> str:
        if crop.tipo == COVER_CROP_TYPE:
            return texts.fase_critica_cobertura.format(dias=self._rules.clima.janela_cobertura_dias)
        return texts.fase_critica_grao

    @staticmethod
    def _harvest_text(crop: CropParams, crop_name: str, texts: FrasesSafra) -> str:
        if crop.tipo == COVER_CROP_TYPE:
            return texts.colheita_cobertura.format(opcao=crop_name)
        if crop.tipo == CONSORTIUM_TYPE:
            return texts.colheita_consorcio.format(opcao=crop_name)
        return texts.colheita_grao.format(opcao=crop_name)
