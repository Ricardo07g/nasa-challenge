import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { Colheita } from '../models/talhao'
import { delayCost, delayCostService, type DelayCost, type DelayCostService } from '../services/delayCostService'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { bandDate, harvestFromDate, harvestSuggestion, harvestWindow } from '../services/harvestService'
import { rainChart, type RainChart } from '../services/monthlyRainService'
import { rainEnd, rainLeft, type RainEnd, type RainLeft } from '../services/rainLeftService'
import { recentSoyWarning } from '../services/recentSoyService'
import { useAsync } from './useAsync'

type Deps = { farm: FarmService; delayCost: DelayCostService; today: () => Date }

const defaultDeps: Deps = { farm: farmService, delayCost: delayCostService, today: () => new Date() }

/** Chuva que sobra no dia usado: `exact` = o dia do campo; senão, o dia de colheita da faixa escolhida. */
export type RainLeftState = (RainLeft & { exact: boolean; band: Colheita }) | null | 'loading'

/**
 * Tela 3 "Quando você colhe a soja?" (pergunta 2 de 2, tarefa 0042). No topo, o dia da colheita, já
 * preenchido com o dia que o satélite viu (NDVI); "Não sei o dia exato" abre as 3 faixas. A data
 * exata vira uma faixa pela mesma regra do backend, e a faixa marcada é sempre a do dia no campo:
 * sugestão = seleção. A faixa que veio na URL (voltando da tela 4) vale mais que a sugestão; aí o
 * campo fica vazio e a faixa azul oferece "Usar o dia do satélite". Logo depois de escolher o ponto,
 * se o satélite não viu soja nele na última safra (RF-24), avisa no topo e deixa seguir.
 */
export function useWhenController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])

  // O talhão quase sempre já está no cache: a tela 2 pediu ao confirmar o ponto.
  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
  )
  // Custo do atraso: o motor do backend roda as 3 faixas, com o solo e as safras que já estão na URL.
  const delay = useAsync(
    () =>
      params
        ? deps.delayCost.get({ lat: params.lat, lon: params.lon, solo: params.solo, confirmadas: params.confirmadas }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.solo, params?.confirmadas, lang, deps.delayCost],
  )
  const loading = talhao.status === 'loading'

  const window = useMemo(() => harvestWindow(deps.today()), [deps])
  const suggestion = loading ? null : harvestSuggestion(talhao.data, window)

  // RF-24: "Ajustar no mapa" é o mesmo caminho do Voltar; "Seguir mesmo assim" só fecha o aviso.
  const [soyDismissed, setSoyDismissed] = useState(false)
  const soyWarning = soyDismissed || talhao.status !== 'ready' ? null : recentSoyWarning(talhao.data)
  const dismissSoyWarning = useCallback(() => setSoyDismissed(true), [])

  // O que o produtor mexeu nesta tela; null = ainda nada (vale o que veio pronto).
  const [choice, setChoice] = useState<{ date: string; band: Colheita | null } | null>(null)
  const [bandsToggle, setBandsToggle] = useState<boolean | null>(null)

  const urlBand = params?.colheita ?? null
  // Vem pronto: o dia do satélite, a não ser que a URL traga outra faixa (escolha feita antes).
  const presetDate = suggestion?.date && (!urlBand || urlBand === suggestion.faixa) ? suggestion.date : ''
  const date = choice ? choice.date : presetDate
  const dateBand = harvestFromDate(date, window)
  const band = choice ? choice.band : urlBand
  const selected: Colheita = dateBand ?? band ?? suggestion?.faixa ?? 'meio'
  const suggestionApplied = Boolean(suggestion?.date) && date === suggestion?.date
  const bandsOpen = bandsToggle ?? (suggestion !== null && date === '')

  const changeDate = useCallback((value: string) => setChoice({ date: value, band: null }), [])
  const select = useCallback((value: Colheita) => setChoice({ date: '', band: value }), [])
  const toggleBands = useCallback(() => setBandsToggle(!bandsOpen), [bandsOpen])
  const suggestedDate = suggestion?.date ?? null
  const applySuggestedDate = useCallback(() => {
    if (suggestedDate) setChoice({ date: suggestedDate, band: null })
  }, [suggestedDate])

  const chart: RainChart | null | 'loading' = loading ? 'loading' : rainChart(talhao.data)
  const leftDate = dateBand ? date : bandDate(selected, window)
  const left = loading ? null : rainLeft(talhao.data, leftDate)
  const remaining: RainLeftState = loading ? 'loading' : left && { ...left, exact: dateBand !== null, band: selected }
  const end: RainEnd | null | 'loading' = loading ? 'loading' : rainEnd(talhao.data)
  const cost: DelayCost | null | 'loading' =
    delay.status === 'loading' ? 'loading' : delay.status === 'ready' ? delayCost(delay.data) : null

  const confirm = useCallback(() => {
    if (!params) return
    // Dispara já: a recomendação carrega enquanto a missão (RF-19) mostra o satélite trabalhando.
    const { lat, lon, solo, exemplo, confirmadas } = params
    deps.farm.recomendacao({ lat, lon, colheita: selected, solo, exemplo, confirmadas }, lang).catch(() => {})
    navigate(`/calculando${buildFlowQuery({ ...params, colheita: selected })}`)
  }, [params, selected, deps.farm, lang, navigate])

  return {
    missingPoint: params === null,
    backTo: `/onde${keepFlowQuery(search.toString())}`,
    /** Aviso "Não vimos soja neste ponto na última safra" (RF-24); null = nenhum aviso. */
    soyWarning,
    dismissSoyWarning,
    /** O que o satélite viu (null enquanto o talhão carrega). */
    suggestion,
    /** O dia no campo é o do satélite (a faixa azul diz "já deixamos esse dia no campo"). */
    suggestionApplied,
    applySuggestedDate,
    selected,
    date,
    dateBand,
    window,
    changeDate,
    bandsOpen,
    toggleBands,
    select,
    confirm,
    /** Chuva e gasto da lavoura (ETo) de cada mês; null = sem gráfico (decisão D2). */
    rainChart: chart,
    /** Chuva que sobra depois da colheita até o fim de junho (mediana e ano seco). */
    rainLeft: remaining,
    /** Fim das chuvas na célula. */
    rainEnd: end,
    /** Custo do atraso: a melhor opção do motor em cada faixa. */
    delayCost: cost,
  }
}
