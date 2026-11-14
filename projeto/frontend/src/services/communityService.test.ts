import { describe, expect, it, vi } from 'vitest'
import type { Community } from '../models/community'
import { createCommunityService, regionPoints } from './communityService'

describe('regionPoints', () => {
  const center = { lat: -18.9543, lon: -48.1993 }
  const points = regionPoints(center)

  it('3 pluviômetros nas direções das leituras: 6 km ao norte, 11 km a leste, 14 km ao sul', () => {
    const gauges = points.filter((point) => point.kind === 'gauge')

    expect(gauges).toHaveLength(3)
    expect(gauges[0].lat).toBeCloseTo(center.lat + 6 / 111, 3)
    expect(gauges[0].lon).toBeCloseTo(center.lon, 3)
    expect(gauges[1].lon).toBeGreaterThan(center.lon + 0.09)
    expect(gauges[2].lat).toBeCloseTo(center.lat - 14 / 111, 3)
  })

  it('vizinhos aproximados (plantou e parado), nunca no ponto exato da lavoura (RNF-10)', () => {
    const neighbors = points.filter((point) => point.kind !== 'gauge')

    expect(neighbors.some((point) => point.kind === 'planted')).toBe(true)
    expect(neighbors.some((point) => point.kind === 'idle')).toBe(true)
    expect(neighbors.every((point) => point.lat !== center.lat || point.lon !== center.lon)).toBe(true)
  })
})

describe('createCommunityService', () => {
  it('pega os dados da comunidade no idioma pedido', async () => {
    const community = { lugar: 'Uberlândia' } as Community
    const repository = { get: vi.fn().mockResolvedValue(community) }

    await expect(createCommunityService(repository).get('pt')).resolves.toBe(community)
    expect(repository.get).toHaveBeenCalledWith('pt')
  })
})
