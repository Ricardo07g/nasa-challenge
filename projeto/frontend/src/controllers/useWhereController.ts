import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { Ponto } from '../models/talhao'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery, readFlowParams } from '../services/flowParams'
import { EXAMPLE_FARM, isInsidePreparedArea, nearestPlace } from '../services/locationService'
import { positionService, type PositionService } from '../services/positionService'

type Deps = { farm: FarmService; positionService: PositionService }

const defaultDeps: Deps = { farm: farmService, positionService }

/** Tela 2 "Onde fica a lavoura?": mapa, GPS e "É aqui" (que já dispara a busca do talhão). */
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

  const move = useCallback((point: Ponto) => setCenter(point), [])

  const useMyLocation = useCallback(() => {
    setLocating(true)
    setLocationError(false)
    deps.positionService
      .current()
      .then((point) => setCenter(point))
      .catch(() => setLocationError(true))
      .finally(() => setLocating(false))
  }, [deps.positionService])

  const outside = !isInsidePreparedArea(center)

  const confirm = useCallback(() => {
    if (!isInsidePreparedArea(center)) return
    const query = buildFlowQuery(center)
    const point = readFlowParams(new URLSearchParams(query))!
    // Dispara já: o talhão (solo, NDVI) carrega enquanto a pessoa responde a pergunta 2.
    deps.farm.talhao({ lat: point.lat, lon: point.lon }, lang).catch(() => {})
    navigate(`/quando${query}`)
  }, [center, deps.farm, lang, navigate])

  const place = useMemo(() => nearestPlace(center), [center])

  return { center, place, outside, locating, locationError, move, useMyLocation, confirm }
}
