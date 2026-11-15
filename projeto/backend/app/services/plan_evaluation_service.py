"""Avaliar um plano de 3 anos qualquer (aba "Plano de 3 anos", seção 5.6, tarefa 0045).

O produtor troca a cultura de cada ano e as notas recalculam na hora. Nada é recalculado fora do
motor: a conta de cada cultura é a do `/recomendacao` (`RecommendationService.recommend`, a mesma
faixa de colheita e o mesmo solo); aqui só se junta os 3 anos:
- segurança climática e clima 2041-2060: média das notas do motor nos anos com lavoura na janela;
- saúde da terra: média da nota de solo dos 3 anos (PRD 7.4; pousio = 0) + o bônus de diversidade
  da rotação (PRD 7.7), até 100, com os fatos (terra coberta, nitrogênio, nematoide, repetição);
- chuva aproveitada: a chuva da semeadura ao fim de julho e o que a planta usou (ETr do balanço);
- Plano A / Plano B do 1º ano (`PlanBService`).
"""

from collections.abc import Iterable, Sequence
from datetime import date
from statistics import mean, median
from typing import Final, Protocol

from app.constants import ROTATION_HORIZON_YEARS, SCORE_MAX, SCORE_MIN
from app.models.climate import ClimateSeason
from app.models.crop_option import CropParams
from app.models.plano import AnoPlano, ChuvaAproveitada, NotasPlano, PlanoAvaliado, TerraPlano
from app.models.recomendacao import ForaDaJanelaOpcao, ResultadoOpcao
from app.models.regras import Regras
from app.repositories.crop_params_repository import CropParamsRepository
from app.repositories.rules_repository import load_default_rules
from app.services.errors import ValidationDomainError
from app.services.plan_b_service import PlanBService
from app.services.recommendation_service import soil_score
from app.services.rotation_plan_service import FALLOW_ID, RotationPlanService

SOURCE_SEPARATOR: Final[str] = "+"


class PlanRecommendation(Protocol):
    """O que o plano lê da recomendação do motor (`Recomendacao`)."""

    celula_id: str
    colheita: str
    semeadura: date
    opcoes: Sequence[ResultadoOpcao]
    fora_da_janela: Sequence[ForaDaJanelaOpcao]


class PlanRecommender(Protocol):
    """O motor do /recomendacao (`RecommendationService.recommend`)."""

    def recommend(
        self,
        lat: float,
        lon: float,
        colheita: str = "meio",
        solo_override: str | None = None,
        lang: str = "pt-BR",
    ) -> PlanRecommendation: ...


class SeasonsRepository(Protocol):
    """A série de clima guardada da célula (a mesma do motor)."""

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]: ...


def _avg(values: Iterable[float]) -> float | None:
    items = list(values)
    return round(mean(items), 1) if items else None


class PlanEvaluationService:
    """Junta a conta do motor de cada ano num plano de 3 anos (notas, terra, chuva, Plano A/B)."""

    def __init__(
        self,
        recommender: PlanRecommender,
        climate_repo: SeasonsRepository,
        crop_repo: CropParamsRepository,
        plan_service: RotationPlanService,
        rules: Regras | None = None,
    ) -> None:
        self._recommender = recommender
        self._climate_repo = climate_repo
        self._crop_repo = crop_repo
        self._plan_service = plan_service
        self._rules = rules if rules is not None else load_default_rules()
        self._plan_b = PlanBService(self._rules)

    def evaluate(
        self,
        lat: float,
        lon: float,
        anos: Sequence[str],
        colheita: str = "meio",
        solo_override: str | None = None,
        lang: str = "pt-BR",
    ) -> PlanoAvaliado:
        """O plano `anos` (3 ids do culturas.yaml, com o pousio) no ponto e na faixa de colheita.

        Raises:
            ValidationDomainError: sem 3 culturas, cultura desconhecida, ou faixa/solo inválidos.
            OutsideAreaError: o ponto não tem dados (o mesmo do `/recomendacao`).
        """
        crops = self._check(anos)
        rec = self._recommender.recommend(
            lat=lat, lon=lon, colheita=colheita, solo_override=solo_override, lang=lang
        )
        en = lang.lower().startswith("en")
        by_id = {o.id: o for o in rec.opcoes}
        out_names = {f.id: f.nome for f in rec.fora_da_janela}
        years = tuple(self._year(crop, by_id.get(crop.id), out_names, en) for crop in crops)
        seasons = self._climate_repo.get_seasons(rec.celula_id)
        first = years[0]
        return PlanoAvaliado(
            colheita=rec.colheita,
            semeadura=rec.semeadura,
            anos=years,
            notas=self._scores(crops, [by_id.get(c.id) for c in crops]),
            terra=self._soil_facts(crops, years),
            chuva=self._used_rain(seasons, rec.semeadura, years),
            plano_ab=self._plan_b.plan_ab(
                first.cultura, list(rec.opcoes), seasons, rec.semeadura, nome_a=first.nome
            ),
        )

    def _check(self, anos: Sequence[str]) -> list[CropParams]:
        if len(anos) != ROTATION_HORIZON_YEARS:
            raise ValidationDomainError(
                f"O plano precisa de {ROTATION_HORIZON_YEARS} culturas, uma por ano."
            )
        known = {c.id: c for c in self._crop_repo.list_all()}
        unknown = [crop for crop in anos if crop not in known]
        if unknown:
            raise ValidationDomainError(f"Cultura desconhecida no plano: {', '.join(unknown)}.")
        return [known[crop] for crop in anos]

    def _year(
        self,
        crop: CropParams,
        option: ResultadoOpcao | None,
        out_names: dict[str, str],
        en: bool,
    ) -> AnoPlano:
        own_name = crop.nome_en if (en and crop.nome_en) else crop.nome
        facts = {
            "cobre_terra": crop.solo_palhada > 0,
            "deixa_nitrogenio": crop.n_deixado_kg > 0,
            "quebra_nematoide": crop.id in self._rules.rotacao.culturas_supressoras_nematoide,
        }
        if option is None:
            return AnoPlano(
                cultura=crop.id,
                nome=out_names.get(crop.id, own_name),
                na_janela=crop.id == FALLOW_ID,
                anos_bons=None,
                total_anos=None,
                futuro_anos_bons=None,
                sede=None,
                usa_mm=None,
                **facts,
            )
        return AnoPlano(
            cultura=crop.id,
            nome=option.nome,
            na_janela=True,
            anos_bons=option.anos_bons_chuva,
            total_anos=option.total_anos,
            futuro_anos_bons=option.futuro.anos_bons_media if option.futuro else None,
            sede=option.agua.sede if option.agua else None,
            usa_mm=option.agua.usa_mm if option.agua else None,
            **facts,
        )

    def _scores(
        self, crops: Sequence[CropParams], options: Sequence[ResultadoOpcao | None]
    ) -> NotasPlano:
        evaluated = [o for o in options if o is not None]
        futures = [o.notas.futuro for o in evaluated]
        solo = mean(soil_score(c, None, self._rules.solo) for c in crops)
        bonus = self._plan_service.diversity_bonus(tuple(c.id for c in crops))
        return NotasPlano(
            seguranca=_avg(o.notas.seguranca for o in evaluated),
            solo=round(max(SCORE_MIN, min(SCORE_MAX, solo + bonus)), 1),
            futuro=None if None in futures else _avg(f for f in futures if f is not None),
        )

    def _soil_facts(self, crops: Sequence[CropParams], years: Sequence[AnoPlano]) -> TerraPlano:
        ids = [c.id for c in crops if c.id != FALLOW_ID]
        repeated = tuple(dict.fromkeys(crop for crop in ids if ids.count(crop) > 1))
        return TerraPlano(
            anos_cobertos=sum(1 for y in years if y.cobre_terra),
            anos_nitrogenio=sum(1 for y in years if y.deixa_nitrogenio),
            anos_nematoide=sum(1 for y in years if y.quebra_nematoide),
            repetidas=repeated,
            total=len(years),
            bonus_diversidade=self._plan_service.diversity_bonus(tuple(c.id for c in crops)),
        )

    def _used_rain(
        self, seasons: Sequence[ClimateSeason], semeadura: date, years: Sequence[AnoPlano]
    ) -> ChuvaAproveitada | None:
        """Chuva da semeadura ao fim de julho (mediana dos anos) e a média do que o plano usa."""
        fim = self._rules.chuva_aproveitada.fim
        end_month, end_day = (int(part) for part in fim.split("-"))
        totals: list[float] = []
        sources: set[str] = set()
        for season in seasons:
            start = date(season.year, semeadura.month, semeadura.day)
            first = (start - season.start_date).days
            last = (date(season.year, end_month, end_day) - season.start_date).days + 1
            if first < 0 or first >= len(season.rain_mm):
                continue
            totals.append(sum(season.rain_mm[first : min(last, len(season.rain_mm))]))
            sources.add(season.rain_source)
        if not totals:
            return None
        uses = [0 if y.cultura == FALLOW_ID else y.usa_mm for y in years]
        return ChuvaAproveitada(
            inicio=semeadura,
            fim=fim,
            chuva_mm=round(median(totals)),
            usa_media_mm=None if None in uses else round(mean(u for u in uses if u is not None)),
            anos=len(totals),
            fonte=SOURCE_SEPARATOR.join(sorted(sources)),
        )
