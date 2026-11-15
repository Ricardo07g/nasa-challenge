import { createHttpCommunityRepository } from './communityRepository'
import { createHttpCustoAtrasoRepository } from './custoAtrasoRepository'
import { createHttpExemploRepository } from './exemploRepository'
import { createPhotonGeocodingRepository } from './geocodingRepository'
import {
  createMockCommunityRepository,
  createMockCustoAtrasoRepository,
  createMockExemploRepository,
  createMockPastSeasonRepository,
  createMockRecomendacaoRepository,
  createMockRegionRepository,
  createMockTalhaoRepository,
} from './mocks/mockRepositories'
import { createMockGeocodingRepository, createMockPilotAreaRepository } from './mocks/mockLocation'
import { createHttpPastSeasonRepository } from './pastSeasonRepository'
import { createHttpPilotAreaRepository } from './pilotAreaRepository'
import { createHttpRecomendacaoRepository } from './recomendacaoRepository'
import { createHttpRegionRepository } from './regionRepository'
import { resolveApiMode } from './repositoryMode'
import { createHttpTalhaoRepository } from './talhaoRepository'

/** Único lugar que decide entre API real e dados de exemplo (e o único que importa `mocks/`). */
export const apiMode = resolveApiMode(import.meta.env.VITE_API_MODE)

const useHttp = apiMode === 'http'

export const talhaoRepository = useHttp ? createHttpTalhaoRepository() : createMockTalhaoRepository()
export const recomendacaoRepository = useHttp
  ? createHttpRecomendacaoRepository()
  : createMockRecomendacaoRepository()
export const exemploRepository = useHttp ? createHttpExemploRepository() : createMockExemploRepository()
export const communityRepository = useHttp ? createHttpCommunityRepository() : createMockCommunityRepository()
export const regionRepository = useHttp ? createHttpRegionRepository() : createMockRegionRepository()
export const pastSeasonRepository = useHttp ? createHttpPastSeasonRepository() : createMockPastSeasonRepository()
export const pilotAreaRepository = useHttp ? createHttpPilotAreaRepository() : createMockPilotAreaRepository()
/** Busca de endereço: Photon de verdade com a API real; cidades de exemplo, sem rede, no modo mock. */
export const geocodingRepository = useHttp ? createPhotonGeocodingRepository() : createMockGeocodingRepository()
export const custoAtrasoRepository = useHttp ? createHttpCustoAtrasoRepository() : createMockCustoAtrasoRepository()
