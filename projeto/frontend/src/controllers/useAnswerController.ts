import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { buildAnswer } from '../services/recomendacaoRules'
import { useAnswerNav } from './useAnswerNav'
import { useAsync } from './useAsync'

type Deps = { farm: FarmService; apiMode: ApiMode }

const defaultDeps: Deps = { farm: farmService, apiMode: currentApiMode }

/** Tela 5 "A resposta": a melhor opção, os sinais, como fazer e as alternativas. */
export function useAnswerController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const nav = useAnswerNav()

  // Quase sempre já está no cache: a tela 4 pediu ao tocar em "Ver o que plantar".
  const recomendacao = useAsync(
    () =>
      params?.colheita
        ? deps.farm.recomendacao(
            { lat: params.lat, lon: params.lon, colheita: params.colheita, solo: params.solo, exemplo: params.exemplo },
            lang,
          )
        : Promise.reject(new Error('sem ponto ou colheita na URL')),
    [params?.lat, params?.lon, params?.colheita, params?.solo, params?.exemplo, lang, deps.farm],
  )

  const answer = recomendacao.data ? buildAnswer(recomendacao.data) : null
  const status = recomendacao.status === 'ready' && !answer ? 'error' : recomendacao.status
  const query = keepFlowQuery(search.toString())

  return {
    redirectTo: !params ? '/onde' : !params.colheita ? `/quando${query}` : null,
    nav,
    status,
    retry: recomendacao.retry,
    answer,
    aviso: recomendacao.data?.aviso ?? '',
    /** Sem o motor ligado (VITE_API_MODE=mock), os números são de exemplo. */
    sampleData: deps.apiMode === 'mock',
  }
}
