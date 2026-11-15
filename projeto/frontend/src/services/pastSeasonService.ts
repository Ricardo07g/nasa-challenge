import type { Lang } from '../i18n/language'
import type { PastSeasonOptions, SafraPassada, TipoEvento } from '../models/pastSeason'
import type { Ponto } from '../models/talhao'
import { pastSeasonRepository as defaultRepository } from '../repositories'
import type { PastSeasonRepository } from '../repositories/pastSeasonRepository'

/** P4: anos do replay. 2024 foi seco; 2023 foi bom. */
export const PAST_YEARS: readonly number[] = [2024, 2023]

/** Como foi cada ano do replay (para o rótulo do botão). */
export function pastYearKind(year: number): 'seco' | 'bom' {
  return year === 2024 ? 'seco' : 'bom'
}

/** O ano vem da URL (`ano`); fora da lista, fica no primeiro (2024). */
export function readPastYear(value: string | null): number {
  const year = Number(value)
  return PAST_YEARS.includes(year) ? year : PAST_YEARS[0]
}

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
