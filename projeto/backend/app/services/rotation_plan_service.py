"""Plano de 3 anos de entressafra (PRD 7.7): ano normal, ano seco e a sequência de hoje."""

from collections.abc import Callable
from datetime import timedelta
from itertools import groupby, product
from operator import attrgetter

from app.constants import ROTATION_HORIZON_YEARS, SCORE_MAX, SCORE_MIN
from app.models.climate import ClimateSeason
from app.models.recomendacao import NotasOpcao, PlanoRotacao, ResultadoOpcao
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules

FALLOW_ID = "pousio"
# Sequência de hoje enquanto o histórico do talhão (R3.2) não chega: soja/milho (PRD 7.7).
TODAY_CROP_ID = "milho_safrinha"

Sequence = tuple[str, ...]


def longest_fallow_run(seq: Sequence) -> int:
    """Maior número de pousios seguidos na sequência."""
    runs = [len(list(group)) for crop, group in groupby(seq) if crop == FALLOW_ID]
    return max(runs, default=0)


class RotationPlanService:
    """Gera as 216 sequências do PRD 7.7, aplica as restrições e escolhe o melhor plano."""

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

    def diversity_bonus(self, seq: Sequence) -> float:
        """PRD 7.7: +5 com 2 funções diferentes e +10 com 3 (grão, gramínea, leguminosa)."""
        funcoes = self._rotacao.funcoes
        count = len(frozenset().union(*(funcoes.get(crop, frozenset()) for crop in seq)))
        if count >= 3:
            return self._rotacao.bonus_diversidade_3
        if count == 2:
            return self._rotacao.bonus_diversidade_2
        return 0.0

    def plan_score(self, seq: Sequence, finals: dict[str, float]) -> float:
        """PRD 7.7: média das notas finais dos 3 anos + bônus de diversidade, de 0 a 100."""
        average = sum(finals[crop] for crop in seq) / len(seq)
        return max(SCORE_MIN, min(SCORE_MAX, round(average + self.diversity_bonus(seq), 1)))

    def all_sequences(self, crop_ids: list[str]) -> list[Sequence]:
        """PRD 7.7 passo 1: todas as sequências de 3 entressafras (6 x 6 x 6 = 216 com pousio)."""
        return list(product(crop_ids, repeat=ROTATION_HORIZON_YEARS))

    def has_nematode_suppressor(self, crop_ids: list[str]) -> bool:
        """Alguma cultura que quebra o ciclo do nematoide (crotalária, milheto) está na lista."""
        return bool(self._rotacao.culturas_supressoras_nematoide & set(crop_ids))

    def candidate_sequences(self, crop_ids: list[str], nematoide: bool | None) -> list[Sequence]:
        """PRD 7.7 passo 2: as sequências que sobram depois das restrições.

        `crop_ids` já vem só com as opções na janela (mais o pousio). Sai a sequência com mais de
        `max_pousios` pousios seguidos. Com nematoide = sim, sai a sequência sem supressora, mas só
        se alguma supressora estiver na lista: sem nenhuma, o filtro tiraria tudo.
        """
        suppressors = self._rotacao.culturas_supressoras_nematoide
        filter_nematode = nematoide is True and self.has_nematode_suppressor(crop_ids)
        return [
            seq
            for seq in self.all_sequences(crop_ids)
            if longest_fallow_run(seq) <= self._rotacao.max_pousios
            and not (filter_nematode and not suppressors & set(seq))
        ]

    def best_plan_starting_with(
        self,
        first: str,
        opcoes: list[ResultadoOpcao],
        pousio: NotasOpcao,
        axis: Callable[[NotasOpcao], float] | None = None,
        nematoide: bool | None = None,
        allow_fallow: bool = True,
    ) -> Sequence:
        """Melhor plano de 3 anos cujo 1º ano é `first` (tarefa 0044: a sugestão é o ano 1).

        Mesmas sequências e restrições do PRD 7.7 (`candidate_sequences`, com o pousio). A nota de
        cada sequência é a média da nota de cada ano mais o bônus de diversidade, sem o teto de 100
        (o teto empataria planos diferentes): a nota do eixo do objetivo (`axis`: segurança, renda
        ou solo) ou, sem objetivo, a nota final. No empate, vale a mesma conta com a nota final;
        depois, a primeira sequência na ordem das opções.

        `allow_fallow=False` tira o pousio das combinações (plano de um objetivo do produtor: com
        segurança 100, o pousio ganharia o "mais segurança" sem ter lavoura para proteger).
        """
        crop_ids = [o.id for o in opcoes if o.id != FALLOW_ID]
        if allow_fallow:
            crop_ids.append(FALLOW_ID)
        finals = {o.id: o.notas.final for o in opcoes} | {FALLOW_ID: pousio.final}
        nota = axis or attrgetter("final")
        scores = {o.id: nota(o.notas) for o in opcoes} | {FALLOW_ID: nota(pousio)}
        sequences = [s for s in self.candidate_sequences(crop_ids, nematoide) if s[0] == first]
        if not sequences:
            return (first,) * ROTATION_HORIZON_YEARS
        return max(
            sequences,
            key=lambda seq: (self._raw_score(seq, scores), self._raw_score(seq, finals)),
        )

    def _raw_score(self, seq: Sequence, scores: dict[str, float]) -> float:
        """Média das notas dos 3 anos + bônus de diversidade, sem o teto (só para comparar)."""
        return sum(scores[crop] for crop in seq) / len(seq) + self.diversity_bonus(seq)

    def build_3_year_plans(
        self,
        opcoes: list[ResultadoOpcao],
        anos_secos: list[int],
        pousio: NotasOpcao,
        nematoide: bool | None = None,
        lang: str = "pt-BR",
    ) -> tuple[PlanoRotacao, PlanoRotacao, PlanoRotacao]:
        """Melhor plano de 3 anos no ano normal e no ano seco, mais a sequência de hoje.

        `opcoes` são as opções na janela; o pousio entra com as notas de `pousio` (fora do ranking,
        mas parte das combinações do PRD 7.7), iguais nos dois cenários. O ano normal usa as notas
        finais dos 20 anos; o ano seco, as notas só dos anos mais secos (`notas_seco`, plano técnico
        §4.6). No empate, fica a primeira sequência na ordem das opções.
        """
        is_en = lang.lower().startswith("en")
        crop_ids = [o.id for o in opcoes if o.id != FALLOW_ID] + [FALLOW_ID]
        finals = {o.id: o.notas.final for o in opcoes} | {FALLOW_ID: pousio.final}
        finals_dry = {o.id: o.notas_seco.final for o in opcoes} | {FALLOW_ID: pousio.final}

        fallow_only = (FALLOW_ID,) * ROTATION_HORIZON_YEARS
        sequences = self.candidate_sequences(crop_ids, nematoide)
        if not sequences:
            # Nenhuma opção na janela: só o pousio, mesmo com 3 seguidos.
            plano = PlanoRotacao(
                anos=fallow_only,
                nota=self.plan_score(fallow_only, finals),
                descricao=(
                    "No crop fits the sowing window for this harvest: only fallow is left."
                    if is_en
                    else "Nenhuma cultura cabe na janela de plantio desta colheita: só resta o "
                    "pousio."
                ),
            )
            return plano, plano, plano

        best_normal = max(sequences, key=lambda seq: self.plan_score(seq, finals))
        best_dry = max(sequences, key=lambda seq: self.plan_score(seq, finals_dry))

        note = ""
        if nematoide is True and not self.has_nematode_suppressor(crop_ids):
            note = (
                " No crop that breaks the nematode cycle fits this harvest's sowing window, "
                "so the plan does not cut the nematode."
                if is_en
                else " Nenhuma cultura que quebra o ciclo do nematoide cabe na janela desta "
                "colheita, então o plano não corta o nematoide."
            )
        driest_str = ", ".join(str(y) for y in sorted(anos_secos))
        desc_normal = (
            "Balanced 3-year rotation combining income, straw cover, and low climate risk."
            if is_en
            else "Rotação equilibrada de 3 anos combinando renda, formação de palhada e controle "
            "de risco climático."
        )
        desc_seco = (
            f"Resilient sequence stress-tested on the {len(anos_secos)} driest historical years "
            f"({driest_str})."
            if is_en
            else f"Sequência resiliente testada nos {len(anos_secos)} anos mais secos da série "
            f"histórica ({driest_str})."
        )

        today_seq, desc_hoje = self._today(crop_ids, is_en)
        return (
            PlanoRotacao(
                anos=best_normal,
                nota=self.plan_score(best_normal, finals),
                descricao=desc_normal + note,
            ),
            PlanoRotacao(
                anos=best_dry,
                nota=self.plan_score(best_dry, finals_dry),
                descricao=desc_seco + note,
            ),
            PlanoRotacao(
                anos=today_seq, nota=self.plan_score(today_seq, finals), descricao=desc_hoje
            ),
        )

    @staticmethod
    def _today(crop_ids: list[str], is_en: bool) -> tuple[Sequence, str]:
        """Sequência de hoje (PRD 7.7: soja/milho ou soja/pousio), sem o histórico do talhão.

        Padrão a revisar: milho safrinha nos 3 anos; sem milho na janela, pousio nos 3 anos.
        """
        if TODAY_CROP_ID in crop_ids:
            return (TODAY_CROP_ID,) * ROTATION_HORIZON_YEARS, (
                "Corn alone after soybeans in all 3 years (reference sequence until your field "
                "history is part of the calculation)."
                if is_en
                else "Milho sozinho depois da soja nos 3 anos (sequência de referência enquanto o "
                "histórico do seu talhão não entra na conta)."
            )
        return (FALLOW_ID,) * ROTATION_HORIZON_YEARS, (
            "Fallow after soybeans in all 3 years: corn does not fit the sowing window for this "
            "harvest (reference sequence until your field history is part of the calculation)."
            if is_en
            else "Terra parada depois da soja nos 3 anos: o milho não cabe na janela desta "
            "colheita (sequência de referência enquanto o histórico do seu talhão não entra na "
            "conta)."
        )
