import { useSearchParams } from 'react-router'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery } from '../services/flowParams'
import { buildAnswer } from '../services/recomendacaoRules'
import type { TelegramService } from '../services/telegramService'
import { useAnswerNav } from './useAnswerNav'
import { useFlowRain } from './useFlowRain'
import { useFlowRecomendacao } from './useFlowRecomendacao'
import { useTelegramLink } from './useTelegramLink'

type Deps = { farm: FarmService; apiMode: ApiMode; telegram?: TelegramService }

const defaultDeps: Deps = { farm: farmService, apiMode: currentApiMode }

/** Tela 5 "A resposta": a melhor opção, os sinais, como fazer e as alternativas. */
export function useAnswerController(deps: Deps = defaultDeps) {
  const { redirectTo, recomendacao, status: flowStatus } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()
  const [search] = useSearchParams()
  const telegramHref = useTelegramLink(deps.telegram)

  const answer = recomendacao.data ? buildAnswer(recomendacao.data) : null
  const rain = useFlowRain(deps.farm, recomendacao.data?.opcoes ?? null)
  const status = flowStatus === 'ready' && !answer ? 'error' : flowStatus

  return {
    redirectTo,
    nav,
    status,
    retry: recomendacao.retry,
    answer,
    aviso: recomendacao.data?.aviso ?? '',
    /** Sem o motor ligado (VITE_API_MODE=mock), os números são de exemplo. */
    sampleData: deps.apiMode === 'mock',
    reportTo: `/relatorio${keepFlowQuery(search.toString())}`,
    rain,
    telegramHref,
  }
}
