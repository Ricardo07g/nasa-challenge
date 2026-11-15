import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { LocationNotice, LocationOption } from '../models/place'
import type { Ponto } from '../models/talhao'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, readFlowParams } from '../services/flowParams'
import { geocodingService, SEARCH_DELAY_MS, type GeocodingService } from '../services/geocodingService'
import { parseLocationInput } from '../services/locationInputService'
import { areaCenter, EXAMPLE_FARM, isInsideArea, nearestPlace } from '../services/locationService'
import { pilotAreaService, type PilotAreaService } from '../services/pilotAreaService'
import { positionService, type PositionService } from '../services/positionService'
import { useAsync } from './useAsync'
import { useDebouncedRequest } from './useDebouncedRequest'

type Deps = {
  farm: FarmService
  positionService: PositionService
  geocoding: GeocodingService
  pilotArea: PilotAreaService
}

const defaultDeps: Deps = { farm: farmService, positionService, geocoding: geocodingService, pilotArea: pilotAreaService }

const NOTICES: readonly string[] = ['short-link', 'link-without-point', 'invalid-coordinates'] satisfies LocationNotice[]

/**
 * Tela "Onde fica a lavoura?" (tarefa 0041): busca de endereço (Photon), coordenadas ou link colados,
 * GPS, arrastar o mapa, endereço aproximado do pino e "Confirmar local" (que já dispara o talhão).
 * Ponto fora da área piloto (vinda da API) não avança.
 */
export function useWhereController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [center, setCenter] = useState<Ponto>(() => {
    const params = readFlowParams(search)
    return params ? { lat: params.lat, lon: params.lon } : EXAMPLE_FARM
  })
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const [query, setQuery] = useState('')
  /** O texto que a pessoa digitou ou colou; `null` depois de escolher uma opção (lista fechada). */
  const [typed, setTyped] = useState<string | null>(null)

  const areaState = useAsync(() => deps.pilotArea.get(), [deps.pilotArea])
  const area = areaState.status === 'ready' ? (areaState.data ?? null) : null
  const outside = area !== null && !isInsideArea(center, area)
  // Sem a área (API fora do ar), deixa seguir: o backend ainda responde OUTSIDE_AREA nas próximas telas.
  const canConfirm = areaState.status === 'error' || (area !== null && !outside)

  const input = useMemo(() => parseLocationInput(typed ?? ''), [typed])
  const searchText = input.kind === 'search' && deps.geocoding.canSearch(input.query) ? input.query : null
  const near = area ? areaCenter(area) : center
  const found = useDebouncedRequest(
    searchText === null ? null : `${lang}|${searchText}`,
    (signal) => deps.geocoding.search(searchText ?? '', lang, { near, signal }),
    SEARCH_DELAY_MS,
  )

  const reverse = useDebouncedRequest(
    `${lang}|${center.lat.toFixed(5)},${center.lon.toFixed(5)}`,
    (signal) => deps.geocoding.reverse(center, lang, { signal }),
    SEARCH_DELAY_MS,
  )
  const fallbackPlace = useMemo(() => nearestPlace(center), [center])
  const place = reverse.status === 'ready' && reverse.data ? reverse.data : fallbackPlace

  const options: LocationOption[] =
    input.kind === 'point'
      ? [{ kind: 'point', id: 'ponto-colado', source: input.source, point: input.point }]
      : searchText !== null && found.status === 'ready'
        ? (found.data ?? []).map((suggestion) => ({ kind: 'place', ...suggestion }))
        : []
  const notice = NOTICES.includes(input.kind) ? (input.kind as LocationNotice) : null
  const searchStatus = searchText === null ? 'idle' : found.status

  const move = useCallback((point: Ponto) => setCenter(point), [])

  const changeQuery = useCallback((text: string) => {
    setQuery(text)
    setTyped(text)
  }, [])

  const selectOption = useCallback((option: LocationOption) => {
    setCenter(option.point)
    if (option.kind === 'place') setQuery(option.label)
    setTyped(null)
  }, [])

  const useMyLocation = useCallback(() => {
    setLocating(true)
    setLocationError(false)
    deps.positionService
      .current()
      .then((point) => setCenter(point))
      .catch(() => setLocationError(true))
      .finally(() => setLocating(false))
  }, [deps.positionService])

  const confirm = useCallback(() => {
    if (!canConfirm) return
    const flowQuery = buildFlowQuery(center)
    const point = readFlowParams(new URLSearchParams(flowQuery))!
    // Dispara já: o talhão (solo, NDVI) carrega enquanto a pessoa responde a pergunta 2.
    deps.farm.talhao({ lat: point.lat, lon: point.lon }, lang).catch(() => {})
    navigate(`/quando${flowQuery}`)
  }, [canConfirm, center, deps.farm, lang, navigate])

  return {
    center,
    place,
    area,
    outside,
    canConfirm,
    locating,
    locationError,
    query,
    options,
    searchStatus,
    notice,
    move,
    changeQuery,
    selectOption,
    useMyLocation,
    confirm,
  }
}
