import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { alertsListen, placeLabel } from '../i18n/alertTexts'
import { useI18n } from '../i18n/useI18n'
import type { Aviso, Avisos } from '../models/avisos'
import { isOutsideArea } from '../repositories/httpClient'
import {
  alertsPoint,
  alertsSummary,
  avisosService,
  changeTiles,
  exampleRows,
  exampleYear,
  nowAlerts,
  planCropOf,
  planLine,
  recentReadings,
  recordTiles,
  viewPointFromFlow,
  type AlertsSummary,
  type AvisosService,
  type ExampleRow,
  type PlanLine,
} from '../services/avisosService'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { nearestPlace } from '../services/locationService'
import { pastSeasonService, type PastSeasonService } from '../services/pastSeasonService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useListenSummary, type ListenSummaryState } from './useListenSummary'

type Deps = { avisos: AvisosService; farm: FarmService; pastSeason: PastSeasonService; speech?: SpeechService }

const defaultDeps: Deps = { avisos: avisosService, farm: farmService, pastSeason: pastSeasonService }

export type AvisosStatus = 'no-point' | 'loading' | 'ready' | 'error' | 'outside'

/** O modal de detalhe aberto: um cartão de "Agora", um quadro de mudança ou um recorde (pela posição na lista). */
export type AvisosDetail = { kind: 'now' | 'change' | 'record'; index: number }

/** "Ver exemplo: avisos de <ano>": o modal com o replay e os recordes daquele ano. */
export type AvisosExample = {
  /** O ano do exemplo; `null` = sem link (durante a safrinha ou sem série). */
  year: number | null
  open: boolean
  status: 'loading' | 'ready'
  rows: ExampleRow[]
  onOpen: () => void
  onClose: () => void
}

export type AvisosState = {
  status: AvisosStatus
  retry: () => void
  avisos: Avisos | null
  /** O lugar do topo: "Lavoura perto de Prata (MG)" ou "Lavoura de demonstração, perto de Uberlândia (MG)". */
  place: string | null
  /** O cartão do resumo (o número é o mesmo do sino). */
  summary: AlertsSummary | null
  /** Os cartões de "Agora", com "Atenção" antes. */
  now: Aviso[]
  /** As leituras de "Agora" são desta semana (senão, "até {data}"). */
  recentReadings: boolean
  changes: Aviso[]
  records: Aviso[]
  /** "Seu plano: {cultura}, plantio até {prazo}". */
  plan: PlanLine | null
  example: AvisosExample
  detail: AvisosDetail | null
  openDetail: (kind: AvisosDetail['kind'], index: number) => void
  closeDetail: () => void
  markTo: string
  backTo: string
  /** "Ouvir resumo" (regra geral 9 do pacote 2): quantos avisos e o que fazer em cada um. */
  listen: ListenSummaryState
}

/**
 * Tela "Avisos" (seção 6 da remodelagem, tarefa 0046; refeita no pacote 3, tela 7, tarefa 0062). Vale para o ponto
 * da URL (inclusive a lavoura de demonstração, que a tela mostra mas o aparelho nunca guarda) ou, sem ele, o último
 * ponto marcado no fluxo, salvo no aparelho. Sem ponto, a tela pede "Marcar minha lavoura". A cultura do plano e o
 * prazo vêm da mesma recomendação da tela 5, e a cultura vai à API dos avisos; o exemplo de um ano só é pedido
 * quando o modal abre.
 */
export function useAvisosController(deps: Deps = defaultDeps): AvisosState {
  const { lang, messages: t } = useI18n()
  const [search] = useSearchParams()
  const { hash } = useLocation()
  const flowParams = useMemo(() => readFlowParams(search), [search])
  const flow = useMemo(() => viewPointFromFlow(flowParams), [flowParams])
  const point = useMemo(() => alertsPoint(flow, deps.avisos.savedPoint()), [flow, deps.avisos])
  const pointKey = point ? JSON.stringify(point) : ''

  // A recomendação da tela 5 (quase sempre já no cache): a cultura do plano e o "Prazo para plantar".
  const recomendacao = useAsync(
    () =>
      point?.colheita
        ? deps.farm.recomendacao(
            {
              lat: point.lat,
              lon: point.lon,
              colheita: point.colheita,
              solo: point.solo,
              confirmadas: point.confirmadas,
              exemplo: point.exemplo,
            },
            lang,
          )
        : Promise.resolve(null),
    [pointKey, lang, deps.farm],
  )
  const rec = recomendacao.status === 'ready' ? (recomendacao.data ?? null) : null
  // Tarefa 0065 do backend: a cultura do 1º ano do plano vai à API (a falta de água e o "deu certo" dela). Espera a
  // recomendação; sem ela (sem colheita ou falha), a escolha da URL ou nenhuma (a API usa a melhor opção).
  const planKnown = !point?.colheita || recomendacao.status !== 'loading'
  const sentCrop = point && planKnown ? planCropOf(point, rec, null) : null
  const state = useAsync(
    () => (point && planKnown ? deps.avisos.get(point, lang, sentCrop) : Promise.resolve(null)),
    [pointKey, lang, deps.avisos, planKnown, sentCrop],
  )
  const avisos = state.data ?? null

  let status: AvisosStatus = state.status
  if (!point) status = 'no-point'
  else if (state.status === 'error') status = isOutsideArea(state.error) ? 'outside' : 'error'
  else if (state.status === 'ready' && !avisos) status = 'loading'
  const ready = status === 'ready' && avisos !== null

  const planCrop = point && avisos ? planCropOf(point, rec, avisos.safrinha?.cultura ?? null) : null
  const plan = useMemo(() => planLine(planCrop, rec), [planCrop, rec])
  const summary = useMemo(() => (ready && avisos ? alertsSummary(avisos) : null), [ready, avisos])
  const now = useMemo(() => (ready && avisos ? nowAlerts(avisos) : []), [ready, avisos])
  const changes = useMemo(() => (ready && avisos ? changeTiles(avisos, planCrop) : []), [ready, avisos, planCrop])
  const records = useMemo(() => (ready && avisos ? recordTiles(avisos) : []), [ready, avisos])

  // "Ver exemplo": o replay do ano com a cultura do plano, pedido só com o modal aberto.
  const [exampleOpen, setExampleOpen] = useState(false)
  const year = ready && avisos ? exampleYear(avisos) : null
  const replayCrop = planCrop && planCrop !== 'pousio' ? planCrop : null
  const replay = useAsync(
    () =>
      point && exampleOpen && year !== null && replayCrop
        ? deps.pastSeason.get({ lat: point.lat, lon: point.lon }, year, lang, { colheita: point.colheita, opcao: replayCrop })
        : Promise.resolve(null),
    [point?.lat, point?.lon, point?.colheita, exampleOpen, year, replayCrop, lang, deps.pastSeason],
  )
  const rows = useMemo(
    () => (avisos && year !== null ? exampleRows(year, replay.status === 'ready' ? (replay.data ?? null) : null, avisos) : []),
    [avisos, year, replay.status, replay.data],
  )

  const [detail, setDetail] = useState<AvisosDetail | null>(null)
  const openDetail = useCallback((kind: AvisosDetail['kind'], index: number) => setDetail({ kind, index }), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  // A âncora "#alertas-oficiais" (o "Ver alertas oficiais" da tela 6): o roteador rola ao abrir, mas o resumo e os
  // cartões chegam depois e empurram o bloco; com a tela pronta, rola de novo.
  const settled = status !== 'loading'
  useEffect(() => {
    if (!settled || !hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [settled, hash])

  const place = placeLabel(t, point ? nearestPlace(point) : null, Boolean(point?.exemplo))
  const spoken = !point ? t.alerts.listen.noPoint : alertsListen(t, lang, summary, now)
  const listen = useListenSummary(spoken, lang, deps.speech ?? speechService)

  return {
    status,
    retry: state.retry,
    avisos,
    place,
    summary,
    now,
    recentReadings: avisos ? recentReadings(avisos.hoje, avisos.agora.ultima_leitura) : false,
    changes,
    records,
    plan,
    example: {
      year,
      open: exampleOpen,
      status: replay.status === 'loading' ? 'loading' : 'ready',
      rows,
      onOpen: () => setExampleOpen(true),
      onClose: () => setExampleOpen(false),
    },
    detail,
    openDetail,
    closeDetail,
    markTo: '/onde',
    backTo: flowParams?.colheita ? `/resposta${keepFlowQuery(search.toString())}` : '/',
    listen,
  }
}
