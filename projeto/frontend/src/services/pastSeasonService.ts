import type { Lang } from '../i18n/language'
import type { PastSeasonOptions, SafraPassada, TipoEvento } from '../models/pastSeason'
import type { Ponto } from '../models/talhao'
import { pastSeasonRepository as defaultRepository } from '../repositories'
import type { PastSeasonRepository } from '../repositories/pastSeasonRepository'

/** Avisos que o produtor teria recebido: veranico e calor. */
export function isWarning(tipo: TipoEvento): boolean {
  return tipo === 'aviso_veranico' || tipo === 'aviso_calor'
}

export type PastSeasonService = {
  get(point: Ponto, year: number, lang: Lang, options?: PastSeasonOptions): Promise<SafraPassada>
}

export function createPastSeasonService(repository: PastSeasonRepository = defaultRepository): PastSeasonService {
  return { get: (point, year, lang, options = {}) => repository.get(point, year, lang, options) }
}

export const pastSeasonService = createPastSeasonService()
