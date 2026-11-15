import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { PlanoAvaliado } from '../models/plano'
import type { CropId, Objetivo, Opcao } from '../models/recomendacao'
import type { SeasonAnswer } from '../models/seasonAnswers'
import {
  availableCrops,
  choiceFlow,
  comparedCrops,
  comparedFlow,
  isLate,
  objectiveFlow,
  pickerItems,
  planChoice,
  rankAll,
  suggestionOf,
  toggleCompared as toggleList,
} from '../services/choiceService'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { pastSeasonService, type PastSeasonService } from '../services/pastSeasonService'
import {
  finalCrops,
  planCards,
  planEdits,
  planService as defaultPlanService,
  planSignal,
  resetPlanFlow,
  suggestionFixos,
  todayState,
  yearFlow,
  type PlanService,
} from '../services/planService'
import { raioXService, type RaioXService } from '../services/raioXService'
import {
  currentChoiceCrop,
  flowWithSeasonAnswers,
  seasonAnswersFromFlow,
  seasonRows,
  withSeasonAnswer,
} from '../services/seasonAnswersService'
import { CURRENT_SEASON } from '../services/seasonService'
import { speechService, type SpeechService } from '../services/speechService'
import { selectedYear } from '../services/suggestionService'
import { useAsync } from './useAsync'
import { useFlowTalhao } from './useFlowRain'
import { useFlowRecomendacao } from './useFlowRecomendacao'
import { useListenSummary } from './useListenSummary'
import { useReplaceFlow, useReplaceUrl } from './useReplaceFlow'

type Deps = {
  farm: FarmService
  plan: PlanService
  raioX: RaioXService
  pastSeason: PastSeasonService
  speech: SpeechService
  /** "Imprimir relatório": a impressão do navegador. */
  print: () => void
  /** O dia de hoje (ISO), para o "Gerado em" do relatório. */
  today: () => string
}

const defaultDeps: Deps = {
  farm: farmService,
  plan: defaultPlanService,
  raioX: raioXService,
  pastSeason: pastSeasonService,
  speech: speechService,
  print: () => window.print(),
  today: () => new Date().toISOString().slice(0, 10),
}

export type AnswerTab = 'choose' | 'plan'

/** As linhas da comparação (cada célula abre um modal com o número, a explicação e a fonte). */
export type CompareRow = 'worked' | 'water' | 'future' | 'income' | 'soil' | 'deadline' | 'pros' | 'cons'

export const COMPARE_ROWS: readonly CompareRow[] = ['worked', 'water', 'future', 'income', 'soil', 'deadline', 'pros', 'cons']

export type ScoreKey = 'seguranca' | 'solo' | 'futuro'

export const SCORE_KEYS: readonly ScoreKey[] = ['seguranca', 'solo', 'futuro']

/** O alerta do plano depois de uma troca: o 1º ano mudou, o 2º mudou (o 3º foi refeito) ou o 3º mudou. */
export type PlanAlert = 'year1' | 'year2' | 'year3'

/** Uma coluna da comparação: a opção do motor, ou null no "Deixar parado" (sem conta). */
export type CompareColumn = { id: CropId; option: Opcao | null }

export type Evaluation = { data: PlanoAvaliado | null; status: 'loading' | 'ready' | 'error' }

/** O ano aberto no explorador vem da URL (`ano`), para o link (ex.: dos avisos) levar direto ao detalhe. */
function readYear(value: string | null): number | null {
  const year = Number(value)
  return value && /^\d{4}$/.test(value) && Number.isInteger(year) ? year : null
}

/**
 * Tela 5 do pacote 2 (`/resposta`, `/opcoes` e `/plano`): as abas "1. Escolher" e "2. Plano de 3 anos" e o
 * relatório para imprimir. O estado fica na URL (`objetivo`, `comparar`, `escolha`, `ano2`, `ano3`, `safras`),
 * gravado sem rolar; os modais ficam aqui. A sugestão e a ordem vêm do `/recomendacao`; o plano, da sugestão em
 * cadeia (`/api/plano/sugestao`) e, com o 3º ano mudado, do `/api/plano`.
 */
export function useChoosePlanController(deps: Deps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const { redirectTo, recomendacao, status: flowStatus } = useFlowRecomendacao(deps.farm)
  const talhao = useFlowTalhao(deps.farm)
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const replaceFlow = useReplaceFlow()
  const replaceUrl = useReplaceUrl()
  const params = useMemo(() => readFlowParams(search), [search])
  const query = keepFlowQuery(search.toString())
  const data = recomendacao.data
  const tab: AnswerTab = pathname === '/plano' ? 'plan' : 'choose'
  const objective: Objetivo | null = params?.objetivo ?? null

  const [alert, setAlert] = useState<PlanAlert | null>(null)
  const [cell, setCell] = useState<{ crop: CropId; row: CompareRow } | null>(null)
  const [score, setScore] = useState<ScoreKey | null>(null)
  const [seasonsOpen, setSeasonsOpen] = useState(false)
  const year = readYear(search.get('ano'))
  const [whyOpen, setWhyOpen] = useState(year !== null)

  const choose = useMemo(() => {
    if (!data || !params) return null
    const suggestion = suggestionOf(data, objective)
    const choice = planChoice(data, objective, params)
    if (!suggestion || !choice) return null
    const ranked = rankAll(data, objective)
    const compared = comparedCrops(data, objective, params)
    const late = new Set(ranked.filter(isLate).map((option) => option.id))
    return {
      suggestion,
      choice,
      ranked,
      compared,
      columns: compared.map((id): CompareColumn => ({ id, option: ranked.find((option) => option.id === id) ?? null })),
      picker: pickerItems(availableCrops(data, objective), compared, choice, suggestion.id, late),
      late,
    }
  }, [data, params, objective])

  // Plano de 3 anos: a sugestão em cadeia com o 1º ano (e o 2º, se mudou); com o 3º mudado, o plano inteiro.
  const edits = useMemo(() => planEdits(params ?? {}), [params])
  const choice = choose?.choice ?? null
  const place = params && data ? { lat: params.lat, lon: params.lon, colheita: data.entrada.colheita, solo: params.solo } : null
  const fixos = choice ? suggestionFixos(choice, edits) : null
  const base = useAsync(
    () => (place && fixos ? deps.plan.suggest({ ...place, fixos }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, fixos?.join(','), lang, deps.plan],
  )
  const finalList = choice ? finalCrops(choice, edits, base.data ?? null) : null
  const final = useAsync(
    () => (place && finalList ? deps.plan.evaluate({ ...place, anos: finalList }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, finalList?.join(','), lang, deps.plan],
  )
  const shown = edits.year3 ? final : base
  const evaluation: Evaluation = { data: shown.data ?? null, status: shown.status }
  const cards = choice ? planCards(choice, edits, base.data ?? null, final.data ?? null, CURRENT_SEASON) : null
  const edited = Boolean(edits.year2 || edits.year3)

  // "Como é hoje": as 3 últimas safras do raio-X (sem elas, "não preenchido"; com "Não plantei", sem comparação).
  const answers = useMemo(() => seasonAnswersFromFlow(params), [params])
  const today = todayState(answers)
  const todayList = today.kind === 'crops' ? today.crops : null
  const todayEvaluation = useAsync(
    () => (place && todayList ? deps.plan.evaluate({ ...place, anos: todayList }, lang) : Promise.resolve(null)),
    [place?.lat, place?.lon, place?.colheita, place?.solo, todayList?.join(','), lang, deps.plan],
  )

  // Relatório: o resumo do raio-X ("Sua terra"); sem ele, a seção diz que não carregou.
  const raio = useAsync(
    () =>
      params?.colheita
        ? deps.raioX.get({ lat: params.lat, lon: params.lon, colheita: params.colheita, solo: params.solo }, lang)
        : Promise.resolve(null),
    [params?.lat, params?.lon, params?.colheita, params?.solo, lang, deps.raioX],
  )

  // "Por que essa sugestão?": o ano tocado no explorador e a safra dia a dia daquele ano.
  const detail = choose && year !== null ? selectedYear(choose.suggestion, year) : null
  const suggestionId = choose?.suggestion.id
  const timeline = useAsync(
    () =>
      params && detail && suggestionId && whyOpen
        ? deps.pastSeason.get({ lat: params.lat, lon: params.lon }, detail.ano, lang, { colheita: params.colheita, opcao: suggestionId })
        : Promise.resolve(null),
    [params?.lat, params?.lon, params?.colheita, detail?.ano, suggestionId, whyOpen, lang, deps.pastSeason],
  )

  const name = (crop: CropId) => t.crops.names[crop].toLocaleLowerCase(lang)
  const idea = currentChoiceCrop(params?.pensa)
  const listen = useListenSummary(
    choose ? t.choose.summary(name(choose.suggestion.id), idea ? name(idea) : null) : '',
    lang,
    deps.speech,
  )

  const write = replaceFlow
  const selectTab = useCallback((next: AnswerTab) => replaceUrl(`${next === 'plan' ? '/plano' : '/resposta'}${query}`), [replaceUrl, query])
  // O botão do fim da aba leva para a outra aba começando do topo (navegação comum: a tela sobe).
  const goToPlan = useCallback(() => void navigate(`/plano${query}`, { replace: true }), [navigate, query])
  const goToChoose = useCallback(() => void navigate(`/resposta${query}`, { replace: true }), [navigate, query])

  const chooseObjective = useCallback(
    (value: Objetivo | null) => {
      if (!params) return
      write(objectiveFlow(params, value))
      setAlert(null)
    },
    [params, write],
  )

  const toggleCompared = useCallback(
    (crop: CropId) => params && choose && write(comparedFlow(params, toggleList(choose.compared, crop))),
    [params, choose, write],
  )

  const chooseForPlan = useCallback(
    (crop: CropId) => {
      if (!params || !choose || crop === choose.choice) return
      write(choiceFlow(params, crop, choose.compared, choose.suggestion.id))
      setAlert('year1')
    },
    [params, choose, write],
  )

  const chooseYear = useCallback(
    (index: number, crop: CropId) => {
      if (!params || !choose) return
      if (index === 0) {
        chooseForPlan(crop)
        return
      }
      write(yearFlow(params, index, crop))
      setAlert(index === 1 ? 'year2' : 'year3')
    },
    [params, choose, chooseForPlan, write],
  )

  const resetPlan = useCallback(() => {
    if (!params) return
    write(resetPlanFlow(params))
    setAlert(null)
  }, [params, write])

  const answerSeason = useCallback(
    (season: number, answer: SeasonAnswer | null) => params && write(flowWithSeasonAnswers(params, withSeasonAnswer(answers, season, answer))),
    [params, answers, write],
  )

  // O endereço da tela sem o `ano` (o `keepFlowQuery` também deixa ele de fora).
  const plainUrl = params ? `${pathname}${buildFlowQuery(params)}` : null
  const yearInUrl = year !== null
  const chooseYearDetail = useCallback(
    (value: number | null) => plainUrl && replaceUrl(value === null ? plainUrl : `${plainUrl}&ano=${value}`),
    [plainUrl, replaceUrl],
  )
  const closeWhy = useCallback(() => {
    setWhyOpen(false)
    if (yearInUrl && plainUrl) replaceUrl(plainUrl)
  }, [yearInUrl, plainUrl, replaceUrl])

  // Com a recomendação na mão, recarregar (ex.: respostas novas das safras) não apaga a tela nem mexe na rolagem.
  const status = data ? (choose ? 'ready' : 'error') : flowStatus

  return {
    redirectTo,
    status,
    retry: recomendacao.retry,
    tab,
    selectTab,
    goToPlan,
    goToChoose,
    backTo: `/satelite${query}`,
    planningTo: `/planejamento${query}`,
    listen,
    /** A data da colheita escolhida na tela 2 (`data`) e a faixa; o dia de plantar da conta do motor. */
    harvest: { date: params?.data ?? null, band: data?.entrada.colheita ?? params?.colheita ?? null, sowing: data?.entrada.semeadura ?? null },
    objective,
    chooseObjective,
    choose,
    toggleCompared,
    chooseForPlan,
    pousioText: data?.pousio.texto ?? '',
    climate: data?.clima_futuro ?? null,
    why: {
      open: whyOpen,
      onOpen: () => setWhyOpen(true),
      onClose: closeWhy,
      year: {
        selected: detail,
        choose: chooseYearDetail,
        timeline: timeline.data && timeline.data.ano === detail?.ano ? timeline.data : null,
        timelineStatus: detail ? timeline.status : null,
      },
    },
    cell: { open: cell, onOpen: (crop: CropId, row: CompareRow) => setCell({ crop, row }), onClose: () => setCell(null) },
    score: { open: score, onOpen: (key: ScoreKey) => setScore(key), onClose: () => setScore(null) },
    plan: {
      cards,
      evaluation,
      alert,
      edited,
      chooseYear,
      reset: resetPlan,
      signal: planSignal(evaluation.data, data ?? null, edited || choice !== choose?.suggestion.id),
    },
    today: { state: today, evaluation: { data: todayEvaluation.data ?? null, status: todayEvaluation.status } as Evaluation },
    seasons: {
      open: seasonsOpen,
      onOpen: () => setSeasonsOpen(true),
      onClose: () => setSeasonsOpen(false),
      form: { seasons: seasonRows(talhao.data?.historico ?? null), answers, onAnswer: answerSeason },
    },
    report: {
      raio: raio.data ?? null,
      answers,
      idea: params?.pensa ?? null,
      demo: params?.exemplo ?? false,
      point: params ? { lat: params.lat, lon: params.lon } : null,
      generatedOn: deps.today(),
    },
    print: deps.print,
  }
}

export type ChoosePlanState = ReturnType<typeof useChoosePlanController>
