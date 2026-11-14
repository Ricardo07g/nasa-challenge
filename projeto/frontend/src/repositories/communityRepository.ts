import type { Lang } from '../i18n/language'
import type { Community } from '../models/community'
import { delay } from './mocks/delay'
import { buildCommunity } from './mocks/fixtures'

export type CommunityRepository = {
  get(lang: Lang): Promise<Community>
}

/** Tela 8 é simulada no hackathon (PRD): não existe versão http. */
export function createMockCommunityRepository(delayMs = 300): CommunityRepository {
  return {
    async get(lang) {
      await delay(delayMs)
      return buildCommunity(lang)
    },
  }
}
