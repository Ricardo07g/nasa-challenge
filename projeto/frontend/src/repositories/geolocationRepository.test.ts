import { describe, expect, it, vi } from 'vitest'
import { createGeolocationRepository } from './geolocationRepository'

describe('geolocationRepository', () => {
  it('devolve a posição atual do GPS', async () => {
    const geolocation = {
      getCurrentPosition: vi.fn((success: PositionCallback) =>
        success({ coords: { latitude: -18.9, longitude: -48.3 } } as GeolocationPosition),
      ),
    }

    const point = await createGeolocationRepository(geolocation).current()

    expect(point).toEqual({ lat: -18.9, lon: -48.3 })
  })

  it('falha quando a pessoa não deixa ou o GPS não responde', async () => {
    const geolocation = {
      getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback | null) =>
        error?.({ code: 1, message: 'negado' } as GeolocationPositionError),
      ),
    }

    await expect(createGeolocationRepository(geolocation).current()).rejects.toThrow('negado')
  })

  it('falha quando o navegador não tem GPS', async () => {
    await expect(createGeolocationRepository(undefined).current()).rejects.toThrow()
  })
})
