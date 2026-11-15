import { createHttpAvisosRepository } from './avisosRepository'
import { createHttpCommunityRepository } from './communityRepository'
import { createHttpCustoAtrasoRepository } from './custoAtrasoRepository'
import { createHttpExemploRepository } from './exemploRepository'
import { createPhotonGeocodingRepository } from './geocodingRepository'
import { createMockAvisosRepository } from './mocks/mockAvisos'
import { createMockCommunityRepository } from './mocks/mockCommunity'
import {
  createMockCustoAtrasoRepository,
  createMockExemploRepository,
  createMockPastSeasonRepository,
  createMockRaioXRepository,
  createMockRecomendacaoRepository,
  createMockRegionRepository,
  createMockTalhaoRepository,
} from './mocks/mockRepositories'
import { createMockGeocodingRepository, createMockPilotAreaRepository } from './mocks/mockLocation'
import { createMockMetodoRepository } from './mocks/mockMetodo'
import { createHttpMetodoRepository } from './metodoRepository'
import { createHttpPastSeasonRepository } from './pastSeasonRepository'
import { createHttpPilotAreaRepository } from './pilotAreaRepository'
import { createMockPlanoRepository } from './mocks/mockPlano'
import { createHttpPlanoRepository } from './planoRepository'
import { createHttpRaioXRepository } from './raioXRepository'
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
/** Relatos da comunidade (tarefa 0047): os exemplos, com o selo "Exemplo", só no modo mock. */
export const communityRepository = useHttp ? createHttpCommunityRepository() : createMockCommunityRepository()
/** Identificador do aparelho no localStorage: o mesmo nos dois modos. */
export { deviceRepository } from './deviceRepository'
export const regionRepository = useHttp ? createHttpRegionRepository() : createMockRegionRepository()
export const pastSeasonRepository = useHttp ? createHttpPastSeasonRepository() : createMockPastSeasonRepository()
export const pilotAreaRepository = useHttp ? createHttpPilotAreaRepository() : createMockPilotAreaRepository()
/** Busca de endereço: Photon de verdade com a API real; cidades de exemplo, sem rede, no modo mock. */
export const geocodingRepository = useHttp ? createPhotonGeocodingRepository() : createMockGeocodingRepository()
export const custoAtrasoRepository = useHttp ? createHttpCustoAtrasoRepository() : createMockCustoAtrasoRepository()
export const raioXRepository = useHttp ? createHttpRaioXRepository() : createMockRaioXRepository()
/** Tela "Avisos" (tarefa 0046 do backend): os exemplos só no modo mock. */
export const avisosRepository = useHttp ? createHttpAvisosRepository() : createMockAvisosRepository()
/** Ponto dos avisos no localStorage: o mesmo nos dois modos. */
export { savedPointRepository } from './savedPointRepository'
/** Aba "Plano de 3 anos" (tarefa 0045): um plano qualquer avaliado pelo motor (`GET /api/plano`). */
export const planoRepository = useHttp ? createHttpPlanoRepository() : createMockPlanoRepository()
/** Tela "Como a conta é feita" (tarefa 0049): os números das regras do `regras.yaml` (`GET /api/metodo`). */
export const metodoRepository = useHttp ? createHttpMetodoRepository() : createMockMetodoRepository()
