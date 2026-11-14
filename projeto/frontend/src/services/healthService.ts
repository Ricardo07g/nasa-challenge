import type { ApiStatus } from '../models/apiStatus'
import { healthRepository, type HealthRepository } from '../repositories/healthRepository'

export type HealthService = {
  getApiStatus(): Promise<ApiStatus>
}

export function createHealthService(repository: HealthRepository = healthRepository): HealthService {
  return {
    async getApiStatus() {
      try {
        const health = await repository.getHealth()
        return health.status === 'ok' ? 'ok' : 'fora do ar'
      } catch {
        return 'fora do ar'
      }
    },
  }
}

export const healthService = createHealthService()
