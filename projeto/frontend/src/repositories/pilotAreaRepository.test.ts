import { describe, expect, it, vi } from 'vitest'
import { createMockPilotAreaRepository } from './mocks/mockLocation'
import { createHttpPilotAreaRepository } from './pilotAreaRepository'

describe('pilotAreaRepository (limites da área piloto, tarefa 0041)', () => {
  it('http chama /api/area-piloto (os limites só existem no backend)', async () => {
    const area = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }
    const getJson = vi.fn().mockResolvedValue(area)

    await expect(createHttpPilotAreaRepository(getJson).get()).resolves.toEqual(area)
    expect(getJson).toHaveBeenCalledWith('/api/area-piloto')
  })

  it('dados de exemplo no formato do contrato', async () => {
    const area = await createMockPilotAreaRepository(0).get()

    expect(Object.keys(area).sort()).toEqual(['max_lat', 'max_lon', 'min_lat', 'min_lon'])
  })
})
