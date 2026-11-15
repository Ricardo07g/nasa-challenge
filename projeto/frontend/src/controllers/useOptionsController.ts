import { useMemo } from 'react'
import { farmService, type FarmService } from '../services/farmService'
import { optionsForObjective } from '../services/suggestionService'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRain } from './useFlowRain'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Aba Comparar (antes "Todas as opções"): a ordem segue o objetivo do produtor ("O que você quer mais?",
 * tarefa 0044), que vem pronta do motor e fica na URL. A S5b refaz o conteúdo da aba.
 */
export function useOptionsController(deps: Deps = defaultDeps) {
  const { redirectTo, recomendacao, status } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()

  const summary = useMemo(
    () => (recomendacao.data ? optionsForObjective(recomendacao.data, nav.objective) : null),
    [recomendacao.data, nav.objective],
  )

  const rain = useFlowRain(deps.farm, recomendacao.data?.opcoes ?? null)

  return { redirectTo, nav, status, retry: recomendacao.retry, summary, rain }
}
