import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type { CropId } from '../models/recomendacao'
import { compareChips, comparedCrops, toggleCompared } from '../services/compareService'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, readFlowParams } from '../services/flowParams'
import { currentPlan, planStartingWith } from '../services/planService'
import { findOption } from '../services/recomendacaoRules'
import { buildSuggestion, rankForObjective } from '../services/suggestionService'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Aba Comparar (seção 5.5 da remodelagem, tarefa 0045): até 3 culturas lado a lado. As escolhidas ficam na
 * URL (`comparar`); sem escolha, as 3 melhores do objetivo (a ordem vem pronta do motor). "Se você prefere…"
 * é o ponto de partida (põe a alternativa ao lado da sugestão) e "Usar no meu plano" leva a cultura para o
 * ano 1 do Plano (`plano` na URL).
 */
export function useOptionsController(deps: Deps = defaultDeps) {
  const { redirectTo, recomendacao, status } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const params = useMemo(() => readFlowParams(search), [search])
  const data = recomendacao.data

  const compare = useMemo(() => {
    if (!data) return null
    const selected = comparedCrops(data, nav.objective, params?.comparar)
    const best = rankForObjective(data, nav.objective)[0]?.id ?? null
    return {
      chips: compareChips(data, nav.objective, selected),
      columns: selected.flatMap((crop) => findOption(data.opcoes, crop) ?? []),
      selected,
      best,
      full: selected.length >= 3,
      alternatives: buildSuggestion(data, nav.objective)?.alternatives ?? [],
    }
  }, [data, nav.objective, params?.comparar])

  const writeCompared = useCallback(
    (next: CropId[]) => {
      if (!params) return
      navigate(`${pathname}${buildFlowQuery({ ...params, comparar: next })}`, { replace: true })
    },
    [navigate, params, pathname],
  )

  const toggle = useCallback(
    (crop: CropId) => compare && writeCompared(toggleCompared(compare.selected, crop)),
    [compare, writeCompared],
  )

  const compareWith = useCallback(
    (crop: CropId) => compare && writeCompared([...new Set([...(compare.best ? [compare.best] : []), crop])]),
    [compare, writeCompared],
  )

  const planLink = useCallback(
    (crop: CropId) => {
      if (!params || !data) return '/plano'
      const plan = currentPlan(data, nav.objective, params.plano).years
      return `/plano${buildFlowQuery({ ...params, comparar: undefined, plano: planStartingWith(plan, crop) })}`
    },
    [data, nav.objective, params],
  )

  return { redirectTo, nav, status, retry: recomendacao.retry, compare, toggle, compareWith, planLink }
}
