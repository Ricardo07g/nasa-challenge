import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { RegionStatus } from '../models/region'
import type { BlockStatus } from '../models/screenStatus'
import {
  communityService,
  isNotConnected,
  regionPlace,
  regionPoints,
  regionSummary,
  type CommunityService,
} from '../services/communityService'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { EXAMPLE_FARM } from '../services/locationService'
import { historySummary } from '../services/satelliteService'
import { useAsync, type AsyncState } from './useAsync'

type Deps = { community: CommunityService; farm: FarmService }

const defaultDeps: Deps = { community: communityService, farm: farmService }

function blockStatus(state: AsyncState<unknown>): BlockStatus {
  return state.status === 'error' && isNotConnected(state.error) ? 'not-connected' : state.status
}

/**
 * Tela 8 "Na sua região": a área de soja parada na região pelo satélite (P3, `/api/regiao`) e o que
 * os vizinhos contam. Com a API real, a comunidade fica "Ainda não conectado"; a região fica
 * "outside" quando o ponto está fora das regiões que o satélite já mediu. Os vizinhos simulados e
 * os botões de demonstração só existem com os dados de exemplo.
 */
export function useCommunityController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const [demo, showDemo] = useState<'tell' | 'rain' | null>(null)

  const community = useAsync(() => deps.community.get(lang), [lang, deps.community])
  const status = blockStatus(community)

  const center = useMemo(() => (params ? { lat: params.lat, lon: params.lon } : EXAMPLE_FARM), [params])
  const points = useMemo(() => (status === 'ready' ? regionPoints(center) : []), [center, status])

  // P3: área parada na região, pelo satélite.
  const region = useAsync(() => deps.community.region(center, lang), [center, lang, deps.community])
  // Fora das regiões que o satélite já mediu (404 OUTSIDE_AREA) não é falha nem função desligada:
  // estado próprio, que explica. "Ainda não conectado" fica só para quando o endpoint não existe.
  const regionStatus: RegionStatus =
    region.status === 'error' && isOutsideArea(region.error) ? 'outside' : blockStatus(region)
  // Histórico da própria lavoura, para comparar com a região (quase sempre já no cache).
  const talhao = useAsync(
    () => deps.farm.talhao({ ...center, exemplo: params ? params.exemplo : true }, lang),
    [center, params?.exemplo, lang, deps.farm],
  )

  const history = historySummary(talhao.data?.historico ?? null)
  const regionReady = regionStatus === 'ready' && region.data ? region.data : null
  const place = regionReady ? regionPlace(regionReady) : null

  return {
    status,
    retry: community.retry,
    community: status === 'ready' ? (community.data ?? null) : null,
    center,
    points,
    regionStatus,
    retryRegion: region.retry,
    region: regionReady ? regionSummary(regionReady) : null,
    regionRadius: place?.radiusKm ?? null,
    regionDistance: place?.distanceKm ?? null,
    history: history ? { idle: history.idle, known: history.known, uncertain: history.uncertain } : null,
    // A Comunidade abre de qualquer tela pelo cabeçalho: volta para a resposta se o caminho estiver na URL.
    backTo: params?.colheita ? `/resposta${keepFlowQuery(search.toString())}` : '/',
    demo,
    showDemo,
  }
}
