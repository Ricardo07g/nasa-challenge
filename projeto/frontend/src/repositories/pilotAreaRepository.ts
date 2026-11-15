import type { PilotArea } from '../models/area'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type PilotAreaRepository = {
  get(): Promise<PilotArea>
}

/** `GET /api/area-piloto`: os limites ficam só no backend (`PILOT_*` do `app/constants.py`). */
export function createHttpPilotAreaRepository(getJson: GetJson = defaultGetJson): PilotAreaRepository {
  return {
    get: () => getJson<PilotArea>('/api/area-piloto'),
  }
}
