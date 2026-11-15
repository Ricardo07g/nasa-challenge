import type { PilotArea } from '../models/area'
import { pilotAreaRepository as defaultRepository } from '../repositories'
import type { PilotAreaRepository } from '../repositories/pilotAreaRepository'

export type PilotAreaService = { get(): Promise<PilotArea> }

/** Limites da área piloto: pede à API uma vez por visita (não mudam) e tenta de novo se falhar. */
export function createPilotAreaService(repository: PilotAreaRepository = defaultRepository): PilotAreaService {
  let cached: Promise<PilotArea> | null = null
  return {
    get() {
      cached ??= repository.get().catch((error: unknown) => {
        cached = null
        throw error
      })
      return cached
    },
  }
}

export const pilotAreaService = createPilotAreaService()
