import type { MetodoRegras } from '../models/metodo'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type MetodoRepository = {
  get(): Promise<MetodoRegras>
}

/** `GET /api/metodo` (tarefa 0049): os números das regras ficam só no `regras.yaml` do backend. */
export function createHttpMetodoRepository(getJson: GetJson = defaultGetJson): MetodoRepository {
  return {
    get: () => getJson<MetodoRegras>('/api/metodo'),
  }
}
