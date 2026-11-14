import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { Colheita } from '../models/talhao'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { harvestFromDate, harvestSuggestion, harvestWindow } from '../services/harvestService'
import { useAsync } from './useAsync'

type Deps = { farm: FarmService; today: () => Date }

const defaultDeps: Deps = { farm: farmService, today: () => new Date() }

/**
 * Tela 3 "Quando você colhe a soja?" (pergunta 2 de 2): a faixa sugerida pelo satélite já vem marcada;
 * "Colocar a data exata" é só um atalho que vira uma das 3 faixas.
 */
export function useWhenController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])

  // O talhão quase sempre já está no cache: a tela 2 pediu ao tocar em "É aqui".
  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
  )
  const suggestion = talhao.status === 'loading' ? null : harvestSuggestion(talhao.data)

  const window = useMemo(() => harvestWindow(deps.today()), [deps])
  const [band, setBand] = useState<Colheita | null>(params?.colheita ?? null)
  const [date, setDate] = useState('')
  const [dateOpen, setDateOpen] = useState(false)

  const dateBand = harvestFromDate(date, window)
  const selected: Colheita = dateBand ?? band ?? suggestion?.faixa ?? 'meio'

  const select = useCallback((value: Colheita) => {
    setBand(value)
    setDate('')
    setDateOpen(false)
  }, [])

  const openDate = useCallback(() => setDateOpen(true), [])
  const changeDate = useCallback((value: string) => setDate(value), [])

  const confirm = useCallback(() => {
    if (!params) return
    // Dispara já: a recomendação carrega enquanto a tela 4 mostra o que o satélite viu.
    deps.farm
      .recomendacao({ lat: params.lat, lon: params.lon, colheita: selected, solo: params.solo, exemplo: params.exemplo }, lang)
      .catch(() => {})
    navigate(`/satelite${buildFlowQuery({ ...params, colheita: selected })}`)
  }, [params, selected, deps.farm, lang, navigate])

  return {
    missingPoint: params === null,
    backTo: `/onde${keepFlowQuery(search.toString())}`,
    suggestion,
    selected,
    dateOpen,
    date,
    dateBand,
    window,
    select,
    openDate,
    changeDate,
    confirm,
  }
}
