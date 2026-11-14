import { useCallback, useMemo, useState } from 'react'
import { farmService, type FarmService } from '../services/farmService'
import { buildPlan, type PlanArea, type PlanScenario } from '../services/recomendacaoRules'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/** Tela 7 "Plano de 3 anos": linha do tempo, ano normal ou seco e por onde começar. */
export function usePlanController(deps: Deps = defaultDeps) {
  const { redirectTo, recomendacao } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()
  const [scenario, setScenario] = useState<PlanScenario>('normal')
  const [area, setArea] = useState<PlanArea>('50')

  // Os grupos de botões avisam "nenhum" (null) ao tocar de novo; aqui sempre fica um escolhido.
  const chooseScenario = useCallback((value: PlanScenario | null) => value && setScenario(value), [])
  const chooseArea = useCallback((value: PlanArea | null) => value && setArea(value), [])

  const plan = useMemo(
    () => (recomendacao.data ? buildPlan(recomendacao.data, scenario) : null),
    [recomendacao.data, scenario],
  )

  return {
    redirectTo,
    nav,
    status: recomendacao.status,
    retry: recomendacao.retry,
    scenario,
    chooseScenario,
    area,
    chooseArea,
    plan,
  }
}
