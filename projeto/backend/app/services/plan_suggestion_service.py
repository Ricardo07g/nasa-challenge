"""Sugestão em cadeia do plano de 3 anos, com o porquê de cada ano (pacote 2, tela 5; tarefa 0056).

O produtor fixa o 1º ano (ou o 1º e o 2º) e o motor sugere os seguintes considerando os anteriores:
a mesma conta do PRD 7.7 (`RotationPlanService.best_plan_with_prefix`: média das notas finais +
diversidade, as mesmas restrições, só culturas no prazo do ZARC) mais as regras da cadeia (grupo
`plano_cadeia`: cobrir depois do parado, quebrar o nematoide depois do milho, variar a função).

O "Por quê:" de cada ano sugerido é a frase da regra que pesou (grupo `frases_plano`), nesta ordem:
cobrir depois do parado, quebrar o nematoide depois do milho, o prazo (sem o prazo do ZARC, uma
cultura fora dele ganharia aquele ano), variar a função; sem nenhuma, a melhor nota. Com a sede
"pouca" (linha "Água", grupo `agua`), a frase diz que aguenta a seca. Hipótese do time, a revisar
pela agrônoma.
"""

from collections.abc import Callable, Sequence

from app.constants import ROTATION_HORIZON_YEARS
from app.models.plano import AnoSugerido
from app.models.recomendacao import NotasOpcao, ResultadoOpcao
from app.models.regras import FrasesPlano, Regras
from app.repositories.rules_repository import load_default_rules
from app.services.errors import ValidationDomainError
from app.services.rotation_plan_service import (
    RULE_COVER_AFTER_FALLOW,
    RULE_NEMATODE_AFTER_CORN,
    RULE_VARY_ROLE,
    RotationPlanService,
)

MONTHS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
# Sede da linha "Água" (WaterNeedService) que vale "aguenta a seca" no porquê
LITTLE_THIRST = "pouca"


def _day_month(iso: str, en: bool) -> str:
    """ "2027-02-28" → "28/02" (pt) ou "Feb 28" (en), como as outras frases do motor."""
    _, month, day = iso.split("-")
    return f"{MONTHS_EN[int(month) - 1]} {int(day)}" if en else f"{day}/{month}"


def _lower_first(nome: str) -> str:
    return nome[:1].lower() + nome[1:]


class PlanSuggestionService:
    """Completa o plano a partir dos anos fixos e escreve o porquê de cada ano sugerido."""

    def __init__(self, plan_service: RotationPlanService, rules: Regras | None = None) -> None:
        self._plan_service = plan_service
        self._frases = (rules if rules is not None else load_default_rules()).frases_plano

    def suggest(
        self,
        fixos: Sequence[str],
        opcoes: Sequence[ResultadoOpcao],
        fora_do_prazo: Sequence[ResultadoOpcao],
        pousio: NotasOpcao,
        nematoide: bool | None = None,
        lang: str = "pt-BR",
        axis: Callable[[NotasOpcao], float] | None = None,
        allow_fallow: bool = True,
    ) -> tuple[AnoSugerido, ...]:
        """Os 3 anos: os `fixos` (1 ou 2) e os sugeridos, só com as `opcoes` no prazo e o pousio.

        `fora_do_prazo`: as culturas fora do prazo do ZARC, avaliadas pelo motor; não são
        sugeridas, mas dizem se o prazo pesou na escolha de um ano.
        `axis` e `allow_fallow`: o plano de um objetivo do produtor (tarefa 0065), com a nota do
        eixo do objetivo e sem o pousio; sem eles, o plano em cadeia do PRD 7.7 (nota final, com o
        pousio), o mesmo do Plano A do `/recomendacao`.

        Raises:
            ValidationDomainError: sem 1 ou 2 anos fixos.
        """
        if not 1 <= len(fixos) < ROTATION_HORIZON_YEARS:
            raise ValidationDomainError(
                f"Fixe 1 ou {ROTATION_HORIZON_YEARS - 1} anos do plano; o motor sugere os outros."
            )
        plan = self._plan_service
        seq = plan.best_plan_with_prefix(
            fixos,
            list(opcoes),
            pousio,
            axis=axis,
            nematoide=nematoide,
            allow_fallow=allow_fallow,
        )
        # A mesma conta sem o prazo do ZARC, para saber se ele pesou em algum ano
        free = (
            plan.best_plan_with_prefix(
                fixos,
                [*opcoes, *fora_do_prazo],
                pousio,
                axis=axis,
                nematoide=nematoide,
                allow_fallow=allow_fallow,
            )
            if fora_do_prazo
            else seq
        )
        en = lang.lower().startswith("en")
        frases = self._frases["en" if en else "pt"]
        by_id = {o.id: o for o in (*opcoes, *fora_do_prazo)}
        late = {o.id for o in fora_do_prazo}
        return tuple(
            AnoSugerido(cultura=crop, fixo=True, motivo=None)
            if i < len(fixos)
            else AnoSugerido(
                cultura=crop,
                fixo=False,
                motivo=self._reason(i, seq, free, by_id, late, frases, en),
            )
            for i, crop in enumerate(seq)
        )

    def _reason(
        self,
        i: int,
        seq: Sequence[str],
        free: Sequence[str],
        by_id: dict[str, ResultadoOpcao],
        late: set[str],
        frases: FrasesPlano,
        en: bool,
    ) -> str:
        prev, crop = seq[i - 1], seq[i]
        rules = self._plan_service.transition_rules(prev, crop)
        option, previous = by_id.get(crop), by_id.get(prev)
        winner = by_id.get(free[i]) if free[i] in late else None
        if RULE_COVER_AFTER_FALLOW in rules:
            text = frases.cobrir_depois_do_parado
        elif RULE_NEMATODE_AFTER_CORN in rules:
            text = frases.quebrar_nematoide_depois_do_milho
        elif (
            winner is not None
            and tuple(free[:i]) == tuple(seq[:i])
            and winner.data_limite
            and option is not None
            and option.data_limite
        ):
            text = frases.prazo.format(
                cultura_fora=_lower_first(winner.nome),
                limite_fora=_day_month(winner.data_limite, en),
                limite=_day_month(option.data_limite, en),
            )
        elif RULE_VARY_ROLE in rules:
            grain = (option.da_grao, previous.da_grao) if option and previous else None
            if grain == (True, False):
                text = frases.grao_depois_da_cobertura
            elif grain == (False, True):
                text = frases.cobertura_depois_do_grao
            else:
                text = frases.variar_funcao
        else:
            text = frases.melhor_nota
        if option is not None and option.agua is not None and option.agua.sede == LITTLE_THIRST:
            text = frases.aguenta_seca.format(motivo=text)
        return text
