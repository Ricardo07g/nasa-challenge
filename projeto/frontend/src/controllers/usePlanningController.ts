import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { planningSummary } from '../i18n/xrayTexts'
import type { ScreenStatus } from '../models/screenStatus'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { planService, todayState, type PlanService } from '../services/planService'
import { alertList, raioXService, type RaioXService } from '../services/raioXService'
import { climateSummary, rainSummary } from '../services/satelliteService'
import { seasonAnswersFromFlow } from '../services/seasonAnswersService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useListenSummary } from './useListenSummary'
import { usePlanFlow, type Evaluation } from './usePlanFlow'

export type PlanningDeps = {
  farm: FarmService
  plan: PlanService
  raioX: RaioXService
  speech?: SpeechService
  /** "Imprimir relatório": a impressão do navegador. */
  print: () => void
  /** O dia de hoje (ISO), para o "Gerado em" do relatório. */
  today: () => string
}

const defaultDeps: PlanningDeps = {
  farm: farmService,
  plan: planService,
  raioX: raioXService,
  print: () => window.print(),
  today: () => new Date().toISOString().slice(0, 10),
}

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

  // Relatório para imprimir (veio da tela 5 no pacote 3): o mesmo plano da tela 5 (`usePlanFlow`).
  const flowPlan = usePlanFlow(deps)
  const answers = useMemo(() => seasonAnswersFromFlow(params), [params])
  const today = todayState(answers)
  const todayList = today.kind === 'crops' ? today.crops : null
  const place = flowPlan.place
  const todayEvaluation = useAsync(
    () => (place && todayList ? deps.plan.evaluate({ ...place, anos: todayList }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, todayList?.join(','), lang, deps.plan],
  )
  const data = flowPlan.data
  const report = flowPlan.choose
    ? {
        choose: flowPlan.choose,
        harvest: { date: params?.data ?? null, band: data?.entrada.colheita ?? params?.colheita ?? null },
        plan: { cards: flowPlan.cards, evaluation: flowPlan.evaluation, signal: flowPlan.signal },
        today: { state: today, evaluation: { data: todayEvaluation.data ?? null, status: todayEvaluation.status } as Evaluation },
        pousioText: data?.pousio.texto ?? '',
        raio: raioX ?? null,
        answers,
        idea: params?.pensa ?? null,
        demo: params?.exemplo ?? false,
        point: params ? { lat: params.lat, lon: params.lon } : null,
        generatedOn: deps.today(),
      }
    : null

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
    report,
    print: deps.print,
  }
}

export type PlanningState = ReturnType<typeof usePlanningController>

/** O que o relatório para imprimir usa (null enquanto o plano não chegou). */
export type PlanReportData = NonNullable<PlanningState['report']>
