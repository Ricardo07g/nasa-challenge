import { describe, expect, it, vi } from 'vitest'
import { createMockRegionRepository } from './mocks/mockRepositories'
import { createHttpRegionRepository } from './regionRepository'

describe('regionRepository (região pelo satélite, P3)', () => {
  it('http chama /api/regiao com lat e lon', async () => {
    const getJson = vi.fn().mockResolvedValue({ raio_km: 30, anos: [], fonte: 'modis' })

    await createHttpRegionRepository(getJson).get({ lat: -18.9543, lon: -48.1993 }, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/regiao?lat=-18.9543&lon=-48.1993', { lang: 'pt' })
  })

  it('dados de exemplo: 30 km e a série de 2015 a 2025, cada ano somando 100%', async () => {
    const region = await createMockRegionRepository(0).get({ lat: -18.9543, lon: -48.1993 }, 'pt')

    expect(region.raio_km).toBe(30)
    expect(region.anos[0].ano).toBe(2015)
    expect(region.anos.at(-1)?.ano).toBe(2025)
    expect(region.anos.every((ano) => ano.pct_parado + ano.pct_plantou + ano.pct_incerto === 100)).toBe(true)
  })

  it('dados de exemplo no contrato: o círculo em volta do ponto pedido (distância 0)', async () => {
    const region = await createMockRegionRepository(0).get({ lat: -19.74, lon: -47.93 }, 'pt')

    expect(region.centro).toEqual({ lat: -19.74, lon: -47.93 })
    expect(region.distancia_km).toBe(0)
  })
})
