"""Service for building 3-year off-season crop rotation plans (normal, dry stress, and baseline)."""

from datetime import timedelta
from itertools import product

from app.constants import ROTATION_HORIZON_YEARS, SCORE_MAX, SCORE_MIN
from app.models.climate import ClimateSeason
from app.models.recomendacao import PlanoRotacao, ResultadoOpcao
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules


class RotationPlanService:
    """Evaluates 3-year off-season crop sequences under normal and dry El Nino stress scenarios."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._rotacao = (rules if rules is not None else load_default_rules()).rotacao

    def select_driest_years(self, seasons: list[ClimateSeason]) -> list[int]:
        """Os anos com menos chuva de fevereiro a abril (PRD 7.7: 4 anos), do mais seco ao menos."""

        def _rain_feb_to_apr(season: ClimateSeason) -> float:
            return sum(
                rain
                for idx, rain in enumerate(season.rain_mm)
                if (season.start_date + timedelta(days=idx)).month in self._rotacao.meses_seco
            )

        driest = sorted(seasons, key=_rain_feb_to_apr)[: self._rotacao.anos_secos]
        return [s.year for s in driest]

    def build_3_year_plans(
        self,
        opcoes: list[ResultadoOpcao],
        anos_secos: list[int],
        nematoide: bool | None = None,
        lang: str = "pt-BR",
    ) -> tuple[PlanoRotacao, PlanoRotacao, PlanoRotacao]:
        """Melhor plano de 3 anos no ano normal e no ano seco, mais a sequência de hoje.

        O ano normal usa as notas finais dos 20 anos; o ano seco usa as notas calculadas só
        com os anos mais secos (`notas_seco`), como pede o plano técnico §4.6.
        """
        if not opcoes:
            fallback = PlanoRotacao(
                anos=("pousio", "pousio", "pousio"),
                nota=20.0,
                descricao="Apenas pousio disponível para a janela selecionada.",
            )
            return fallback, fallback, fallback

        opt_by_id = {o.id: o for o in opcoes}
        candidate_ids = [o.id for o in opcoes]

        best_normal_seq: tuple[str, ...] = (candidate_ids[0],) * ROTATION_HORIZON_YEARS
        best_normal_score = -1.0
        best_dry_seq: tuple[str, ...] = best_normal_seq
        best_dry_score = -1.0

        rotacao = self._rotacao
        suppressors = rotacao.culturas_supressoras_nematoide
        for seq in product(candidate_ids, repeat=ROTATION_HORIZON_YEARS):
            if sum(1 for c in seq if c == "pousio") >= rotacao.max_pousios:
                continue
            if nematoide is True and not any(c in suppressors for c in seq):
                continue

            distinct_crops = len(set(seq))
            diversity_bonus = (
                rotacao.bonus_diversidade_3
                if distinct_crops == 3
                else (rotacao.bonus_diversidade_2 if distinct_crops == 2 else 0.0)
            )
            monoculture_penalty = (
                rotacao.penalidade_monocultura_milho
                if seq == ("milho_safrinha", "milho_safrinha", "milho_safrinha")
                else 0.0
            )
            ajuste = diversity_bonus - monoculture_penalty

            avg_normal = sum(opt_by_id[c].notas.final for c in seq) / ROTATION_HORIZON_YEARS
            normal_score = max(SCORE_MIN, min(SCORE_MAX, round(avg_normal + ajuste, 1)))
            if normal_score > best_normal_score:
                best_normal_score = normal_score
                best_normal_seq = seq

            avg_dry = sum(opt_by_id[c].notas_seco.final for c in seq) / ROTATION_HORIZON_YEARS
            dry_score = max(SCORE_MIN, min(SCORE_MAX, round(avg_dry + ajuste, 1)))
            if dry_score > best_dry_score:
                best_dry_score = dry_score
                best_dry_seq = seq

        driest_str = ", ".join(str(y) for y in sorted(anos_secos))

        is_en = lang.lower().startswith("en")
        desc_normal = (
            "Balanced 3-year rotation combining income, straw cover, and low climate risk."
            if is_en
            else (
                "Rotação equilibrada de 3 anos combinando renda, "
                "formação de palhada e controle de risco climático."
            )
        )
        desc_seco = (
            f"Resilient sequence stress-tested on the {len(anos_secos)} driest historical years "
            f"({driest_str})."
            if is_en
            else (
                f"Sequência resiliente testada nos {len(anos_secos)} anos mais secos "
                f"da série histórica ({driest_str})."
            )
        )

        baseline_crop = "milho_safrinha" if "milho_safrinha" in opt_by_id else candidate_ids[0]
        baseline_score = round(
            max(
                SCORE_MIN,
                opt_by_id[baseline_crop].notas.final - rotacao.penalidade_monocultura_milho,
            ),
            1,
        )
        desc_hoje = (
            "Continuous monoculture succession without functional rotation."
            if is_en
            else "Sucessão contínua sem rotação funcional na entressafra (maior risco acumulado)."
        )

        return (
            PlanoRotacao(anos=best_normal_seq, nota=best_normal_score, descricao=desc_normal),
            PlanoRotacao(anos=best_dry_seq, nota=best_dry_score, descricao=desc_seco),
            PlanoRotacao(
                anos=(baseline_crop, baseline_crop, baseline_crop),
                nota=baseline_score,
                descricao=desc_hoje,
            ),
        )
