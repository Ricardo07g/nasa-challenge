import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { Avisos, GrupoAvisos, GrupoAvisosChave } from '../models/avisos'
import { isOutsideArea } from '../repositories/httpClient'
import {
  alertGroups,
  alertsPoint,
  avisosService,
  explorerLink,
  pointFromFlow,
  type AvisosService,
} from '../services/avisosService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { nearestPlace } from '../services/locationService'
import { useAsync } from './useAsync'

type Deps = { avisos: AvisosService }

const defaultDeps: Deps = { avisos: avisosService }

export type AvisosStatus = 'no-point' | 'loading' | 'ready' | 'error' | 'outside'

export type AvisosState = {
  status: AvisosStatus
  retry: () => void
  avisos: Avisos | null
  groups: { key: GrupoAvisosChave; group: GrupoAvisos }[]
  /** "Lavoura perto de…": a cidade de referência mais perto (lista do front, sem rede). */
  place: string | null
  /** "Ver como teriam sido os avisos em 2024" (só fora da safrinha). */
  explorerTo: string | null
  markTo: string
  backTo: string
}

/**
 * Tela "Avisos" (seção 6 da remodelagem, tarefa 0046 do backend, RF-31). Vale para o ponto da URL (o que
 * a pessoa está olhando) ou, sem ele, o último ponto marcado no fluxo, salvo no aparelho; a fazenda de
 * exemplo não conta. Sem ponto, a tela pede "Marcar minha lavoura". Sem notificação: os avisos aparecem
 * quando o app é aberto.
 */
export function useAvisosController(deps: Deps = defaultDeps): AvisosState {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const flowParams = useMemo(() => readFlowParams(search), [search])
  const flow = useMemo(() => pointFromFlow(flowParams), [flowParams])
  const point = useMemo(() => alertsPoint(flow, deps.avisos.savedPoint()), [flow, deps.avisos])
  const pointKey = point ? JSON.stringify(point) : ''

  const state = useAsync(
    () => (point ? deps.avisos.get(point, lang) : Promise.resolve(null)),
    [pointKey, lang, deps.avisos],
  )
  const avisos = state.data ?? null
  const groups = useMemo(() => (avisos ? alertGroups(avisos) : []), [avisos])

  let status: AvisosStatus = state.status
  if (!point) status = 'no-point'
  else if (state.status === 'error') status = isOutsideArea(state.error) ? 'outside' : 'error'
  else if (state.status === 'ready' && !avisos) status = 'loading'

  const safrinha = avisos?.safrinha
  const explorerTo =
    point && safrinha && !safrinha.em_andamento && safrinha.explorar_ano !== null
      ? explorerLink(point, safrinha.explorar_ano)
      : null

  return {
    status,
    retry: state.retry,
    avisos,
    groups,
    place: point ? nearestPlace(point) : null,
    explorerTo,
    markTo: '/onde',
    backTo: flowParams?.colheita ? `/resposta${keepFlowQuery(search.toString())}` : '/',
  }
}
