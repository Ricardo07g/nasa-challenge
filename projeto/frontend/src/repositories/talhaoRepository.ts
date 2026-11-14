import type { Lang } from '../i18n/language'
import type { Ponto, Talhao } from '../models/talhao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type TalhaoRepository = {
  get(point: Ponto, lang: Lang): Promise<Talhao>
}

/** `GET /api/talhao?lat&lon` (plano técnico §3.1). */
export function createHttpTalhaoRepository(getJson: GetJson = defaultGetJson): TalhaoRepository {
  return {
    get: (point, lang) => getJson<Talhao>(`/api/talhao?lat=${point.lat}&lon=${point.lon}`, { lang }),
  }
}
