import { describe, expect, it, vi } from 'vitest'
import { createPilotAreaService } from './pilotAreaService'

const AREA = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }

describe('pilotAreaService (limites da área piloto, vindos da API)', () => {
  it('pede a área uma vez só na visita e guarda', async () => {
    const repository = { get: vi.fn().mockResolvedValue(AREA) }
    const service = createPilotAreaService(repository)

    await expect(service.get()).resolves.toEqual(AREA)
    await expect(service.get()).resolves.toEqual(AREA)
    expect(repository.get).toHaveBeenCalledTimes(1)
  })

  it('se a API falhar, tenta de novo na próxima vez', async () => {
    const repository = { get: vi.fn().mockRejectedValueOnce(new Error('fora do ar')).mockResolvedValue(AREA) }
    const service = createPilotAreaService(repository)

    await expect(service.get()).rejects.toThrow('fora do ar')
    await expect(service.get()).resolves.toEqual(AREA)
    expect(repository.get).toHaveBeenCalledTimes(2)
  })
})
