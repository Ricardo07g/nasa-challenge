import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { planningSummary } from '../i18n/planningTexts'
import { useI18n } from '../i18n/useI18n'
import type { CropId, Opcao } from '../models/recomendacao'
import type { SeasonAnswer } from '../models/seasonAnswers'
import type { ScreenStatus } from '../models/screenStatus'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery } from '../services/flowParams'
import { geocodingService, SEARCH_DELAY_MS, type GeocodingService } from '../services/geocodingService'
import { nearestPlace } from '../services/locationService'
import {
  harvestDay,
  lastSeasons,
  pastFutureRows,
  planGain,
  planningAlerts,
  planTimeline,
  sowingDay,
  type TimelineStep,
} from '../services/planningService'
import { planBState, planService, rainSourceName, type PlanService } from '../services/planService'
import { raioXService, type RaioXService } from '../services/raioXService'
import { answeredCount, flowWithSeasonAnswers, seasonAnswersFromFlow, seasonRows, withSeasonAnswer } from '../services/seasonAnswersService'
import { CURRENT_SEASON, LAST_SEASONS } from '../services/seasonService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useDebouncedRequest } from './useDebouncedRequest'
import { useFlowTalhao } from './useFlowRain'
import { useListenSummary } from './useListenSummary'
import { usePlanFlow } from './usePlanFlow'
import { useReplaceFlow } from './useReplaceFlow'

export type PlanningDeps = {
  farm: FarmService
  plan: PlanService
  raioX: RaioXService
  /** O nome do lugar da tela 1 ("Perto de …"), pela busca reversa do Photon (uso justo: um pedido, 400 ms). */
  geocoding: Pick<GeocodingService, 'reverse'>
  speech?: SpeechService
  /** "Imprimir relatório": a impressão do navegador. */
  print: () => void
  /** O dia de hoje (ISO): o "Agora" da linha do tempo e o "Gerado em" do relatório. */
  today: () => string
}

const defaultDeps: PlanningDeps = {
  farm: farmService,
  plan: planService,
  raioX: raioXService,
  geocoding: geocodingService,
  print: () => window.print(),
  today: () => new Date().toISOString().slice(0, 10),
}

/**
 * Tela 6 "Seu planejamento" (`/planejamento`, pacote 3): a tela final do fluxo. O plano é **o mesmo da tela 5**
 * (`usePlanFlow`, com a escolha e os anos da URL); a linha do tempo, os alertas, o passado e o futuro e o relatório
 * saem das regras do `planningService` com o `/recomendacao`, o `/api/plano` e o `/raio-x`. Sem dado, o bloco não
 * aparece. É a única tela com "Imprimir relatório".
 */
export function usePlanningController(deps: PlanningDeps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const flow = usePlanFlow(deps)
  const { params, data, choose, cards, evaluation } = flow
  const talhao = useFlowTalhao(deps.farm)
  const [search] = useSearchParams()
  const query = keepFlowQuery(search.toString())
  const replaceFlow = useReplaceFlow()
  const [seasonsOpen, setSeasonsOpen] = useState(false)

  const band = data?.entrada.colheita ?? params?.colheita ?? null
  const raio = useAsync(
    () => (params && band ? deps.raioX.get({ lat: params.lat, lon: params.lon, colheita: band, ...(params.solo ? { solo: params.solo } : {}) }, lang) : Promise.resolve(null)),
    [params?.lat, params?.lon, band, params?.solo, lang, deps.raioX],
  )
  const raioX = raio.status === 'error' ? null : (raio.data ?? null)

  // O lugar: a lavoura de demonstração tem nome próprio; fora dela, o mesmo "Perto de …" da tela 1.
  const demo = params?.exemplo ?? false
  const point = useMemo(() => (params ? { lat: params.lat, lon: params.lon } : null), [params])
  const reverse = useDebouncedRequest(
    point && !demo ? `${lang}|${point.lat.toFixed(5)},${point.lon.toFixed(5)}` : null,
    (signal) => deps.geocoding.reverse(point!, lang, { signal }),
    SEARCH_DELAY_MS,
  )
  const placeName = demo || !point ? null : reverse.status === 'ready' && reverse.data ? reverse.data : nearestPlace(point)

  const optionOf = useCallback((crop: CropId): Opcao | null => choose?.ranked.find((option) => option.id === crop) ?? null, [choose])
  const generatedOn = deps.today()
  const harvest = band ? harvestDay(params?.data, band) : null
  const plan = evaluation.data
  const timeline: TimelineStep[] | null =
    cards && harvest && data
      ? planTimeline({
          today: generatedOn,
          harvest,
          sowing: sowingDay(params?.data, data.entrada.semeadura),
          season: CURRENT_SEASON,
          firstCrop: cards[0].crop,
          first: optionOf(cards[0].crop),
          secondCrop: cards[1]?.crop ?? null,
          secondDeadline: cards[1]?.deadline ?? null,
          secondLate: cards[1]?.late ?? false,
          signal: flow.signal,
          planAB: plan?.plano_ab ?? null,
        })
      : null
  const gain = plan && choose ? planGain(plan, (crop) => optionOf(crop)?.renda.da_grao ?? null, CURRENT_SEASON) : null
  const planB = plan?.plano_ab ? planBState(plan.plano_ab) : null

  // Últimas safras do relatório: a resposta do produtor ou o que o satélite viu; faltou, "Preencher agora".
  const answers = useMemo(() => seasonAnswersFromFlow(params), [params])
  const rows = seasonRows(talhao.data?.historico ?? null)
  const seasonList = lastSeasons(answers, rows)
  const answerSeason = useCallback(
    (season: number, answer: SeasonAnswer | null) => params && replaceFlow(flowWithSeasonAnswers(params, withSeasonAnswer(answers, season, answer))),
    [params, answers, replaceFlow],
  )

  const plantStep = timeline?.find((step): step is Extract<TimelineStep, { kind: 'plant' }> => step.kind === 'plant') ?? null
  const listen = useListenSummary(
    cards && harvest ? planningSummary(t, lang, { crops: cards.map((card) => card.crop), harvest, plant: plantStep, planB: planB?.kind === 'b' ? planB.crop : null }) : '',
    lang,
    deps.speech ?? speechService,
  )

  // Com a recomendação na mão, a tela espera o plano (e o 1º raio-X, para não pular); depois, recarregar não apaga nada.
  let status: ScreenStatus = data ? (!choose ? 'error' : cards ? 'ready' : evaluation.status === 'error' ? 'error' : 'loading') : flow.flowStatus
  if (status === 'ready' && raio.status === 'loading' && raio.data === undefined) status = 'loading'

  return {
    redirectTo: flow.redirectTo,
    status,
    retry: flow.retry,
    backTo: `/plano${query}`,
    changeTo: `/plano${query}`,
    avisosTo: `/avisos${query}`,
    /** O bloco "Alertas oficiais" da tela de Avisos (o id `alertas-oficiais` é de lá). */
    officialTo: `/avisos${query}#alertas-oficiais`,
    guideTo: '/guia',
    newPlanTo: '/onde',
    listen,
    place: { demo, name: placeName, point },
    /** A data da tela 2 (`data`), a época e o dia da colheita usado nas contas (a data ou o dia da época no motor). */
    harvest: { date: params?.data ?? null, band, day: harvest },
    plan: { cards, evaluation: plan, signal: flow.signal },
    choose,
    optionOf,
    timeline,
    alerts: planningAlerts(flow.signal, raioX),
    pastFuture: plan ? pastFutureRows(plan, CURRENT_SEASON) : null,
    rainSource: rainSourceName(plan?.chuva?.fonte ?? 'gpm_imerg'),
    climate: raioX?.cartoes.clima_futuro ?? data?.clima_futuro ?? null,
    raio: raioX,
    seasons: {
      list: seasonList,
      idea: params?.pensa ?? null,
      /** O produtor não respondeu as 3 últimas safras: o aviso com o "Preencher agora" (regra geral 6). */
      missing: answeredCount(answers) < LAST_SEASONS.length,
      open: seasonsOpen,
      onOpen: () => setSeasonsOpen(true),
      onClose: () => setSeasonsOpen(false),
      form: { seasons: rows, answers, onAnswer: answerSeason },
    },
    gain,
    pousioText: data?.pousio.texto ?? '',
    print: deps.print,
    generatedOn,
  }
}

export type PlanningState = ReturnType<typeof usePlanningController>
