import { useEffect, useState } from 'react'
import type { ApiStatus } from '../models/apiStatus'
import type { CropOption } from '../models/cropOption'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { cropOptionService, type CropOptionService } from '../services/cropOptionService'
import { healthService, type HealthService } from '../services/healthService'

type Deps = { apiMode: ApiMode; healthService: HealthService; cropOptionService: CropOptionService }

const defaultDeps: Deps = { apiMode: currentApiMode, healthService, cropOptionService }

/** /design-system, seção "Ambiente": de onde vêm os dados e se o backend real está de pé. */
export function useDesignSystemController(deps: Deps = defaultDeps) {
  const [backend, setBackend] = useState<ApiStatus>('carregando')
  const [cropOptions, setCropOptions] = useState<CropOption[]>([])
  const [cropOptionsError, setCropOptionsError] = useState(false)
  const { healthService: health, cropOptionService: crops } = deps

  useEffect(() => {
    let active = true
    health.getApiStatus().then((status) => active && setBackend(status))
    crops
      .listOptions()
      .then((options) => active && setCropOptions(options))
      .catch(() => active && setCropOptionsError(true))
    return () => {
      active = false
    }
  }, [health, crops])

  return { apiMode: deps.apiMode, backend, cropOptions, cropOptionsError }
}
