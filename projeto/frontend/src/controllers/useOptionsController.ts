import { useMemo, useState } from 'react'
import type { Eixo } from '../models/recomendacao'
import { farmService, type FarmService } from '../services/farmService'
import { optionsSummary } from '../services/recomendacaoRules'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/** Tela 6 "Todas as opções": reordenar por Chuva, Dinheiro ou Terra é no navegador (RF-05). */
export function useOptionsController(deps: Deps = defaultDeps) {
  const { redirectTo, recomendacao } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()
  const [axis, chooseAxis] = useState<Eixo | null>(null)

  const summary = useMemo(
    () => (recomendacao.data ? optionsSummary(recomendacao.data, axis) : null),
    [recomendacao.data, axis],
  )

  return { redirectTo, nav, status: recomendacao.status, retry: recomendacao.retry, axis, chooseAxis, summary }
}
