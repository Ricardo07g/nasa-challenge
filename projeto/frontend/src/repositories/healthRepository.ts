import type { HealthResponse } from '../models/apiStatus'
import { getJson } from './httpClient'

export type HealthRepository = {
  getHealth(): Promise<HealthResponse>
}

export const healthRepository: HealthRepository = {
  getHealth: () => getJson<HealthResponse>('/api/health'),
}
