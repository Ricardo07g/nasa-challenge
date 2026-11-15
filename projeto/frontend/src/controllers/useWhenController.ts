import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { formatDayMonth, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { useI18n } from '../i18n/useI18n'
import type { Colheita } from '../models/talhao'
import { delayCost, delayCostService, type DelayCostService } from '../services/delayCostService'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { harvestBands } from '../services/harvestBandsService'
import { choiceDay, harvestChoice, harvestDateWindow, harvestFromDate, type HarvestChoice } from '../services/harvestService'
import { methodRulesService, type MethodRulesService } from '../services/methodRulesService'
import { rainChart } from '../services/monthlyRainService'
import { rainEnd, rainLeft, rainLeftCurve, type RainLeft } from '../services/rainLeftService'
import { recentSoyWarning } from '../services/recentSoyService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useListenSummary } from './useListenSummary'
import { useReplaceFlow } from './useReplaceFlow'

type Deps = { farm: FarmService; delayCost: DelayCostService; rules: MethodRulesService; speech: SpeechService }

const defaultDeps: Deps = { farm: farmService, delayCost: delayCostService, rules: methodRulesService, speech: speechService }

/** Modal "Não sei o dia exato": as 3 épocas, abre sempre sem nenhuma marcada. */
export type BandsModalState = {
  open: boolean
  /** A época marcada no modal (ainda não usada); null = nenhuma, e "Usar esta época" fica desligado. */
  draft: Colheita | null
  onOpen: () => void
  onClose: () => void
  onDraft: (band: Colheita) => void
  onSubmit: () => void
}

/** Modal grande "Nossas sugestões para a data da colheita", aberto pela caixa "Ainda não decidiu?". */
export type DetailsModalState = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** "Usar esta época" de "Compare as épocas": escolhe a época e fecha o modal. */
  onUseBand: (band: Colheita) => void
}

/** "Ouvir resumo" da tela (regra geral 9): com a data ou a época, os números da chuva que sobra da tela. */
function summaryText(t: Messages, lang: Lang, choice: HarvestChoice | null, left: RainLeft | null): string {
  const w = t.when
  if (!choice) return w.summaryEmpty
  const start = choice.date ? w.summaryDate(formatDayMonth(lang, choice.date)) : w.summaryBand(t.harvest[choice.band].inline)
  return left
    ? w.summaryRain(start, formatNumber(lang, left.medianMm), formatNumber(lang, left.dryMm))
    : w.summaryNoRain(start)
}

/**
 * Tela 2 "Quando você colhe a soja?" (pacote 2, tarefa 0057). Na tela fica só a pergunta: o produtor escolhe
 * o dia (campo de data, de 1/jan a 30/abr de 2027) ou, em "Não sei o dia exato", a época. O satélite não vê o
 * dia da colheita, então a tela abre sem data (a `colheita_sugerida` do NDVI não preenche mais nada). A
 * escolha vai para a URL na hora, sem rolar (`data` e `colheita`, ou só `colheita`), e volta com o produtor
 * da tela seguinte. O que ajuda a decidir (as épocas comparadas, a chuva que sobra, a chuva mês a mês e o fim
 * das chuvas) fica no modal grande; os números vêm do `/api/talhao`, do `/api/custo-atraso` e do `/api/metodo`.
 */
export function useWhenController(deps: Deps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const navigate = useNavigate()
  const replaceFlow = useReplaceFlow()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const window = useMemo(() => harvestDateWindow(), [])
  const choice = useMemo(() => harvestChoice(params, window), [params, window])

  // O talhão quase sempre já está no cache: "Onde fica a lavoura" pediu ao confirmar o ponto.
  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
  )
  // A melhor opção de cada época: o motor do backend roda as 3 faixas, com o solo e as safras da URL.
  const delay = useAsync(
    () =>
      params
        ? deps.delayCost.get({ lat: params.lat, lon: params.lon, solo: params.solo, confirmadas: params.confirmadas }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.solo, params?.confirmadas, lang, deps.delayCost],
  )
  const rules = useAsync(() => deps.rules.get(), [deps.rules])

  // Enquanto carrega, a tela não mostra nem o dado nem aviso (decisão D2).
  const data = talhao.status === 'ready' ? talhao.data : undefined
  const cost = delay.status === 'ready' ? delayCost(delay.data) : null
  const left = choice ? rainLeft(data, choiceDay(choice, window)) : null

  const [modal, setModal] = useState<'bands' | 'details' | null>(null)
  const [draft, setDraft] = useState<Colheita | null>(null)

  const pickDate = useCallback(
    (value: string) => {
      const band = harvestFromDate(value, window)
      if (!params || !band) return
      replaceFlow({ ...params, data: value, colheita: band })
    },
    [params, window, replaceFlow],
  )
  const pickBand = useCallback(
    (band: Colheita) => {
      if (params) replaceFlow({ ...params, data: undefined, colheita: band })
    },
    [params, replaceFlow],
  )

  const bandsModal: BandsModalState = {
    open: modal === 'bands',
    draft,
    onOpen: useCallback(() => {
      setDraft(null)
      setModal('bands')
    }, []),
    onClose: useCallback(() => {
      setDraft(null)
      setModal(null)
    }, []),
    onDraft: setDraft,
    onSubmit: useCallback(() => {
      if (!draft) return
      pickBand(draft)
      setDraft(null)
      setModal(null)
    }, [draft, pickBand]),
  }

  const details: DetailsModalState = {
    open: modal === 'details',
    onOpen: useCallback(() => setModal('details'), []),
    onClose: useCallback(() => setModal(null), []),
    onUseBand: useCallback(
      (band: Colheita) => {
        pickBand(band)
        setModal(null)
      },
      [pickBand],
    ),
  }

  const listen = useListenSummary(summaryText(t, lang, choice, left), lang, deps.speech)

  const confirm = useCallback(() => {
    if (!params || !choice) return
    // Dispara já: a recomendação carrega enquanto a missão (RF-19) mostra o satélite trabalhando.
    const { lat, lon, solo, exemplo, confirmadas } = params
    deps.farm.recomendacao({ lat, lon, colheita: choice.band, solo, exemplo, confirmadas }, lang).catch(() => {})
    navigate(`/calculando${buildFlowQuery({ ...params, colheita: choice.band, data: choice.date ?? undefined })}`)
  }, [params, choice, deps.farm, lang, navigate])

  return {
    missingPoint: params === null,
    backTo: `/onde${keepFlowQuery(search.toString())}`,
    listen,
    /** O campo de data: de 1/jan a 30/abr do ano da colheita da safra atual. */
    window,
    /** A data (e a época dela) ou só a época; null = nada escolhido (a tela abre assim). */
    choice,
    canContinue: choice !== null,
    pickDate,
    bandsModal,
    details,
    confirm,
    /** O satélite não viu soja no ponto na última safra (`soja_recente.vista === false`). */
    notSoy: recentSoyWarning(data) !== null,
    /** A curva da chuva que sobra (todos os dias da tabela); null sem o dado. */
    rainCurve: rainLeftCurve(data),
    /** A chuva que sobra no dia escolhido (ou no dia da época no motor); null sem escolha ou fora da tabela. */
    rainLeft: left,
    /** As 3 épocas: chuva que sobra e melhor opção do motor, com a do produtor marcada. */
    bands: harvestBands(data, cost, choice, window),
    /** Chuva e gasto da lavoura (ETo) mês a mês; null sem o dado. */
    rainChart: rainChart(data),
    /** Fim das chuvas na célula; null sem o dado. */
    rainEnd: rainEnd(data),
    /** Os °C do calor no "deu certo" (`/api/metodo`); null sem a rota: a frase fica sem o número. */
    heatC: rules.status === 'ready' ? (rules.data?.deu_certo.calor_temp_c ?? null) : null,
    /** Ainda carregando o talhão (a caixa "Ainda não decidiu?" aparece sem a prévia). */
    loading: talhao.status === 'loading',
  }
}
