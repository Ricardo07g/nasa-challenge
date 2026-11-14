import type { Lang } from '../i18n/language'
import type { SafraPassada } from '../models/pastSeason'
import type { Ponto } from '../models/talhao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type PastSeasonRepository = {
  get(point: Ponto, year: number, lang: Lang): Promise<SafraPassada>
}

/** `GET /api/safra-passada?lat&lon&ano` (P4). */
export function createHttpPastSeasonRepository(getJson: GetJson = defaultGetJson): PastSeasonRepository {
  return {
    get: (point, year, lang) =>
      getJson<SafraPassada>(`/api/safra-passada?lat=${point.lat}&lon=${point.lon}&ano=${year}`, { lang }),
  }
}
