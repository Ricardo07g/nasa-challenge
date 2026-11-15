import type { Lang } from '../i18n/language'
import type { PlanoAvaliado, PlanoParams, PlanoSugestaoParams } from '../models/plano'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type PlanoRepository = {
  get(params: PlanoParams, lang: Lang): Promise<PlanoAvaliado>
  /** Sugestão em cadeia (tarefa 0056): os anos fixos e os outros completados pelo motor, com o porquê. */
  suggest(params: PlanoSugestaoParams, lang: Lang): Promise<PlanoAvaliado>
}

function query(params: PlanoParams): string {
  const solo = params.solo ? `&solo=${params.solo}` : ''
  return `lat=${params.lat}&lon=${params.lon}&colheita=${params.colheita}&anos=${params.anos.join(',')}${solo}`
}

function suggestionQuery(params: PlanoSugestaoParams): string {
  const solo = params.solo ? `&solo=${params.solo}` : ''
  return `lat=${params.lat}&lon=${params.lon}&colheita=${params.colheita}&fixos=${params.fixos.join(',')}${solo}`
}

/**
 * `GET /api/plano?lat&lon&colheita&anos=a,b,c[&solo]` (aba "Plano de 3 anos", tarefa 0045 do backend) e
 * `GET /api/plano/sugestao?…&fixos=a[,b]` (sugestão em cadeia, tarefa 0056).
 */
export function createHttpPlanoRepository(getJson: GetJson = defaultGetJson): PlanoRepository {
  return {
    get: (params, lang) => getJson<PlanoAvaliado>(`/api/plano?${query(params)}`, { lang }),
    suggest: (params, lang) => getJson<PlanoAvaliado>(`/api/plano/sugestao?${suggestionQuery(params)}`, { lang }),
  }
}
