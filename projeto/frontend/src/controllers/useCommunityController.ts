import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { communityService, regionPoints, regionSummary, type CommunityService } from '../services/communityService'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { EXAMPLE_FARM } from '../services/locationService'
import { useAsync } from './useAsync'

type Deps = { community: CommunityService; farm: FarmService }

const defaultDeps: Deps = { community: communityService, farm: farmService }

/** Tela 8 "Perto de você" (simulada no hackathon, PRD RF-13 a RF-15): os botões só avisam que é demonstração. */
export function useCommunityController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const [demo, showDemo] = useState<'tell' | 'rain' | null>(null)

  const community = useAsync(() => deps.community.get(lang), [lang, deps.community])

  const center = useMemo(() => (params ? { lat: params.lat, lon: params.lon } : EXAMPLE_FARM), [params])
  const points = useMemo(() => regionPoints(center), [center])

  // P3: área parada na região, pelo satélite; sem o dado na API, o bloco some.
  const region = useAsync(() => deps.community.region(center, lang), [center, lang, deps.community])
  // Histórico da própria lavoura, para comparar com a região (quase sempre já no cache).
  const talhao = useAsync(
    () => deps.farm.talhao({ ...center, exemplo: params ? params.exemplo : true }, lang),
    [center, params?.exemplo, lang, deps.farm],
  )

  return {
    status: community.status,
    retry: community.retry,
    community: community.data ?? null,
    center,
    points,
    region: region.status === 'ready' && region.data ? regionSummary(region.data) : null,
    regionRadius: region.data?.raio_km ?? null,
    history: talhao.data?.historico
      ? { parado: talhao.data.historico.parado, total: talhao.data.historico.total }
      : null,
    // A Comunidade abre de qualquer tela pelo cabeçalho: volta para a resposta se o caminho estiver na URL.
    backTo: params?.colheita ? `/resposta${keepFlowQuery(search.toString())}` : '/',
    demo,
    showDemo,
  }
}
