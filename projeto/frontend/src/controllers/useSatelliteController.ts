import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { xraySummary } from '../i18n/xrayTexts'
import type { CulturaRelato } from '../models/community'
import type { RaioX } from '../models/raioX'
import type { CurrentChoice, SeasonAnswer, SeasonAnswers, SeasonRow } from '../models/seasonAnswers'
import type { ScreenStatus } from '../models/screenStatus'
import type { Colheita, Textura } from '../models/talhao'
import {
  COMMUNITY_OPEN,
  communityService,
  plantingReport,
  reportErrorKind,
  type CommunityService,
  type PlantingDraft,
  type ReportResult,
} from '../services/communityService'
import { noSoyAtPoint } from '../services/confirmedSeasonsService'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { nearestPlace } from '../services/locationService'
import { raioXService, xRayBlocks, type RaioXService, type XRayBlock } from '../services/raioXService'
import { soilSummary } from '../services/satelliteService'
import {
  answeredCount,
  confirmadasFromAnswers,
  flowWithSeasonAnswers,
  seasonAnswersFromFlow,
  seasonRows,
  withSeasonAnswer,
} from '../services/seasonAnswersService'
import { seasonChart } from '../services/seasonChartService'
import { LAST_SEASONS } from '../services/seasonService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useListenSummary } from './useListenSummary'
import { useReplaceFlow } from './useReplaceFlow'

export type SatelliteDeps = {
  farm: FarmService
  raioX: RaioXService
  community?: CommunityService
  /** A comunidade está aberta na interface (padrão: `COMMUNITY_OPEN`, "em breve" desde o pacote 3). */
  communityOpen?: boolean
  speech?: SpeechService
}

const EMPTY_SHARE: PlantingDraft = { crop: null, year: null, outcome: null, reason: null }

/** Estado de uma safra no "Compartilhar com a comunidade": enviando, enviada, o motivo da falha ou nada. */
export type ShareStatus = ReportResult | 'sending'

export type SeasonShareRow = {
  year: number
  /** O produtor respondeu "Deixei parado": o relato já está pronto (pousio, sem "como foi"). */
  idle: boolean
  draft: PlantingDraft
  ready: boolean
  status: ShareStatus
}

export type SeasonShare = { open: boolean; showNotice: boolean; rows: SeasonShareRow[] }

/** O painel do raio-X: o dado do backend, os blocos com dado, o lugar e o ponto. */
export type XRayModel = { raio: RaioX; blocks: XRayBlock[]; place: string; demo: boolean; point: { lat: number; lon: number } }

/** O que o satélite viu da soja nas 3 últimas safras (o selo no topo de "Suas últimas safras"). */
export type SoySeen = { kind: 'all' | 'some' | 'none' | 'no-reading'; count: number }

export type SeasonsModel = {
  /** As 3 últimas safras com o que o satélite viu (o formulário `SeasonAnswersForm`). */
  rows: SeasonRow[]
  answers: SeasonAnswers
  /** A safra atual: a escolha (`pensa`), a data da colheita da tela 2 (`data`), a época (`colheita`) e o "Trocar data". */
  current: { choice: CurrentChoice | null; harvestDate: string | null; harvestBand: Colheita | null; changeDateTo: string }
  /** Quantas das 3 safras estão respondidas (nada é obrigatório). */
  answered: number
  seen: SoySeen
}

const defaultDeps: SatelliteDeps = { farm: farmService, raioX: raioXService }

function soySeen(rows: readonly SeasonRow[]): SoySeen {
  if (rows.every((row) => row.satellite === null)) return { kind: 'no-reading', count: 0 }
  const count = rows.filter((row) => row.satellite?.soy).length
  return { kind: count === rows.length ? 'all' : count === 0 ? 'none' : 'some', count }
}

const isCulturaRelato = (answer: SeasonAnswer | undefined): answer is CulturaRelato & SeasonAnswer =>
  answer !== undefined && answer !== 'soja' && answer !== 'sem_soja'

/**
 * Tela 4 "Pronto. O satélite já viu o resto." (pacote 2, tarefa 0058): o raio-X da sua terra (8 blocos enxutos,
 * cada um abre o seu modal) e "Suas últimas safras" (o gráfico do satélite e as confirmações, por safra).
 *
 * - O talhão é pedido **sem** as respostas (o que o satélite viu) e o raio-X com a colheita e a terra da URL;
 *   responder não recarrega nada: as respostas valem no front (gráfico, contas e formulário).
 * - As respostas vão para a URL sem rolar (`safras` e `pensa`, pelo `useReplaceFlow`) e seguem para a resposta;
 *   a moldura guarda o fluxo no aparelho (o ponto salvo dos avisos).
 * - "Sua terra é diferente?" (no modal do Solo) grava `solo` na URL, também sem rolar; o painel continua na
 *   tela enquanto o raio-X recarrega.
 * - Os alertas, os 20 anos de chuva e o clima 2041–2060 saíram daqui: estão em `/planejamento`.
 *
 * Tarefa 0047: com safras respondidas, "Compartilhar com a comunidade" grava o relato de plantio de cada uma
 * no ponto da lavoura ("Deixei parado" vai pronto). Na lavoura de demonstração não aparece.
 */
export function useSatelliteController(deps: SatelliteDeps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const navigate = useNavigate()
  const replaceFlow = useReplaceFlow()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const answers = useMemo(() => seasonAnswersFromFlow(params), [params])
  const [detail, setDetail] = useState<XRayBlock['kind'] | null>(null)

  // Quase sempre já está no cache: a tela "Onde fica a lavoura" pediu o talhão ao confirmar o local.
  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
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
  // O raio-X demora mais que o talhão (roda o motor). Na primeira carga a tela espera por ele, para o
  // painel não entrar por cima do que já apareceu. Se ele falhar, a tela abre sem o painel.
  const xrayPending = raio.status === 'loading' && raio.data === undefined
  const status: ScreenStatus = outside ? 'outside' : talhao.status === 'ready' && xrayPending ? 'loading' : talhao.status
  const redirectTo = !params ? '/onde' : !params.colheita ? `/quando${query}` : null
  const historico = talhao.data?.historico ?? null
  // Ao trocar a terra, o raio-X recarrega com o painel (e o modal do Solo) na tela: vale o último que chegou.
  const raioX = raio.status === 'error' ? undefined : raio.data
  const blocks = useMemo(() => xRayBlocks(raioX), [raioX])
  const soil = soilSummary(talhao.data?.solo ?? null, params?.solo)

  const rows = useMemo(() => seasonRows(historico), [historico])
  const seasons: SeasonsModel = {
    rows,
    answers,
    current: {
      choice: params?.pensa ?? null,
      harvestDate: params?.data ?? null,
      harvestBand: params?.colheita ?? null,
      changeDateTo: `/quando${query}`,
    },
    answered: answeredCount(answers),
    seen: soySeen(rows),
  }
  const chart = useMemo(
    () =>
      seasonChart({
        strip: raioX?.historico_ndvi,
        historico,
        answers,
        current: params?.pensa,
        harvestDay: params?.data?.slice(5) ?? null,
      }),
    [raioX, historico, answers, params?.pensa, params?.data],
  )

  const listen = useListenSummary(xraySummary(t, lang, blocks, soil), lang, deps.speech ?? speechService)

  const openDetail = useCallback((kind: XRayBlock['kind']) => setDetail(kind), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  const chooseSoil = useCallback(
    (solo: Textura) => {
      if (params) replaceFlow({ ...params, solo })
    },
    [params, replaceFlow],
  )

  const answerSeason = useCallback(
    (year: number, answer: SeasonAnswer | null) => {
      if (params) replaceFlow(flowWithSeasonAnswers(params, withSeasonAnswer(answers, year, answer)))
    },
    [params, answers, replaceFlow],
  )

  const chooseCurrent = useCallback(
    (choice: CurrentChoice | null) => {
      if (params) replaceFlow({ ...params, pensa: choice ?? undefined })
    },
    [params, replaceFlow],
  )

  const confirm = useCallback(() => {
    if (!params?.colheita) return
    const { lat, lon, colheita, solo, exemplo } = params
    // Dispara já, com as respostas no lugar do satélite: a resposta chega pronta.
    deps.farm.recomendacao({ lat, lon, colheita, solo, exemplo, confirmadas: confirmadasFromAnswers(answers) }, lang).catch(() => {})
    navigate(`/resposta${buildFlowQuery(params)}`)
  }, [params, answers, deps.farm, lang, navigate])

  // Tarefa 0047: "Compartilhar com a comunidade" das safras respondidas (só na lavoura marcada). Desde o pacote 3
  // (tarefa 0061), a comunidade está "em breve": com ela fechada, a tela não oferece compartilhar.
  const community = deps.community ?? communityService
  const communityOpen = deps.communityOpen ?? COMMUNITY_OPEN
  const [shareOpen, setShareOpen] = useState(false)
  const [shareDrafts, setShareDrafts] = useState<Partial<Record<number, PlantingDraft>>>({})
  const [shareStatus, setShareStatus] = useState<Partial<Record<number, ShareStatus>>>({})
  const [noticeSeen, setNoticeSeen] = useState(() => community.noticeSeen())
  const sharePoint = useMemo(() => (params && !params.exemplo ? { lat: params.lat, lon: params.lon } : null), [params])
  const shareRows = useMemo(
    (): SeasonShareRow[] =>
      LAST_SEASONS.filter((year) => answers[year] !== undefined && answers[year] !== 'sem_soja').map((year) => {
        const answer = answers[year]
        const idle = answer === 'pousio'
        const saved = shareDrafts[year] ?? EMPTY_SHARE
        const answered = isCulturaRelato(answer) ? answer : null
        const crop = idle ? 'pousio' : saved.crop && saved.crop !== 'pousio' ? saved.crop : answered
        const draft: PlantingDraft = { ...saved, crop, year }
        const ready = sharePoint !== null && plantingReport(draft, sharePoint) !== null
        return { year, idle, draft, ready, status: shareStatus[year] ?? null }
      }),
    [answers, shareDrafts, shareStatus, sharePoint],
  )
  const share: SeasonShare | null =
    communityOpen && sharePoint && shareRows.length > 0 ? { open: shareOpen, showNotice: !noticeSeen, rows: shareRows } : null

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

  const xray: XRayModel | null =
    raioX && params
      ? { raio: raioX, blocks, place: nearestPlace(params), demo: params.exemplo, point: { lat: params.lat, lon: params.lon } }
      : null

  return {
    redirectTo,
    backTo: `/quando${query}`,
    adjustTo: `/onde${query}`,
    status,
    retry: talhao.retry,
    listen,
    xray,
    detail,
    openDetail,
    closeDetail,
    soil,
    chooseSoil,
    chart,
    seasons,
    answerSeason,
    chooseCurrent,
    noSoy: noSoyAtPoint(historico),
    share,
    toggleShare,
    changeShare,
    sendShare,
    communityTo: `/comunidade${query}`,
    confirm,
  }
}
