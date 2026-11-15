import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { FieldMapView } from '../design-system/components/FieldMap'
import { useI18n } from '../i18n/useI18n'
import type { Ponto } from '../models/talhao'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, readFlowParams } from '../services/flowParams'
import { geocodingService, SEARCH_DELAY_MS, type GeocodingService } from '../services/geocodingService'
import { parseLocationInput } from '../services/locationInputService'
import { canConfirm, EXAMPLE_FARM, nearestPlace, whereStatus } from '../services/locationService'
import { pilotAreaService, type PilotAreaService } from '../services/pilotAreaService'
import { positionService, type PositionService } from '../services/positionService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useDebouncedRequest } from './useDebouncedRequest'
import { useListenSummary } from './useListenSummary'

type Deps = {
  farm: FarmService
  positionService: PositionService
  geocoding: Pick<GeocodingService, 'reverse'>
  pilotArea: PilotAreaService
  speech: SpeechService
}

const defaultDeps: Deps = {
  farm: farmService,
  positionService,
  geocoding: geocodingService,
  pilotArea: pilotAreaService,
  speech: speechService,
}

/** Modal "Outras formas de marcar": coordenadas ou link do Google Maps. */
export type OtherWaysState = {
  open: boolean
  text: string
  /** "Não entendi": o texto não virou um ponto. */
  error: boolean
  onOpen: () => void
  onClose: () => void
  onChange: (text: string) => void
  onSubmit: () => void
}

/** Modal "Onde o app funciona", aberto pelo "Saiba mais" da legenda do mapa. */
export type AreaInfoState = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** "Ver a área inteira": fecha o modal e enquadra a área no mapa. */
  onShowArea: () => void
}

type Marked = { point: Ponto; demo: boolean }

/**
 * Tela "Onde fica a lavoura?" (tarefa 0053): o produtor toca no mapa (e arrasta o alfinete), usa o GPS ou a
 * lavoura de demonstração; coordenadas e link do Google Maps ficam no modal "Outras formas de marcar". O
 * endereço aproximado vem do Photon (busca reversa). Ponto fora da área do MVP (vinda da API) não avança.
 */
export function useWhereController(deps: Deps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [marked, setMarked] = useState<Marked | null>(() => {
    const params = readFlowParams(search)
    return params ? { point: { lat: params.lat, lon: params.lon }, demo: params.exemplo } : null
  })
  const [view, setView] = useState<FieldMapView>(() => ({ target: marked ? 'point' : 'area', seq: 0 }))
  const [gps, setGps] = useState<'idle' | 'locating' | 'error'>('idle')
  const [modal, setModal] = useState<'other' | 'area' | null>(null)
  const [otherText, setOtherText] = useState('')
  const [otherError, setOtherError] = useState(false)
  const listen = useListenSummary(t.where.summary, lang, deps.speech)

  const point = marked?.point ?? null
  const areaState = useAsync(() => deps.pilotArea.get(), [deps.pilotArea])
  const area = areaState.status === 'ready' ? (areaState.data ?? null) : null
  const status = whereStatus(point, area)

  // Endereço aproximado: só para o ponto do produtor (a lavoura de demonstração tem nome próprio).
  const reverse = useDebouncedRequest(
    point && !marked?.demo ? `${lang}|${point.lat.toFixed(5)},${point.lon.toFixed(5)}` : null,
    (signal) => deps.geocoding.reverse(point!, lang, { signal }),
    SEARCH_DELAY_MS,
  )
  const fallbackPlace = useMemo(() => (point ? nearestPlace(point) : ''), [point])
  const place = reverse.status === 'ready' && reverse.data ? reverse.data : fallbackPlace

  const focus = useCallback((target: FieldMapView['target']) => {
    setView((current) => ({ target, seq: current.seq + 1 }))
  }, [])

  const mark = useCallback((next: Ponto, demo = false) => {
    setMarked({ point: next, demo })
    setGps((current) => (current === 'error' ? 'idle' : current))
  }, [])

  const pick = useCallback((next: Ponto) => mark(next), [mark])

  const useDemo = useCallback(() => {
    mark(EXAMPLE_FARM, true)
    focus('point')
  }, [mark, focus])

  const useMyLocation = useCallback(() => {
    setGps('locating')
    deps.positionService.current().then(
      (found) => {
        setMarked({ point: found, demo: false })
        setGps('idle')
        focus('point')
      },
      () => setGps('error'),
    )
  }, [deps.positionService, focus])

  const showArea = useCallback(() => focus('area'), [focus])

  const other: OtherWaysState = {
    open: modal === 'other',
    text: otherText,
    error: otherError,
    onOpen: useCallback(() => setModal('other'), []),
    onClose: useCallback(() => {
      setModal(null)
      setOtherError(false)
    }, []),
    onChange: useCallback((text: string) => {
      setOtherText(text)
      setOtherError(false)
    }, []),
    onSubmit: useCallback(() => {
      const typed = parseLocationInput(otherText)
      if (!typed) {
        setOtherError(true)
        return
      }
      setModal(null)
      mark(typed)
      focus('point')
    }, [otherText, mark, focus]),
  }

  const areaInfo: AreaInfoState = {
    open: modal === 'area',
    onOpen: useCallback(() => setModal('area'), []),
    onClose: useCallback(() => setModal(null), []),
    onShowArea: useCallback(() => {
      setModal(null)
      focus('area')
    }, [focus]),
  }

  const confirmable = canConfirm(status, areaState.status)
  const confirm = useCallback(() => {
    if (!confirmable || !marked) return
    const flowQuery = buildFlowQuery({ ...marked.point, exemplo: marked.demo })
    const params = readFlowParams(new URLSearchParams(flowQuery))!
    // Dispara já: o talhão (solo, NDVI) carrega enquanto a pessoa responde a pergunta seguinte.
    const talhao = marked.demo ? { lat: params.lat, lon: params.lon, exemplo: true } : { lat: params.lat, lon: params.lon }
    deps.farm.talhao(talhao, lang).catch(() => {})
    navigate(`/quando${flowQuery}`)
  }, [confirmable, marked, deps.farm, lang, navigate])

  return {
    point,
    demo: marked?.demo ?? false,
    place,
    area,
    status,
    canConfirm: confirmable,
    gps,
    view,
    listen,
    other,
    areaInfo,
    pick,
    useDemo,
    useMyLocation,
    showArea,
    confirm,
  }
}
