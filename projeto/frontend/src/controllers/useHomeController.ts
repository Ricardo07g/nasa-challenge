import { useEffect, useState } from 'react'
import type { ApiStatus } from '../models/apiStatus'
import type { CropOption } from '../models/cropOption'
import { cropOptionService, type CropOptionService } from '../services/cropOptionService'
import { healthService, type HealthService } from '../services/healthService'

export type HomeControllerDeps = {
  healthService: HealthService
  cropOptionService: CropOptionService
}

export type HomeState = {
  apiStatus: ApiStatus
  cropOptions: CropOption[]
  error: string | null
}

const defaultDeps: HomeControllerDeps = { healthService, cropOptionService }

/** Controller da tela inicial: chama os services e guarda o estado que a view mostra. */
export function useHomeController(deps: HomeControllerDeps = defaultDeps): HomeState {
  const { healthService: health, cropOptionService: cropOptions } = deps
  const [state, setState] = useState<HomeState>({
    apiStatus: 'carregando',
    cropOptions: [],
    error: null,
  })

  useEffect(() => {
    let active = true

    health.getApiStatus().then((apiStatus) => {
      if (active) setState((current) => ({ ...current, apiStatus }))
    })

    cropOptions
      .listOptions()
      .then((options) => {
        if (active) setState((current) => ({ ...current, cropOptions: options, error: null }))
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Erro inesperado'
        if (active) setState((current) => ({ ...current, cropOptions: [], error: message }))
      })

    return () => {
      active = false
    }
  }, [health, cropOptions])

  return state
}
