import type { Lang } from '../i18n/language'
import type { Community } from '../models/community'
import { NotConnectedError } from './httpClient'

export type CommunityRepository = {
  get(lang: Lang): Promise<Community>
}

/**
 * Tela 8, comunidade (PRD RF-13 a RF-15): ainda não há endpoint no backend. Com a API real, a tela
 * mostra "Ainda não conectado" (nada de vizinho simulado); os dados de exemplo ficam em mocks/.
 */
export function createHttpCommunityRepository(): CommunityRepository {
  return {
    get: () => Promise.reject(new NotConnectedError('comunidade')),
  }
}
