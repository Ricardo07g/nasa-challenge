"""Service for building 3-year off-season crop rotation plans (normal, dry stress, and baseline)."""

from itertools import product

from app.constants import (
    DIVERSITY_BONUS_THREE_ROLES,
    DIVERSITY_BONUS_TWO_ROLES,
    DRIEST_YEARS_COUNT,
    MAX_CONSECUTIVE_FALLOW,
    MONOCULTURE_CORN_PENALTY,
    NEMATODE_SUPPRESSOR_CROPS,
    ROTATION_HORIZON_YEARS,
    SCORE_MAX,
    SCORE_MIN,
)
from app.models.climate import ClimateSeason
from app.models.recomendacao import PlanoRotacao, ResultadoOpcao


class RotationPlanService:
    """Evaluates 3-year off-season crop sequences under normal and dry El Nino stress scenarios."""

    def select_4_driest_years(self, seasons: list[ClimateSeason]) -> list[ClimateSeason]:
        """Selects the 4 seasons with lowest accumulated off-season rainfall (Feb-May) (US-09)."""

        def _safrinha_rain(season: ClimateSeason) -> float:
            # Feb 1 is index 31, May 31 is index 151
            return sum(season.rain_mm[31:151])

        sorted_seasons = sorted(seasons, key=_safrinha_rain)
        return sorted_seasons[:DRIEST_YEARS_COUNT]

    def build_3_year_plans(
        self,
        opcoes: list[ResultadoOpcao],
        seasons: list[ClimateSeason],
        nematoide: bool | None = None,
        lang: str = "pt-BR",
    ) -> tuple[PlanoRotacao, PlanoRotacao, PlanoRotacao]:
        """Evaluates 3-year sequences and returns normal, dry, and baseline plans."""
        if not opcoes:
            fallback = PlanoRotacao(
                anos=("pousio", "pousio", "pousio"),
                nota=20.0,
                descricao="Apenas pousio disponível para a janela selecionada.",
            )
            return fallback, fallback, fallback

        opt_by_id = {o.id: o for o in opcoes}
        candidate_ids = [o.id for o in opcoes]

        best_normal_seq: tuple[str, str, str] = (
            candidate_ids[0],
            candidate_ids[0],
            candidate_ids[0],
        )
        best_normal_score = -1.0

        best_dry_seq: tuple[str, str, str] = best_normal_seq
        best_dry_score = -1.0

        for seq in product(candidate_ids, repeat=ROTATION_HORIZON_YEARS):
            c1, c2, c3 = seq[0], seq[1], seq[2]
            if sum(1 for c in seq if c == "pousio") >= MAX_CONSECUTIVE_FALLOW:
                continue

            if nematoide is True and not any(c in NEMATODE_SUPPRESSOR_CROPS for c in seq):
                continue

            distinct_crops = len(set(seq))
            diversity_bonus = (
                DIVERSITY_BONUS_THREE_ROLES
                if distinct_crops == 3
                else (DIVERSITY_BONUS_TWO_ROLES if distinct_crops == 2 else 0.0)
            )
            monoculture_penalty = (
                MONOCULTURE_CORN_PENALTY
                if seq == ("milho_safrinha", "milho_safrinha", "milho_safrinha")
                else 0.0
            )

            # Normal scenario score
            avg_final = sum(opt_by_id[c].notas.final for c in seq) / ROTATION_HORIZON_YEARS
            normal_score = max(
                SCORE_MIN,
                min(SCORE_MAX, round(avg_final + diversity_bonus - monoculture_penalty, 1)),
            )
            if normal_score > best_normal_score:
                best_normal_score = normal_score
                best_normal_seq = (c1, c2, c3)

            # Dry scenario score prioritizes climate safety (60%) and soil protection (30%)
            avg_dry = (
                sum(
                    0.60 * opt_by_id[c].notas.seguranca
                    + 0.30 * opt_by_id[c].notas.solo
                    + 0.10 * opt_by_id[c].notas.renda
                    for c in seq
                )
                / ROTATION_HORIZON_YEARS
            )
            dry_score = max(
                SCORE_MIN,
                min(SCORE_MAX, round(avg_dry + diversity_bonus - monoculture_penalty, 1)),
            )
            if dry_score > best_dry_score:
                best_dry_score = dry_score
                best_dry_seq = (c1, c2, c3)

        driest_years = [s.year for s in self.select_4_driest_years(seasons)]
        driest_str = ", ".join(str(y) for y in driest_years)

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
            f"Resilient sequence stress-tested on the 4 driest historical years ({driest_str})."
            if is_en
            else (
                "Sequência resiliente testada nos 4 anos mais secos "
                f"da série histórica ({driest_str})."
            )
        )

        baseline_crop = "milho_safrinha" if "milho_safrinha" in opt_by_id else candidate_ids[0]
        baseline_score = round(
            max(SCORE_MIN, opt_by_id[baseline_crop].notas.final - MONOCULTURE_CORN_PENALTY),
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
