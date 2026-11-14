import type { Lang } from '../i18n/language'
import type { Recomendacao, RecomendacaoParams } from '../models/recomendacao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'
import { delay } from './mocks/delay'
import { buildRecomendacao } from './mocks/fixtures'

export type RecomendacaoRepository = {
  get(params: RecomendacaoParams, lang: Lang): Promise<Recomendacao>
}

function query(params: RecomendacaoParams): string {
  const solo = params.solo ? `&solo=${params.solo}` : ''
  return `lat=${params.lat}&lon=${params.lon}&colheita=${params.colheita}${solo}`
}

/** `GET /api/recomendacao?lat&lon&colheita[&solo]` (plano técnico §3.2). */
export function createHttpRecomendacaoRepository(getJson: GetJson = defaultGetJson): RecomendacaoRepository {
  return {
    get: (params, lang) => getJson<Recomendacao>(`/api/recomendacao?${query(params)}`, { lang }),
  }
}

export function createMockRecomendacaoRepository(delayMs = 400): RecomendacaoRepository {
  return {
    async get(params, lang) {
      await delay(delayMs)
      return buildRecomendacao(params, lang)
    },
  }
}
