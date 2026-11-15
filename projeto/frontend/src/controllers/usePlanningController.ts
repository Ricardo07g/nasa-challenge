import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { planningSummary } from '../i18n/xrayTexts'
import type { ScreenStatus } from '../models/screenStatus'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { alertList, raioXService, type RaioXService } from '../services/raioXService'
import { climateSummary, rainSummary } from '../services/satelliteService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useListenSummary } from './useListenSummary'

export type PlanningDeps = { farm: FarmService; raioX: RaioXService; speech?: SpeechService }

const defaultDeps: PlanningDeps = { farm: farmService, raioX: raioXService }

/**
 * Tela final "Seu planejamento" (`/planejamento`, pacote 2, tarefa 0058). Por enquanto, guarda os blocos que
 * saíram do raio-X, como eram: "Alertas da sua área", "20 anos de chuva" e "Clima 2041–2060" (do `/raio-x`);
 * sem o raio-X, os cartões de antes (anos de chuva e clima, do talhão e da recomendação). Será refeita no
 * próximo pacote. O Voltar leva para a resposta, com o fluxo.
 */
export function usePlanningController(deps: PlanningDeps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])

  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
  )
  // Só para os anos de chuva do cartão de antes (sem o raio-X). Quase sempre já está no cache.
  const recomendacao = useAsync(
    () =>
      params?.colheita
        ? deps.farm.recomendacao(
            { lat: params.lat, lon: params.lon, colheita: params.colheita, solo: params.solo, exemplo: params.exemplo },
            lang,
          )
        : Promise.reject(new Error('sem colheita na URL')),
    [params?.lat, params?.lon, params?.colheita, params?.solo, params?.exemplo, lang, deps.farm],
  )
  const raio = useAsync(
    () =>
      params?.colheita
        ? deps.raioX.get(
            { lat: params.lat, lon: params.lon, colheita: params.colheita, ...(params.solo ? { solo: params.solo } : {}) },
            lang,
          )
        : Promise.reject(new Error('sem colheita na URL')),
    [params?.lat, params?.lon, params?.colheita, params?.solo, lang, deps.raioX],
  )

  const query = keepFlowQuery(search.toString())
  const outside =
    (talhao.status === 'ready' && talhao.data?.dentro_da_area === false) ||
    (talhao.status === 'error' && isOutsideArea(talhao.error))
  const xrayPending = raio.status === 'loading' && raio.data === undefined
  const status: ScreenStatus = outside ? 'outside' : talhao.status === 'ready' && xrayPending ? 'loading' : talhao.status
  const raioX = raio.status === 'error' ? undefined : raio.data
  const alerts = alertList(raioX)
  const cards = raioX?.cartoes ?? null
  const listen = useListenSummary(planningSummary(t, alerts, cards), lang, deps.speech ?? speechService)

  return {
    redirectTo: !params ? '/onde' : !params.colheita ? `/quando${query}` : null,
    backTo: `/resposta${query}`,
    answerTo: `/resposta${query}`,
    status,
    retry: talhao.retry,
    listen,
    alerts,
    cards,
    rain: rainSummary(talhao.data?.dados ?? [], recomendacao.data?.opcoes ?? null),
    climate: climateSummary(talhao.data?.dados ?? []),
  }
}
