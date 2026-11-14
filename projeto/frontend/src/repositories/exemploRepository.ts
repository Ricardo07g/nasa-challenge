import type { Lang } from '../i18n/language'
import type { Exemplo } from '../models/recomendacao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type ExemploRepository = {
  get(lang: Lang): Promise<Exemplo>
}

/** `GET /api/exemplo` (plano técnico §3.3): abre na hora, vem de uma fixture do pipeline. */
export function createHttpExemploRepository(getJson: GetJson = defaultGetJson): ExemploRepository {
  return {
    get: (lang) => getJson<Exemplo>('/api/exemplo', { lang }),
  }
}
