import { describe, expect, it, vi } from 'vitest'
import type { Community } from '../models/community'
import type { RegiaoSatelite } from '../models/region'
import { createCommunityService, regionPoints, regionSummary } from './communityService'

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
    const regions = { get: vi.fn() }

    await expect(createCommunityService(repository, regions).get('pt')).resolves.toBe(community)
    expect(repository.get).toHaveBeenCalledWith('pt')
  })

  it('pega a região pelo satélite no ponto da lavoura (P3)', async () => {
    const region = { raio_km: 30 } as RegiaoSatelite
    const regions = { get: vi.fn().mockResolvedValue(region) }

    await expect(createCommunityService({ get: vi.fn() }, regions).region({ lat: 1, lon: 2 }, 'en')).resolves.toBe(region)
    expect(regions.get).toHaveBeenCalledWith({ lat: 1, lon: 2 }, 'en')
  })
})

describe('regionSummary (P3)', () => {
  const region: RegiaoSatelite = {
    raio_km: 30,
    fonte: 'modis',
    anos: [
      { ano: 2023, pct_parado: 64, pct_plantou: 27, pct_incerto: 9 },
      { ano: 2024, pct_parado: 63, pct_plantou: 29, pct_incerto: 8 },
      { ano: 2025, pct_parado: 62, pct_plantou: 30, pct_incerto: 8 },
    ],
  }

  it('o último ano em destaque, a média da série e o quanto o satélite não conseguiu ver', () => {
    expect(regionSummary(region)).toEqual({
      last: { ano: 2025, pct: 62 },
      average: 63,
      uncertain: 8,
      bars: [
        { ano: 2023, pct: 64 },
        { ano: 2024, pct: 63 },
        { ano: 2025, pct: 62 },
      ],
    })
  })

  it('sem anos na série, não há o que mostrar', () => {
    expect(regionSummary({ ...region, anos: [] })).toBeNull()
  })
})
