import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { Textura } from '../models/talhao'
import type { ScreenStatus } from '../models/screenStatus'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'
import { historySummary, rainPeriod, soilSummary } from '../services/satelliteService'
import { useAsync } from './useAsync'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Tela 4 "Pronto. O satélite já viu o resto.": histórico do talhão, chuva, terra (com "Não é? Trocar")
 * e clima. A terra escolhida fica na URL (RF-18) e segue para a resposta.
 */
export function useSatelliteController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const [soilOpen, setSoilOpen] = useState(false)

  // Quase sempre já está no cache: a tela 2 pediu o talhão ao tocar em "É aqui".
  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
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

  const confirm = useCallback(() => {
    if (!params?.colheita) return
    const { lat, lon, colheita, solo, exemplo } = params
    // Dispara já (na tela 3 pode ter sido pedida com outra terra): a resposta chega pronta.
    deps.farm.recomendacao({ lat, lon, colheita, solo, exemplo }, lang).catch(() => {})
    navigate(`/resposta${buildFlowQuery(params)}`)
  }, [params, deps.farm, lang, navigate])

  const query = keepFlowQuery(search.toString())
  const outside =
    (talhao.status === 'ready' && talhao.data?.dentro_da_area === false) ||
    (talhao.status === 'error' && isOutsideArea(talhao.error))
  const status: ScreenStatus = outside ? 'outside' : talhao.status
  const redirectTo = !params ? '/onde' : !params.colheita ? `/quando${query}` : null

  return {
    redirectTo,
    backTo: `/quando${query}`,
    status,
    retry: talhao.retry,
    history: historySummary(talhao.data?.historico ?? null),
    rain: rainPeriod(talhao.data?.dados ?? []),
    soil: soilSummary(talhao.data?.solo ?? null, params?.solo),
    soilOpen,
    toggleSoil,
    chooseSoil,
    confirm,
  }
}
