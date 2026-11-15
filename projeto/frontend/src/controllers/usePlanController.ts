import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { PlanoAvaliado } from '../models/plano'
import type { CropId } from '../models/recomendacao'
import { parseConfirmadas } from '../services/confirmedSeasonsService'
import { formatToday, parseToday } from '../services/cropListParams'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import {
  currentPlan,
  planChoices,
  planService as defaultPlanService,
  todayPlan,
  todayRows,
  withTodayAnswer,
  withYearCrop,
  type PlanService,
  type TodayRow,
} from '../services/planService'
import { harvestYear } from '../services/recomendacaoRules'
import { thirstByCrop } from '../services/suggestionService'
import { useAnswerNav } from './useAnswerNav'
import { useAsync } from './useAsync'
import { useFlowTalhao } from './useFlowRain'
import { useFlowRecomendacao } from './useFlowRecomendacao'

type Deps = { farm: FarmService; plan?: PlanService }

const defaultDeps: Deps = { farm: farmService, plan: defaultPlanService }

export type Evaluation = { data: PlanoAvaliado | null; status: 'loading' | 'ready' | 'error' }

export type TodayState = {
  rows: TodayRow[]
  /** O talhão tem o histórico do NDVI (senão, a tela pergunta direto). */
  hasSatellite: boolean
  crops: CropId[]
  /** Sem as 3 safras conhecidas: a sequência de referência do motor. */
  reference: boolean
  referenceText: string
  evaluation: Evaluation
}

/**
 * Aba "Plano de 3 anos" (seção 5.6 da remodelagem, tarefa 0045): o produtor monta a rotação. O plano editado
 * (`plano`) e as respostas do "Como é hoje" (`hoje`) ficam na URL; as notas, a saúde da terra, a chuva
 * aproveitada e o Plano A/B vêm do `GET /api/plano`, recalculados a cada troca (o último resultado fica na
 * tela enquanto o novo chega). O botão "Como teria sido em 2024?" saiu: o detalhe de cada ano está no
 * explorador da Sugestão.
 */
export function usePlanController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const { redirectTo, recomendacao, status } = useFlowRecomendacao(deps.farm)
  const talhao = useFlowTalhao(deps.farm)
  const nav = useAnswerNav()
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const params = useMemo(() => readFlowParams(search), [search])
  const data = recomendacao.data
  const planService = deps.plan ?? defaultPlanService

  const plan = useMemo(() => {
    if (!data) return null
    const { years, edited } = currentPlan(data, nav.objective, params?.plano)
    const first = harvestYear(data.entrada.semeadura)
    return {
      years: years.map((crop, index) => ({ year: first + index, crop })),
      choices: planChoices(data, nav.objective),
      edited,
      thirst: thirstByCrop(data),
      options: data.opcoes,
    }
  }, [data, nav.objective, params?.plano])

  const today = useMemo(() => {
    if (!data) return null
    const field = talhao.data
    const rows = todayRows(
      field?.historico ?? null,
      field?.anos_confirmaveis,
      parseConfirmadas(params?.confirmadas),
      parseToday(params?.hoje),
    )
    return { rows, hasSatellite: Boolean(field?.historico), ...todayPlan(rows, data), referenceText: data.plano_3_anos.hoje.descricao }
  }, [data, talhao.data, params?.confirmadas, params?.hoje])

  const evaluate = (crops: readonly CropId[] | undefined) =>
    params && data && crops
      ? planService.evaluate(
          { lat: params.lat, lon: params.lon, colheita: data.entrada.colheita, solo: params.solo, anos: crops },
          lang,
        )
      : Promise.resolve(null)

  const planCrops = plan?.years.map((year) => year.crop)
  const planEvaluation = useAsync(() => evaluate(planCrops), [params?.lat, params?.lon, params?.solo, data, planCrops?.join(','), lang])
  const todayEvaluation = useAsync(() => evaluate(today?.crops), [params?.lat, params?.lon, params?.solo, data, today?.crops.join(','), lang])

  const write = useCallback(
    (change: Parameters<typeof buildFlowQuery>[0] | null) => change && navigate(`${pathname}${buildFlowQuery(change)}`, { replace: true }),
    [navigate, pathname],
  )

  const chooseCrop = useCallback(
    (index: number, crop: CropId) => plan && params && write({ ...params, plano: withYearCrop(plan.years.map((y) => y.crop), index, crop) }),
    [params, plan, write],
  )
  const reset = useCallback(() => params && write({ ...params, plano: undefined }), [params, write])
  const answerToday = useCallback(
    (year: number, crop: CropId | null) => params && write({ ...params, hoje: formatToday(withTodayAnswer(parseToday(params.hoje), year, crop)) }),
    [params, write],
  )

  const asEvaluation = (state: typeof planEvaluation): Evaluation => ({ data: state.data ?? null, status: state.status })

  return {
    redirectTo,
    nav,
    status,
    retry: recomendacao.retry,
    signal: data?.sinal ?? null,
    plan,
    evaluation: asEvaluation(planEvaluation),
    today: today ? ({ ...today, evaluation: asEvaluation(todayEvaluation) } satisfies TodayState) : null,
    chooseCrop,
    reset,
    answerToday,
    communityTo: `/comunidade${keepFlowQuery(search.toString())}`,
  }
}
