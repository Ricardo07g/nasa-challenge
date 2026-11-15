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
import { finalCrops, planCards, planEdits, planSignal, suggestionFixos, type PlanService } from '../services/planService'
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
 * se mudou) e, com o 3º ano mudado (`ano3`), do `/api/plano`. As duas telas chamam este hook para nunca
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

  // Plano de 3 anos: a sugestão em cadeia com o 1º ano (e o 2º, se mudou); com o 3º mudado, o plano inteiro.
  const edits = useMemo(() => planEdits(params ?? {}), [params])
  const choice = choose?.choice ?? null
  const place = params && data ? { lat: params.lat, lon: params.lon, colheita: data.entrada.colheita, solo: params.solo } : null
  const fixos = choice ? suggestionFixos(choice, edits) : null
  const base = useAsync(
    () => (place && fixos ? deps.plan.suggest({ ...place, fixos }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, fixos?.join(','), lang, deps.plan],
  )
  const finalList = choice ? finalCrops(choice, edits, base.data ?? null) : null
  const final = useAsync(
    () => (place && finalList ? deps.plan.evaluate({ ...place, anos: finalList }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, finalList?.join(','), lang, deps.plan],
  )
  const shown = edits.year3 ? final : base
  const evaluation: Evaluation = { data: shown.data ?? null, status: shown.status }
  const cards = choice ? planCards(choice, edits, base.data ?? null, final.data ?? null, CURRENT_SEASON) : null
  const edited = Boolean(edits.year2 || edits.year3)

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
  }
}

export type PlanFlow = ReturnType<typeof usePlanFlow>
