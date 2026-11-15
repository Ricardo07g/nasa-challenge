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
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { climateSummary, historySummary, rainSummary, soilSummary } from '../services/satelliteService'
import { useAsync } from './useAsync'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Tela 4 "Pronto. O satélite já viu o resto.": histórico do talhão, chuva, terra (com "Não é? Trocar")
 * e clima. A terra escolhida fica na URL (RF-18) e segue para a resposta. Histórico, chuva e clima só
 * aparecem com o dado de verdade; sem ele, o cartão não aparece (decisão D2).
 *
 * Tarefa 0039: no cartão do histórico, o produtor confirma as últimas safras ("Plantei" / "Deixei
 * parado"). A escolha vai para a URL (`confirmadas`), vale no lugar do satélite na faixa e segue para
 * a recomendação.
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

  return {
    redirectTo,
    backTo: `/quando${query}`,
    adjustTo: `/onde${query}`,
    status,
    retry: talhao.retry,
    history: historySummary(applyConfirmations(historico, confirmadas)),
    confirmations: confirmationRows(historico, talhao.data?.anos_confirmaveis, confirmadas),
    noSoy: noSoyAtPoint(historico),
    rain: rainSummary(talhao.data?.dados ?? [], recomendacao.data?.opcoes ?? null),
    climate: climateSummary(talhao.data?.dados ?? []),
    soil: soilSummary(talhao.data?.solo ?? null, params?.solo),
    soilOpen,
    toggleSoil,
    chooseSoil,
    confirmSeason,
    confirm,
  }
}
