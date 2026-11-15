import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPositionService, GPS_TIMEOUT_MS } from './positionService'

describe('positionService', () => {
  afterEach(() => vi.useRealTimers())

  it('arredonda a posição do GPS em 4 casas (cerca de 10 m, sem guardar mais que o necessário)', async () => {
    const service = createPositionService({ current: vi.fn().mockResolvedValue({ lat: -18.923456, lon: -48.281234 }) })

    expect(await service.current()).toEqual({ lat: -18.9235, lon: -48.2812 })
  })

  it('desiste depois de 10 s, mesmo com o pedido de permissão ainda aberto (o tempo do navegador não conta aí)', async () => {
    vi.useFakeTimers()
    const service = createPositionService({ current: vi.fn(() => new Promise<never>(() => {})) })

    const result = service.current()
    const failed = expect(result).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(GPS_TIMEOUT_MS - 1)
    let settled = false
    result.catch(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await failed
    expect(GPS_TIMEOUT_MS).toBe(10_000)
  })

  it('a resposta do GPS antes dos 10 s vale, e o relógio é desligado', async () => {
    vi.useFakeTimers()
    const service = createPositionService({ current: vi.fn().mockResolvedValue({ lat: -19.1, lon: -48.1 }) })

    await expect(service.current()).resolves.toEqual({ lat: -19.1, lon: -48.1 })
    expect(vi.getTimerCount()).toBe(0)
  })
})
