import type { Lang } from '../i18n/language'
import type { Recomendacao, RecomendacaoParams } from '../models/recomendacao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type RecomendacaoRepository = {
  get(params: RecomendacaoParams, lang: Lang): Promise<Recomendacao>
}

function query(params: RecomendacaoParams): string {
  const solo = params.solo ? `&solo=${params.solo}` : ''
  const confirmadas = params.confirmadas ? `&confirmadas=${params.confirmadas}` : ''
  return `lat=${params.lat}&lon=${params.lon}&colheita=${params.colheita}${solo}${confirmadas}`
}

/** `GET /api/recomendacao?lat&lon&colheita[&solo][&confirmadas]` (plano técnico §3.2; tarefa 0039). */
export function createHttpRecomendacaoRepository(getJson: GetJson = defaultGetJson): RecomendacaoRepository {
  return {
    get: (params, lang) => getJson<Recomendacao>(`/api/recomendacao?${query(params)}`, { lang }),
  }
}
