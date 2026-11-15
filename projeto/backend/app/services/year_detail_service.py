"""O que aconteceu em cada ano da faixa de chuva de uma opção (P1, plano de evolução 4.1).

Para cada ano que o motor simulou, guarda o resultado (`bom`, o mesmo da faixa), a data da fase que
mais precisa de água, a maior sequência de dias secos nessa fase (regra do `CropAlertService`, a
mesma dos avisos), a fase do ENSO pelo ONI da NOAA (só informa: não entra na conta) e a frase do
ano, montada com os modelos do `regras.yaml` (grupo `frases_ano`), sem IA generativa.
"""

from collections.abc import Mapping, Sequence
from datetime import date, timedelta
from typing import Final

from app.models.climate import ClimateSeason
from app.models.crop_option import CropParams
from app.models.enso import FaseEnso
from app.models.recomendacao import AnoDetalhe, ResultadoAno
from app.models.regras import FrasesAno, Regras
from app.repositories.enso_repository import EnsoRepository
from app.repositories.rules_repository import load_default_rules
from app.services.crop_alert_service import COVER_CROP_TYPE, CropAlertService, critical_stage
from app.services.past_season_service import season_days

ENGLISH_PREFIX: Final[str] = "en"
MONTHS_PT: Final[tuple[str, ...]] = (
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
MONTHS_EN: Final[tuple[str, ...]] = (
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


def _date_text(day: date, is_en: bool) -> str:
    """Data por extenso: 18 de fevereiro / February 18; o dia 1 em português vira 1º."""
    if is_en:
        return f"{MONTHS_EN[day.month - 1]} {day.day}"
    dia = "1º" if day.day == 1 else str(day.day)
    return f"{dia} de {MONTHS_PT[day.month - 1]}"


class YearDetailService:
    """Monta o `anos_detalhe` de uma opção a partir da conta do motor (P1)."""

    def __init__(
        self,
        alert_service: CropAlertService | None = None,
        enso_repo: EnsoRepository | None = None,
        rules: Regras | None = None,
    ) -> None:
        self._rules = rules if rules is not None else load_default_rules()
        self._alerts = alert_service or CropAlertService(self._rules)
        # Sem repository (ou sem arquivo do ONI), nenhum ano tem fase: `enso: null`
        self._enso_repo = enso_repo

    def year_details(
        self,
        crop: CropParams,
        semeadura: date,
        seasons: Sequence[ClimateSeason],
        resultados: Sequence[ResultadoAno],
        lang: str = "pt-BR",
        smap_wetness_by_year: Mapping[int, float] | None = None,
    ) -> tuple[AnoDetalhe, ...]:
        """Um item por ano simulado, na ordem dos `resultados` (a mesma da faixa de chuva).

        Args:
            crop: Parâmetros da cultura (floração, ciclo e tipo).
            semeadura: Data de semeadura (o ano é ignorado; vale o dia e o mês).
            seasons: Séries de cada ano (as mesmas que o motor simulou).
            resultados: Resultado de cada ano no motor (`ClimateRiskService.simulate_historical`).
            lang: Língua da frase (`Accept-Language`); "en..." = inglês, o resto = português.
            smap_wetness_by_year: Umidade do SMAP no dia de plantar de cada ano (a mesma do balde
                inicial do motor); vira a `umidade_inicial` do ano. Ano fora dele: None.
        """
        umidade = smap_wetness_by_year or {}
        is_en = lang.lower().startswith(ENGLISH_PREFIX)
        texts = self._rules.frases_ano[ENGLISH_PREFIX if is_en else "pt"]
        stage = critical_stage(crop, self._rules.clima)
        phases = self._phases()
        by_year = {season.year: season for season in seasons}

        detalhes: list[AnoDetalhe] = []
        for resultado in resultados:
            season = by_year.get(resultado.ano)
            if season is None:
                continue
            sowing = date(resultado.ano, semeadura.month, semeadura.day)
            dias = self._alerts.longest_dry_spell(crop, sowing, season_days(season))
            enso = phases.get(resultado.ano)
            fase_critica = sowing + timedelta(days=stage.marker)
            detalhes.append(
                AnoDetalhe(
                    ano=resultado.ano,
                    bom=not resultado.aperto,
                    fase_critica=fase_critica,
                    dias_sem_chuva=dias,
                    enso=enso,
                    texto=self._text(
                        crop, resultado, sowing, fase_critica, dias, enso, texts, is_en
                    ),
                    isna=resultado.isna,
                    dias_calor=resultado.dias_calor,
                    falta_agua=resultado.falta_agua,
                    calor=resultado.calor,
                    semeadura=sowing,
                    umidade_inicial=umidade.get(resultado.ano),
                )
            )
        return tuple(detalhes)

    def _phases(self) -> dict[int, FaseEnso | None]:
        if self._enso_repo is None:
            return {}
        return {item.ano: item.fase for item in self._enso_repo.get_oni_years()}

    def _text(
        self,
        crop: CropParams,
        resultado: ResultadoAno,
        sowing: date,
        fase_critica: date,
        dias: int,
        enso: FaseEnso | None,
        texts: FrasesAno,
        is_en: bool,
    ) -> str:
        """Fase crítica com a seca, o resultado do ano e a marca do ENSO, nessa ordem."""
        clima = self._rules.clima
        if dias == 0:
            seca = texts.nenhum_dia_sem_chuva
        elif dias == 1:
            seca = texts.um_dia_sem_chuva
        else:
            seca = texts.varios_dias_sem_chuva.format(dias=dias)
        campos = {
            "ano": resultado.ano,
            "semeadura": _date_text(sowing, is_en),
            "data_fase": _date_text(fase_critica, is_en),
            "janela": clima.janela_cobertura_dias,
            "seca": seca,
        }
        modelo = texts.fase_cobertura if crop.tipo == COVER_CROP_TYPE else texts.fase_grao
        frases = [modelo.format(**campos)]
        if not resultado.aperto:
            frases.append(texts.deu_certo)
        if resultado.falta_agua:
            frases.append(texts.faltou_agua)
        if resultado.calor:
            temp_c = f"{clima.calor_temp_c:g}"
            frases.append(texts.calor.format(dias=resultado.dias_calor, temp_c=temp_c))
        if enso == "el_nino":
            frases.append(texts.el_nino)
        elif enso == "la_nina":
            frases.append(texts.la_nina)
        return " ".join(frases)
