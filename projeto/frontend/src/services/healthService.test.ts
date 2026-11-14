import { describe, expect, it, vi } from 'vitest'
import { createHealthService } from './healthService'

describe('healthService.getApiStatus', () => {
  it('devolve "ok" quando a API responde ok', async () => {
    const service = createHealthService({ getHealth: vi.fn().mockResolvedValue({ status: 'ok' }) })

    expect(await service.getApiStatus()).toBe('ok')
  })

  it('devolve "fora do ar" quando a API responde outro status', async () => {
    const service = createHealthService({
      getHealth: vi.fn().mockResolvedValue({ status: 'degradado' }),
    })

    expect(await service.getApiStatus()).toBe('fora do ar')
  })

  it('devolve "fora do ar" quando a chamada falha', async () => {
    const service = createHealthService({
      getHealth: vi.fn().mockRejectedValue(new Error('rede')),
    })

    expect(await service.getApiStatus()).toBe('fora do ar')
  })
})
