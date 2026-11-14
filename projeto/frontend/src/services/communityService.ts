import type { Lang } from '../i18n/language'
import type { Community } from '../models/community'
import type { RegiaoSatelite } from '../models/region'
import type { Ponto } from '../models/talhao'
import { communityRepository as defaultRepository, regionRepository as defaultRegions } from '../repositories'
import type { CommunityRepository } from '../repositories/communityRepository'
import type { RegionRepository } from '../repositories/regionRepository'

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

export type CommunityService = {
  get(lang: Lang): Promise<Community>
  /** P3: área parada na região, pelo satélite. */
  region(point: Ponto, lang: Lang): Promise<RegiaoSatelite>
}

export function createCommunityService(
  repository: CommunityRepository = defaultRepository,
  regions: RegionRepository = defaultRegions,
): CommunityService {
  return { get: (lang) => repository.get(lang), region: (point, lang) => regions.get(point, lang) }
}

export type RegionSummary = {
  last: { ano: number; pct: number }
  /** Média da série (% da área parada), arredondada. */
  average: number
  /** % da área que o satélite não conseguiu dizer, no último ano. */
  uncertain: number
  bars: { ano: number; pct: number }[]
}

/** P3: o último ano em destaque, a média da série e as barras, ano a ano. */
export function regionSummary(region: RegiaoSatelite): RegionSummary | null {
  const last = region.anos.at(-1)
  if (!last) return null
  const total = region.anos.reduce((sum, ano) => sum + ano.pct_parado, 0)
  return {
    last: { ano: last.ano, pct: last.pct_parado },
    average: Math.round(total / region.anos.length),
    uncertain: last.pct_incerto,
    bars: region.anos.map((ano) => ({ ano: ano.ano, pct: ano.pct_parado })),
  }
}

export const communityService = createCommunityService()
