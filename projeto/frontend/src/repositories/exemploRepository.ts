import type { Lang } from '../i18n/language'
import { EXAMPLE_FARM } from '../models/area'
import type { Exemplo } from '../models/recomendacao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'
import { delay } from './mocks/delay'
import { buildRecomendacao, buildTalhao } from './mocks/fixtures'

export type ExemploRepository = {
  get(lang: Lang): Promise<Exemplo>
}

/** `GET /api/exemplo` (plano técnico §3.3): abre na hora, vem de uma fixture do pipeline. */
export function createHttpExemploRepository(getJson: GetJson = defaultGetJson): ExemploRepository {
  return {
    get: (lang) => getJson<Exemplo>('/api/exemplo', { lang }),
  }
}

export function createMockExemploRepository(delayMs = 0): ExemploRepository {
  return {
    async get(lang) {
      await delay(delayMs)
      return {
        talhao: buildTalhao(EXAMPLE_FARM, lang),
        recomendacao: buildRecomendacao({ ...EXAMPLE_FARM, colheita: 'meio' }, lang),
      }
    },
  }
}
