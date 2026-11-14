import type { Lang } from '../i18n/language'
import type { Community } from '../models/community'
import type { Ponto } from '../models/talhao'
import { communityRepository as defaultRepository } from '../repositories'
import type { CommunityRepository } from '../repositories/communityRepository'

export type RegionPoint = Ponto & { kind: 'gauge' | 'planted' | 'idle' }

const KM_PER_DEGREE = 111

/** Desloca um ponto alguns km para norte (+) / sul (-) e leste (+) / oeste (-). */
function move({ lat, lon }: Ponto, northKm: number, eastKm: number): Ponto {
  const kmPerLonDegree = KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180)
  return { lat: lat + northKm / KM_PER_DEGREE, lon: lon + eastKm / kmPerLonDegree }
}

/** Vizinhos (km ao norte, km a leste): pontos aproximados, nunca a posição exata das fazendas (RNF-10). */
const NEIGHBORS: { north: number; east: number; kind: 'planted' | 'idle' }[] = [
  { north: 4, east: 9, kind: 'planted' },
  { north: -7, east: 5, kind: 'planted' },
  { north: 10, east: -8, kind: 'planted' },
  { north: -4, east: -11, kind: 'idle' },
  { north: 1, east: -4, kind: 'planted' },
  { north: 8, east: 2, kind: 'idle' },
]

/**
 * Tela 8 (simulada): pontos ilustrativos do mapa da região. Os 3 pluviômetros ficam nas direções das
 * leituras do "Choveu aqui" (6 km ao norte, 11 km a leste, 14 km ao sul).
 */
export function regionPoints(center: Ponto): RegionPoint[] {
  return [
    { ...move(center, 6, 0), kind: 'gauge' },
    { ...move(center, 0, 11), kind: 'gauge' },
    { ...move(center, -14, 0), kind: 'gauge' },
    ...NEIGHBORS.map(({ north, east, kind }) => ({ ...move(center, north, east), kind })),
  ]
}

export type CommunityService = { get(lang: Lang): Promise<Community> }

export function createCommunityService(repository: CommunityRepository = defaultRepository): CommunityService {
  return { get: (lang) => repository.get(lang) }
}

export const communityService = createCommunityService()
