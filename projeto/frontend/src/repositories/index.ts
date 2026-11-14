import { createMockCommunityRepository } from './communityRepository'
import { createHttpExemploRepository, createMockExemploRepository } from './exemploRepository'
import { createHttpRecomendacaoRepository, createMockRecomendacaoRepository } from './recomendacaoRepository'
import { resolveApiMode } from './repositoryMode'
import { createHttpTalhaoRepository, createMockTalhaoRepository } from './talhaoRepository'

/** Único lugar que decide entre API real e dados de exemplo. */
export const apiMode = resolveApiMode(import.meta.env.VITE_API_MODE)

const useHttp = apiMode === 'http'

export const talhaoRepository = useHttp ? createHttpTalhaoRepository() : createMockTalhaoRepository()
export const recomendacaoRepository = useHttp
  ? createHttpRecomendacaoRepository()
  : createMockRecomendacaoRepository()
export const exemploRepository = useHttp ? createHttpExemploRepository() : createMockExemploRepository()
export const communityRepository = createMockCommunityRepository()
