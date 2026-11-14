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

    def diversity_bonus(self, seq: tuple[str, ...]) -> float:
        """PRD 7.7: +5 com 2 funções diferentes e +10 com 3 (grão, gramínea, leguminosa)."""
        funcoes = self._rotacao.funcoes
        count = len(frozenset().union(*(funcoes.get(crop, frozenset()) for crop in seq)))
        if count >= 3:
            return self._rotacao.bonus_diversidade_3
        if count == 2:
            return self._rotacao.bonus_diversidade_2
        return 0.0

    def plan_score(self, seq: tuple[str, ...], finals: dict[str, float]) -> float:
        """PRD 7.7: média das notas finais dos 3 anos + bônus de diversidade, de 0 a 100."""
        average = sum(finals[crop] for crop in seq) / len(seq)
        return max(SCORE_MIN, min(SCORE_MAX, round(average + self.diversity_bonus(seq), 1)))

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
        finals = {o.id: o.notas.final for o in opcoes}
        finals_dry = {o.id: o.notas_seco.final for o in opcoes}

        best_normal_seq: tuple[str, ...] = (candidate_ids[0],) * ROTATION_HORIZON_YEARS
        best_normal_score = -1.0
        best_dry_seq: tuple[str, ...] = best_normal_seq
        best_dry_score = -1.0

        rotacao = self._rotacao
        suppressors = rotacao.culturas_supressoras_nematoide
        # Sem supressora na janela, o filtro descartaria tudo: o plano sai e a descrição avisa.
        no_suppressor = nematoide is True and not suppressors & set(candidate_ids)
        for seq in product(candidate_ids, repeat=ROTATION_HORIZON_YEARS):
            if sum(1 for c in seq if c == "pousio") >= rotacao.max_pousios:
                continue
            if nematoide is True and not no_suppressor and not suppressors & set(seq):
                continue

            normal_score = self.plan_score(seq, finals)
            if normal_score > best_normal_score:
                best_normal_score = normal_score
                best_normal_seq = seq

            dry_score = self.plan_score(seq, finals_dry)
            if dry_score > best_dry_score:
                best_dry_score = dry_score
                best_dry_seq = seq

        driest_str = ", ".join(str(y) for y in sorted(anos_secos))

        is_en = lang.lower().startswith("en")
        nematode_note = ""
        if no_suppressor:
            nematode_note = (
                " No crop that breaks the nematode cycle fits this harvest's sowing window, "
                "so the plan does not cut the nematode."
                if is_en
                else " Nenhuma cultura que quebra o ciclo do nematoide cabe na janela desta "
                "colheita, então o plano não corta o nematoide."
            )
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
        baseline_seq = (baseline_crop,) * ROTATION_HORIZON_YEARS
        baseline_score = self.plan_score(baseline_seq, finals)
        desc_hoje = (
            "Continuous monoculture succession without functional rotation."
            if is_en
            else "Sucessão contínua sem rotação funcional na entressafra (maior risco acumulado)."
        )

        return (
            PlanoRotacao(
                anos=best_normal_seq, nota=best_normal_score, descricao=desc_normal + nematode_note
            ),
            PlanoRotacao(
                anos=best_dry_seq, nota=best_dry_score, descricao=desc_seco + nematode_note
            ),
            PlanoRotacao(anos=baseline_seq, nota=baseline_score, descricao=desc_hoje),
        )
