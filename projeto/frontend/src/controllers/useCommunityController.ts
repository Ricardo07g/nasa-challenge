import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { TipoRelato } from '../models/community'
import type { RegionStatus } from '../models/region'
import type { BlockStatus } from '../models/screenStatus'
import {
  cellMarkers,
  communityService,
  dateBounds,
  eventReport,
  isCommunityUnavailable,
  isNotConnected,
  isoDate,
  nearbySummary,
  plantingReport,
  rainReport,
  regionPlace,
  regionSummary,
  reportErrorKind,
  type CommunityService,
  type EventDraft,
  type PlantingDraft,
  type RainDraft,
  type ReportResult,
} from '../services/communityService'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { EXAMPLE_FARM } from '../services/locationService'
import { historySummary } from '../services/satelliteService'
import { useAsync } from './useAsync'

type Deps = { community: CommunityService; farm: FarmService; today?: () => string }

const defaultDeps: Deps = { community: communityService, farm: farmService }

function todayOnDevice(): string {
  return isoDate(new Date())
}

const EMPTY_PLANTING: PlantingDraft = { crop: null, year: null, outcome: null, reason: null }

/** Estado dos três relatos (o aberto, os rascunhos e o resultado do envio), para a view. */
export type CommunityFormState = {
  open: TipoRelato | null
  planting: PlantingDraft
  rain: RainDraft
  event: EventDraft
  bounds: { min: string; max: string }
  /** O relato aberto está completo e pode ser enviado. */
  ready: boolean
  sending: boolean
  result: ReportResult
  /** "Seus vizinhos veem a região, não o seu ponto.": até o primeiro envio que deu certo. */
  showNotice: boolean
  /** Fogo escolhido: "Em caso de fogo, ligue 193 (Bombeiros)". */
  fireCall: boolean
}

/**
 * Tela "Na sua região" (seção 7 da remodelagem, tarefa 0047): o primeiro passo de uma comunidade
 * local, sem cadastro. Em cima, contar (plantio, chuva, evento: no máximo três toques cada); embaixo,
 * a redondeza de 30 km (resumo "Perto de você", mapa por célula e os meus relatos, para apagar).
 *
 * Só conta quem marcou a própria lavoura (o relato vale para o ponto marcado; a fazenda de exemplo
 * não conta). Sem banco no servidor (503) a comunidade fica "not-connected" e não aparece. O bloco
 * da região pelo satélite (P3) continua como antes: some sem o arquivo da região (404).
 */
export function useCommunityController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  // O dia de hoje no aparelho, lido uma vez ao abrir a tela (padrão das datas de chuva e evento).
  const [today] = useState(() => (deps.today ?? todayOnDevice)())

  const center = useMemo(() => (params ? { lat: params.lat, lon: params.lon } : EXAMPLE_FARM), [params])
  const ownPoint = params && !params.exemplo ? center : null

  // Relatos da redondeza.
  const nearby = useAsync(() => deps.community.nearby(center, lang), [center, lang, deps.community])
  const status: BlockStatus =
    nearby.status === 'error' && isCommunityUnavailable(nearby.error) ? 'not-connected' : nearby.status
  const data = nearby.data ?? null
  const summary = useMemo(() => (data ? nearbySummary(data, today) : null), [data, today])
  const markers = useMemo(() => (data ? cellMarkers(data.relatos) : []), [data])
  const years = useMemo(() => data?.anos_safra ?? [], [data])

  // Os três relatos.
  const [open, setOpen] = useState<TipoRelato | null>(null)
  const [planting, setPlantingDraft] = useState<PlantingDraft>(EMPTY_PLANTING)
  const [rain, setRainDraft] = useState<RainDraft>({ mm: '', date: today })
  const [event, setEventDraft] = useState<EventDraft>({ event: null, date: today })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<ReportResult>(null)
  const [noticeSeen, setNoticeSeen] = useState(() => deps.community.noticeSeen())
  const [removing, setRemoving] = useState<string | null>(null)

  // A safra mais recente já vem escolhida: cultura e como foi bastam (no máximo três toques).
  const latestYear = years.length > 0 ? Math.max(...years) : null
  const plantingDraft = useMemo(() => ({ ...planting, year: planting.year ?? latestYear }), [planting, latestYear])

  const report = useMemo(() => {
    if (!ownPoint || !open) return null
    if (open === 'plantio') return plantingReport(plantingDraft, ownPoint)
    if (open === 'chuva') return rainReport(rain, ownPoint, today)
    return eventReport(event, ownPoint, today)
  }, [ownPoint, open, plantingDraft, rain, event, today])

  const openForm = useCallback((kind: TipoRelato | null) => {
    setOpen((current) => (current === kind ? null : kind))
    setResult(null)
  }, [])
  const setPlanting = useCallback((change: Partial<PlantingDraft>) => setPlantingDraft((d) => ({ ...d, ...change })), [])
  const setRain = useCallback((change: Partial<RainDraft>) => setRainDraft((d) => ({ ...d, ...change })), [])
  const setEvent = useCallback((change: Partial<EventDraft>) => setEventDraft((d) => ({ ...d, ...change })), [])

  const retryNearby = nearby.retry
  const send = useCallback(async () => {
    if (!report || sending) return
    setSending(true)
    setResult(null)
    try {
      await deps.community.send(report)
      setResult('sent')
      setOpen(null)
      if (report.tipo === 'plantio') setPlantingDraft(EMPTY_PLANTING)
      if (report.tipo === 'chuva') setRainDraft({ mm: '', date: today })
      if (report.tipo === 'evento') setEventDraft({ event: null, date: today })
      retryNearby()
    } catch (error) {
      setResult(reportErrorKind(error))
    } finally {
      setNoticeSeen(deps.community.noticeSeen())
      setSending(false)
    }
  }, [report, sending, deps.community, today, retryNearby])

  const remove = useCallback(
    async (id: string) => {
      setRemoving(id)
      try {
        await deps.community.remove(id)
        retryNearby()
      } catch {
        setResult('other')
      } finally {
        setRemoving(null)
      }
    },
    [deps.community, retryNearby],
  )

  // P3: área parada na região, pelo satélite (escondida enquanto a calibração não termina: sem o
  // arquivo da região, a API responde 404 e o bloco não aparece).
  const regionAsync = useAsync(() => deps.community.region(center, lang), [center, lang, deps.community])
  const regionStatus: RegionStatus =
    regionAsync.status === 'error' && isOutsideArea(regionAsync.error)
      ? 'outside'
      : regionAsync.status === 'error' && isNotConnected(regionAsync.error)
        ? 'not-connected'
        : regionAsync.status
  const talhao = useAsync(
    () => deps.farm.talhao({ ...center, exemplo: params ? params.exemplo : true }, lang),
    [center, params?.exemplo, lang, deps.farm],
  )
  const history = historySummary(talhao.data?.historico ?? null)
  const regionReady = regionStatus === 'ready' && regionAsync.data ? regionAsync.data : null
  const place = regionReady ? regionPlace(regionReady) : null

  return {
    // A Comunidade abre de qualquer tela pelo cabeçalho: volta para a resposta se o caminho estiver na URL.
    backTo: params?.colheita ? `/resposta${keepFlowQuery(search.toString())}` : '/',
    center,
    radiusKm: data?.raio_km ?? 30,
    status,
    retry: nearby.retry,
    summary,
    markers,
    canTell: ownPoint !== null,
    markTo: '/onde',
    years,
    form: {
      open,
      planting: plantingDraft,
      rain,
      event,
      bounds: dateBounds(today),
      ready: report !== null,
      sending,
      result,
      showNotice: !noticeSeen,
      fireCall: event.event === 'fogo',
    } satisfies CommunityFormState,
    openForm,
    setPlanting,
    setRain,
    setEvent,
    send,
    remove,
    removing,
    regionStatus,
    retryRegion: regionAsync.retry,
    region: regionReady ? regionSummary(regionReady) : null,
    regionRadius: place?.radiusKm ?? null,
    regionDistance: place?.distanceKm ?? null,
    history: history ? { idle: history.idle, known: history.known, uncertain: history.uncertain } : null,
  }
}
