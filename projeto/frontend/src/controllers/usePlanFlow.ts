import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { PlanoAvaliado } from '../models/plano'
import type { CropId, Objetivo, Opcao } from '../models/recomendacao'
import {
  availableCrops,
  comparedCrops,
  isLate,
  pickerItems,
  planChoice,
  rankAll,
  suggestionOf,
} from '../services/choiceService'
import type { FarmService } from '../services/farmService'
import { readFlowParams } from '../services/flowParams'
import {
  finalCrops,
  planCards,
  planEdited,
  planEdits,
  planSignal,
  suggestedFor,
  suggestionFixos,
  type PlanService,
  type PlanSources,
} from '../services/planService'
import { CURRENT_SEASON } from '../services/seasonService'
import { useAsync } from './useAsync'
import { useFlowRecomendacao } from './useFlowRecomendacao'

export type PlanFlowDeps = { farm: FarmService; plan: PlanService }

/** Uma coluna da comparação: a opção do motor, ou null no "Deixar parado" (sem conta). */
export type CompareColumn = { id: CropId; option: Opcao | null }

export type Evaluation = { data: PlanoAvaliado | null; status: 'loading' | 'ready' | 'error' }

/**
 * O plano de 3 anos do caminho que está na URL, o mesmo na tela 5 ("Escolher" e "Plano de 3 anos") e na tela 6
 * ("Seu planejamento"). A sugestão, a ordem e a comparação vêm do `/recomendacao`; a escolha do 1º ano, da URL
 * (`escolha`, `pensa` ou a sugestão); o plano, da sugestão em cadeia (`/api/plano/sugestao`, com o 1º ano e o 2º,
 * se mudou) e, com o 3º ano mudado (`ano3`), do `/api/plano`. Cada cartão traz a nossa sugestão para o ano
 * (`suggestedFor`) e diz "Você mudou" só quando o ano é outra cultura. As duas telas chamam este hook para nunca
 * mostrarem planos diferentes.
 */
export function usePlanFlow(deps: PlanFlowDeps) {
  const { lang } = useI18n()
  const { redirectTo, recomendacao, status } = useFlowRecomendacao(deps.farm)
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const data = recomendacao.data
  const objective: Objetivo | null = params?.objetivo ?? null

  const choose = useMemo(() => {
    if (!data || !params) return null
    const suggestion = suggestionOf(data, objective)
    const choice = planChoice(data, objective, params)
    if (!suggestion || !choice) return null
    const ranked = rankAll(data, objective)
    const compared = comparedCrops(data, objective, params)
    const late = new Set(ranked.filter(isLate).map((option) => option.id))
    return {
      suggestion,
      choice,
      ranked,
      compared,
      columns: compared.map((id): CompareColumn => ({ id, option: ranked.find((option) => option.id === id) ?? null })),
      picker: pickerItems(availableCrops(data, objective), compared, choice, suggestion.id, late),
      late,
    }
  }, [data, params, objective])

  // Plano de 3 anos. A sugestão com o 1º ano fixo diz a nossa sugestão do 2º ano (e a do 3º, com o 2º sugerido);
  // com o 2º ano mudado para outra cultura, a sugestão com os dois fixos refaz o 3º; com o 3º mudado, o plano inteiro
  // vai para o /api/plano. Sem o 2º mudado, os dois pedidos de sugestão são o mesmo (o cache do planService junta).
  const edits = useMemo(() => planEdits(params ?? {}), [params])
  const choice = choose?.choice ?? null
  const suggestion = choose?.suggestion.id ?? null
  const place = params && data ? { lat: params.lat, lon: params.lon, colheita: data.entrada.colheita, solo: params.solo } : null
  const chain = useAsync(
    () => (place && choice ? deps.plan.suggest({ ...place, fixos: [choice] }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, choice, lang, deps.plan],
  )
  const fromChoice = chain.data ?? null
  const sources = (fromYear2: PlanoAvaliado | null, final: PlanoAvaliado | null): PlanSources | null =>
    choice && suggestion ? { choice, suggestion, edits, fromChoice, fromYear2, final } : null
  const chainOnly = sources(null, null)
  const second = chainOnly ? (suggestedFor(1, chainOnly)?.crop ?? null) : null
  // O plano sugerido que a tela mostra: guarda o anterior enquanto o novo carrega (trocar um ano não pisca a tela).
  const fixos = choice ? suggestionFixos(choice, edits, second) : null
  const base = useAsync(
    () => (place && fixos ? deps.plan.suggest({ ...place, fixos }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, fixos?.join(','), lang, deps.plan],
  )
  const finalList = choice ? finalCrops(choice, edits, fromChoice) : null
  const final = useAsync(
    () => (place && finalList ? deps.plan.evaluate({ ...place, anos: finalList }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, finalList?.join(','), lang, deps.plan],
  )
  // Com o 3º ano mudado, enquanto o plano final carrega, ficam as notas e os cartões do sugerido ("Recalculando…",
  // sem piscar); se o /api/plano falhar, a tela diz que não deu (nunca mostra o sugerido no lugar do plano dele).
  const finalFailed = Boolean(edits.year3) && final.status === 'error'
  const evaluation: Evaluation = edits.year3
    ? { data: finalFailed ? null : (final.data ?? base.data ?? null), status: final.status }
    : { data: base.data ?? null, status: base.status }
  const all = sources(fixos && fixos.length > 1 ? (base.data ?? null) : null, final.data ?? null)
  const cards = all && !finalFailed ? planCards(all, CURRENT_SEASON) : null
  const edited = planEdited(cards, edits)

  return {
    params,
    redirectTo,
    /** O estado da recomendação (com o 404 `OUTSIDE_AREA` como `outside`). */
    flowStatus: status,
    recomendacao,
    data,
    objective,
    choose,
    place,
    evaluation,
    cards,
    edited,
    /** O sinal do outono da tela: o da avaliação do plano (com o Plano A e o Plano B que a tela mostra). */
    signal: planSignal(evaluation.data, data ?? null, edited || choice !== choose?.suggestion.id),
    /** "Tentar de novo": a recomendação e o plano. */
    retry: () => {
      recomendacao.retry()
      chain.retry()
      base.retry()
      final.retry()
    },
  }
}

export type PlanFlow = ReturnType<typeof usePlanFlow>
