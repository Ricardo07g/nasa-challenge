import type { Lang } from '../i18n/language'
import type { RaioX, RaioXParams } from '../models/raioX'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type RaioXRepository = {
  get(params: RaioXParams, lang: Lang): Promise<RaioX>
}

function query(params: RaioXParams): string {
  const solo = params.solo ? `&solo=${params.solo}` : ''
  const confirmadas = params.confirmadas ? `&confirmadas=${params.confirmadas}` : ''
  return `lat=${params.lat}&lon=${params.lon}&colheita=${params.colheita}${solo}${confirmadas}`
}

/** `GET /api/raio-x?lat&lon&colheita[&solo][&confirmadas]` (tela 4, tarefa 0043 do backend). */
export function createHttpRaioXRepository(getJson: GetJson = defaultGetJson): RaioXRepository {
  return {
    get: (params, lang) => getJson<RaioX>(`/api/raio-x?${query(params)}`, { lang }),
  }
}
