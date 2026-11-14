import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { farmService, type FarmService } from '../services/farmService'
import { buildAnswer } from '../services/recomendacaoRules'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService; apiMode: ApiMode }

const defaultDeps: Deps = { farm: farmService, apiMode: currentApiMode }

/** Tela 5 "A resposta": a melhor opção, os sinais, como fazer e as alternativas. */
export function useAnswerController(deps: Deps = defaultDeps) {
  const { redirectTo, recomendacao } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()

  const answer = recomendacao.data ? buildAnswer(recomendacao.data) : null
  const status = recomendacao.status === 'ready' && !answer ? 'error' : recomendacao.status

  return {
    redirectTo,
    nav,
    status,
    retry: recomendacao.retry,
    answer,
    aviso: recomendacao.data?.aviso ?? '',
    /** Sem o motor ligado (VITE_API_MODE=mock), os números são de exemplo. */
    sampleData: deps.apiMode === 'mock',
  }
}
