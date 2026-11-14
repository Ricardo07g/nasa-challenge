import type { Lang } from '../i18n/language'
import type { Ponto, Talhao } from '../models/talhao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'
import { buildTalhao } from './mocks/fixtures'
import { delay } from './mocks/delay'

export type TalhaoRepository = {
  get(point: Ponto, lang: Lang): Promise<Talhao>
}

/** `GET /api/talhao?lat&lon` (plano técnico §3.1). */
export function createHttpTalhaoRepository(getJson: GetJson = defaultGetJson): TalhaoRepository {
  return {
    get: (point, lang) => getJson<Talhao>(`/api/talhao?lat=${point.lat}&lon=${point.lon}`, { lang }),
  }
}

/** Mesmo contrato, com dados de exemplo (enquanto o motor não existe). */
export function createMockTalhaoRepository(delayMs = 500): TalhaoRepository {
  return {
    async get(point, lang) {
      await delay(delayMs)
      return buildTalhao(point, lang)
    },
  }
}
