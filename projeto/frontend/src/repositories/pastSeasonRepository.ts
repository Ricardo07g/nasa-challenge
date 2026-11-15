import type { Lang } from '../i18n/language'
import type { PastSeasonOptions, SafraPassada } from '../models/pastSeason'
import type { Ponto } from '../models/talhao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type PastSeasonRepository = {
  get(point: Ponto, year: number, lang: Lang, options?: PastSeasonOptions): Promise<SafraPassada>
}

/**
 * `GET /api/safra-passada?lat&lon&ano[&colheita][&opcao]` (P4). Desde a tarefa 0044 é o detalhe de qualquer
 * ano do explorador da aba Sugestão: vai a faixa de colheita e a opção que a aba mostra.
 */
export function createHttpPastSeasonRepository(getJson: GetJson = defaultGetJson): PastSeasonRepository {
  return {
    get: (point, year, lang, options = {}) => {
      const extra = `${options.colheita ? `&colheita=${options.colheita}` : ''}${options.opcao ? `&opcao=${options.opcao}` : ''}`
      return getJson<SafraPassada>(`/api/safra-passada?lat=${point.lat}&lon=${point.lon}&ano=${year}${extra}`, { lang })
    },
  }
}
