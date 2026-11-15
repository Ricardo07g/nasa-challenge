import type { Lang } from '../i18n/language'
import type { PlanoAvaliado, PlanoParams } from '../models/plano'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type PlanoRepository = {
  get(params: PlanoParams, lang: Lang): Promise<PlanoAvaliado>
}

function query(params: PlanoParams): string {
  const solo = params.solo ? `&solo=${params.solo}` : ''
  return `lat=${params.lat}&lon=${params.lon}&colheita=${params.colheita}&anos=${params.anos.join(',')}${solo}`
}

/** `GET /api/plano?lat&lon&colheita&anos=a,b,c[&solo]` (aba "Plano de 3 anos", tarefa 0045 do backend). */
export function createHttpPlanoRepository(getJson: GetJson = defaultGetJson): PlanoRepository {
  return {
    get: (params, lang) => getJson<PlanoAvaliado>(`/api/plano?${query(params)}`, { lang }),
  }
}
