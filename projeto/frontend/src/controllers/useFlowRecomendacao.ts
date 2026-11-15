import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { ScreenStatus } from '../models/screenStatus'
import { isOutsideArea, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { confirmadasFromAnswers, seasonAnswersFromFlow } from '../services/seasonAnswersService'
import { useAsync } from './useAsync'

/**
 * Recomendação do caminho que está na URL (telas 5, 6 e 7). Quase sempre já está no cache: as telas
 * 3 e 4 pediram antes. Sem ponto volta ao mapa; sem colheita volta à pergunta 2.
 */
export function useFlowRecomendacao(farm: FarmService) {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  // Pacote 2: as respostas das safras vêm do `safras` (e dos links antigos com `confirmadas`).
  const confirmadas = useMemo(() => confirmadasFromAnswers(seasonAnswersFromFlow(params)), [params])

  const recomendacao = useAsync(
    () =>
      params?.colheita
        ? farm.recomendacao(
            {
              lat: params.lat,
              lon: params.lon,
              colheita: params.colheita,
              solo: params.solo,
              exemplo: params.exemplo,
              confirmadas,
            },
            lang,
          )
        : Promise.reject(new Error('sem ponto ou colheita na URL')),
    [params?.lat, params?.lon, params?.colheita, params?.solo, params?.exemplo, confirmadas, lang, farm],
  )

  const query = keepFlowQuery(search.toString())
  const redirectTo = !params ? '/onde' : !params.colheita ? `/quando${query}` : null
  // 404 OUTSIDE_AREA: o servidor ainda não tem dados para esse ponto (não é falha, é cobertura).
  const status: ScreenStatus =
    recomendacao.status === 'error' && isOutsideArea(recomendacao.error) ? 'outside' : recomendacao.status
  return { redirectTo, recomendacao, status }
}
