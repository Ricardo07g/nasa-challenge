import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { ScreenStatus } from '../models/screenStatus'
import { isOutsideArea, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { useAsync } from './useAsync'

/**
 * Talhão e recomendação do caminho que está na URL (missão e relatório). Quase sempre já estão no
 * cache. Sem ponto volta ao mapa; sem colheita volta à pergunta 2; fora da área vira "outside".
 */
export function useFlowFarm(farm: FarmService) {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const query = keepFlowQuery(search.toString())

  const talhao = useAsync(
    () =>
      params
        ? farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, farm],
  )
  const recomendacao = useAsync(
    () =>
      params?.colheita
        ? farm.recomendacao(
            { lat: params.lat, lon: params.lon, colheita: params.colheita, solo: params.solo, exemplo: params.exemplo },
            lang,
          )
        : Promise.reject(new Error('sem colheita na URL')),
    [params?.lat, params?.lon, params?.colheita, params?.solo, params?.exemplo, lang, farm],
  )

  const outside =
    (talhao.status === 'ready' && talhao.data?.dentro_da_area === false) ||
    isOutsideArea(talhao.error) ||
    isOutsideArea(recomendacao.error)
  const status: ScreenStatus = outside
    ? 'outside'
    : talhao.status === 'error' || recomendacao.status === 'error'
      ? 'error'
      : talhao.status === 'ready' && recomendacao.status === 'ready'
        ? 'ready'
        : 'loading'

  return {
    params,
    query,
    redirectTo: !params ? '/onde' : !params.colheita ? `/quando${query}` : null,
    talhao,
    recomendacao,
    status,
  }
}
