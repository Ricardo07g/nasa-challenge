import type { Lang } from '../i18n/language'
import type { RegiaoSatelite } from '../models/region'
import type { Ponto } from '../models/talhao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type RegionRepository = {
  get(point: Ponto, lang: Lang): Promise<RegiaoSatelite>
}

/** `GET /api/regiao?lat&lon` (P3, contrato proposto; o backend ainda não tem). */
export function createHttpRegionRepository(getJson: GetJson = defaultGetJson): RegionRepository {
  return {
    get: (point, lang) => getJson<RegiaoSatelite>(`/api/regiao?lat=${point.lat}&lon=${point.lon}`, { lang }),
  }
}
