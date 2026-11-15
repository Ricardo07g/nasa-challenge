import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { Confirmacao, Textura } from '../models/talhao'
import type { ScreenStatus } from '../models/screenStatus'
import {
  applyConfirmations,
  confirmationRows,
  formatConfirmadas,
  noSoyAtPoint,
  parseConfirmadas,
  withConfirmation,
} from '../services/confirmedSeasonsService'
import {
  communityService,
  plantingReport,
  reportErrorKind,
  type CommunityService,
  type PlantingDraft,
  type ReportResult,
} from '../services/communityService'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { nearestPlace } from '../services/locationService'
import { alertList, heatmap, raioXService, xRayBlocks, type RaioXService } from '../services/raioXService'
import { climateSummary, historySummary, rainSummary, soilSummary } from '../services/satelliteService'
import { useAsync } from './useAsync'

type Deps = { farm: FarmService; raioX: RaioXService; community?: CommunityService }

const EMPTY_SHARE: PlantingDraft = { crop: null, year: null, outcome: null, reason: null }

/** Estado de uma safra no "Compartilhar com a comunidade": enviando, enviada, o motivo da falha ou nada. */
export type ShareStatus = ReportResult | 'sending'

export type SeasonShareRow = {
  year: number
  /** O produtor confirmou "Deixei parado": o relato já está pronto (pousio, sem "como foi"). */
  idle: boolean
  draft: PlantingDraft
  ready: boolean
  status: ShareStatus
}

export type SeasonShare = { open: boolean; showNotice: boolean; rows: SeasonShareRow[] }

const defaultDeps: Deps = { farm: farmService, raioX: raioXService }

/**
 * Tela 4 "Pronto. O satélite já viu o resto.": histórico do talhão, chuva, terra (com "Não é? Trocar")
 * e clima. A terra escolhida fica na URL (RF-18) e segue para a resposta. Histórico, chuva e clima só
 * aparecem com o dado de verdade; sem ele, o cartão não aparece (decisão D2).
 *
 * Tarefa 0039: no cartão do histórico, o produtor confirma as últimas safras ("Plantei" / "Deixei
 * parado"). A escolha vai para a URL (`confirmadas`), vale no lugar do satélite na faixa e segue para
 * a recomendação.
 *
 * Tarefa 0047: depois de confirmar, "Compartilhar com a comunidade" grava o relato de plantio de cada
 * safra confirmada no ponto da lavoura ("Deixei parado" vai pronto; "Plantei" pergunta a cultura e
 * como foi). Na fazenda de exemplo não aparece: o relato vale para a lavoura marcada.
 *
 * Tarefa 0043 (remodelagem S4): o raio-X do ponto (`/api/raio-x`), com a colheita e a terra da URL.
 * Sem as safras confirmadas, como o talhão: confirmar não recarrega o painel (a faixa de calor aplica
 * as respostas no front). Sem o raio-X, o painel, os alertas e os cartões não aparecem.
 */
export function useSatelliteController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const confirmadas = useMemo(() => parseConfirmadas(params?.confirmadas), [params?.confirmadas])
  const [soilOpen, setSoilOpen] = useState(false)

  // Quase sempre já está no cache: a tela 2 pediu o talhão ao tocar em "É aqui".
  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
  )
  // Só para os anos de chuva usados de fato (`chuva.anos`). Quase sempre já está no cache: a missão
  // esperou por ela. Se falhar, a chuva conta pelo período de dados[] e a tela segue. Sem as safras
  // confirmadas: os anos de chuva não dependem delas (e confirmar não pede de novo).
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

  const toggleSoil = useCallback(() => setSoilOpen((open) => !open), [])

  const chooseSoil = useCallback(
    (solo: Textura) => {
      if (!params) return
      setSoilOpen(false)
      navigate(`/satelite${buildFlowQuery({ ...params, solo })}`, { replace: true })
    },
    [params, navigate],
  )

  const confirmSeason = useCallback(
    (year: number, value: Confirmacao | null) => {
      if (!params) return
      const next = formatConfirmadas(withConfirmation(confirmadas, year, value))
      navigate(`/satelite${buildFlowQuery({ ...params, confirmadas: next })}`, { replace: true })
    },
    [params, confirmadas, navigate],
  )

  const confirm = useCallback(() => {
    if (!params?.colheita) return
    const { lat, lon, colheita, solo, exemplo } = params
    // Dispara já (na tela 3 pode ter sido pedida com outra terra): a resposta chega pronta.
    deps.farm.recomendacao({ lat, lon, colheita, solo, exemplo, confirmadas: params.confirmadas }, lang).catch(() => {})
    navigate(`/resposta${buildFlowQuery(params)}`)
  }, [params, deps.farm, lang, navigate])

  const query = keepFlowQuery(search.toString())
  const outside =
    (talhao.status === 'ready' && talhao.data?.dentro_da_area === false) ||
    (talhao.status === 'error' && isOutsideArea(talhao.error))
  const status: ScreenStatus = outside ? 'outside' : talhao.status
  const redirectTo = !params ? '/onde' : !params.colheita ? `/quando${query}` : null
  const historico = talhao.data?.historico ?? null
  const anosConfirmaveis = talhao.data?.anos_confirmaveis
  const confirmations = useMemo(
    () => confirmationRows(historico, anosConfirmaveis, confirmadas),
    [historico, anosConfirmaveis, confirmadas],
  )

  // Tarefa 0047: "Compartilhar com a comunidade" das safras confirmadas (só na lavoura marcada).
  const community = deps.community ?? communityService
  const [shareOpen, setShareOpen] = useState(false)
  const [shareDrafts, setShareDrafts] = useState<Partial<Record<number, PlantingDraft>>>({})
  const [shareStatus, setShareStatus] = useState<Partial<Record<number, ShareStatus>>>({})
  const [noticeSeen, setNoticeSeen] = useState(() => community.noticeSeen())
  const sharePoint = useMemo(
    () => (params && !params.exemplo ? { lat: params.lat, lon: params.lon } : null),
    [params],
  )
  const shareRows = useMemo(
    (): SeasonShareRow[] =>
      confirmations
        .filter((row) => row.choice !== null)
        .map((row) => {
          const idle = row.choice === 'parado'
          const saved = shareDrafts[row.year] ?? EMPTY_SHARE
          const crop = idle ? 'pousio' : saved.crop === 'pousio' ? null : saved.crop
          const draft: PlantingDraft = { ...saved, crop, year: row.year }
          const ready = sharePoint !== null && plantingReport(draft, sharePoint) !== null
          return { year: row.year, idle, draft, ready, status: shareStatus[row.year] ?? null }
        }),
    [confirmations, shareDrafts, shareStatus, sharePoint],
  )
  const share: SeasonShare | null =
    sharePoint && shareRows.length > 0 ? { open: shareOpen, showNotice: !noticeSeen, rows: shareRows } : null

  const toggleShare = useCallback(() => setShareOpen((open) => !open), [])
  const changeShare = useCallback((year: number, change: Partial<PlantingDraft>) => {
    setShareDrafts((drafts) => ({ ...drafts, [year]: { ...(drafts[year] ?? EMPTY_SHARE), ...change } }))
    setShareStatus((statuses) => ({ ...statuses, [year]: null }))
  }, [])
  const sendShare = useCallback(
    async (year: number) => {
      const row = shareRows.find((item) => item.year === year)
      const report = row && sharePoint ? plantingReport(row.draft, sharePoint) : null
      if (!report) return
      setShareStatus((statuses) => ({ ...statuses, [year]: 'sending' }))
      try {
        await community.send(report)
        setShareStatus((statuses) => ({ ...statuses, [year]: 'sent' }))
      } catch (error) {
        setShareStatus((statuses) => ({ ...statuses, [year]: reportErrorKind(error) }))
      } finally {
        setNoticeSeen(community.noticeSeen())
      }
    },
    [shareRows, sharePoint, community],
  )

  const historicoConfirmado = applyConfirmations(historico, confirmadas)
  const raioX = raio.status === 'ready' ? raio.data : undefined

  return {
    redirectTo,
    backTo: `/quando${query}`,
    adjustTo: `/onde${query}`,
    status,
    retry: talhao.retry,
    history: historySummary(historicoConfirmado),
    confirmations,
    share,
    toggleShare,
    changeShare,
    sendShare,
    communityTo: `/comunidade${query}`,
    noSoy: noSoyAtPoint(historico),
    rain: rainSummary(talhao.data?.dados ?? [], recomendacao.data?.opcoes ?? null),
    climate: climateSummary(talhao.data?.dados ?? []),
    soil: soilSummary(talhao.data?.solo ?? null, params?.solo),
    soilOpen,
    toggleSoil,
    chooseSoil,
    confirmSeason,
    confirm,
    xray:
      raioX && params
        ? { raio: raioX, blocks: xRayBlocks(raioX), place: nearestPlace(params), point: { lat: params.lat, lon: params.lon } }
        : null,
    heatmap: heatmap(raioX?.historico_ndvi, historicoConfirmado),
    alerts: alertList(raioX),
    cards: raioX?.cartoes ?? null,
    answerTo: `/resposta${query}`,
  }
}
