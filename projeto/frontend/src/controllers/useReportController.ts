import { useCallback, useMemo } from 'react'
import { EXAMPLE_FARM } from '../models/area'
import { applyConfirmations, parseConfirmadas } from '../services/confirmedSeasonsService'
import { farmService, type FarmService } from '../services/farmService'
import { nearestPlace } from '../services/locationService'
import { useFlowFarm } from './useFlowFarm'

type Deps = { farm: FarmService; print: () => void; today: () => Date }

const defaultDeps: Deps = { farm: farmService, print: () => window.print(), today: () => new Date() }

const isExampleFarm = (point: { lat: number; lon: number }) =>
  Math.abs(point.lat - EXAMPLE_FARM.lat) < 1e-4 && Math.abs(point.lon - EXAMPLE_FARM.lon) < 1e-4

/** Data local de hoje em ISO (AAAA-MM-DD). */
function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Relatório para banco e seguro (P2): folha para imprimir, com os mesmos dados da resposta. */
export function useReportController(deps: Deps = defaultDeps) {
  const { params, query, redirectTo, talhao, recomendacao, status } = useFlowFarm(deps.farm)
  const { print: printPage } = deps
  const print = useCallback(() => printPage(), [printPage])
  // As safras confirmadas na tela 4 valem no lugar do satélite no histórico do relatório (tarefa 0039).
  const confirmed = useMemo(() => {
    if (!talhao.data) return null
    const historico = applyConfirmations(talhao.data.historico, parseConfirmadas(params?.confirmadas))
    return { ...talhao.data, historico }
  }, [talhao.data, params?.confirmadas])

  return {
    redirectTo,
    backTo: `/resposta${query}`,
    status,
    retry: () => {
      talhao.retry()
      recomendacao.retry()
    },
    talhao: status === 'ready' ? confirmed : null,
    recomendacao: status === 'ready' ? (recomendacao.data ?? null) : null,
    example: params ? params.exemplo || isExampleFarm(params) : false,
    place: params ? nearestPlace(params) : null,
    today: isoDate(deps.today()),
    print,
  }
}
