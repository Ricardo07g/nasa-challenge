import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery } from '../services/flowParams'
import { PAST_YEARS } from '../services/pastSeasonService'
import { buildPlan, initialScenario, plantingRule, type PlanScenario } from '../services/recomendacaoRules'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService; apiMode: ApiMode }

const defaultDeps: Deps = { farm: farmService, apiMode: currentApiMode }

/**
 * Tela 7 "Plano de 3 anos": sinal para o outono com Plano A / Plano B (RF-20). O bloco "Comece por um pedaço"
 * (hectares e totais em reais, RF-21) saiu na tarefa 0040: nenhum valor em reais no produto.
 */
export function usePlanController(deps: Deps = defaultDeps) {
  const { redirectTo, recomendacao, status } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()
  const [search] = useSearchParams()
  const data = recomendacao.data

  // O sinal marca o plano; a escolha da pessoa vale mais. Os botões avisam "nenhum" (null) ao tocar de novo.
  const [chosen, setChosen] = useState<PlanScenario | null>(null)
  const scenario = chosen ?? initialScenario(data?.sinal)
  const chooseScenario = useCallback((value: PlanScenario | null) => value && setChosen(value), [])

  const plan = useMemo(() => (data ? buildPlan(data, scenario) : null), [data, scenario])

  return {
    redirectTo,
    nav,
    status,
    retry: recomendacao.retry,
    signal: data?.sinal ?? null,
    scenario,
    chooseScenario,
    rule: data ? plantingRule(data) : null,
    plan,
    /** O estudo do ganho na soja é ilustrativo (não vem de dado nenhum): só com os dados de exemplo. */
    showGainReference: deps.apiMode === 'mock',
    communityTo: `/comunidade${keepFlowQuery(search.toString())}`,
    pastTo: `/safra-passada${keepFlowQuery(search.toString())}${search.toString() ? '&' : '?'}ano=${PAST_YEARS[0]}`,
  }
}
