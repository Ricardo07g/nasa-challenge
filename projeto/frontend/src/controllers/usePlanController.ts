import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery } from '../services/flowParams'
import { PAST_YEARS } from '../services/pastSeasonService'
import {
  buildPlan,
  findOption,
  initialScenario,
  normalizeHectares,
  plantingRule,
  testAreaTotals,
  type PlanScenario,
} from '../services/recomendacaoRules'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Tela 7 "Plano de 3 anos": sinal para o outono com Plano A / Plano B (RF-20) e os hectares para testar
 * com os totais em reais (RF-21).
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

  // Hectares: o campo aceita qualquer texto; a conta usa o valor normalizado (padrão 50 ha).
  const [areaInput, setAreaInput] = useState('50')
  const hectares = normalizeHectares(areaInput)
  const changeArea = useCallback((value: string) => setAreaInput(value), [])
  const commitArea = useCallback(() => setAreaInput((value) => String(normalizeHectares(value))), [])
  const stepArea = useCallback(
    (delta: number) => setAreaInput((value) => String(Math.max(1, normalizeHectares(value) + delta))),
    [],
  )

  const plan = useMemo(() => (data ? buildPlan(data, scenario) : null), [data, scenario])
  const firstYear = data && plan ? findOption(data.opcoes, plan.years[0]?.crop) : undefined

  return {
    redirectTo,
    nav,
    status,
    retry: recomendacao.retry,
    signal: data?.sinal ?? null,
    scenario,
    chooseScenario,
    areaInput,
    hectares,
    changeArea,
    commitArea,
    stepArea,
    totals: testAreaTotals(firstYear, hectares),
    rule: data ? plantingRule(data) : null,
    plan,
    communityTo: `/comunidade${keepFlowQuery(search.toString())}`,
    pastTo: `/safra-passada${keepFlowQuery(search.toString())}${search.toString() ? '&' : '?'}ano=${PAST_YEARS[0]}`,
  }
}
